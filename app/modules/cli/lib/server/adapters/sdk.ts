import type { CookoutClient, CookoutClientOptions, CookoutErrorCode } from "../../../../sdk/index.ts";
import { CookoutError, createCookoutClient } from "../../../../sdk/index.ts";
import { Effect, Option, Predicate } from "effect";
import type { LeaseState, LeaseStateFailure, LeaseStateFile, LeaseStateNeeds } from "../lease-state.ts";
import { agentToolEnvironment, cookoutToken, cookoutUrl } from "../../../../config/server.ts";
import type { CookoutConnection } from "../../../../config/index.ts";
import type { LoginFailure } from "../logins.ts";
import { agentToolIn } from "../../../../config/index.ts";
import { baseUrlOf } from "../../../../http/client.ts";
import { leaseLost } from "../../../../leases/index.ts";
import { leaseStateFile } from "../lease-state.ts";
import { loginFor } from "../logins.ts";

type CallFailureCode =
  | CookoutErrorCode
  | LeaseStateFailure["code"]
  | LoginFailure["code"]
  | "usage"
  | "timeout"
  | "server_unreachable";

interface CallFailure {
  readonly code: CallFailureCode;
  readonly message: string;
  readonly status?: number;
  readonly details?: unknown;
}

type CredentialSource = "COOKOUT_TOKEN" | "login" | "none";

interface Credential {
  readonly source: CredentialSource;
  readonly token: string;
}

interface ClientWithLeaseState {
  readonly client: CookoutClient;
  readonly connection: CookoutConnection;
  readonly file: LeaseStateFile;
  readonly saved: Option.Option<LeaseState>;
  readonly source: CredentialSource;
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

function clientOptions(connection: CookoutConnection, saved: Option.Option<LeaseState>): CookoutClientOptions {
  const withConnection = { ...connection, env: NOTHING };
  if (Option.isNone(saved)) {
    return withConnection;
  }
  return { ...withConnection, leaseId: saved.value.leaseId };
}

function onLeaseLost({
  file,
  saved,
}: ClientWithLeaseState): (failure: CallFailure) => Effect.Effect<never, CallFailure> {
  return (failure) =>
    Effect.gen(function* forgetLostLease() {
      if (failure.code !== leaseLost || Option.isNone(saved)) {
        return yield* Effect.fail(failure);
      }
      yield* file.remove;
      const rejoin = `run \`cookout join --as ${saved.value.identity}\` to take it again`;
      return yield* Effect.fail({ ...failure, message: `${failure.message} The stored lease was deleted; ${rejoin}.` });
    });
}

function connectionFrom(url: string, token: string, agentTool: { readonly agentTool?: string }): CookoutConnection {
  if (token === "") {
    return { url: baseUrlOf(url) };
  }
  return { ...agentTool, token, url: baseUrlOf(url) };
}

const NO_CREDENTIAL: Credential = { source: "none", token: "" };

function credentialFor(
  url: string,
  token: string,
  markers: Readonly<Record<string, string>>,
): Effect.Effect<Credential, CallFailure, LeaseStateNeeds> {
  if (token !== "") {
    return Effect.succeed({ source: "COOKOUT_TOKEN", token });
  }
  const { agentTool } = agentToolIn({ ...markers, COOKOUT_ALLOW_HUMAN: "" });
  if (Predicate.isNotUndefined(agentTool) || url === "") {
    return Effect.succeed(NO_CREDENTIAL);
  }
  return Effect.map(
    loginFor(baseUrlOf(url)),
    Option.match({ onNone: () => NO_CREDENTIAL, onSome: (login) => ({ source: "login", token: login }) }),
  );
}

function clientFor(
  connection: CookoutConnection,
  source: CredentialSource,
): Effect.Effect<ClientWithLeaseState, CallFailure, LeaseStateNeeds> {
  return Effect.gen(function* openClient() {
    const file = yield* leaseStateFile(connection);
    const saved = yield* file.read;
    const client = yield* Effect.try({
      catch: toFailure,
      try: () => createCookoutClient(clientOptions(connection, saved)),
    });
    return { client, connection, file, saved, source };
  });
}

function withClient<Value>(
  run: (client: ClientWithLeaseState) => Effect.Effect<Value, CallFailure>,
): Effect.Effect<Value, CallFailure, LeaseStateNeeds> {
  return Effect.gen(function* callWithClient() {
    const url = yield* Effect.orDie(cookoutUrl);
    const token = yield* Effect.orDie(cookoutToken);
    const markers = yield* Effect.orDie(agentToolEnvironment);
    const credential = yield* credentialFor(url, token, markers);
    const opened = yield* clientFor(connectionFrom(url, credential.token, agentToolIn(markers)), credential.source);
    return yield* run(opened).pipe(Effect.catch(onLeaseLost(opened)));
  });
}

function callClient<Value>(call: Call<Value>): (opened: ClientWithLeaseState) => Effect.Effect<Value, CallFailure> {
  return ({ client }) => Effect.tryPromise({ catch: toFailure, try: () => call(client) });
}

function callServer<Value>(call: Call<Value>): Effect.Effect<Value, CallFailure, LeaseStateNeeds> {
  return withClient(callClient(call));
}

export {
  type Call,
  type CallFailure,
  type ClientWithLeaseState,
  type CredentialSource,
  callClient,
  callServer,
  toFailure,
  withClient,
};
