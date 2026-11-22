import { Effect } from "effect";
import { HttpServerRequest, type HttpServerResponse } from "effect/http";
import type { HttpMethod } from "../../client.ts";
import type { Refusal } from "../../index.ts";
import { methodNotAllowed, notFound } from "./refusals.ts";

export type Params = Readonly<Record<string, string>>;

export type Route<R> = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly handle: (
    params: Params,
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse, unknown, R | HttpServerRequest.HttpServerRequest>;
};

const invalidPath = (path: string): Refusal => ({
  status: 400,
  code: "invalid_path",
  message: `The path ${path} is not valid percent-encoding.`,
});

const segmentMatches = (pattern: string, segment: string | undefined) =>
  segment !== undefined && segment !== "" && (pattern.startsWith(":") || pattern === segment);

const matches = (pattern: string, path: string) => {
  const patternSegments = pattern.split("/");
  const segments = path.split("/");
  return (
    patternSegments.length === segments.length &&
    patternSegments.every((p, i) => (p === "" ? segments[i] === "" : segmentMatches(p, segments[i])))
  );
};

const decodeParams = (pattern: string, path: string): Effect.Effect<Params, Refusal> =>
  Effect.try({
    try: () => {
      const segments = path.split("/");
      const entries = pattern
        .split("/")
        .flatMap(
          (p, i): Array<[string, string]> =>
            p.startsWith(":") ? [[p.slice(1), decodeURIComponent(segments[i] ?? "")]] : [],
        );
      const params: Params = Object.fromEntries(entries);
      return params;
    },
    catch: () => invalidPath(path),
  });

const pick = <R>(routes: ReadonlyArray<Route<R>>, method: string, path: string): Effect.Effect<Route<R>, Refusal> => {
  const onPath = routes.filter((route) => matches(route.path, path));
  const route = onPath.find((candidate) => candidate.method === method);
  if (route !== undefined) return Effect.succeed(route);
  return Effect.fail(onPath.length === 0 ? notFound(method, path) : methodNotAllowed(method, path));
};

export const dispatch = <R>(routes: ReadonlyArray<Route<R>>) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const path = request.url.split("?")[0] ?? "/";
    const route = yield* pick(routes, request.method, path);
    const params = yield* decodeParams(route.path, path);
    return yield* route.handle(params);
  });
