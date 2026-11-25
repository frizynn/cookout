import { Caller, issueToken } from "./auth.ts";
import { DateTime, Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { sessionCookieName, sessionPath, token, whoamiPath } from "../../index.ts";
import type { Cookies } from "effect/http";
import type { Identity } from "../../index.ts";
import { IdentityResponseSchema } from "./wire.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import { isoTimeOf } from "../../../time/server.ts";

const FORBIDDEN = 403;

const WEB_UI_HOST = "web UI";

const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "strict",
} as const satisfies NonNullable<Cookies.Cookie["options"]>;

function humanOnly({ kind, name }: Identity): Refusal {
  return {
    code: "human_only",
    details: { kind },
    message: `Only a human identity can log in to the web UI, and ${name} is an ${kind}.`,
    status: FORBIDDEN,
  };
}

const identityResponse = HttpServerResponse.schemaJson(IdentityResponseSchema);

const callerResponse = Effect.gen(function* answerWithCaller() {
  const identity = yield* Caller;
  return yield* identityResponse({ identity });
});

const whoamiRoute: Route<Caller> = {
  handle: () => callerResponse,
  method: "GET",
  path: whoamiPath,
};

const loginRoute: Route<Caller | Storage | Secrets> = {
  handle: () =>
    Effect.gen(function* logIn() {
      const identity = yield* Caller;
      if (identity.kind !== "human") {
        return yield* Effect.fail(humanOnly(identity));
      }
      const storage = yield* Storage;
      const issued = yield* issueToken;
      const now = yield* DateTime.now;
      yield* storage.issueLoginCredential({
        credentialHash: issued.hash,
        host: WEB_UI_HOST,
        identity: identity.name,
        now: isoTimeOf(now),
      });
      const response = yield* identityResponse({ identity });
      return yield* HttpServerResponse.setCookie(response, sessionCookieName, issued.token, cookieOptions);
    }),
  method: "POST",
  path: sessionPath,
};

const revokeSessionCookie = Effect.gen(function* revokeSessionCookie() {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const sent = Option.fromUndefinedOr(request.cookies[sessionCookieName]).pipe(Option.filter((value) => value !== ""));
  if (Option.isSome(sent)) {
    const secrets = yield* Secrets;
    const storage = yield* Storage;
    const hash = yield* secrets.hashToken(token(sent.value));
    yield* storage.revokeLoginCredential(hash);
  }
});

const logoutRoute: Route<Caller | Storage | Secrets> = {
  handle: () =>
    Effect.gen(function* logOut() {
      yield* revokeSessionCookie;
      const response = yield* callerResponse;
      return yield* HttpServerResponse.expireCookie(response, sessionCookieName, cookieOptions);
    }),
  method: "DELETE",
  path: sessionPath,
};

export const callerRoutes: readonly Route<Caller | Storage | Secrets>[] = [whoamiRoute, loginRoute, logoutRoute];
