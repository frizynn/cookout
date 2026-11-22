/**
 * A fake command handler: a real HTTP server on port 0 that stands in for the
 * webhook a command calls. It records every call, can be told to fail the next
 * calls, and can wait for calls that have not arrived yet. Plain TypeScript, so
 * tests and `pnpm dev` use it without Effect. Reachable only from tests and the
 * dev script.
 */
import { listen, type ReceivedRequest } from "./lib/server/adapters/node-http.ts";

export type WebhookCall = ReceivedRequest & {
  /** The status the fake answered with. */
  readonly status: number;
};

export type WebhookFake = {
  /** Base URL, such as `http://127.0.0.1:54321`. Any path is accepted. */
  readonly url: string;
  /** Every call so far, oldest first. */
  readonly calls: ReadonlyArray<WebhookCall>;
  /** Answers the next `count` calls with `status` (default 500), then 200 again. */
  readonly failNext: (count: number, status?: number) => void;
  /** Resolves with every call so far once at least `count` have arrived. */
  readonly waitForCalls: (count: number) => Promise<ReadonlyArray<WebhookCall>>;
  /** Stops the server and drops open connections. Stopping twice is a no-op. */
  readonly stop: () => Promise<void>;
};

type Waiter = { readonly count: number; readonly resolve: (calls: ReadonlyArray<WebhookCall>) => void };

/** Starts a fake on `127.0.0.1` and a free port. The caller stops it. */
export async function startWebhookFake(): Promise<WebhookFake> {
  const calls: WebhookCall[] = [];
  const failures: number[] = [];
  let waiters: Waiter[] = [];

  const settleWaiters = () => {
    const ready = waiters.filter((waiter) => calls.length >= waiter.count);
    waiters = waiters.filter((waiter) => calls.length < waiter.count);
    for (const waiter of ready) waiter.resolve([...calls]);
  };

  const listener = await listen((request) => {
    const status = failures.shift() ?? 200;
    calls.push({ ...request, status });
    settleWaiters();
    return status;
  });

  let stopped: Promise<void> | undefined;
  return {
    url: `http://127.0.0.1:${listener.port}`,
    calls,
    failNext: (count, status = 500) => {
      for (let i = 0; i < count; i++) failures.push(status);
    },
    waitForCalls: (count) =>
      new Promise((resolve) => {
        waiters.push({ count, resolve });
        settleWaiters();
      }),
    stop: () => {
      stopped ??= listener.close();
      return stopped;
    },
  };
}
