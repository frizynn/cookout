import type { CookoutClient, CookoutClientOptions, CookoutErrorCode } from "../../../../sdk/index.ts";
import { CookoutError, createCookoutClient } from "../../../../sdk/index.ts";
import { Effect, Option, Predicate } from "effect";
import type { LeaseState, LeaseStateFailure, LeaseStateFile, LeaseStateNeeds } from "../lease-state.ts";
import { cookoutToken, cookoutUrl } from "../../../../config/server.ts";
import { baseUrlOf } from "../../../../http/client.ts";
import { leaseLost } from "../../../../leases/index.ts";
import { leaseStateFile } from "../lease-state.ts";

type CallFailureCode = CookoutErrorCode | LeaseStateFailure["code"] | "usage";

interface CallFailure {
  readonly code: CallFailureCode;
  readonly message: string;
  readonly status?: number;
  readonly details?: unknown;
}

interface Session {
  readonly client: CookoutClient;
  readonly url: string;
  readonly file: LeaseStateFile;
  readonly saved: Option.Option<LeaseState>;
}

interface Connection {
  readonly url: string;
  readonly token: string;
}

type Call<Value> = (client: CookoutClient) => Promise<Value>;

const NO_STATUS = 0;

function toFailure(error: unknown): CallFailure {
  if (!(error instanceof CookoutError)) {
    return { code: "cli_error", message: error instanceof Error ? error.message : String(error) };
  }
  const { code, details, message, status } = error;
  const withStatus = { code, message, ...(status === NO_STATUS ? {} : { status }) };
  if (Predicate.isUndefined(details)) {
    return withStatus;
  }
  return { ...withStatus, details };
}

function clientOptions({ token, url }: Connection, saved: Option.Option<LeaseState>): CookoutClientOptions {
  const withToken = { env: {}, url, ...(token === "" ? {} : { token }) };
  if (Option.isNone(saved)) {
    return withToken;
  }
  return { ...withToken, leaseId: saved.value.leaseId };
}

function onLeaseLost({ file, saved }: Pick<Session, "file" | "saved">) {
  return (failure: CallFailure): Effect.Effect<never, CallFailure> =>
    Effect.gen(function* forgetLostLease() {
      if (failure.code !== leaseLost || Option.isNone(saved)) {
        return yield* Effect.fail(failure);
      }
      yield* file.remove;
      const rejoin = `run \`cookout join --as ${saved.value.identity}\` to take it again`;
      return yield* Effect.fail({ ...failure, message: `${failure.message} The stored lease was deleted; ${rejoin}.` });
    });
}

function sessionFor(connection: Connection): Effect.Effect<Session, CallFailure, LeaseStateNeeds> {
  return Effect.gen(function* openSession() {
    const file = yield* leaseStateFile(connection);
    const saved = yield* file.read;
    const client = yield* Effect.try({
      catch: toFailure,
      try: () => createCookoutClient(clientOptions(connection, saved)),
    });
    return { client, file, saved, url: connection.url };
  });
}

function withSession<Value>(
  run: (session: Session) => Effect.Effect<Value, CallFailure>,
): Effect.Effect<Value, CallFailure, LeaseStateNeeds> {
  return Effect.gen(function* callWithSession() {
    const setUrl = yield* Effect.orDie(cookoutUrl);
    const token = yield* Effect.orDie(cookoutToken);
    const session = yield* sessionFor({ token, url: baseUrlOf(setUrl) });
    return yield* run(session).pipe(Effect.catch(onLeaseLost(session)));
  });
}

function callClient<Value>(call: Call<Value>): (session: Session) => Effect.Effect<Value, CallFailure> {
  return (session) => Effect.tryPromise({ catch: toFailure, try: () => call(session.client) });
}

function callServer<Value>(call: Call<Value>): Effect.Effect<Value, CallFailure, LeaseStateNeeds> {
  return withSession(callClient(call));
}

export { type CallFailure, type Session, callClient, callServer, withSession };
