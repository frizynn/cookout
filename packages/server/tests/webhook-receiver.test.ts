import { expect, it } from "vitest";
import { startFakeWebhookReceiver } from "./fake-webhook-receiver.ts";

async function post(url: string, body: unknown): Promise<number> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-cookout-test": "yes" },
    body: JSON.stringify(body),
  });
  return response.status;
}

it("the fake webhook receiver records each call", async () => {
  const receiver = await startFakeWebhookReceiver();
  expect(await post(`${receiver.url}/hooks/deploy`, { command: "deploy" })).toBe(200);
  expect(receiver.calls).toEqual([
    expect.objectContaining({
      method: "POST",
      path: "/hooks/deploy",
      body: { command: "deploy" },
      headers: expect.objectContaining({ "x-cookout-test": "yes" }),
    }),
  ]);
});

it("the fake webhook receiver can be told to fail the next calls", async () => {
  const receiver = await startFakeWebhookReceiver();
  receiver.failNext(2, 503);
  const statuses = [await post(receiver.url, 1), await post(receiver.url, 2), await post(receiver.url, 3)];
  expect(statuses).toEqual([503, 503, 200]);
  expect(receiver.calls.map((call) => call.status)).toEqual([503, 503, 200]);
});

it("the fake webhook receiver can wait for calls that have not arrived yet", async () => {
  const receiver = await startFakeWebhookReceiver();
  const arrived = receiver.waitForCalls(2);
  await post(receiver.url, "a");
  await post(receiver.url, "b");
  expect((await arrived).map((call) => call.body)).toEqual(["a", "b"]);
});
