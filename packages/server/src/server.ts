import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { ErrorResponse, HealthResponse, StorageAdapter } from "@ai-hero/cookout-protocol";
import { errorResponseSchema, healthPath, healthResponseSchema } from "@ai-hero/cookout-protocol";

/** Where the server reads the time. Tests pass a fake one. */
export type Clock = { now(): Date };

export type ServerOptions = {
  storage: StorageAdapter;
  clock: Clock;
  /** 0 picks a free port. */
  port: number;
  /** Default `0.0.0.0`. */
  host?: string;
};

export type RunningServer = {
  /** Base URL, e.g. `http://127.0.0.1:54321`. */
  url: string;
  /** Stops accepting requests and closes open connections. Doesn't close storage. */
  close(): Promise<void>;
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, status: number, error: ErrorResponse["error"]): void {
  sendJson(response, status, errorResponseSchema.parse({ error }));
}

async function handle(options: ServerOptions, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;

  if (path === healthPath) {
    if (request.method !== "GET") {
      sendError(response, 405, { code: "method_not_allowed", message: `${request.method} ${path} is not allowed.` });
      return;
    }
    try {
      await options.storage.checkHealth();
    } catch {
      sendError(response, 503, { code: "storage_unavailable", message: "Storage is not usable." });
      return;
    }
    const body: HealthResponse = { status: "ok", time: options.clock.now().toISOString() };
    sendJson(response, 200, healthResponseSchema.parse(body));
    return;
  }

  sendError(response, 404, { code: "not_found", message: `No route for ${request.method} ${path}.` });
}

/** Starts the HTTP server with the storage and clock it is given. */
export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const server = createServer((request, response) => {
    handle(options, request, response).catch(() => {
      if (!response.headersSent) {
        sendError(response, 500, { code: "internal_error", message: "Something went wrong on the server." });
      } else {
        response.end();
      }
    });
  });

  const host = options.host ?? "0.0.0.0";
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address: AddressInfo | string | null = server.address();
  if (address === null || typeof address === "string") throw new Error("The server has no TCP port.");
  const urlHost = address.family === "IPv6" ? `[${address.address}]` : address.address;

  return {
    url: `http://${urlHost}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
