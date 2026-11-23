import { adminClient, openAt } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Message } from "../../sdk/index.ts";

async function threadIn(channel: string): Promise<Message> {
  const admin = adminClient();
  await admin.createChannel({ name: channel });
  const { message: parent } = await admin.createMessage({ channel, text: "The parent" });
  await admin.createMessage({ channel, replyTo: parent.id, text: "First reply" });
  await admin.createMessage({ channel, replyTo: parent.id, text: "Second reply" });
  return parent;
}

async function threadPanel(): Promise<HTMLElement> {
  const panel = await screen.findByRole("complementary", { name: "Thread" });
  return panel;
}

function hashOf(parent: Message): string {
  return `#/channels/${parent.channel}/threads/${String(parent.id)}`;
}

it("a thread's address opens its channel with the thread panel beside it, and closing the panel leaves the channel", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const parent = await threadIn("web-thread-back");
  const close = openAt({ client: adminClient(), hash: hashOf(parent) });

  const panel = await threadPanel();
  const heading = screen.getByRole("heading", { level: 1 });
  fireEvent.click(within(panel).getByRole("link", { name: "Close thread" }));
  await waitFor(() => {
    expect(screen.queryByRole("complementary", { name: "Thread" })).toBeNull();
  });

  expect([
    heading.textContent,
    globalThis.location.hash,
    screen.getByRole("heading", { level: 1 }).textContent,
  ]).toStrictEqual(["#web-thread-back", "#/channels/web-thread-back", "#web-thread-back"]);

  close();
});

it("following a message's reply count opens its thread in the panel, beside the channel", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const parent = await threadIn("web-thread-opens");
  const close = openAt({ client: adminClient(), hash: `#/channels/${parent.channel}` });

  fireEvent.click(await screen.findByRole("link", { name: /The parent/u }));
  const parentMessage = await within(await threadPanel()).findByRole("article", { name: "Parent message" });

  expect([
    globalThis.location.hash,
    parentMessage.textContent,
    screen.getByRole("list", { name: "Messages" }).textContent,
  ]).toStrictEqual([hashOf(parent), "@adminThe parent", "@adminThe parent2 replies"]);

  close();
});
