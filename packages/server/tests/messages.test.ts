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

/** A server with one non-admin identity (owned by matt) and a `grill` channel it made. */
async function withChannel() {
  const cookout = await startTestServer();
  const agent = await cookout.createIdentity("auth-griller", { owner: "matt" });
  await agent.client.createChannel({ name: "grill" });
  return { cookout, agent };
}

// Channels

it("any identity, not only an admin, can create a channel", async () => {
  const cookout = await startTestServer();
  const agent = await cookout.createIdentity("agent");
  cookout.clock.advance(1_000);
  const created = await agent.client.createChannel({ name: "grill-auth", description: "Grilling the auth plan" });
  expect(created).toEqual({
    channel: { name: "grill-auth", description: "Grilling the auth plan", createdAt: "2026-01-01T00:00:01.000Z" },
  });
});

it("a channel can be made without a description", async () => {
  const { agent } = await withChannel();
  const { channel } = await agent.client.getChannel("grill");
  expect(channel).toEqual({ name: "grill", createdAt: "2026-01-01T00:00:00.000Z" });
});

it("any identity lists channels by name", async () => {
  const { cookout, agent } = await withChannel();
  await cookout.client.createChannel({ name: "general" });
  const other = await cookout.createIdentity("other");
  const { channels } = await other.client.listChannels();
  expect(channels.map((channel) => channel.name)).toEqual(["general", "grill"]);
  expect(await agent.client.listChannels()).toEqual({ channels });
});

it("a channel name already in use is refused with 409", async () => {
  const { agent } = await withChannel();
  expect(await errorOf(agent.client.createChannel({ name: "grill" }))).toMatchObject({
    status: 409,
    code: "channel_exists",
  });
});

it("a bad channel name is refused with 400 and the schema errors", async () => {
  const { agent } = await withChannel();
  const error = await errorOf(agent.client.createChannel({ name: "Not Allowed" }));
  expect(error).toMatchObject({ status: 400, code: "invalid_request" });
  expect(error.details).toEqual([expect.objectContaining({ path: ["name"] })]);
});

it("getting a missing channel is a 404", async () => {
  const { agent } = await withChannel();
  expect(await errorOf(agent.client.getChannel("nowhere"))).toMatchObject({ status: 404, code: "channel_not_found" });
});

it("channels need a token", async () => {
  const cookout = await startTestServer();
  expect(await errorOf(cookout.clientFor(undefined).listChannels())).toMatchObject({
    status: 401,
    code: "token_missing",
  });
});

// Posting and replying

it("an identity posts a top-level message with JSON data, and sees its author and owner", async () => {
  const { cookout, agent } = await withChannel();
  cookout.clock.advance(5_000);
  const { message } = await agent.client.postMessage({
    channel: "grill",
    text: "Is the lease 60 s?",
    data: { question: 1, tags: ["lease"], open: true, note: null },
  });
  expect(message).toEqual({
    id: expect.any(Number),
    channel: "grill",
    author: { name: "auth-griller", owner: "matt" },
    text: "Is the lease 60 s?",
    data: { question: 1, tags: ["lease"], open: true, note: null },
    mentions: [],
    createdAt: "2026-01-01T00:00:05.000Z",
    replyCount: 0,
    latestReplyId: null,
  });
});

it("an author with no owner has no owner on its messages", async () => {
  const { cookout } = await withChannel();
  const bot = await cookout.createIdentity("company-bot");
  const { message } = await bot.client.postMessage({ channel: "grill", text: "hello" });
  expect(message.author).toEqual({ name: "company-bot" });
  expect("data" in message).toBe(false);
});

it("a reply joins the message's thread and updates its reply count and latest reply", async () => {
  const { cookout, agent } = await withChannel();
  const other = await cookout.createIdentity("other");
  const { message: parent } = await agent.client.postMessage({ channel: "grill", text: "parent" });
  const { message: first } = await other.client.postMessage({ channel: "grill", text: "first", replyTo: parent.id });
  const { message: second } = await agent.client.postMessage({ channel: "grill", text: "second", replyTo: parent.id });
  expect(first).toMatchObject({ replyTo: parent.id, author: { name: "other" } });
  expect(first).not.toHaveProperty("replyCount");
  expect(second.id).toBeGreaterThan(first.id);

  const { messages } = await agent.client.listMessages("grill");
  expect(messages).toEqual([{ ...parent, replyCount: 2, latestReplyId: second.id }]);
});

it("a reply to a reply lands on the parent's thread (replyTo is the top-level message)", async () => {
  const { agent } = await withChannel();
  const { message: parent } = await agent.client.postMessage({ channel: "grill", text: "parent" });
  const { message: reply } = await agent.client.postMessage({ channel: "grill", text: "reply", replyTo: parent.id });
  const { message: nested } = await agent.client.postMessage({ channel: "grill", text: "nested", replyTo: reply.id });
  expect(nested).toMatchObject({ replyTo: parent.id });

  const thread = await agent.client.getThread(parent.id);
  expect(thread.replies.map((message) => message.text)).toEqual(["reply", "nested"]);
  expect(thread.parent).toMatchObject({ id: parent.id, replyCount: 2, latestReplyId: nested.id });
});

it("a thread is the parent plus its replies in order, and can be got from any message in it", async () => {
  const { cookout, agent } = await withChannel();
  const { message: parent } = await agent.client.postMessage({ channel: "grill", text: "parent", data: { n: 0 } });
  const texts = ["one", "two", "three"];
  const replies = [];
  for (const text of texts) {
    cookout.clock.advance(1_000);
    replies.push((await agent.client.postMessage({ channel: "grill", text, replyTo: parent.id })).message);
  }
  // A top-level message posted in between isn't part of the thread.
  await agent.client.postMessage({ channel: "grill", text: "elsewhere" });

  const thread = await agent.client.getThread(parent.id);
  expect(thread).toEqual({
    parent: { ...parent, replyCount: 3, latestReplyId: replies[2]?.id },
    replies,
  });
  expect(await agent.client.getThread(replies[1]?.id ?? 0)).toEqual(thread);
});

it("a message with no replies is a thread of its own", async () => {
  const { agent } = await withChannel();
  const { message } = await agent.client.postMessage({ channel: "grill", text: "alone" });
  expect(await agent.client.getThread(message.id)).toEqual({ parent: message, replies: [] });
});

it("getting the thread of a missing message is a 404", async () => {
  const { agent } = await withChannel();
  expect(await errorOf(agent.client.getThread(999))).toMatchObject({ status: 404, code: "message_not_found" });
});

it("posting to a missing channel is a 404", async () => {
  const { agent } = await withChannel();
  expect(await errorOf(agent.client.postMessage({ channel: "nowhere", text: "hi" }))).toMatchObject({
    status: 404,
    code: "channel_not_found",
  });
});

it("replying to a missing message is a 404 and posts nothing", async () => {
  const { agent } = await withChannel();
  expect(await errorOf(agent.client.postMessage({ channel: "grill", text: "hi", replyTo: 999 }))).toMatchObject({
    status: 404,
    code: "message_not_found",
  });
  expect((await agent.client.listMessages("grill")).messages).toEqual([]);
});

it("replying to a message in another channel is refused with 400 and posts nothing", async () => {
  const { agent } = await withChannel();
  await agent.client.createChannel({ name: "other" });
  const { message: parent } = await agent.client.postMessage({ channel: "other", text: "parent" });
  expect(await errorOf(agent.client.postMessage({ channel: "grill", text: "hi", replyTo: parent.id }))).toMatchObject({
    status: 400,
    code: "reply_in_other_channel",
  });
  expect((await agent.client.getThread(parent.id)).replies).toEqual([]);
});

it("a bad message body is refused with 400 and the schema errors", async () => {
  const { cookout, agent } = await withChannel();
  for (const body of [
    { channel: "grill" },
    { channel: "grill", text: "" },
    { channel: "grill", text: "hi", replyTo: "one" },
    { channel: "grill", text: 7 },
  ]) {
    const response = await fetch(`${cookout.url}/v1/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${agent.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
    const { error } = errorResponseSchema.parse(await response.json());
    expect(error.code).toBe("invalid_request");
    expect(error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: expect.any(Array) })]));
  }
  expect((await agent.client.listMessages("grill")).messages).toEqual([]);
});

it("posting needs a token", async () => {
  const { cookout } = await withChannel();
  expect(await errorOf(cookout.clientFor(undefined).postMessage({ channel: "grill", text: "hi" }))).toMatchObject({
    status: 401,
    code: "token_missing",
  });
});

it("message IDs increase across channels", async () => {
  const { agent } = await withChannel();
  await agent.client.createChannel({ name: "other" });
  const ids = [];
  for (const channel of ["grill", "other", "grill", "other"]) {
    ids.push((await agent.client.postMessage({ channel, text: "hi" })).message.id);
  }
  expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  expect(new Set(ids).size).toBe(4);
});

it("a message keeps its author's name and owner after the identity is deleted", async () => {
  const { cookout, agent } = await withChannel();
  const { message } = await agent.client.postMessage({ channel: "grill", text: "still here" });
  await cookout.client.deleteIdentity("auth-griller");
  expect((await cookout.client.getThread(message.id)).parent.author).toEqual({ name: "auth-griller", owner: "matt" });
});

// Reading a channel

it("a channel page lists top-level messages oldest first, without replies", async () => {
  const { agent } = await withChannel();
  const { message: a } = await agent.client.postMessage({ channel: "grill", text: "a" });
  await agent.client.postMessage({ channel: "grill", text: "reply", replyTo: a.id });
  await agent.client.postMessage({ channel: "grill", text: "b" });
  const page = await agent.client.listMessages("grill");
  expect(page.messages.map((message) => message.text)).toEqual(["a", "b"]);
  expect(page.hasMore).toBe(false);
});

it("a channel pages back from a message ID", async () => {
  const { agent } = await withChannel();
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push((await agent.client.postMessage({ channel: "grill", text: `m${i}` })).message.id);

  const latest = await agent.client.listMessages("grill", { limit: 2 });
  expect(latest.messages.map((message) => message.text)).toEqual(["m3", "m4"]);
  expect(latest.hasMore).toBe(true);

  const before = await agent.client.listMessages("grill", { before: latest.messages[0]?.id ?? 0, limit: 2 });
  expect(before.messages.map((message) => message.text)).toEqual(["m1", "m2"]);
  expect(before.hasMore).toBe(true);

  const oldest = await agent.client.listMessages("grill", { before: before.messages[0]?.id ?? 0, limit: 2 });
  expect(oldest.messages.map((message) => message.text)).toEqual(["m0"]);
  expect(oldest.hasMore).toBe(false);
});

it("a channel page holds only that channel's messages", async () => {
  const { agent } = await withChannel();
  await agent.client.createChannel({ name: "other" });
  await agent.client.postMessage({ channel: "other", text: "not here" });
  await agent.client.postMessage({ channel: "grill", text: "here" });
  expect((await agent.client.listMessages("grill")).messages.map((message) => message.text)).toEqual(["here"]);
});

it("a bad page cursor or limit is refused with 400", async () => {
  const { agent } = await withChannel();
  for (const options of [{ limit: 0 }, { limit: 201 }, { before: -1 }]) {
    expect(await errorOf(agent.client.listMessages("grill", options))).toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  }
});

it("a path segment that isn't valid percent-encoding is 400 invalid_path on every route", async () => {
  const cookout = await startTestServer();
  for (const [method, path] of [
    ["GET", "/v1/channels/%E0"],
    ["GET", "/v1/channels/%E0/messages"],
    ["DELETE", "/v1/identities/%E0"],
    ["POST", "/v1/identities/%E0/token"],
  ] as const) {
    const response = await fetch(`${cookout.url}${path}`, {
      method,
      headers: { authorization: `Bearer ${cookout.adminToken}` },
    });
    expect(response.status, `${method} ${path}`).toBe(400);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe("invalid_path");
  }
});

it("reading a missing channel's messages is a 404", async () => {
  const { agent } = await withChannel();
  expect(await errorOf(agent.client.listMessages("nowhere"))).toMatchObject({ status: 404, code: "channel_not_found" });
});
