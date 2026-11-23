import type {
  AgentSessionState,
  AgentSessionStateFailure,
  AgentSessionStateFile,
  AgentSessionStateNeeds,
} from "../agent-session-state.ts";
import type { AgentToolSession, CookoutConnection } from "../../../../config/index.ts";
import type { CookoutClient, CookoutErrorCode } from "../../../../sdk/index.ts";
import { CookoutError, createCookoutClient } from "../../../../sdk/index.ts";
import { Effect, Option, Predicate } from "effect";
import { agentSessionExpired, agentSessionRevoked } from "../../../../agent-sessions/index.ts";
import { agentToolEnvironment, cookoutSession, cookoutToken } from "../../../../config/server.ts";
import { agentToolIn, agentToolSessionIn } from "../../../../config/index.ts";
import { boardUrl, loginFor } from "../logins.ts";
import type { LoginFailure } from "../logins.ts";
import { agentSessionStateFile } from "../agent-session-state.ts";
import { baseUrlOf } from "../../../../http/client.ts";

type CallFailureCode =
  | CookoutErrorCode
  | AgentSessionStateFailure["code"]
  | LoginFailure["code"]
  | "agent_tool_missing"
  | "agent_tool_session_missing"
  | "already_joined"
  | "not_joined"
  | "usage"
  | "login_request_expired"
  | "not_a_cookout"
  | "timeout"
  | "server_unreachable";

interface CallFailure {
  readonly code: CallFailureCode;
  readonly message: string;
  readonly status?: number;
  readonly details?: unknown;
}

type CredentialSource = "COOKOUT_TOKEN" | "COOKOUT_SESSION" | "agent session token" | "login" | "none";

interface JoinedSession {
  readonly file: AgentSessionStateFile;
  readonly state: AgentSessionState;
}

interface Credential {
  readonly joined: Option.Option<JoinedSession>;
  readonly source: CredentialSource;
  readonly token: string;
}

interface ClientWithAgentSessionState {
  readonly client: CookoutClient;
  readonly connection: CookoutConnection;
  readonly joined: Option.Option<JoinedSession>;
  readonly source: CredentialSource;
}

interface CliEnvironment {
  readonly markers: Readonly<Record<string, string>>;
  readonly session: string;
  readonly token: string;
  readonly url: string;
}

type Call<Value> = (client: CookoutClient) => Promise<Value>;

const NO_STATUS = 0;
const NOTHING = {};

const notJoined: CallFailure = {
  code: "not_joined",
  message: "join as an agent first: cookout join --as <name>",
};

function statusOf(status: number): { readonly status?: number } {
  if (status === NO_STATUS) {
    return NOTHING;
  }
  return { status };
}

function toFailure(error: unknown): CallFailure {
  if (!(error instanceof CookoutError)) {
    return { code: "cli_error", message: String(error) };
  }
  const { code, details, message, status } = error;
  const withStatus = { code, message, ...statusOf(status) };
  if (Predicate.isUndefined(details)) {
    return withStatus;
  }
  return { ...withStatus, details };
}

function isEnded(code: CallFailureCode): boolean {
  return code === agentSessionRevoked || code === agentSessionExpired;
}

function onAgentSessionEnded({
  joined,
}: ClientWithAgentSessionState): (failure: CallFailure) => Effect.Effect<never, CallFailure> {
  return (failure) =>
    Effect.gen(function* forgetEndedAgentSession() {
      if (!isEnded(failure.code) || Option.isNone(joined)) {
        return yield* Effect.fail(failure);
      }
      yield* joined.value.file.remove;
      const rejoin = `run \`cookout join --as ${joined.value.state.identity}\` to join again`;
      return yield* Effect.fail({
        ...failure,
        message: `${failure.message} The stored agent session token was deleted; ${rejoin}.`,
      });
    });
}

const variables = Effect.orDie(
  Effect.all({ markers: agentToolEnvironment, session: cookoutSession, token: cookoutToken }, { concurrency: 1 }),
);

const cliEnvironment: Effect.Effect<CliEnvironment, CallFailure, AgentSessionStateNeeds> = Effect.all(
  {
    url: Effect.map(
      boardUrl,
      Option.getOrElse(() => ""),
    ),
    variables,
  },
  { concurrency: 1 },
).pipe(Effect.map(({ url, variables: found }) => ({ ...found, url })));

function connectionFrom(url: string, token: string, agentTool: { readonly agentTool?: string }): CookoutConnection {
  if (token === "") {
    return { url: baseUrlOf(url) };
  }
  return { ...agentTool, token, url: baseUrlOf(url) };
}

const NO_CREDENTIAL: Credential = { joined: Option.none(), source: "none", token: "" };

function given(source: CredentialSource, token: string): Credential {
  return { joined: Option.none(), source, token };
}

function joinedSessionFile(
  { agentTool = "", sessionId }: AgentToolSession,
  url: string,
): Effect.Effect<Option.Option<AgentSessionStateFile>, never, AgentSessionStateNeeds> {
  if (agentTool === "" || Predicate.isUndefined(sessionId)) {
    return Effect.succeedNone;
  }
  return Effect.asSome(agentSessionStateFile({ agentTool, sessionId, url: baseUrlOf(url) }));
}

function joinedCredential(
  place: AgentToolSession,
  url: string,
): Effect.Effect<Credential, CallFailure, AgentSessionStateNeeds> {
  return Effect.gen(function* findJoinedSession() {
    const file = yield* joinedSessionFile(place, url);
    if (Option.isNone(file)) {
      return yield* Effect.fail(notJoined);
    }
    const saved = yield* file.value.read;
    if (Option.isNone(saved)) {
      return yield* Effect.fail(notJoined);
    }
    const joined = { file: file.value, state: saved.value };
    return {
      joined: Option.some(joined),
      source: "agent session token" as const,
      token: saved.value.agentSessionToken,
    };
  });
}

function loginCredential(url: string): Effect.Effect<Credential, CallFailure, AgentSessionStateNeeds> {
  return Effect.map(
    loginFor(baseUrlOf(url)),
    Option.match({ onNone: () => NO_CREDENTIAL, onSome: (login) => given("login", login) }),
  );
}

function storedCredential({
  markers,
  url,
}: CliEnvironment): Effect.Effect<Credential, CallFailure, AgentSessionStateNeeds> {
  const place = agentToolSessionIn(markers);
  if (url === "") {
    return Effect.succeed(NO_CREDENTIAL);
  }
  if (Predicate.isNotUndefined(place.agentTool)) {
    return joinedCredential(place, url);
  }
  return loginCredential(url);
}

function credentialFor(env: CliEnvironment): Effect.Effect<Credential, CallFailure, AgentSessionStateNeeds> {
  if (env.token !== "") {
    return Effect.succeed(given("COOKOUT_TOKEN", env.token));
  }
  if (env.session !== "") {
    return Effect.succeed(given("COOKOUT_SESSION", env.session));
  }
  return storedCredential(env);
}

function clientFor(
  env: CliEnvironment,
  { joined, source, token }: Credential,
): Effect.Effect<ClientWithAgentSessionState, CallFailure> {
  const connection = connectionFrom(env.url, token, agentToolIn(env.markers));
  return Effect.map(
    Effect.try({ catch: toFailure, try: () => createCookoutClient({ ...connection, env: NOTHING }) }),
    (client) => ({ client, connection, joined, source }),
  );
}

type Run<Value> = (client: ClientWithAgentSessionState) => Effect.Effect<Value, CallFailure>;

function runWith<Value>(
  env: CliEnvironment,
  credential: Credential,
  run: Run<Value>,
): Effect.Effect<Value, CallFailure, AgentSessionStateNeeds> {
  return Effect.gen(function* runWithClient() {
    const opened = yield* clientFor(env, credential);
    return yield* run(opened).pipe(Effect.catch(onAgentSessionEnded(opened)));
  });
}

function withClient<Value>(run: Run<Value>): Effect.Effect<Value, CallFailure, AgentSessionStateNeeds> {
  return Effect.gen(function* callWithClient() {
    const env = yield* cliEnvironment;
    const credential = yield* credentialFor(env);
    return yield* runWith(env, credential, run);
  });
}

function withIdentityTokenClient<Value>(run: Run<Value>): Effect.Effect<Value, CallFailure, AgentSessionStateNeeds> {
  return Effect.flatMap(cliEnvironment, (env) => runWith(env, given("COOKOUT_TOKEN", env.token), run));
}

function callClient<Value>(
  call: Call<Value>,
): (opened: ClientWithAgentSessionState) => Effect.Effect<Value, CallFailure> {
  return ({ client }) => Effect.tryPromise({ catch: toFailure, try: () => call(client) });
}

function callServer<Value>(call: Call<Value>): Effect.Effect<Value, CallFailure, AgentSessionStateNeeds> {
  return withClient(callClient(call));
}

interface JoinPlace {
  readonly file: Option.Option<AgentSessionStateFile>;
  readonly place: AgentToolSession;
  readonly url: string;
}

const joinPlace: Effect.Effect<JoinPlace, CallFailure, AgentSessionStateNeeds> = Effect.gen(function* findJoinPlace() {
  const env = yield* cliEnvironment;
  const place = agentToolSessionIn(env.markers);
  const file = yield* joinedSessionFile(place, env.url);
  return { file, place, url: baseUrlOf(env.url) };
});

export {
  type Call,
  type CallFailure,
  type ClientWithAgentSessionState,
  type CredentialSource,
  type JoinPlace,
  callClient,
  callServer,
  joinPlace,
  toFailure,
  withClient,
  withIdentityTokenClient,
};
