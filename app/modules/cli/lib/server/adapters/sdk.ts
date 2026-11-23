import type {
  AgentSessionState,
  AgentSessionStateFailure,
  AgentSessionStateFile,
  AgentSessionStateNeeds,
} from "../agent-session-state.ts";
import type { CookoutClient, CookoutErrorCode } from "../../../../sdk/index.ts";
import type { CookoutConnection, HarnessSession } from "../../../../config/index.ts";
import { Effect, Option, Predicate } from "effect";
import { agentSessionExpired, agentSessionRevoked } from "../../../../agent-sessions/index.ts";
import { boardUrlOrEmpty, loginFor } from "../logins.ts";
import { cookoutSession, cookoutToken, harnessEnvironment } from "../../../../config/server.ts";
import { harnessIn, harnessSessionIn } from "../../../../config/index.ts";
import { throughProxy, toFailure, toFailureAt } from "./http.ts";
import type { LoginFailure } from "../logins.ts";
import { agentSessionStateFile } from "../agent-session-state.ts";
import { baseUrlOf } from "../../../../http/client.ts";
import { createCookoutClient } from "../../../../sdk/index.ts";

type CallFailureCode =
  | CookoutErrorCode
  | AgentSessionStateFailure["code"]
  | LoginFailure["code"]
  | "harness_missing"
  | "harness_session_missing"
  | "already_joined"
  | "login_missing"
  | "agent_join_request_expired"
  | "not_joined"
  | "usage"
  | "login_request_expired"
  | "not_a_cookout"
  | "timeout"
  | "unreachable"
  | "server_unreachable";

interface CallFailure {
  readonly code: CallFailureCode;
  readonly message: string;
  readonly status?: number;
  readonly details?: unknown;
}

type CredentialSource =
  | "COOKOUT_TOKEN"
  | "COOKOUT_SESSION"
  | "agent session token"
  | "agent-join-request"
  | "join-code"
  | "login"
  | "none";

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

const NOTHING = {};

const notJoined: CallFailure = {
  code: "not_joined",
  message: "join as an agent first: cookout join --as <name>",
};

const loginMissing: CallFailure = {
  code: "login_missing",
  message: "log in first: cookout login",
};

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
  Effect.all({ markers: harnessEnvironment, session: cookoutSession, token: cookoutToken }, { concurrency: 1 }),
);

const cliEnvironment = Effect.zipWith(boardUrlOrEmpty, variables, (url, found): CliEnvironment => ({ ...found, url }));

function connectionFrom(url: string, token: string, harness: { readonly harness?: string }): CookoutConnection {
  if (token === "") {
    return { url: baseUrlOf(url) };
  }
  return { ...harness, token, url: baseUrlOf(url) };
}

const NO_CREDENTIAL: Credential = { joined: Option.none(), source: "none", token: "" };

function given(source: CredentialSource, token: string): Credential {
  return { joined: Option.none(), source, token };
}

function joinedSessionFile(
  { harness = "", sessionId }: HarnessSession,
  url: string,
): Effect.Effect<Option.Option<AgentSessionStateFile>, never, AgentSessionStateNeeds> {
  if (harness === "" || Predicate.isUndefined(sessionId)) {
    return Effect.succeedNone;
  }
  return Effect.asSome(agentSessionStateFile({ harness, sessionId, url: baseUrlOf(url) }));
}

type Found<Value = Credential> = Effect.Effect<Value, CallFailure, AgentSessionStateNeeds>;

function joinedCredential(place: HarnessSession, url: string): Found<Option.Option<Credential>> {
  return Effect.gen(function* findJoinedSession() {
    const file = yield* joinedSessionFile(place, url);
    if (Option.isNone(file)) {
      return Option.none();
    }
    const saved = yield* file.value.read;
    return Option.map(saved, (state) => ({
      joined: Option.some({ file: file.value, state }),
      source: "agent session token" as const,
      token: state.agentSessionToken,
    }));
  });
}

function loginCredential(url: string): Found {
  return Effect.map(
    loginFor(baseUrlOf(url)),
    Option.match({ onNone: () => NO_CREDENTIAL, onSome: (login) => given("login", login) }),
  );
}

function tokenOr(env: CliEnvironment, otherwise: () => Found): Found {
  if (env.token !== "") {
    return Effect.succeed(given("COOKOUT_TOKEN", env.token));
  }
  return otherwise();
}

function sessionOr(env: CliEnvironment, otherwise: () => Found): Found {
  if (env.session !== "") {
    return Effect.succeed(given("COOKOUT_SESSION", env.session));
  }
  return otherwise();
}

function joinedOrToken(env: CliEnvironment, place: HarnessSession): Found {
  if (env.url === "") {
    return tokenOr(env, () => Effect.succeed(NO_CREDENTIAL));
  }
  return Effect.flatMap(
    joinedCredential(place, env.url),
    Option.match({ onNone: () => tokenOr(env, () => Effect.fail(notJoined)), onSome: Effect.succeed }),
  );
}

function variablesOr(env: CliEnvironment, stored: (url: string) => Found): Found {
  if (env.url === "") {
    return tokenOr(env, () => sessionOr(env, () => Effect.succeed(NO_CREDENTIAL)));
  }
  return tokenOr(env, () => sessionOr(env, () => stored(env.url)));
}

function credentialFor(env: CliEnvironment): Found {
  const place = harnessSessionIn(env.markers);
  if (Predicate.isUndefined(place.harness)) {
    return variablesOr(env, loginCredential);
  }
  return sessionOr(env, () => joinedOrToken(env, place));
}

function clientFor(
  env: CliEnvironment,
  { joined, source, token }: Credential,
): Effect.Effect<ClientWithAgentSessionState, CallFailure> {
  const connection = connectionFrom(env.url, token, harnessIn(env.markers));
  return Effect.map(
    Effect.try({ catch: toFailure, try: () => createCookoutClient({ ...connection, env: NOTHING }) }),
    (client) => ({ client, connection, joined, source }),
  );
}

type Run<Value> = (client: ClientWithAgentSessionState) => Effect.Effect<Value, CallFailure>;

function runWith<Value>(env: CliEnvironment, credential: Credential, run: Run<Value>): Found<Value> {
  return Effect.scoped(
    Effect.gen(function* runWithClient() {
      yield* throughProxy;
      const opened = yield* clientFor(env, credential);
      return yield* run(opened).pipe(Effect.catch(onAgentSessionEnded(opened)));
    }),
  );
}

function withClient<Value>(run: Run<Value>): Found<Value> {
  return Effect.gen(function* callWithClient() {
    const env = yield* cliEnvironment;
    const credential = yield* credentialFor(env);
    return yield* runWith(env, credential, run);
  });
}

function joinCredentialFor(env: CliEnvironment): Found {
  return variablesOr(env, (url) =>
    Effect.filterOrFail(
      loginCredential(url),
      ({ source }) => source === "login",
      () => loginMissing,
    ),
  );
}

function withJoinClient<Value>(run: Run<Value>): Found<Value> {
  return Effect.gen(function* callWithJoinCredential() {
    const env = yield* cliEnvironment;
    const credential = yield* joinCredentialFor(env);
    return yield* runWith(env, credential, run);
  });
}

function callClient<Value>(
  call: Call<Value>,
): (opened: ClientWithAgentSessionState) => Effect.Effect<Value, CallFailure> {
  return ({ client, connection }) => Effect.tryPromise({ catch: toFailureAt(connection.url), try: () => call(client) });
}

function callServer<Value>(call: Call<Value>): Found<Value> {
  return withClient(callClient(call));
}

interface JoinPlace {
  readonly file: Option.Option<AgentSessionStateFile>;
  readonly place: HarnessSession;
  readonly url: string;
}

const joinPlace: Effect.Effect<JoinPlace, CallFailure, AgentSessionStateNeeds> = Effect.gen(function* findJoinPlace() {
  const env = yield* cliEnvironment;
  const place = harnessSessionIn(env.markers);
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
  withClient,
  withJoinClient,
};
export { toFailure } from "./http.ts";
