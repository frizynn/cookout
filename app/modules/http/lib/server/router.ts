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

export type Gate<Provides, Needs, Fails = unknown> = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
) => Effect.Effect<A, E | Fails, Exclude<R, Provides> | Needs>;

type Target = { readonly method: string; readonly path: string };

const answer = <R>(onPath: ReadonlyArray<Route<R>>, target: Target, params: Params) => {
  const route = onPath.find((candidate) => candidate.method === target.method);
  return route === undefined ? Effect.fail(methodNotAllowed(target.method, target.path)) : route.handle(params);
};

const paramsOf = <R>(onPath: ReadonlyArray<Route<R>>, target: Target) =>
  decodeParams(onPath[0]?.path ?? target.path, target.path);

const onPathOf = <R>(routes: ReadonlyArray<Route<R>>, path: string) =>
  routes.filter((route) => matches(route.path, path));

export const dispatch = <Open, R, Provides, Needs, Fails>(
  open: ReadonlyArray<Route<Open>>,
  gated: ReadonlyArray<Route<R>>,
  gate: Gate<Provides, Needs, Fails>,
) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const target = { method: request.method, path: request.url.split("?")[0] ?? "/" };
    const openOnPath = onPathOf(open, target.path);
    if (openOnPath.length > 0) return yield* answer(openOnPath, target, yield* paramsOf(openOnPath, target));
    const gatedOnPath = onPathOf(gated, target.path);
    if (gatedOnPath.length === 0) return yield* Effect.fail(notFound(target.method, target.path));
    const params = yield* paramsOf(gatedOnPath, target);
    return yield* gate(answer(gatedOnPath, target, params));
  });
