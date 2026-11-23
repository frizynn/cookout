import type { CookoutClient, Message } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { inPane, inSidebar } from "./regions.ts";
import { screen, waitFor, within } from "@testing-library/react";
import { openAt } from "./render.tsx";

interface People {
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
}

async function people(channel: string): Promise<People> {
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await adminClient().createChannel({ name: channel });
  return { poster: poster.client, reader: reader.client };
}

interface Posting {
  readonly by: CookoutClient;
  readonly channel: string;
  readonly text: string;
  readonly replyTo?: Message;
}

async function post({ by, channel, replyTo, text }: Posting): Promise<Message> {
  const { message } = await by.createMessage({ channel, text, ...(replyTo && { replyTo: replyTo.id }) });
  return message;
}

const WHY = /^(?:Mentioned you|Replied to you|New reply in a thread you follow|New in #.+)$/u;

function whysIn(label: string): readonly string[] {
  const whys: string[] = [];
  for (const why of within(inPane().getByRole("list", { name: label })).getAllByText(WHY)) {
    whys.push(why.textContent);
  }
  return whys;
}

function sidebarLink(name: string): HTMLElement {
  return inSidebar().getByRole("link", { name: new RegExp(`^${name}(?![a-z-])`, "u") });
}

function badgesOn(name: string): readonly string[] {
  const badges: string[] = [];
  for (const label of within(sidebarLink(name)).queryAllByText(/^\d+ (?:unread|for you)$/u)) {
    const hidden = label.closest("span.sr-only > span") !== null;
    badges.push(`${label.textContent}, hidden: ${String(hidden)}`);
  }
  return badges;
}

function isBold(name: string): boolean {
  return within(sidebarLink(name)).getByText(name).className.includes("font-semibold");
}

it("a mention shows the strong badge in the sidebar and leads its Inbox row with Mentioned you, under For you", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-attention-mention";
  const { poster, reader } = await people(channel);
  await post({ by: poster, channel, text: `@${channel}-reader can you check?` });
  const close = openAt({ client: reader, hash: "#/inbox" });
  await screen.findByRole("list", { name: "For you" });

  await waitFor(() => {
    expect([
      badgesOn("Inbox"),
      badgesOn(`#${channel}`),
      whysIn("For you"),
      inPane().queryByRole("list", { name: "Activity" }),
    ]).toStrictEqual([["1 for you, hidden: false"], ["1 for you, hidden: false"], ["Mentioned you"], null]);
  });

  close();
});

it("a followed-thread reply that doesn't mention you is activity only: bold, no count, under Activity", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-attention-activity";
  const { poster, reader } = await people(channel);
  const parent = await post({ by: poster, channel, text: "Deploy at noon?" });
  await reader.follow(parent.id);
  await post({ by: poster, channel, replyTo: parent, text: "Noon works" });
  const close = openAt({ client: reader, hash: "#/inbox" });
  await screen.findByRole("list", { name: "Activity" });

  expect([
    badgesOn("Inbox"),
    badgesOn(`#${channel}`),
    isBold(`#${channel}`),
    whysIn("Activity"),
    inPane().queryByRole("list", { name: "For you" }),
  ]).toStrictEqual([
    ["1 unread, hidden: true"],
    ["1 unread, hidden: true"],
    true,
    ["New reply in a thread you follow"],
    null,
  ]);

  close();
});

function headings(): readonly string[] {
  const texts: string[] = [];
  for (const heading of inPane().getAllByRole("heading", { level: 2 })) {
    texts.push(heading.textContent);
  }
  return texts;
}

const DOT = '[aria-hidden="true"].rounded-full.bg-mention-bar';
const PLAIN = "for you: false, dot: false, filled: false";
const DOTTED = "for you: true, dot: true, filled: false";

function accentsOf(found: () => readonly Element[]): readonly string[] {
  const accents: string[] = [];
  for (const element of found()) {
    const dotted = element.querySelector(DOT) !== null;
    const filled = /\bbg-mention-(?:bar|bg)\b/u.test(element.className);
    const forYou = element.matches('[data-for-you="true"]');
    accents.push(`for you: ${String(forYou)}, dot: ${String(dotted)}, filled: ${String(filled)}`);
  }
  return accents;
}

it("a For you row in the Inbox has an accent dot, not a filled block", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-attention-row";
  const { poster, reader } = await people(channel);
  await post({ by: poster, channel, text: `@${channel}-reader one for you` });
  const close = openAt({ client: reader, hash: "#/inbox" });
  const list = await screen.findByRole("list", { name: "For you" });

  expect(accentsOf(() => within(list).getAllByRole("link"))).toStrictEqual([
    "for you: false, dot: true, filled: false",
  ]);

  close();
});

async function ownThreadAnswered(channel: string): Promise<CookoutClient> {
  const { poster, reader } = await people(channel);
  await reader.subscribe(channel);
  const mine = await post({ by: reader, channel, text: "Deploy at noon?" });
  await post({ by: poster, channel, text: "Lunch first" });
  await post({ by: poster, channel, replyTo: mine, text: "Noon works" });
  return reader;
}

it("the Inbox lists For you before Activity, and a reply in your own thread is Replied to you", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-attention-order";
  const reader = await ownThreadAnswered(channel);
  const close = openAt({ client: reader, hash: "#/inbox" });
  await screen.findByRole("list", { name: "Activity" });
  await inPane().findByRole("heading", { level: 2, name: "Earlier" });

  expect([headings(), whysIn("For you"), whysIn("Activity")]).toStrictEqual([
    ["For you 1", "Activity 1", "Earlier"],
    ["Replied to you"],
    [`New in #${channel}`],
  ]);

  close();
});

function repliesShown(): readonly string[] {
  const panel = screen.getByRole("complementary", { name: "Thread" });
  return accentsOf(() => within(within(panel).getByRole("list", { name: "Replies" })).getAllByRole("article"));
}

interface Threads {
  readonly reader: CookoutClient;
  readonly theirs: Message;
  readonly mine: Message;
}

async function mixedThreads(channel: string): Promise<Threads> {
  const { poster, reader } = await people(channel);
  const theirs = await post({ by: poster, channel, text: "Deploy at noon?" });
  await post({ by: poster, channel, replyTo: theirs, text: "Noon works" });
  await post({ by: poster, channel, replyTo: theirs, text: `@${channel}-reader does noon suit you?` });
  const mine = await post({ by: reader, channel, text: "Rollback plan?" });
  await post({ by: poster, channel, replyTo: mine, text: "It's in the doc" });
  return { mine, reader, theirs };
}

it("in a thread, a reply that mentions you or answers your message has an accent dot, not a filled block, and other replies look normal", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-attention-thread";
  const { mine, reader, theirs } = await mixedThreads(channel);
  const close = openAt({ client: reader, hash: `#/channels/${channel}/threads/${String(theirs.id)}` });
  await screen.findByText("Noon works");
  const inTheirs = repliesShown();
  globalThis.location.hash = `#/channels/${channel}/threads/${String(mine.id)}`;
  await screen.findByText("It's in the doc");

  expect([inTheirs, repliesShown()]).toStrictEqual([[PLAIN, DOTTED], [DOTTED]]);

  close();
});

async function followedThreads(channel: string): Promise<CookoutClient> {
  const { poster, reader } = await people(channel);
  const quiet = await post({ by: poster, channel, text: "Deploy at noon?" });
  const loud = await post({ by: poster, channel, text: "Rollback plan?" });
  await Promise.all([reader.follow(quiet.id), reader.follow(loud.id)]);
  await post({ by: poster, channel, replyTo: quiet, text: "Noon works" });
  await post({ by: poster, channel, replyTo: quiet, text: "Or one" });
  await post({ by: poster, channel, replyTo: loud, text: `@${channel}-reader it's in the doc` });
  return reader;
}

function lookOf(summary: string, news: string): string {
  const link = inPane().getByRole("link", { name: new RegExp(`^${summary}`, "u") });
  const text = within(link).getByText(news);
  const dot = text.matches(`${DOT} + *`);
  return `bold: ${String(text.className.includes("font-semibold"))}, accent text: ${String(text.className.includes("mention"))}, dot: ${String(dot)}`;
}

it("in a channel, a thread's summary says how many replies are new, and one that mentions you has an accent dot before it", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-attention-summary";
  const reader = await followedThreads(channel);
  const close = openAt({ client: reader, hash: `#/channels/${channel}` });
  await inPane().findByRole("link", { name: /^2 replies, 2 new replies/u });
  const quiet = lookOf("2 replies, 2 new replies", "2 new replies");
  const loud = lookOf("1 reply, 1 new reply · mentions you", "1 new reply · mentions you");

  expect([quiet, loud]).toStrictEqual([
    "bold: true, accent text: false, dot: false",
    "bold: true, accent text: false, dot: true",
  ]);

  close();
});
