import { expect, it } from "vitest";
import { CookoutError } from "@ai-hero/cookout-client";
import { errorResponseSchema } from "@ai-hero/cookout-protocol";
import { startTestServer } from "./test-server.ts";

async function errorOf(promise: Promise<unknown>): Promise<CookoutError> {
  const caught = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(caught instanceof CookoutError)) throw new Error(`Expected a CookoutError, got ${String(caught)}`);
  return caught;
}

it("the first boot makes an admin identity with a working token", async () => {
  const cookout = await startTestServer();
  expect(cookout.adminToken.length).toBeGreaterThanOrEqual(43);
  expect(await cookout.client.whoami()).toEqual({
    identity: { name: "admin", admin: true, createdAt: "2026-01-01T00:00:00.000Z" },
  });
});

it("an admin creates an identity with an owner and gets its token once", async () => {
  const cookout = await startTestServer();
  cookout.clock.advance(1_000);
  const created = await cookout.client.createIdentity({ name: "auth-griller", owner: "matt" });
  expect(created.identity).toEqual({
    name: "auth-griller",
    owner: "matt",
    admin: false,
    createdAt: "2026-01-01T00:00:01.000Z",
  });
  expect(created.token).not.toBe(cookout.adminToken);
  expect(await cookout.clientFor(created.token).whoami()).toEqual({ identity: created.identity });
});

it("an admin creates an identity with no owner", async () => {
  const cookout = await startTestServer();
  const created = await cookout.client.createIdentity({ name: "company-bot" });
  expect(created.identity).toEqual({ name: "company-bot", admin: false, createdAt: "2026-01-01T00:00:00.000Z" });
  expect("owner" in created.identity).toBe(false);
});

it("every identity gets a different random token of at least 256 bits", async () => {
  const cookout = await startTestServer();
  const tokens = [cookout.adminToken];
  for (let i = 0; i < 5; i++) tokens.push((await cookout.client.createIdentity({ name: `agent-${i}` })).token);
  expect(new Set(tokens).size).toBe(tokens.length);
  for (const token of tokens) {
    // base64url: 6 bits per character, after a fixed prefix.
    const random = token.replace(/^cookout_/, "");
    expect(random).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(random.length * 6).toBeGreaterThanOrEqual(256);
  }
});

it("the store holds only a hash of each token", async () => {
  const cookout = await startTestServer();
  const created = await cookout.client.createIdentity({ name: "agent" });
  for (const token of [cookout.adminToken, created.token]) {
    expect(await cookout.storage.findIdentityByTokenHash(token)).toEqual({ status: "unknown" });
  }
});

it("a name already in use is refused with 409", async () => {
  const cookout = await startTestServer();
  await cookout.client.createIdentity({ name: "twin" });
  const error = await errorOf(cookout.client.createIdentity({ name: "twin", owner: "matt" }));
  expect(error).toMatchObject({ status: 409, code: "identity_exists" });
});

it("a name that breaks the naming rule is refused with 400", async () => {
  const cookout = await startTestServer();
  const response = await fetch(`${cookout.url}/v1/identities`, {
    method: "POST",
    headers: { authorization: `Bearer ${cookout.adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "Not OK" }),
  });
  expect(response.status).toBe(400);
  expect(errorResponseSchema.parse(await response.json()).error.code).toBe("invalid_request");
});

it("a body that isn't JSON is refused with 400", async () => {
  const cookout = await startTestServer();
  const response = await fetch(`${cookout.url}/v1/identities`, {
    method: "POST",
    headers: { authorization: `Bearer ${cookout.adminToken}`, "content-type": "application/json" },
    body: "{nope",
  });
  expect(response.status).toBe(400);
  expect(errorResponseSchema.parse(await response.json()).error.code).toBe("invalid_json");
});

it("any identity lists every identity and its owner, sorted by name", async () => {
  const cookout = await startTestServer();
  const agent = await cookout.createIdentity("zed-agent", { owner: "matt" });
  await cookout.createIdentity("bot");
  const { identities } = await agent.client.listIdentities();
  expect(identities.map((identity) => [identity.name, identity.owner])).toEqual([
    ["admin", undefined],
    ["bot", undefined],
    ["zed-agent", "matt"],
  ]);
});

it("whoami shows a non-admin identity as not admin", async () => {
  const cookout = await startTestServer();
  const agent = await cookout.createIdentity("agent", { owner: "matt" });
  expect(await agent.client.whoami()).toEqual({ identity: agent.identity });
  expect(agent.identity.admin).toBe(false);
});

it("rotating a token issues a new one and the old one gets 401 at once", async () => {
  const cookout = await startTestServer();
  const agent = await cookout.createIdentity("leaky");
  const rotated = await cookout.client.rotateToken("leaky");
  expect(rotated.identity).toEqual(agent.identity);
  expect(rotated.token).not.toBe(agent.token);

  const error = await errorOf(agent.client.whoami());
  expect(error).toMatchObject({ status: 401, code: "token_revoked" });
  expect(await cookout.clientFor(rotated.token).whoami()).toEqual({ identity: agent.identity });
});

it("rotating the token of a missing identity is a 404", async () => {
  const cookout = await startTestServer();
  const error = await errorOf(cookout.client.rotateToken("nobody"));
  expect(error).toMatchObject({ status: 404, code: "identity_not_found" });
});

it("deleting an identity removes it and its token stops working", async () => {
  const cookout = await startTestServer();
  const agent = await cookout.createIdentity("e2e-run-1", { owner: "matt" });
  expect(await cookout.client.deleteIdentity("e2e-run-1")).toEqual({ identity: agent.identity });
  const { identities } = await cookout.client.listIdentities();
  expect(identities.map((identity) => identity.name)).toEqual(["admin"]);
  const error = await errorOf(agent.client.whoami());
  expect(error).toMatchObject({ status: 401, code: "token_revoked" });
});

it("deleting a missing identity is a 404", async () => {
  const cookout = await startTestServer();
  const error = await errorOf(cookout.client.deleteIdentity("nobody"));
  expect(error).toMatchObject({ status: 404, code: "identity_not_found" });
});

it("a request with no token gets 401 token_missing", async () => {
  const cookout = await startTestServer();
  const error = await errorOf(cookout.clientFor(undefined).whoami());
  expect(error).toMatchObject({ status: 401, code: "token_missing" });
});

it("a header that isn't a bearer token gets 401 token_missing", async () => {
  const cookout = await startTestServer();
  const response = await fetch(`${cookout.url}/v1/whoami`, { headers: { authorization: `Basic ${cookout.adminToken}` } });
  expect(response.status).toBe(401);
  expect(errorResponseSchema.parse(await response.json()).error.code).toBe("token_missing");
});

it("a token that was never issued gets 401 token_unknown", async () => {
  const cookout = await startTestServer();
  const error = await errorOf(cookout.clientFor(`cookout_${"x".repeat(43)}`).listIdentities());
  expect(error).toMatchObject({ status: 401, code: "token_unknown" });
});

it("a non-admin can't create, rotate or delete identities (403)", async () => {
  const cookout = await startTestServer();
  const agent = await cookout.createIdentity("agent");
  for (const attempt of [
    () => agent.client.createIdentity({ name: "sneaky" }),
    () => agent.client.rotateToken("admin"),
    () => agent.client.deleteIdentity("admin"),
  ]) {
    expect(await errorOf(attempt())).toMatchObject({ status: 403, code: "admin_only" });
  }
  const { identities } = await cookout.client.listIdentities();
  expect(identities.map((identity) => identity.name)).toEqual(["admin", "agent"]);
});

it("a server on a store that already has identities makes no new admin", async () => {
  const cookout = await startTestServer();
  const second = await cookout.startSecondServer();
  expect(second.adminToken).toBeUndefined();
  const { identities } = await second.client.listIdentities();
  expect(identities.map((identity) => identity.name)).toEqual(["admin"]);
});
