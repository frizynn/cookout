import type { CookoutClient, EventStream } from "../../sdk/index.ts";
import { adminClient, clientWith, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { addCommand } from "./commands.ts";
import { inSidebar } from "./regions.ts";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

async function openLive(client: CookoutClient, hash: string): Promise<() => Promise<void>> {
  const { live, stream } = watched(client);
  const unmount = openAt({ client, hash, live });
  const events: EventStream = await stream;
  return async () => {
    unmount();
    await events.close();
  };
}

async function openChannelLive(client: CookoutClient, channel: string): Promise<() => Promise<void>> {
  await adminClient().createChannel({ name: channel });
  const close = await openLive(client, `#/channels/${channel}`);
  await screen.findByLabelText("Message");
  return close;
}

async function agentCard(name: string): Promise<HTMLElement> {
  const card = await screen.findByRole("group", { name: `@${name}` });
  return card;
}

async function ownerWithAgent(prefix: string): Promise<CookoutClient> {
  const human = await newIdentity({ kind: "human", name: `${prefix}-human` });
  await newIdentity({ kind: "agent", name: `${prefix}-bot`, owner: `${prefix}-human` });
  return human.client;
}

it("a command registered elsewhere shows in the / suggestions without a reload", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = await openChannelLive(adminClient(), "web-live-command");
  await addCommand({ description: "Ships it", name: "web-live-command-ship" });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "/web-live-command-sh" } });

  await expect(screen.findByRole("list", { name: "Command suggestions" })).resolves.toHaveProperty(
    "textContent",
    expect.stringContaining("/web-live-command-ship"),
  );

  await close();
});

it("an agent's join and leave elsewhere show in Settings without a reload", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const human = await ownerWithAgent("web-live-session");
  const close = await openLive(human, "#/settings/agents");
  const card = await agentCard("web-live-session-bot");
  await within(card).findByText("No live session");
  const { agentSessionToken } = await human.join({ as: "web-live-session-bot", host: "laptop" });
  await within(card).findByText(/^Joined from laptop/u);
  await clientWith(agentSessionToken).leave();

  await expect(within(card).findByText("No live session")).resolves.toBeInstanceOf(HTMLElement);

  await close();
});

it("an agent's session that expires leaves Settings without a reload", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const human = await ownerWithAgent("web-live-expiry");
  await human.join({ as: "web-live-expiry-bot", host: "laptop", idleExpiry: "1s" });
  const close = await openLive(human, "#/settings/agents");
  const card = await agentCard("web-live-expiry-bot");
  await within(card).findByText(/^Joined from laptop/u);

  await expect(within(card).findByText("No live session", {}, { timeout: 3000 })).resolves.toBeInstanceOf(HTMLElement);

  await close();
});

it("a channel deleted elsewhere leaves the sidebar, and its open view goes to the Inbox with a notice", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const reader = await newIdentity({ kind: "human", name: "web-live-deleted-reader" });
  const close = await openChannelLive(reader.client, "web-live-deleted");
  await adminClient().deleteChannel("web-live-deleted");
  const notice = await screen.findByRole("status");

  expect([
    notice.textContent,
    globalThis.location.hash,
    inSidebar().queryByRole("link", { name: /^#web-live-deleted/u }),
  ]).toStrictEqual(["#web-live-deleted was deleted, so you're back in your inbox.Dismiss", "#/inbox", null]);

  fireEvent.click(within(notice).getByRole("button", { name: "Dismiss" }));

  expect(screen.queryByRole("status")).toBeNull();

  await close();
});
