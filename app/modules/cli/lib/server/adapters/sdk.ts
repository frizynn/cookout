import { Effect } from "effect";
import { type CookoutClient, CookoutError, createCookoutClient } from "../../../../sdk/index.ts";
import { cookoutToken, cookoutUrl } from "../../../../config/server.ts";

type CallFailure = {
  readonly code: string;
  readonly message: string;
  readonly status?: number;
  readonly details?: unknown;
};

const toFailure = (error: unknown): CallFailure => {
  if (!(error instanceof CookoutError)) {
    return { code: "cli_error", message: error instanceof Error ? error.message : String(error) };
  }
  const { code, message, status, details } = error;
  return { code, message, ...(status === 0 ? {} : { status }), ...(details === undefined ? {} : { details }) };
};

const connect = (url: string, token: string): CookoutClient =>
  createCookoutClient({ url, ...(token === "" ? {} : { token }), env: {} });

export const callServer = <A>(call: (client: CookoutClient) => Promise<A>) =>
  Effect.gen(function* () {
    const url = (yield* Effect.orDie(cookoutUrl)).replace(/\/+$/u, "");
    const token = yield* Effect.orDie(cookoutToken);
    return yield* Effect.tryPromise({ try: () => call(connect(url, token)), catch: toFailure });
  });
