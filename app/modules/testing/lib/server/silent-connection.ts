import { Effect } from "effect";
import { NodeSocket } from "@effect/platform-node";
import type { Scope } from "effect";

interface SilentConnection {
  readonly dropped: Effect.Effect<void>;
}

function silentConnection(url: string): Effect.Effect<SilentConnection, never, Scope.Scope> {
  const { hostname, port } = new URL(url);
  return Effect.gen(function* openSilentConnection() {
    const socket = yield* NodeSocket.makeNet({ host: hostname, port: Number(port) });
    const reader = yield* socket.reader;
    return { dropped: Effect.ignore(reader.pull) };
  }).pipe(Effect.orDie);
}

export { type SilentConnection, silentConnection };
