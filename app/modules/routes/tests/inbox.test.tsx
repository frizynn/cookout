import type { CookoutClient, EventStream, Message, MessageId } from "../../sdk/index.ts";
import { adminClient, anonymousClient, newIdentity, openAt, sessionOf } from "./app.tsx";
import { expect, it, onTestFinished, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { watched } from "./watched.ts";

const NONE = 0;
const TWO_A_PAGE = 2;
const FIVE_MINUTES = 300_000;
const TWO_HOURS = 7_200_000;
const THREE_DAYS = 259_200_000;

interface InboxReader {
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
}

interface Posted {
  readonly reader: CookoutClient;
  readonly first: Message;
  readonly parent: Message;
  readonly reply: Message;
  readonly other: Message;
}

interface OpenInbox {
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
  readonly close: () => Promise<void>;
}

async function subscribe(reader: CookoutClient, channel: string): Promise<void> {
  await adminClient().createChannel({ name: channel });
  await reader.subscribe(channel);
}

async function subscribedReader(channel: string, ...others: readonly string[]): Promise<InboxReader> {
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await Promise.all(
    [channel, ...others].map(async (name) => {
      await subscribe(reader.client, name);
    }),
  );
  return { poster: poster.client, reader: reader.client };
}

async function postedIn(channel: string, also: string): Promise<Posted> {
  const { poster, reader } = await subscribedReader(channel, also);
  const { message: first } = await poster.createMessage({ channel: also, text: "Lunch?" });
  const { message: parent } = await reader.createMessage({ channel, text: "Deploy at noon?" });
  const { message: reply } = await poster.createMessage({
    channel,
    replyTo: parent.id,
    text: `@${channel}-reader noon`,
  });
  const { message: other } = await poster.createMessage({ channel, text: "Or at one?" });
  return { first, other, parent, reader, reply };
}

async function postAll(poster: CookoutClient, channel: string, texts: readonly string[]): Promise<MessageId> {
  const [text, ...rest] = texts;
  const { message } = await poster.createMessage({ channel, text: String(text) });
  if (rest.length === NONE) {
    return message.id;
  }
  const last = await postAll(poster, channel, rest);
  return last;
}

async function readThenUnread(channel: string): Promise<CookoutClient> {
  const { poster, reader } = await subscribedReader(channel);
  await reader.ack(await postAll(poster, channel, ["One", "Two", "Three"]));
  await postAll(poster, channel, ["Four", "Five", "Six"]);
  return reader;
}

function postedRow(channel: string, text: string): string {
  return `#/channels/${channel} ${channel}-posterposted in#${channel}just now${text}Channel`;
}

function clockAt(moment: string): void {
  vi.useFakeTimers({ now: 0, toFake: ["Date"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  vi.setSystemTime(moment);
}

async function openWatched(channel: string): Promise<OpenInbox> {
  const { poster, reader } = await subscribedReader(channel);
  const { live, stream } = watched(reader);
  const unmount = openAt({ client: reader, hash: "#/inbox", live });
  await screen.findByText("You're all caught up.");
  await stream;
  return {
    close: async () => {
      unmount();
      const events: EventStream = await stream;
      await events.close();
    },
    poster,
    reader,
  };
}

async function openAndComeBack(href: string): Promise<void> {
  globalThis.location.hash = href;
  await screen.findByRole("list", { name: "Messages" });
  globalThis.location.hash = "#/inbox";
  await screen.findByRole("list", { name: "Earlier" });
}

async function timeShown(reader: CookoutClient, later: number): Promise<string> {
  vi.advanceTimersByTime(later);
  const unmount = openAt({ client: reader, hash: "#/inbox" });
  const row = await within(await screen.findByRole("list", { name: "Unread" })).findByRole("link");
  const shown = within(row).getByText(/ ago$/u).textContent;
  unmount();
  return shown;
}

function rowsOf(label: string): readonly string[] {
  const rows: string[] = [];
  for (const link of within(screen.getByRole("list", { name: label })).getAllByRole("link")) {
    rows.push(`${link.getAttribute("href") ?? ""} ${link.textContent}`);
  }
  return rows;
}

it("the inbox lists unread items newest first, each with who posted it where, its thread and its reasons", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-inbox";
  const also = `${channel}-also`;
  const { first, other, parent, reader, reply } = await postedIn(channel, also);
  const unmount = openAt({ client: reader, hash: "#/inbox" });

  await screen.findByRole("list", { name: "Unread" });

  expect(screen.getByRole("heading", { level: 2, name: "Unread 3" })).toBeDefined();
  expect(rowsOf("Unread")).toStrictEqual([
    `#/channels/${channel} ${channel}-posterposted in#${channel}just now${other.text}Channel`,
    `#/channels/${channel}/threads/${String(parent.id)} ${channel}-posterreplied in a thread in#${channel}just nowre: ${parent.text}${reply.text}ThreadMention`,
    `#/channels/${also} ${channel}-posterposted in#${also}just now${first.text}Channel`,
  ]);

  unmount();
});

it("earlier lists read items newest first, a page at a time, until there are no more", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-inbox-earlier";
  const reader = await readThenUnread(channel);
  const unmount = openAt({ client: reader, hash: "#/inbox", pageSize: TWO_A_PAGE });
  await screen.findByRole("list", { name: "Earlier" });

  expect([rowsOf("Earlier"), screen.queryByText("That's everything.")]).toStrictEqual([
    [postedRow(channel, "Three")],
    null,
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await screen.findByText("That's everything.");

  expect([rowsOf("Earlier"), rowsOf("Unread"), screen.queryByRole("button", { name: "Load more" })]).toStrictEqual([
    ["Three", "Two", "One"].map((text) => postedRow(channel, text)),
    ["Six", "Five", "Four"].map((text) => postedRow(channel, text)),
    null,
  ]);

  unmount();
});

it("with nothing in it, the inbox says it is all caught up and nothing is read yet", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { reader } = await subscribedReader("web-inbox-empty");
  const unmount = openAt({ client: reader, hash: "#/inbox" });

  await screen.findByText("Nothing read yet.");

  expect(screen.getByText("You're all caught up.")).toBeDefined();
  expect(screen.getByRole("heading", { level: 2, name: "Unread 0" })).toBeDefined();

  unmount();
});

it("a live mention appears at the top of Unread, and opening it moves it to Earlier", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-inbox-live";
  const { close, poster } = await openWatched(channel);
  const { message } = await poster.createMessage({ channel, text: `@${channel}-reader look` });

  const row = await within(await screen.findByRole("list", { name: "Unread" })).findByRole("link");

  expect(row.textContent).toContain("Mention");

  await openAndComeBack(String(row.getAttribute("href")));

  expect([rowsOf("Earlier"), screen.getByText("You're all caught up.").tagName]).toStrictEqual([
    [`#/channels/${channel} ${channel}-posterposted in#${channel}just now${message.text}MentionChannel`],
    "P",
  ]);

  await close();
});

it("each item's time is how long ago it was posted, in minutes, hours or days", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-inbox-times";
  const { poster, reader } = await subscribedReader(channel);
  const { message } = await poster.createMessage({ channel, text: "Deploy at noon?" });
  clockAt(message.createdAt);
  const minutes = await timeShown(reader, FIVE_MINUTES);
  const hours = await timeShown(reader, TWO_HOURS);
  const days = await timeShown(reader, THREE_DAYS);

  expect([minutes, hours, days]).toStrictEqual(["5m ago", "2h ago", "3d ago"]);
});

it("clicking a reply's row opens its thread", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-inbox-open";
  const { parent, reader } = await postedIn(channel, `${channel}-also`);
  const unmount = openAt({ client: reader, hash: "#/inbox" });
  const unread = await screen.findByRole("list", { name: "Unread" });

  fireEvent.click(within(unread).getByRole("link", { name: /replied in a thread/u }));

  await waitFor(() => {
    expect(globalThis.location.hash).toBe(`#/channels/${channel}/threads/${String(parent.id)}`);
  });

  unmount();
});

it("an inbox that can't be read says why", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const unmount = openAt({ client: anonymousClient(), hash: "#/inbox", session: sessionOf(adminClient()) });

  await screen.findByRole("navigation", { name: "Sidebar" });
  const alert = await within(screen.getByRole("main")).findByRole("alert");

  expect(alert.textContent).toMatch(/^Couldn't load the inbox \(\w+\): /u);

  unmount();
});
