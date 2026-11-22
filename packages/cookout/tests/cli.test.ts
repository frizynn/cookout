import { join } from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";
import {
  errorResponseSchema,
  identityResponseSchema,
  identityWithTokenResponseSchema,
  listIdentitiesResponseSchema,
} from "@ai-hero/cookout-protocol";
import { freshFolder, runCookout, startServeProcess } from "./processes.ts";

const adminTokenLine = z.object({ adminToken: z.string() });

async function startCookout(): Promise<{ url: string; adminToken: string }> {
  const server = await startServeProcess(join(await freshFolder(), "cookout.db"));
  const line = server.lines.map((l) => adminTokenLine.safeParse(l)).find((parsed) => parsed.success);
  if (line?.data === undefined) throw new Error("No admin token was printed.");
  return { url: server.url, adminToken: line.data.adminToken };
}

it("the cookout CLI creates and lists identities and says who you are, as JSON", async () => {
  const { url, adminToken } = await startCookout();
  const asAdmin = { COOKOUT_URL: url, COOKOUT_TOKEN: adminToken };

  const created = await runCookout(["identity", "create", "auth-griller", "--owner", "matt"], asAdmin);
  expect(created.exitCode).toBe(0);
  const { identity, token } = identityWithTokenResponseSchema.parse(JSON.parse(created.stdout));
  expect(identity).toMatchObject({ name: "auth-griller", owner: "matt", admin: false });

  const noOwner = await runCookout(["identity", "create", "company-bot"], asAdmin);
  expect(identityWithTokenResponseSchema.parse(JSON.parse(noOwner.stdout)).identity).not.toHaveProperty("owner");

  const asAgent = { COOKOUT_URL: url, COOKOUT_TOKEN: token };
  const listed = await runCookout(["identity", "list"], asAgent);
  expect(listed.exitCode).toBe(0);
  const { identities } = listIdentitiesResponseSchema.parse(JSON.parse(listed.stdout));
  expect(identities.map((i) => [i.name, i.owner])).toEqual([
    ["admin", undefined],
    ["auth-griller", "matt"],
    ["company-bot", undefined],
  ]);

  const whoami = await runCookout(["whoami"], asAgent);
  expect(whoami.exitCode).toBe(0);
  expect(identityResponseSchema.parse(JSON.parse(whoami.stdout))).toEqual({ identity });
});

it("the CLI rotates and deletes identities", async () => {
  const { url, adminToken } = await startCookout();
  const asAdmin = { COOKOUT_URL: url, COOKOUT_TOKEN: adminToken };
  const { token } = identityWithTokenResponseSchema.parse(
    JSON.parse((await runCookout(["identity", "create", "leaky"], asAdmin)).stdout),
  );

  const rotated = await runCookout(["identity", "rotate", "leaky"], asAdmin);
  expect(rotated.exitCode).toBe(0);
  expect(identityWithTokenResponseSchema.parse(JSON.parse(rotated.stdout)).token).not.toBe(token);

  const deleted = await runCookout(["identity", "delete", "leaky"], asAdmin);
  expect(deleted.exitCode).toBe(0);
  expect(identityResponseSchema.parse(JSON.parse(deleted.stdout)).identity.name).toBe("leaky");
});

it("the CLI exits 1 with a JSON error on stderr when the token is missing", async () => {
  const { url } = await startCookout();
  const result = await runCookout(["whoami"], { COOKOUT_URL: url });
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(errorResponseSchema.parse(JSON.parse(result.stderr)).error.code).toBe("token_missing");
});

it("the CLI says so when COOKOUT_URL is not set", async () => {
  const result = await runCookout(["whoami"], {});
  expect(result.exitCode).toBe(1);
  expect(errorResponseSchema.parse(JSON.parse(result.stderr)).error.code).toBe("url_missing");
});

it("the CLI refuses an unknown command with a usage error", async () => {
  const result = await runCookout(["identity", "explode"], { COOKOUT_URL: "http://127.0.0.1:1" });
  expect(result.exitCode).toBe(1);
  expect(errorResponseSchema.parse(JSON.parse(result.stderr)).error.code).toBe("usage");
});
