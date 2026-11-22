import { join } from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";
import {
  channelResponseSchema,
  errorResponseSchema,
  identityResponseSchema,
  identityWithTokenResponseSchema,
  listChannelsResponseSchema,
  listIdentitiesResponseSchema,
  listMessagesResponseSchema,
  messageResponseSchema,
  threadResponseSchema,
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

it("the CLI makes a channel, posts a message and a reply, and reads the thread back as JSON", async () => {
  const { url, adminToken } = await startCookout();
  const { token } = identityWithTokenResponseSchema.parse(
    JSON.parse((await runCookout(["identity", "create", "agent", "--owner", "matt"], { COOKOUT_URL: url, COOKOUT_TOKEN: adminToken })).stdout),
  );
  const asAgent = { COOKOUT_URL: url, COOKOUT_TOKEN: token };
  const json = async (args: string[]): Promise<unknown> => {
    const result = await runCookout(args, asAgent);
    expect(result, result.stderr).toMatchObject({ exitCode: 0 });
    return JSON.parse(result.stdout);
  };

  const created = channelResponseSchema.parse(await json(["channel", "create", "grill", "--description", "Grill it"]));
  expect(created.channel).toMatchObject({ name: "grill", description: "Grill it" });
  expect(listChannelsResponseSchema.parse(await json(["channel", "list"])).channels.map((c) => c.name)).toEqual(["grill"]);
  expect(channelResponseSchema.parse(await json(["channel", "get", "grill"]))).toEqual(created);

  const { message: parent } = messageResponseSchema.parse(
    await json(["message", "post", "grill", "Is the lease 60 s?", "--data", '{"question":1}']),
  );
  expect(parent).toMatchObject({ text: "Is the lease 60 s?", data: { question: 1 }, author: { name: "agent", owner: "matt" } });
  const { message: reply } = messageResponseSchema.parse(
    await json(["message", "post", "grill", "Yes.", "--reply-to", String(parent.id)]),
  );
  expect(reply).toMatchObject({ replyTo: parent.id });

  const thread = threadResponseSchema.parse(await json(["thread", "get", String(reply.id)]));
  expect(thread.parent).toMatchObject({ id: parent.id, replyCount: 1, latestReplyId: reply.id });
  expect(thread.replies).toEqual([reply]);

  const page = listMessagesResponseSchema.parse(await json(["message", "list", "grill", "--limit", "1"]));
  expect(page.messages.map((message) => message.id)).toEqual([parent.id]);
});

it("the CLI refuses --data that isn't JSON with a usage error", async () => {
  const result = await runCookout(["message", "post", "grill", "hi", "--data", "{nope"], { COOKOUT_URL: "http://127.0.0.1:1" });
  expect(result.exitCode).toBe(1);
  expect(errorResponseSchema.parse(JSON.parse(result.stderr)).error.code).toBe("usage");
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
