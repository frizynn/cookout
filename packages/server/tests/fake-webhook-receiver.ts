import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { onTestFinished } from "vitest";

export type RecordedWebhookCall = {
  method: string;
  /** Path and query, e.g. `/hooks/deploy?x=1`. */
  path: string;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  /** The raw body as received (check signatures against this). */
  rawBody: string;
  /** The body parsed as JSON, or `undefined` if it isn't JSON. */
  body: unknown;
  /** The status the receiver answered with. */
  status: number;
};

export type FakeWebhookReceiver = {
  /** Base URL, e.g. `http://127.0.0.1:54321`. Any path is accepted. */
  url: string;
  /** Every call so far, oldest first. */
  calls: RecordedWebhookCall[];
  /** Answer the next `count` calls with `status` (default 500), then 200 again. */
  failNext(count: number, status?: number): void;
  /** Resolves once at least `count` calls have been received. */
  waitForCalls(count: number): Promise<RecordedWebhookCall[]>;
  close(): Promise<void>;
};

/**
 * A local HTTP server that stands in for a command's webhook handler. It
 * records every call and can be told to fail. Closed when the test ends.
 */
export async function startFakeWebhookReceiver(): Promise<FakeWebhookReceiver> {
  const calls: RecordedWebhookCall[] = [];
  const failures: number[] = [];
  const waiters: { count: number; resolve: (calls: RecordedWebhookCall[]) => void }[] = [];

  function settleWaiters(): void {
    for (const waiter of [...waiters]) {
      if (calls.length >= waiter.count) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve([...calls]);
      }
    }
  }

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      let body: unknown;
      try {
        body = rawBody === "" ? undefined : JSON.parse(rawBody);
      } catch {
        body = undefined;
      }
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value;
      }
      const status = failures.shift() ?? 200;
      calls.push({ method: request.method ?? "", path: request.url ?? "", headers, rawBody, body, status });
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: status < 400 }));
      settleWaiters();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address: AddressInfo | string | null = server.address();
  if (address === null || typeof address === "string") throw new Error("The webhook receiver has no TCP port.");
  const { port } = address;

  let closed = false;
  async function close(): Promise<void> {
    if (closed) return;
    closed = true;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  onTestFinished(close);

  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    failNext(count, status = 500) {
      for (let i = 0; i < count; i++) failures.push(status);
    },
    waitForCalls(count) {
      return new Promise((resolve) => {
        waiters.push({ count, resolve });
        settleWaiters();
      });
    },
    close,
  };
}
