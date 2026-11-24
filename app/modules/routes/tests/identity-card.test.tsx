import type { CookoutClient, EventStream } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { agentNamed, openedBy } from "./presence.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { inPane } from "./regions.ts";
import { openAt } from "./render.tsx";

const PREFIX = "web-card";

interface Card {
  readonly lines: readonly string[];
  readonly profile: string | null;
}

async function readerOn(channel: string): Promise<() => void> {
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  return openAt({ client: reader.client, hash: `#/channels/${channel}` });
}

async function authorName(name: string): Promise<HTMLElement> {
  const messages = await screen.findByRole("list", { name: "Messages" });
  const link = await within(messages).findByRole("link", { name });
  return link;
}

async function cardOf(trigger: () => HTMLElement): Promise<Card> {
  const card = await screen.findByRole("tooltip");
  await waitFor(() => {
    expect(trigger().getAttribute("aria-describedby")).toBe(card.id);
  });
  const lines: string[] = [];
  for (const line of card.querySelectorAll("p")) {
    lines.push(line.textContent);
  }
  return { lines, profile: within(card).getByRole("link", { name: "View profile" }).getAttribute("href") };
}

async function hovered(name: string): Promise<Card> {
  const trigger = await authorName(name);
  fireEvent.pointerMove(trigger, { pointerType: "mouse" });
  const card = await cardOf(() => trigger);
  return card;
}

async function profileHeading(): Promise<string> {
  const panel = await screen.findByRole("complementary", { name: "Profile" });
  const heading = await within(panel).findByRole("heading", { level: 3 });
  return heading.textContent;
}

async function postedBy(channel: string, author: CookoutClient): Promise<() => void> {
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await adminClient().createChannel({ name: channel });
  await author.createMessage({ channel, text: `Hello @${channel}-reader` });
  return openAt({ client: reader.client, hash: `#/channels/${channel}` });
}

async function deactivatedAuthor(channel: string, author: CookoutClient): Promise<() => void> {
  await adminClient().createChannel({ name: channel });
  const { message } = await author.createMessage({ channel, text: "Bye" });
  await adminClient().deactivateIdentity(message.author.name);
  const close = await readerOn(channel);
  return close;
}

async function describedAgent(channel: string): Promise<Awaited<ReturnType<typeof agentNamed>>> {
  const owner = `${channel}-owner`;
  const bot = `${channel}-bot`;
  await newIdentity({ kind: "human", name: owner });
  const agent = await agentNamed(bot);
  await adminClient().transferAgent(bot, owner);
  await adminClient().setDisplayName(bot, "Mail Bot");
  await adminClient().setDescription(bot, "Reads the mail");
  return agent;
}

async function onlineAgent(channel: string): Promise<EventStream> {
  const agent = await describedAgent(channel);
  const events = await agent.watch();
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await adminClient().createChannel({ name: channel });
  await agent.client.createMessage({ channel, text: "Beep" });
  await openedBy({ client: reader.client, hash: `#/channels/${channel}` });
  return events;
}

it("hovering an agent author's name opens a card with its presence, name, description, owner and a link to its profile in People", {
  timeout: 10_000,
}, async () => {
  expect.hasAssertions();

  const channel = `${PREFIX}-agent`;
  const bot = `${channel}-bot`;
  const events = await onlineAgent(channel);

  await expect(hovered("Mail Bot")).resolves.toStrictEqual({
    lines: ["Online", "Mail Bot", `@${bot}`, "Reads the mail", `Agent · owned by ${channel}-owner`],
    profile: `#/people/${bot}`,
  });

  await events.close();

  await waitFor(() => {
    expect(screen.getByRole("tooltip").textContent).toMatch(/^Offline/u);
  });

  fireEvent.click(within(screen.getByRole("tooltip")).getByRole("link", { name: "View profile" }));

  await expect(profileHeading()).resolves.toMatch(`Mail Bot@${bot}`);
});

it("hovering a person's name opens a card with their presence, name and profile link, and no owner", {
  timeout: 10_000,
}, async () => {
  expect.hasAssertions();

  const channel = `${PREFIX}-person`;
  const ann = await newIdentity({ kind: "human", name: `${channel}-ann` });
  const close = await postedBy(channel, ann.client);

  await expect(hovered(`${channel}-ann`)).resolves.toStrictEqual({
    lines: ["Offline", `${channel}-ann`, "Human"],
    profile: `#/people/${channel}-ann`,
  });

  close();
});

it("focusing an @mention opens its card, and Escape closes it", { timeout: 10_000 }, async () => {
  expect.hasAssertions();

  const channel = `${PREFIX}-mention`;
  const close = await postedBy(channel, adminClient());
  const mention = await inPane().findByRole("link", { name: `@${channel}-reader` });
  mention.focus();

  await expect(cardOf(() => mention)).resolves.toStrictEqual({
    lines: ["Offline", `${channel}-reader`, "Human"],
    profile: `#/people/${channel}-reader`,
  });

  fireEvent.keyDown(mention, { key: "Escape" });

  await waitFor(() => {
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  close();
});

it("a deactivated identity's card says Deactivated", { timeout: 10_000 }, async () => {
  expect.hasAssertions();

  const channel = `${PREFIX}-gone`;
  const cy = await newIdentity({ kind: "human", name: `${channel}-cy` });
  const close = await deactivatedAuthor(channel, cy.client);

  await expect(hovered(`${channel}-cy`)).resolves.toStrictEqual({
    lines: ["Offline", `${channel}-cy`, "Human", "Deactivated"],
    profile: `#/people/${channel}-cy`,
  });

  close();
});
