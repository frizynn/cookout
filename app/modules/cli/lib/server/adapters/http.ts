import { Array as Arr, Effect, Option, Predicate } from "effect";
import { EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { CookoutError } from "../../../../sdk/index.ts";
import type { CookoutErrorCode } from "../../../../sdk/index.ts";
import type { Scope } from "effect";
import { proxyEnvironment } from "../../../../config/server.ts";

interface CallFailure {
  readonly code: CookoutErrorCode | "cli_error" | "unreachable";
  readonly message: string;
  readonly status?: number;
  readonly details?: unknown;
}

interface Unreachable {
  readonly url: string;
  readonly why: string;
}

const NETWORK_FAILURE = "fetch failed";
const NO_STATUS = 0;
const NOTHING = {};

function unreachableMessage({ url, why }: Unreachable): string {
  return `cannot reach ${url}: ${why} (check COOKOUT_URL, or HTTPS_PROXY if you are behind a proxy)`;
}

function nameOf(cause: unknown): string {
  if (Predicate.hasProperty(cause, "code") && Predicate.isString(cause.code)) {
    return cause.code;
  }
  if (Predicate.hasProperty(cause, "name") && Predicate.isString(cause.name)) {
    return cause.name;
  }
  return String(cause);
}

function messageOf(cause: unknown): string {
  if (Predicate.hasProperty(cause, "message") && Predicate.isString(cause.message)) {
    return cause.message;
  }
  return "";
}

function whyOf(cause: unknown): string {
  const message = messageOf(cause);
  if (message !== "") {
    return message;
  }
  if (cause instanceof AggregateError) {
    return Arr.join(Arr.map(cause.errors, whyOf), "; ");
  }
  return nameOf(cause);
}

function networkFailureCause(error: unknown): Option.Option<string> {
  if (!(error instanceof TypeError) || error.message !== NETWORK_FAILURE) {
    return Option.none();
  }
  return Option.some(whyOf(error.cause));
}

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

function toFailureAt(url: string): (error: unknown) => CallFailure {
  return (error) =>
    Option.match(networkFailureCause(error), {
      onNone: () => toFailure(error),
      onSome: (why): CallFailure => ({ code: "unreachable", message: unreachableMessage({ url, why }) }),
    });
}

const throughProxy: Effect.Effect<void, never, Scope.Scope> = Effect.gen(function* useProxy() {
  const settings = yield* Effect.orDie(proxyEnvironment);
  if (settings.httpProxy === "" && settings.httpsProxy === "") {
    return;
  }
  const direct = getGlobalDispatcher();
  const proxied = new EnvHttpProxyAgent(settings);
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      setGlobalDispatcher(proxied);
    }),
    () =>
      Effect.andThen(
        Effect.sync(() => {
          setGlobalDispatcher(direct);
        }),
        Effect.promise(() => proxied.destroy()),
      ),
  );
});

export { throughProxy, toFailure, toFailureAt, unreachableMessage };
