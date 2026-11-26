import type { CookoutClient, EventStream, MessageId } from "../../sdk/index.ts";
import { expect, it, vi } from "vitest";
import { idOf, postedIn } from "./feed.ts";
import type { Posted } from "./feed.ts";
import { inPane } from "./regions.ts";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

const MISSING_ID = 999_999;
const QUOTED = "Deploy at **noon** on Friday.";
const SHOWN = "Deploy at noon on Friday.";

interface Quoting {
  readonly posted: Posted;
  readonly quoted: MessageId;
}

interface Replied {
  readonly posted: Posted;
  readonly href: string;
  readonly reply: MessageId;
}

async function quotingIn(channel: string, quoting: (quoted: MessageId) => string): Promise<Quoting> {
  const posted = await postedIn({ channel, closed: [], texts: [QUOTED] });
  const quoted = idOf({ posted, text: QUOTED });
  await posted.poster.createMessage({ channel, text: quoting(quoted) });
  return { posted, quoted };
}

function hrefOfMessage(channel: string, thread: MessageId, message: MessageId): string {
  return `#/channels/${channel}/threads/${String(thread)}/messages/${String(message)}`;
}

function cardsSaying(text: string): readonly HTMLElement[] {
  return inPane()
    .queryAllByRole("link", { name: (name) => name.includes(text) })
    .filter((link: unknown) => link instanceof HTMLElement && link.textContent.includes(" in #"));
}

async function cardFor(text: string): Promise<HTMLElement> {
  const card = await vi.waitFor(() => {
    const [found = null] = cardsSaying(text);
    if (found === null) {
      throw new TypeError(`no card says ${text}`);
    }
    return found;
  });
  return card;
}

async function openLive(client: CookoutClient, hash: string): Promise<() => Promise<void>> {
  const { live, stream } = watched(client);
  const unmount = openAt({ client, hash, live });
  const events: EventStream = await stream;
  return async () => {
    unmount();
    await events.close();
  };
}

async function linkedReply(channel: string): Promise<Replied> {
  const posted = await postedIn({ channel, closed: [], texts: ["Deploy?"] });
  const parent = idOf({ posted, text: "Deploy?" });
  const { message } = await posted.poster.createMessage({ channel, replyTo: parent, text: "Noon works for everyone." });
  const href = hrefOfMessage(channel, parent, message.id);
  await posted.poster.createMessage({ channel, text: `Answered: ${globalThis.location.origin}/${href}` });
  return { href, posted, reply: message.id };
}

it("msg and an ID in a message link to that message and show it as a card under the text", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { posted, quoted } = await quotingIn("web-quote-msg", (id) => `Settled in msg ${String(id)}, see there.`);
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}` });
  const card = await cardFor(SHOWN);
  const href = hrefOfMessage(posted.channel, quoted, quoted);

  expect(card.getAttribute("href")).toBe(href);
  expect(card.textContent).toContain(`${posted.channel}-ada`);
  expect(card.textContent).toContain(`Message in #${posted.channel}`);
  expect(
    inPane()
      .getByRole("link", { name: `msg ${String(quoted)}` })
      .getAttribute("href"),
  ).toBe(href);

  close();
});

it("a link to a reply on this board reads as msg and its channel, with the reply's card under it", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { href, posted, reply } = await linkedReply("web-quote-link");
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}` });
  const card = await cardFor("Noon works for everyone.");

  expect(card.getAttribute("href")).toBe(href);
  expect(card.textContent).toContain(`Reply in #${posted.channel}`);
  expect(inPane().getByRole("link", { name: `msg ${String(reply)} in #${posted.channel}` })).toBeDefined();

  close();
});

it("msg with an ID no message has, or inside code, stays plain text with no card", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const posted = await postedIn({
    channel: "web-quote-none",
    closed: [],
    texts: ["Only in code.", "Quoted for real."],
  });
  const inCode = idOf({ posted, text: "Only in code." });
  const real = idOf({ posted, text: "Quoted for real." });
  await posted.poster.createMessage({
    channel: posted.channel,
    text: `Nothing at msg ${String(MISSING_ID)}, \`msg ${String(inCode)}\` is code, and msg ${String(real)} is real.`,
  });
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}` });
  await cardFor("Quoted for real.");

  expect(inPane().queryByRole("link", { name: `msg ${String(MISSING_ID)}` })).toBeNull();
  expect(cardsSaying("Only in code.")).toStrictEqual([]);

  close();
});

it("deleting a quoted message takes its card away", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { posted, quoted } = await quotingIn("web-quote-deleted", (id) => `Settled in msg ${String(id)}.`);
  const close = await openLive(posted.reader, `#/channels/${posted.channel}`);
  await cardFor(SHOWN);
  await posted.poster.deleteMessage(quoted);

  await vi.waitFor(() => {
    expect(cardsSaying(SHOWN)).toStrictEqual([]);
  });

  await close();
});
