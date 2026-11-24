import type { CookoutClient, Message } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect, onTestFinished, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { inConversation } from "./regions.ts";
import { openWithClockStopped } from "./clock.ts";

const INBOX = "#/inbox";
const NONE = 0;
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

interface Wanted {
  readonly channel: string;
  readonly read: number;
  readonly unread: number;
}

async function threadsWithReplies({ channel, read, unread }: Wanted): Promise<Threads> {
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

interface Section {
  readonly label: string;
  readonly count: number;
}

async function rowAddresses({ count, label }: Section): Promise<readonly string[]> {
  const addresses = await waitFor(() => {
    const links = inboxAddresses(label);

    expect(links).toHaveLength(count);

    return links;
  });
  return addresses;
}

interface KeyInit {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
}

function keyInitOf(press: string | KeyInit): KeyInit {
  if (typeof press === "string") {
    return { key: press };
  }
  return press;
}

function pressed(press: string | KeyInit): string {
  fireEvent.keyDown(globalThis.document.activeElement ?? globalThis.document.body, keyInitOf(press));
  return globalThis.location.hash;
}

function typedHere(key: string): boolean {
  return fireEvent.keyDown(globalThis.document.activeElement ?? globalThis.document.body, { key });
}

function focusedHref(): string | null {
  const focused = globalThis.document.activeElement;
  if (focused === null) {
    return null;
  }
  return focused.getAttribute("href");
}

function focusedTag(): string | null {
  const focused = globalThis.document.activeElement;
  if (focused === null) {
    return null;
  }
  return focused.tagName;
}

function narrowWindow(): void {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
}

interface Selected extends Threads {
  readonly address: string;
  readonly unmount: () => void;
}

interface Selecting {
  readonly channel: string;
  readonly section: "Activity" | "Earlier";
}

async function firstRowSelected({ channel, section }: Selecting): Promise<Selected> {
  const threads = await threadsWithReplies({
    channel,
    read: Number(section === "Earlier"),
    unread: Number(section === "Activity"),
  });
  const unmount = openWithClockStopped({ client: threads.reader, hash: INBOX });
  await rowAddresses({ count: ONE, label: section });
  const address = pressed("j");
  await inConversation().findByRole("textbox", { name: "Reply" });
  return { ...threads, address, unmount };
}

async function unreadRepliesOf(reader: CookoutClient, parents: readonly Message[]): Promise<number> {
  const { items } = await reader.inbox();
  const ids = new Set(parents.map((parent) => parent.id));
  return items.filter((item) => item.message.kind === "reply" && ids.has(item.parent.id)).length;
}

interface Settling extends Threads {
  readonly count: number;
}

async function unreadSettledAt(threads: Settling): Promise<number> {
  const { count } = threads;
  const settled = await waitFor(async () => {
    const unread = await unreadRepliesOf(threads.reader, threads.parents);

    expect(unread).toBe(count);

    return unread;
  });
  return settled;
}

export {
  INBOX,
  firstRowSelected,
  focusedHref,
  focusedTag,
  narrowWindow,
  pressed,
  rowAddresses,
  threadsWithReplies,
  typedHere,
  unreadSettledAt,
};
