import { Array as Arr, Effect, Option, Record, String as Str, pipe } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/http";
import { methodNotAllowed, notFound } from "./refusals.ts";
import type { HttpMethod } from "../../client.ts";
import type { Refusal } from "../../index.ts";
import { HttpServerRequest as Request } from "effect/http";
import { echoed } from "../../index.ts";

type Params = Readonly<Record<string, string>>;

type SegmentPair = readonly [string, string];

type Handled<Needs> = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  unknown,
  Needs | HttpServerRequest.HttpServerRequest
>;

interface Route<Needs> {
  readonly handle: (params: Params) => Handled<Needs>;
  readonly method: HttpMethod;
  readonly path: string;
  readonly segments?: Readonly<Record<string, (segment: string) => boolean>>;
}

type Segments = NonNullable<Route<unknown>["segments"]>;

type Gate<Provides, Needs, Fails = unknown> = <Value, Failure, Requires>(
  effect: Effect.Effect<Value, Failure, Requires>,
) => Effect.Effect<Value, Failure | Fails, Exclude<Requires, Provides> | Needs>;

interface Target {
  readonly method: string;
  readonly path: string;
}

interface Routes<Open, Gated, Provides, Needs, Fails> {
  readonly gate: Gate<Provides, Needs, Fails>;
  readonly gated: readonly Route<Gated>[];
  readonly open: readonly Route<Open>[];
}

const BAD_REQUEST = 400;
const PARAM = ":";
const PARAM_NAME_START = 1;
const SEPARATOR = "/";

function invalidPath(path: string): Refusal {
  return {
    code: "invalid_path",
    message: `The path ${echoed(path)} is not valid percent-encoding.`,
    status: BAD_REQUEST,
  };
}

function isParam(pattern: string): boolean {
  return Str.startsWith(PARAM)(pattern);
}

function paramName(pattern: string): string {
  return Str.slice(PARAM_NAME_START)(pattern);
}

function paramMatches(pattern: string, segment: string, segments: Segments): boolean {
  const rule = Option.fromNullishOr(segments[paramName(pattern)]);
  return Option.match(rule, { onNone: () => true, onSome: (matchesRule) => matchesRule(segment) });
}

function segmentMatches(pattern: string, segment: string, segments: Segments): boolean {
  if (isParam(pattern)) {
    return segment !== "" && paramMatches(pattern, segment, segments);
  }
  return pattern === segment;
}

function segmentPairs(pattern: string, path: string): readonly SegmentPair[] {
  return Arr.zip(Str.split(SEPARATOR)(pattern), Str.split(SEPARATOR)(path));
}

function matches<Needs>({ path: pattern, segments = {} }: Route<Needs>, path: string): boolean {
  if (Str.split(SEPARATOR)(pattern).length !== Str.split(SEPARATOR)(path).length) {
    return false;
  }
  return Arr.every(segmentPairs(pattern, path), ([expected, actual]: SegmentPair) =>
    segmentMatches(expected, actual, segments),
  );
}

function decodedParam([expected, actual]: SegmentPair): SegmentPair {
  return [paramName(expected), decodeURIComponent(actual)];
}

function decodeParams(pattern: string, path: string): Effect.Effect<Params, Refusal> {
  return Effect.try({
    catch: () => invalidPath(path),
    try: (): Params =>
      pipe(
        segmentPairs(pattern, path),
        Arr.filter(([expected]: SegmentPair) => isParam(expected)),
        Arr.map(decodedParam),
        Record.fromEntries,
      ),
  });
}

function answer<Needs>(onPath: readonly Route<Needs>[], target: Target, params: Params): Handled<Needs> {
  const route = Arr.findFirst(onPath, (candidate) => candidate.method === target.method);
  return Option.match(route, {
    onNone: () => Effect.fail(methodNotAllowed(target.method, target.path)),
    onSome: (found) => found.handle(params),
  });
}

function paramsOf<Needs>(
  onPath: Arr.NonEmptyReadonlyArray<Route<Needs>>,
  target: Target,
): Effect.Effect<Params, Refusal> {
  return decodeParams(Arr.headNonEmpty(onPath).path, target.path);
}

function onPathOf<Needs>(routes: readonly Route<Needs>[], path: string): readonly Route<Needs>[] {
  return Arr.filter(routes, (route) => matches(route, path));
}

function targetOf(request: HttpServerRequest.HttpServerRequest): Target {
  const [path] = Str.split("?")(request.url);
  return { method: request.method, path };
}

const requestTarget: Effect.Effect<Target, never, HttpServerRequest.HttpServerRequest> = Effect.map(
  Request.HttpServerRequest,
  targetOf,
);

function dispatch<Open, Gated, Provides, Needs, Fails>({
  gate,
  gated,
  open,
}: Routes<Open, Gated, Provides, Needs, Fails>): Handled<Open | Exclude<Gated, Provides> | Needs> {
  return Effect.gen(function* routeRequest() {
    const target = yield* requestTarget;
    const openOnPath = onPathOf(open, target.path);
    if (Arr.isReadonlyArrayNonEmpty(openOnPath)) {
      const openParams = yield* paramsOf(openOnPath, target);
      return yield* answer(openOnPath, target, openParams);
    }
    const gatedOnPath = onPathOf(gated, target.path);
    if (!Arr.isReadonlyArrayNonEmpty(gatedOnPath)) {
      return yield* Effect.fail(notFound(target.method, target.path));
    }
    const params = yield* paramsOf(gatedOnPath, target);
    return yield* gate(answer(gatedOnPath, target, params));
  });
}

export { type Gate, type Route, dispatch };
