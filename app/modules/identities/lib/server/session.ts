import { Caller, credentialsOf, sentToken } from "./auth.ts";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { sessionCookieName, sessionPath, whoamiPath } from "../../index.ts";
import type { Cookies } from "effect/http";
import { Effect } from "effect";
import type { Identity } from "../../index.ts";
import { IdentityResponseSchema } from "./wire.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";

const FORBIDDEN = 403;

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

const loginRoute: Route<Caller> = {
  handle: () =>
    Effect.gen(function* logIn() {
      const identity = yield* Caller;
      if (identity.kind !== "human") {
        return yield* Effect.fail(humanOnly(identity));
      }
      const request = yield* HttpServerRequest.HttpServerRequest;
      const token = yield* sentToken(credentialsOf(request));
      const response = yield* identityResponse({ identity });
      return yield* HttpServerResponse.setCookie(response, sessionCookieName, token, cookieOptions);
    }),
  method: "POST",
  path: sessionPath,
};

const logoutRoute: Route<Caller> = {
  handle: () => Effect.flatMap(callerResponse, HttpServerResponse.expireCookie(sessionCookieName, cookieOptions)),
  method: "DELETE",
  path: sessionPath,
};

export const callerRoutes: readonly Route<Caller>[] = [whoamiRoute, loginRoute, logoutRoute];
