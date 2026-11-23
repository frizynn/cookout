import { adminClient, alertSaying, clientWith, newIdentity, openAt } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import type { CookoutClient } from "../../sdk/index.ts";
import { createCookoutClient } from "../../sdk/index.ts";

const schema = { properties: { branch: { type: "string" } }, required: ["branch"], type: "object" };
const nowhere = "http://127.0.0.1:9/command";
const INDENT = 2;

function pretty(value: unknown): string {
  return JSON.stringify(value, null, INDENT);
}

async function addCommand(name: string): Promise<CookoutClient> {
  const handler = await newIdentity({ kind: "agent", name, owner: "admin" });
  await adminClient().addCommand({ name, schema, url: nowhere });
  return handler.client;
}

async function channelWithCommand(channel: string, command: string): Promise<CookoutClient> {
  await adminClient().createChannel({ name: channel });
  return addCommand(command);
}

async function callFromTheForm(command: string, data: string): Promise<void> {
  const form = await screen.findByRole("form", { name: "Call a command" });
  await within(form).findByRole("option", { name: `/${command}` });
  fireEvent.change(within(form).getByLabelText("Command"), { target: { value: command } });
  fireEvent.change(within(form).getByLabelText("Data"), { target: { value: data } });
  fireEvent.click(within(form).getByRole("button", { name: "Call" }));
}

it("a command call and its result reply show their data in the thread", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const handler = await channelWithCommand("web-command-shows", "web-show-call");
  const { threadId } = await adminClient().callCommand("web-show-call", {
    channel: "web-command-shows",
    data: { branch: "main" },
  });
  await handler.createMessage({
    channel: "web-command-shows",
    data: { status: "done" },
    replyTo: threadId,
    text: "Shipped main.",
  });
  const close = openAt({ client: adminClient(), hash: `#/channels/web-command-shows/threads/${String(threadId)}` });

  const reply = await within(await screen.findByRole("list", { name: "Replies" })).findByRole("listitem");
  const parent = screen.getByRole("article", { name: "Parent message" });

  expect([
    within(parent).getByLabelText("Call to /web-show-call").textContent,
    within(reply).getByLabelText("Data").textContent,
    reply.textContent,
  ]).toStrictEqual([
    pretty({ branch: "main" }),
    pretty({ status: "done" }),
    `@web-show-callagentShipped main.${pretty({ status: "done" })}`,
  ]);

  close();
});

it("a person picks a command, enters data and calls it, and the call message appears", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWithCommand("web-command-call", "web-call-form");
  await adminClient().createMessage({ channel: "web-command-call", text: "Ready to ship" });
  const caller = await newIdentity({ kind: "human", name: "web-command-caller" });
  const close = openAt({ client: caller.client, hash: "#/channels/web-command-call" });

  await callFromTheForm("web-call-form", '{"branch":"main"}');
  const shown = await screen.findByLabelText("Call to /web-call-form");
  const { messages } = await adminClient().listMessages("web-command-call");

  expect([
    shown.textContent,
    messages.map(({ author, data = "no data", text }) => [author.name, text, data]),
  ]).toStrictEqual([
    pretty({ branch: "main" }),
    [
      ["admin", "Ready to ship", "no data"],
      ["web-command-caller", "/web-call-form", { command: "web-call-form", data: { branch: "main" } }],
    ],
  ]);

  close();
});

it("a call whose data breaks the command's schema shows the schema errors", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWithCommand("web-command-bad", "web-call-bad");
  const close = openAt({ client: adminClient(), hash: "#/channels/web-command-bad" });

  await callFromTheForm("web-call-bad", '{"branch":[1,true,null,"main",{}]}');
  const alert = await screen.findByRole("alert");
  const { messages } = await adminClient().listMessages("web-command-bad");

  expect([alert.textContent, messages]).toStrictEqual([
    expect.stringMatching(/^Couldn't call \/web-call-bad \(invalid_request\).*data\.branch: must be string$/u),
    [],
  ]);

  close();
});

it("a schema error keeps the typed data in the box, and a good call empties it", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWithCommand("web-command-keep", "web-call-keep");
  const close = openAt({ client: adminClient(), hash: "#/channels/web-command-keep" });

  await callFromTheForm("web-call-keep", '{"branch":1}');
  await screen.findByRole("alert");
  const kept = screen.queryByDisplayValue('{"branch":1}');
  await callFromTheForm("web-call-keep", '{"branch":"main"}');
  await screen.findByLabelText("Call to /web-call-keep");

  expect([kept, screen.queryByDisplayValue('{"branch":"main"}')]).toStrictEqual([screen.getByLabelText("Data"), null]);

  close();
});

it("data that isn't JSON is refused before it is sent", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWithCommand("web-command-not-json", "web-call-not-json");
  const close = openAt({ client: adminClient(), hash: "#/channels/web-command-not-json" });

  await callFromTheForm("web-call-not-json", "{branch");
  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toBe("Couldn't call /web-call-not-json (invalid_json): The data isn't JSON.");

  close();
});

it("a refused call says so and keeps the channel shown", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWithCommand("web-command-refused", "web-call-refused");
  const caller = await newIdentity({ kind: "human", name: "web-command-rotated" });
  const close = openAt({ client: caller.client, hash: "#/channels/web-command-refused" });
  await screen.findByRole("form", { name: "Call a command" });
  await caller.rotateToken();

  await callFromTheForm("web-call-refused", '{"branch":"main"}');
  const alert = await alertSaying("Couldn't call");

  expect([alert.textContent, screen.queryByRole("list", { name: "Schema errors" })]).toStrictEqual([
    expect.stringMatching(/^Couldn't call \/web-call-refused \(token_revoked\)/u),
    null,
  ]);

  close();
});

it("a call to a server that can't be reached says so, with no schema errors", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWithCommand("web-command-unreachable", "web-call-unreachable");
  const nowhereClient = createCookoutClient({ env: {}, token: "cookout_any", url: "http://127.0.0.1:1" });
  const close = openAt({
    client: { ...adminClient(), callCommand: nowhereClient.callCommand },
    hash: "#/channels/web-command-unreachable",
  });

  await callFromTheForm("web-call-unreachable", '{"branch":"main"}');
  const alert = await screen.findByRole("alert");

  expect([alert.textContent, screen.queryByRole("list", { name: "Schema errors" })]).toStrictEqual([
    expect.stringMatching(/^Couldn't call \/web-call-unreachable \(unreachable\)/u),
    null,
  ]);

  close();
});

it("commands that can't be listed say so", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await adminClient().createChannel({ name: "web-command-unlisted" });
  const revoked = clientWith("cookout_not-a-token");
  const close = openAt({
    client: { ...adminClient(), listCommands: revoked.listCommands },
    hash: "#/channels/web-command-unlisted",
  });

  const refusal = await screen.findByText(/^Couldn't list the commands/u);

  expect([refusal.getAttribute("role"), refusal.textContent]).toStrictEqual([
    "alert",
    expect.stringMatching(/^Couldn't list the commands \(\w+\): /u),
  ]);

  close();
});
