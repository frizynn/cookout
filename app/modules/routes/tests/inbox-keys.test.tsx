import type { CookoutClient, Message } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect, it, onTestFinished, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { inConversation, inThread } from "./regions.ts";
import { openWithClockStopped } from "./clock.ts";
import { subscribedReader } from "./inbox-reader.ts";

const INBOX = "#/inbox";
const NONE = 0;
const THREE = 3;
const TWO = 2;
const ONE = 1;

interface Threads {
  readonly channel: string;
  readonly reader: CookoutClient;
  readonly parents: readonly Message[];
}

interface Posting {
  readonly channel: string;
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
  readonly read: number;
}

async function postedThread(posting: Posting, index: number): Promise<Message> {
  const { channel, poster, reader } = posting;
  const { message: parent } = await poster.createMessage({ channel, text: `Thread ${String(index)}` });
  await reader.follow(parent.id);
  const { message: reply } = await poster.createMessage({
    channel,
    replyTo: parent.id,
    text: `Reply ${String(index)}`,
  });
  if (index < posting.read) {
    await reader.ack(reply.id);
  }
  return parent;
}

async function postedThreads(posting: Posting, from: number, count: number): Promise<readonly Message[]> {
  if (from >= count) {
    return [];
  }
  const parent = await postedThread(posting, from);
  const rest = await postedThreads(posting, from + ONE, count);
  return [parent, ...rest];
}

async function threadsWithReplies(channel: string, read: number, unread: number): Promise<Threads> {
  await adminClient().createChannel({ name: channel });
  const [poster, reader] = await Promise.all([
    newIdentity({ kind: "agent", name: `${channel}-poster` }),
    newIdentity({ kind: "human", name: `${channel}-reader` }),
  ]);
  const parents = await postedThreads(
    { channel, poster: poster.client, read, reader: reader.client },
    NONE,
    read + unread,
  );
  return { channel, parents, reader: reader.client };
}

async function emptyInbox(channel: string): Promise<CookoutClient> {
  const { reader } = await subscribedReader(channel);
  return reader;
}

function inboxAddresses(label: string): readonly string[] {
  const addresses: string[] = [];
  for (const link of within(screen.getByRole("list", { name: label })).getAllByRole("link")) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("#/inbox/")) {
      addresses.push(href);
    }
  }
  return addresses;
}

async function rowAddresses(label: string, count: number): Promise<readonly string[]> {
  const addresses = await waitFor(() => {
    const links = inboxAddresses(label);

    expect(links).toHaveLength(count);

    return links;
  });
  return addresses;
}

function pressed(key: string, held: Readonly<Partial<Pick<KeyboardEvent, "ctrlKey" | "metaKey">>> = {}): string {
  fireEvent.keyDown(globalThis.document.activeElement ?? globalThis.document.body, { key, ...held });
  return globalThis.location.hash;
}

function focusedHref(): string | null {
  const focused = globalThis.document.activeElement;
  if (focused === null) {
    return null;
  }
  return focused.getAttribute("href");
}

function narrowWindow(): void {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
}

it("j and k (or the down and up arrows) step through the rows, from the first with nothing selected, stopping at the ends", {
  timeout: 8000,
}, async () => {
  expect.hasAssertions();

  const { reader } = await threadsWithReplies("web-inbox-keys-steps", THREE, NONE);
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  const [first = "", second = "", third = ""] = await rowAddresses("Earlier", THREE);
  const lettered = [pressed("k"), pressed("j"), focusedHref(), pressed("j"), pressed("k")];
  const arrowed = [pressed("ArrowDown"), pressed("ArrowDown"), pressed("ArrowDown"), pressed("ArrowUp")];
  const ends = [pressed("j"), pressed("j"), pressed("k"), pressed("k"), pressed("k")];

  expect([lettered, arrowed, ends]).toStrictEqual([
    [INBOX, first, first, second, first],
    [second, third, third, second],
    [third, third, second, first, first],
  ]);

  unmount();
});

it("j moves from the last Activity row to the first Earlier row", { timeout: 8000 }, async () => {
  expect.hasAssertions();

  const { reader } = await threadsWithReplies("web-inbox-keys-sections", TWO, ONE);
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  const [activity = ""] = await rowAddresses("Activity", ONE);
  const [earlier = ""] = await rowAddresses("Earlier", TWO);

  expect([pressed("j"), pressed("j"), focusedHref()]).toStrictEqual([activity, earlier, earlier]);

  unmount();
});

it("o opens the selected row's thread", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { channel, parents, reader } = await threadsWithReplies("web-inbox-keys-open", ONE, NONE);
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  await rowAddresses("Earlier", ONE);
  pressed("j");
  const open = await inConversation().findByRole("link", { name: "Open thread" });
  pressed("o");
  await inThread().findByText("Reply 0");

  expect([open.getAttribute("aria-keyshortcuts"), [globalThis.location.hash]]).toStrictEqual([
    "o",
    parents.map((parent) => `#/channels/${channel}/threads/${String(parent.id)}`),
  ]);

  unmount();
});

it("keys held with Ctrl or Meta do nothing", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { reader } = await threadsWithReplies("web-inbox-keys-held", ONE, NONE);
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  await rowAddresses("Earlier", ONE);

  expect([pressed("j", { ctrlKey: true }), pressed("ArrowDown", { metaKey: true })]).toStrictEqual([INBOX, INBOX]);

  unmount();
});

it("keys outside the map, and j with no rows, do nothing", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const reader = await emptyInbox("web-inbox-keys-empty");
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  await screen.findByText("Nothing read yet.");

  expect([pressed("x"), pressed("j")]).toStrictEqual([INBOX, INBOX]);

  unmount();
});

it("esc goes back to the list from a conversation on a narrow window, and does nothing on a wide one", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { reader } = await threadsWithReplies("web-inbox-keys-escape", ONE, NONE);
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  const [address = ""] = await rowAddresses("Earlier", ONE);
  pressed("j");
  await inConversation().findByText("Thread 0");
  const wide = pressed("Escape");
  narrowWindow();

  expect([wide, pressed("Escape")]).toStrictEqual([address, INBOX]);

  unmount();
});

interface ReplyBox extends Threads {
  readonly box: HTMLElement;
  readonly address: string;
  readonly unmount: () => void;
}

async function replyBoxOfFirstRow(channel: string): Promise<ReplyBox> {
  const threads = await threadsWithReplies(channel, ONE, NONE);
  const unmount = openWithClockStopped({ client: threads.reader, hash: INBOX });
  await rowAddresses("Earlier", ONE);
  const address = pressed("j");
  const box = await inConversation().findByRole("textbox", { name: "Reply" });
  return { ...threads, address, box, unmount };
}

function typedHere(key: string): boolean {
  return fireEvent.keyDown(globalThis.document.activeElement ?? globalThis.document.body, { key });
}

function focusedTag(): string | null {
  const focused = globalThis.document.activeElement;
  if (focused === null) {
    return null;
  }
  return focused.tagName;
}

it("r and Enter focus the reply box, where j, e and u are typed, and Esc returns to the selected row keeping the draft", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { address, box, unmount } = await replyBoxOfFirstRow("web-inbox-keys-reply");
  pressed("r");
  const typing = [focusedTag(), typedHere("j"), typedHere("e"), typedHere("u"), globalThis.location.hash];
  fireEvent.change(box, { target: { value: "Half a draft" } });
  pressed("Escape");
  const afterEscape = focusedHref();
  pressed("Enter");

  expect([typing, afterEscape, focusedTag(), box]).toStrictEqual([
    ["TEXTAREA", true, true, true, address],
    address,
    "TEXTAREA",
    expect.objectContaining({ value: "Half a draft" }),
  ]);

  unmount();
});

it("the @ suggestions keep the up and down arrows and Enter while they show", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { address, box, channel, unmount } = await replyBoxOfFirstRow("web-inbox-keys-suggest");
  pressed("r");
  fireEvent.change(box, { target: { value: `Ping @${channel}-po` } });
  await inConversation().findByRole("list", { name: "Mention suggestions" });
  const taken = [typedHere("ArrowDown"), typedHere("ArrowUp"), typedHere("Enter")];

  expect([taken, globalThis.location.hash, box]).toStrictEqual([
    [false, false, false],
    address,
    expect.objectContaining({ value: `Ping @${channel}-poster ` }),
  ]);

  unmount();
});

async function unreadRepliesOf(reader: CookoutClient, parents: readonly Message[]): Promise<number> {
  const { items } = await reader.inbox();
  const ids = parents.map((parent) => parent.id);
  return items.filter((item) => item.message.kind === "reply" && ids.includes(item.parent.id)).length;
}

async function settledAt(reader: CookoutClient, parents: readonly Message[], count: number): Promise<number> {
  const settled = await waitFor(async () => {
    const unread = await unreadRepliesOf(reader, parents);

    expect(unread).toBe(count);

    return unread;
  });
  return settled;
}

function shortcutOf(name: string): string | null {
  return inConversation().getByRole("button", { name }).getAttribute("aria-keyshortcuts");
}

it("e reads the selected row at once, and u puts it back", { timeout: 8000 }, async () => {
  expect.hasAssertions();

  const { parents, reader } = await threadsWithReplies("web-inbox-keys-read", NONE, ONE);
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  await rowAddresses("Activity", ONE);
  pressed("j");
  await inConversation().findByRole("button", { name: "Mark read" });
  const before = await unreadRepliesOf(reader, parents);
  pressed("e");
  const afterE = await settledAt(reader, parents, NONE);
  pressed("u");
  const afterU = await settledAt(reader, parents, ONE);

  expect([shortcutOf("Mark read"), shortcutOf("Mark unread"), before, afterE, afterU]).toStrictEqual([
    "e",
    "u",
    ONE,
    NONE,
    ONE,
  ]);

  unmount();
});
