import { expect, it } from "vitest";
import { CookoutError } from "@ai-hero/cookout-client";
import { leaseConflictDetailsSchema } from "@ai-hero/cookout-protocol";
import { startTestServer } from "./test-server.ts";

async function errorOf(promise: Promise<unknown>): Promise<CookoutError> {
  const caught = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(caught instanceof CookoutError)) throw new Error(`Expected a CookoutError, got ${String(caught)}`);
  return caught;
}

/** `heldUntil` from a lease error's details. */
function heldUntilOf(error: CookoutError): string | null {
  return leaseConflictDetailsSchema.parse(error.details).heldUntil;
}

/**
 * One identity with a `grill` channel, and two sessions using its token:
 * `first` and `second` are separate clients, like two agent processes.
 */
async function twoSessions() {
  const cookout = await startTestServer();
  const agent = await cookout.createIdentity("auth-griller", { owner: "matt" });
  await agent.client.createChannel({ name: "grill" });
  return { cookout, first: cookout.clientFor(agent.token), second: cookout.clientFor(agent.token) };
}

it("join takes the lease for the token's identity and says when it ends", async () => {
  const { first } = await twoSessions();
  const lease = await first.join({ as: "auth-griller" });
  expect(lease.leaseId.length).toBeGreaterThanOrEqual(16);
  expect(lease.expiresAt).toBe("2026-01-01T00:01:00.000Z");
});

it("join refuses a name that isn't the token's identity: the name is a check, not a switch", async () => {
  const { cookout, first } = await twoSessions();
  await cookout.createIdentity("someone-else");
  const error = await errorOf(first.join({ as: "someone-else" }));
  expect(error).toMatchObject({ status: 403, code: "not_your_identity" });
  // Nothing was taken: the real identity can still be joined.
  await expect(first.join({ as: "auth-griller" })).resolves.toMatchObject({});
});

it("a second join while the lease is held gets 409 with heldUntil", async () => {
  const { cookout, first, second } = await twoSessions();
  await first.join({ as: "auth-griller" });
  cookout.clock.advance(10_000);
  const error = await errorOf(second.join({ as: "auth-griller" }));
  expect(error).toMatchObject({ status: 409, code: "lease_held" });
  expect(heldUntilOf(error)).toBe("2026-01-01T00:01:00.000Z");
});

it("the holding session joining again keeps its lease and renews it", async () => {
  const { cookout, first } = await twoSessions();
  const lease = await first.join({ as: "auth-griller" });
  cookout.clock.advance(10_000);
  expect(await first.join({ as: "auth-griller" })).toEqual({
    leaseId: lease.leaseId,
    expiresAt: "2026-01-01T00:01:10.000Z",
  });
});

it("posting and reading don't need the lease, even while another session holds it", async () => {
  const { first, second } = await twoSessions();
  await first.join({ as: "auth-griller" });
  const { message } = await second.postMessage({ channel: "grill", text: "posted without the lease" });
  expect(message.author.name).toBe("auth-griller");
  await expect(second.listChannels()).resolves.toMatchObject({ channels: [{ name: "grill" }] });
  await expect(second.getThread(message.id)).resolves.toMatchObject({ parent: { id: message.id } });
});

it("an action that needs the lease, sent without the lease ID, gets 409 with heldUntil", async () => {
  const { first, second } = await twoSessions();
  await first.join({ as: "auth-griller" });
  // Leave is such an action; ack and watch (#7, #8) are the others.
  const error = await errorOf(second.leave());
  expect(error).toMatchObject({ status: 409, code: "lease_required" });
  expect(heldUntilOf(error)).toBe("2026-01-01T00:01:00.000Z");
});

it("an action that needs the lease is refused when nobody holds it, with heldUntil null", async () => {
  const { second } = await twoSessions();
  const error = await errorOf(second.leave());
  expect(error).toMatchObject({ status: 409, code: "lease_required" });
  expect(heldUntilOf(error)).toBeNull();
});

it("any request carrying the lease ID renews it: 50 s, a request, 50 s more, still held", async () => {
  const { cookout, first, second } = await twoSessions();
  await first.join({ as: "auth-griller" });
  cookout.clock.advance(50_000);
  await first.listChannels();
  cookout.clock.advance(50_000);
  const error = await errorOf(second.join({ as: "auth-griller" }));
  expect(error).toMatchObject({ status: 409, code: "lease_held" });
  expect(heldUntilOf(error)).toBe("2026-01-01T00:01:50.000Z");
});

it("a request without the lease ID doesn't renew it", async () => {
  const { cookout, first, second } = await twoSessions();
  await first.join({ as: "auth-griller" });
  cookout.clock.advance(50_000);
  await second.listChannels();
  cookout.clock.advance(10_000);
  await expect(second.join({ as: "auth-griller" })).resolves.toMatchObject({});
});

it("a lease left idle for 60 s expires, and the next join succeeds", async () => {
  const { cookout, first, second } = await twoSessions();
  await first.join({ as: "auth-griller" });
  cookout.clock.advance(59_999);
  expect(await errorOf(second.join({ as: "auth-griller" }))).toMatchObject({ code: "lease_held" });
  cookout.clock.advance(1);
  expect(await second.join({ as: "auth-griller" })).toMatchObject({ expiresAt: "2026-01-01T00:02:00.000Z" });
});

it("a session whose lease expired hears so on its next request, even a read", async () => {
  const { cookout, first } = await twoSessions();
  await first.join({ as: "auth-griller" });
  cookout.clock.advance(60_000);
  const error = await errorOf(first.listChannels());
  expect(error).toMatchObject({ status: 409, code: "lease_lost" });
  expect(heldUntilOf(error)).toBeNull();
});

it("join --force takes over a held lease, and the old lease ID stops working at once", async () => {
  const { cookout, first, second } = await twoSessions();
  const old = await first.join({ as: "auth-griller" });
  cookout.clock.advance(5_000);
  const taken = await second.join({ as: "auth-griller", force: true });
  expect(taken.leaseId).not.toBe(old.leaseId);
  expect(taken.expiresAt).toBe("2026-01-01T00:01:05.000Z");

  // The old session can tell it lost the identity, and to whom: on reads,
  // posts and lease actions alike.
  const attempts = [() => first.listChannels(), () => first.postMessage({ channel: "grill", text: "hi" }), () => first.leave()];
  for (const attempt of attempts) {
    const error = await errorOf(attempt());
    expect(error).toMatchObject({ status: 409, code: "lease_lost" });
    expect(heldUntilOf(error)).toBe("2026-01-01T00:01:05.000Z");
  }
  // The new holder carries on.
  await expect(second.listChannels()).resolves.toMatchObject({});
});

it("join --force works when nobody holds the lease", async () => {
  const { second } = await twoSessions();
  await expect(second.join({ as: "auth-griller", force: true })).resolves.toMatchObject({});
});

it("leave releases the lease, so the next join succeeds at once", async () => {
  const { first, second } = await twoSessions();
  await first.join({ as: "auth-griller" });
  expect(await first.leave()).toEqual({ released: true });
  await expect(second.join({ as: "auth-griller" })).resolves.toMatchObject({});
});

it("after leave the session is back to working without a lease", async () => {
  const { first } = await twoSessions();
  await first.join({ as: "auth-griller" });
  await first.leave();
  await expect(first.listChannels()).resolves.toMatchObject({});
});

it("a lease is per identity: another identity joins while this one is held", async () => {
  const { cookout, first } = await twoSessions();
  await first.join({ as: "auth-griller" });
  const other = await cookout.createIdentity("other-agent");
  await expect(other.client.join({ as: "other-agent" })).resolves.toMatchObject({});
});

it("a lease ID sent with another identity's token is refused", async () => {
  const { cookout, first } = await twoSessions();
  const { leaseId } = await first.join({ as: "auth-griller" });
  const other = await cookout.createIdentity("other-agent");
  const borrowed = cookout.clientFor(other.token, { leaseId });
  expect(await errorOf(borrowed.listChannels())).toMatchObject({ status: 409, code: "lease_lost" });
});

it("join needs a token like every other route", async () => {
  const { cookout } = await twoSessions();
  expect(await errorOf(cookout.clientFor(undefined).join({ as: "auth-griller" }))).toMatchObject({
    status: 401,
    code: "token_missing",
  });
});

it("join refuses a body that isn't a join request", async () => {
  const { first } = await twoSessions();
  // @ts-expect-error -- `as` is required; this checks the server refuses it without one.
  expect(await errorOf(first.join({}))).toMatchObject({ status: 400, code: "invalid_request" });
});

it("the lease length is configurable", async () => {
  const cookout = await startTestServer({ leaseMilliseconds: 5_000 });
  const agent = await cookout.createIdentity("agent");
  expect(await agent.client.join({ as: "agent" })).toMatchObject({ expiresAt: "2026-01-01T00:00:05.000Z" });
});
