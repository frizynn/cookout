import { Effect } from "effect";
import type { Server } from "node:http";
import { createServer } from "node:http";

interface Connection {
  readonly bytesRead: number;
  readonly destroy: () => unknown;
  readonly once: (event: "close", listener: () => void) => unknown;
}

interface ClosingServer {
  readonly server: Server;
  readonly dropSilent: Effect.Effect<void>;
}

const NOTHING = 0;

function serverDroppingSilentConnections(): ClosingServer {
  const server = createServer();
  const open = new Set<Connection>();
  server.on("connection", (socket: Connection) => {
    open.add(socket);
    socket.once("close", () => {
      open.delete(socket);
    });
  });
  const dropSilent = Effect.sync(() => {
    for (const socket of open) {
      if (socket.bytesRead === NOTHING) {
        socket.destroy();
      }
    }
  });
  return { dropSilent, server };
}

export { serverDroppingSilentConnections };
