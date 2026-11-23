import { Array as Arr, Effect } from "effect";
import type { ProxyOptions } from "vite";
import type { Scope } from "effect";
import { createServer } from "vite";

const LOCAL = "127.0.0.1";
const FREE_PORT = 0;

function cookoutProxy(cookoutUrl: string): ProxyOptions {
  return { changeOrigin: true, headers: { origin: cookoutUrl }, target: cookoutUrl };
}

function viteDevServer(cookoutUrl: string): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* startWebDevServer() {
    const server = { host: LOCAL, port: FREE_PORT, proxy: { "/v1": cookoutProxy(cookoutUrl) }, strictPort: true };
    const vite = yield* Effect.promise(() => createServer({ server }));
    yield* Effect.addFinalizer(() => Effect.promise(() => vite.close()));
    yield* Effect.promise(() => vite.listen());
    const resolved = yield* Effect.orDie(Effect.fromNullishOr(vite.resolvedUrls));
    const url = yield* Effect.orDie(Effect.fromOption(Arr.head(resolved.local)));
    return new URL(url).origin;
  }).pipe(Effect.uninterruptible);
}

export { viteDevServer };
