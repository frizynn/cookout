import type { CookoutClient, EventStream, Message } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect } from "vitest";
import { inPane } from "./regions.ts";
import { openAt } from "./render.tsx";
import { waitFor } from "@testing-library/react";
import { watched } from "./watched.ts";

const LIST = "Open threads";

interface Starters {
  readonly channel: string;
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
  readonly readerName: string;
}

interface Posting {
  readonly by: CookoutClient;
  readonly channel: string;
  readonly texts: readonly string[];
}

interface Opening {
  readonly client: CookoutClient;
  readonly hash: string;
  readonly pageSize?: number;
}

interface Expected {
  readonly channel: string;
  readonly texts: readonly string[];
}

async function startersIn(channel: string): Promise<Starters> {
  const poster = await newIdentity({ kind: "human", name: `${channel}-ada` });
  const readerName = `${channel}-grace`;
  const reader = await newIdentity({ kind: "human", name: readerName });
  await adminClient().createChannel({ name: channel });
  return { channel, poster: poster.client, reader: reader.client, readerName };
}

async function posted({ by, channel, texts }: Posting): Promise<readonly Message[]> {
  const [text, ...rest] = texts;
  if (typeof text !== "string") {
    return [];
  }
  const { message } = await by.createMessage({ channel, text });
  const later = await posted({ by, channel, texts: rest });
  return [message, ...later];
}

async function postedOne({ by, channel, text }: Omit<Posting, "texts"> & { readonly text: string }): Promise<Message> {
  const { message } = await by.createMessage({ channel, text });
  return message;
}

async function involvedIn(channel: string): Promise<Starters> {
  const starters = await startersIn(channel);
  const { poster, reader, readerName } = starters;
  const asked = await postedOne({ by: poster, channel, text: "Deploy at noon?" });
  await posted({ by: poster, channel, texts: [`@${readerName} can you look?`, "Nobody asked you."] });
  await posted({ by: reader, channel, texts: ["My own question."] });
  await reader.createMessage({ channel, replyTo: asked.id, text: "Yes." });
  return starters;
}

async function twoThreadsIn(channel: string): Promise<Starters & { readonly first: Message }> {
  const starters = await startersIn(channel);
  const first = await postedOne({ by: starters.reader, channel, text: "First." });
  await posted({ by: starters.reader, channel, texts: ["Second."] });
  return { ...starters, first };
}

async function openLive(opening: Opening): Promise<() => Promise<void>> {
  const { live, stream } = watched(opening.client);
  const unmount = openAt({ ...opening, live });
  const events: EventStream = await stream;
  return async () => {
    unmount();
    await events.close();
  };
}

async function openThreadsShown(channel: string): Promise<readonly string[]> {
  const list = await inPane().findByRole("list", { name: LIST });
  const rows: string[] = [];
  for (const row of list.querySelectorAll("li")) {
    const hrefs: string[] = [];
    for (const link of row.querySelectorAll('a[href^="#/channels/"]')) {
      hrefs.push(link.getAttribute("href") ?? "");
    }
    if (row.textContent.includes(`#${channel}`)) {
      rows.push(`${hrefs.join(" ")} ${row.textContent}`);
    }
  }
  return rows;
}

function closeIn(text: string): HTMLElement {
  const list = inPane().getByRole("list", { name: LIST });
  for (const row of list.querySelectorAll("li")) {
    const button = row.querySelector("button");
    if (row.textContent.includes(text) && button !== null) {
      return button;
    }
  }
  throw new TypeError(`No open thread says ${text}`);
}

async function listShows({ channel, texts }: Expected): Promise<void> {
  await waitFor(async () => {
    const rows = await openThreadsShown(channel);

    expect(rows.map((row) => texts.find((text) => row.includes(text)) ?? row)).toStrictEqual(texts);
  });
}

export { closeIn, involvedIn, listShows, openLive, openThreadsShown, posted, postedOne, startersIn, twoThreadsIn };
