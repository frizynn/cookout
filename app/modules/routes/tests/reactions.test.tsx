import type { CookoutClient, Message } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

interface Talk {
  readonly ann: CookoutClient;
  readonly bob: CookoutClient;
  readonly message: Message;
}

interface ChipShown {
  readonly name: string;
  readonly pressed: boolean;
  readonly tooltip: string | null;
}

async function talkIn(channel: string): Promise<Talk> {
  const ann = await newIdentity({ kind: "human", name: `${channel}-ann` });
  const bob = await newIdentity({ kind: "human", name: `${channel}-bob` });
  await adminClient().createChannel({ name: channel });
  const { message } = await ann.client.createMessage({ channel, text: "Ship it?" });
  return { ann: ann.client, bob: bob.client, message };
}

function messageArticle(): HTMLElement {
  return within(screen.getByRole("list", { name: "Messages" })).getByRole("article");
}

function chipsShown(): readonly ChipShown[] {
  const shown: ChipShown[] = [];
  for (const chip of within(messageArticle()).queryAllByRole("button", { name: /^[👍👎] \d+$/u })) {
    shown.push({
      name: chip.textContent,
      pressed: chip.getAttribute("aria-pressed") === "true",
      tooltip: chip.getAttribute("title"),
    });
  }
  return shown;
}

async function chipsBecome(expected: readonly ChipShown[]): Promise<void> {
  await waitFor(() => {
    expect(chipsShown()).toStrictEqual(expected);
  });
}

async function openedAs(client: CookoutClient, channel: string): Promise<void> {
  openAt({ client, hash: `#/channels/${channel}` });
  await screen.findByText("Ship it?");
}

it("clicking 👍 in a message's hover actions shows a 👍 1 chip, highlighted as yours, naming you", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-react-hover";
  const { bob } = await talkIn(channel);
  await openedAs(bob, channel);
  fireEvent.click(within(messageArticle()).getByRole("button", { name: "React with 👍" }));

  await chipsBecome([{ name: "👍 1", pressed: true, tooltip: `${channel}-bob` }]);
});

it("clicking your own chip again removes your reaction, and the server forgets it", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-react-toggle";
  const { bob, message } = await talkIn(channel);
  await bob.react(message.id, "thumbs_up");
  await openedAs(bob, channel);
  await chipsBecome([{ name: "👍 1", pressed: true, tooltip: `${channel}-bob` }]);
  fireEvent.click(within(messageArticle()).getByRole("button", { name: "👍 1" }));
  await chipsBecome([]);
  const { messages } = await bob.listMessages(channel);

  expect(messages.map((shown) => "reactions" in shown)).toStrictEqual([false]);
});

it("a chip counts everyone's reaction, and clicking one that isn't yours adds yours", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-react-join";
  const { ann, bob, message } = await talkIn(channel);
  await ann.react(message.id, "thumbs_down");
  await openedAs(bob, channel);
  await chipsBecome([{ name: "👎 1", pressed: false, tooltip: `${channel}-ann` }]);
  fireEvent.click(within(messageArticle()).getByRole("button", { name: "👎 1" }));

  await chipsBecome([{ name: "👎 2", pressed: true, tooltip: `${channel}-ann, ${channel}-bob` }]);
});

it("the message menu, opened by right-clicking, offers 👍 and 👎", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-react-menu";
  const { bob } = await talkIn(channel);
  await openedAs(bob, channel);
  fireEvent.contextMenu(screen.getByText("Ship it?"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "React with 👎" }));

  await chipsBecome([{ name: "👎 1", pressed: true, tooltip: `${channel}-bob` }]);

  expect(screen.queryByRole("menu")).toBeNull();
});

it("pressing + on a focused message reacts 👍 and - reacts 👎", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-react-keys";
  const { bob } = await talkIn(channel);
  await openedAs(bob, channel);
  fireEvent.keyDown(messageArticle(), { key: "+" });
  await chipsBecome([{ name: "👍 1", pressed: true, tooltip: `${channel}-bob` }]);
  fireEvent.keyDown(messageArticle(), { key: "-" });

  await chipsBecome([
    { name: "👍 1", pressed: true, tooltip: `${channel}-bob` },
    { name: "👎 1", pressed: true, tooltip: `${channel}-bob` },
  ]);
});

it("a reaction left in another tab shows at once", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-react-live";
  const { ann, bob, message } = await talkIn(channel);
  const { live, stream } = watched(bob);
  openAt({ client: bob, hash: `#/channels/${channel}`, live });
  await screen.findByText("Ship it?");
  await stream;
  await ann.react(message.id, "thumbs_up");

  await chipsBecome([{ name: "👍 1", pressed: false, tooltip: `${channel}-ann` }]);
});
