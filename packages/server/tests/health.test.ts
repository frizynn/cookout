import { expect, it } from "vitest";
import { CookoutError } from "@ai-hero/cookout-client";
import { errorResponseSchema } from "@ai-hero/cookout-protocol";
import { startTestServer } from "./test-server.ts";

it("a server on port 0 answers the health check through the SDK", async () => {
  const cookout = await startTestServer();
  expect(new URL(cookout.url).port).not.toBe("0");
  expect(await cookout.client.health()).toEqual({
    status: "ok",
    time: "2026-01-01T00:00:00.000Z",
  });
});

it("the health check reports the server's clock", async () => {
  const cookout = await startTestServer();
  cookout.clock.advance(90_000);
  expect((await cookout.client.health()).time).toBe("2026-01-01T00:01:30.000Z");
});

it("the health check needs no token", async () => {
  const cookout = await startTestServer();
  const response = await fetch(`${cookout.url}/v1/health`);
  expect(response.status).toBe(200);
});

it("the health check fails with 503 when storage is unusable", async () => {
  const cookout = await startTestServer();
  await cookout.storage.close();
  const error = await cookout.client.health().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(CookoutError);
  expect(error).toMatchObject({ status: 503, code: "storage_unavailable" });
});

it("an unknown route is a 404 in the error shape", async () => {
  const cookout = await startTestServer();
  const response = await fetch(`${cookout.url}/v1/no-such-route`);
  expect(response.status).toBe(404);
  const body = errorResponseSchema.parse(await response.json());
  expect(body.error.code).toBe("not_found");
});
