import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export type ReceivedRequest = {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly rawBody: string;
  readonly body: unknown;
};

export type Listener = {
  readonly port: number;
  readonly close: () => Promise<void>;
};

const parseJson = (rawBody: string): unknown => {
  if (rawBody === "") return undefined;
  try {
    const body: unknown = JSON.parse(rawBody);
    return body;
  } catch {
    return undefined;
  }
};

const flatHeaders = (request: IncomingMessage): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  return headers;
};

const received = (request: IncomingMessage, rawBody: string): ReceivedRequest => ({
  method: request.method ?? "",
  path: request.url ?? "",
  headers: flatHeaders(request),
  rawBody,
  body: parseJson(rawBody),
});

const answer = (response: ServerResponse, status: number): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: status < 400 }));
};

const portOf = (address: AddressInfo | string | null): number => {
  if (address === null || typeof address === "string") throw new Error("The webhook fake has no TCP port.");
  return address.port;
};

export async function listen(handle: (request: ReceivedRequest) => number): Promise<Listener> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => answer(response, handle(received(request, Buffer.concat(chunks).toString("utf8")))));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = portOf(server.address());
  const close = (): Promise<void> => {
    server.closeAllConnections();
    return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  };
  return { port, close };
}
