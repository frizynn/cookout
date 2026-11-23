import type {
  AgentSessionState,
  AgentSessionStateFailure,
  AgentSessionStateFile,
  AgentSessionStateNeeds,
} from "../agent-session-state.ts";
import type { CookoutClient, CookoutClientOptions, CookoutErrorCode } from "../../../../sdk/index.ts";
import { CookoutError, createCookoutClient } from "../../../../sdk/index.ts";
import { Effect, Option, Predicate } from "effect";
import { agentSessionExpired, agentSessionRevoked } from "../../../../agent-sessions/index.ts";
import { agentToolEnvironment, cookoutToken, cookoutUrl } from "../../../../config/server.ts";
import type { CookoutConnection } from "../../../../config/index.ts";
import { agentSessionStateFile } from "../agent-session-state.ts";
import { agentToolIn } from "../../../../config/index.ts";
import { baseUrlOf } from "../../../../http/client.ts";

type CallFailureCode = CookoutErrorCode | AgentSessionStateFailure["code"] | "usage" | "timeout" | "server_unreachable";

interface CallFailure {
  readonly code: CallFailureCode;
  readonly message: string;
  readonly status?: number;
  readonly details?: unknown;
}

interface ClientWithAgentSessionState {
  readonly client: CookoutClient;
  readonly connection: CookoutConnection;
  readonly file: AgentSessionStateFile;
  readonly saved: Option.Option<AgentSessionState>;
}

type Call<Value> = (client: CookoutClient) => Promise<Value>;

const NO_STATUS = 0;
const NOTHING = {};

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

type Sends = "agent-session" | "identity-token";

interface ClientOptionsFor {
  readonly connection: CookoutConnection;
  readonly saved: Option.Option<AgentSessionState>;
  readonly sends: Sends;
}

function clientOptions({ connection, saved, sends }: ClientOptionsFor): CookoutClientOptions {
  const withConnection = { ...connection, env: NOTHING };
  if (Option.isNone(saved) || sends === "identity-token") {
    return withConnection;
  }
  return { ...withConnection, token: saved.value.agentSessionToken };
}

function isEnded(code: CallFailureCode): boolean {
  return code === agentSessionRevoked || code === agentSessionExpired;
}

function onAgentSessionEnded({
  file,
  saved,
}: ClientWithAgentSessionState): (failure: CallFailure) => Effect.Effect<never, CallFailure> {
  return (failure) =>
    Effect.gen(function* forgetEndedAgentSession() {
      if (!isEnded(failure.code) || Option.isNone(saved)) {
        return yield* Effect.fail(failure);
      }
      yield* file.remove;
      const rejoin = `run \`cookout join --as ${saved.value.identity}\` to join again`;
      return yield* Effect.fail({
        ...failure,
        message: `${failure.message} The stored agent session token was deleted; ${rejoin}.`,
      });
    });
}

function connectionFrom(url: string, token: string, agentTool: { readonly agentTool?: string }): CookoutConnection {
  if (token === "") {
    return { url: baseUrlOf(url) };
  }
  return { ...agentTool, token, url: baseUrlOf(url) };
}

function clientFor(
  connection: CookoutConnection,
  sends: Sends,
): Effect.Effect<ClientWithAgentSessionState, CallFailure, AgentSessionStateNeeds> {
  return Effect.gen(function* openClient() {
    const file = yield* agentSessionStateFile(connection);
    const saved = yield* file.read;
    const client = yield* Effect.try({
      catch: toFailure,
      try: () => createCookoutClient(clientOptions({ connection, saved, sends })),
    });
    return { client, connection, file, saved };
  });
}

type Run<Value> = (client: ClientWithAgentSessionState) => Effect.Effect<Value, CallFailure>;

interface Sending<Value> {
  readonly run: Run<Value>;
  readonly sends: Sends;
}

function withClientSending<Value>({
  run,
  sends,
}: Sending<Value>): Effect.Effect<Value, CallFailure, AgentSessionStateNeeds> {
  return Effect.gen(function* callWithClient() {
    const url = yield* Effect.orDie(cookoutUrl);
    const token = yield* Effect.orDie(cookoutToken);
    const markers = yield* Effect.orDie(agentToolEnvironment);
    const opened = yield* clientFor(connectionFrom(url, token, agentToolIn(markers)), sends);
    return yield* run(opened).pipe(Effect.catch(onAgentSessionEnded(opened)));
  });
}

function withClient<Value>(run: Run<Value>): Effect.Effect<Value, CallFailure, AgentSessionStateNeeds> {
  return withClientSending({ run, sends: "agent-session" });
}

function withIdentityTokenClient<Value>(run: Run<Value>): Effect.Effect<Value, CallFailure, AgentSessionStateNeeds> {
  return withClientSending({ run, sends: "identity-token" });
}

function callClient<Value>(
  call: Call<Value>,
): (opened: ClientWithAgentSessionState) => Effect.Effect<Value, CallFailure> {
  return ({ client }) => Effect.tryPromise({ catch: toFailure, try: () => call(client) });
}

function callServer<Value>(call: Call<Value>): Effect.Effect<Value, CallFailure, AgentSessionStateNeeds> {
  return withClient(callClient(call));
}

export {
  type Call,
  type CallFailure,
  type ClientWithAgentSessionState,
  callClient,
  callServer,
  toFailure,
  withClient,
  withIdentityTokenClient,
};
