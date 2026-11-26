import type { Page, Route } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { test as base, expect } from "@playwright/test";
import type { Person } from "./people.ts";
import { inPane } from "./regions.ts";
import { logInWithStream } from "./login.ts";
import { probeFixtures } from "./probe.ts";
import { unique } from "./names.ts";

const test = base.extend(probeFixtures);

const EARLIER = 12;
const LAST = "The last word, under its quote.";
const QUOTED = "A quoted message long enough to give its card a few lines of height in the feed.";
const QUOTE_DELAY = 800;

interface Quoting {
  readonly channel: string;
  readonly reader: Person;
}

async function postedInOrder(poster: Person, channel: string, texts: readonly string[]): Promise<void> {
  const [text = null, ...rest] = texts;
  if (text === null) {
    return;
  }
  await poster.client.createMessage({ channel, text });
  await postedInOrder(poster, channel, rest);
}

async function quotingAtTheEnd(): Promise<Quoting> {
  const channel = unique("feed-end");
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  const { message: quoted } = await poster.client.createMessage({ channel, text: QUOTED });
  const earlier = Array.from({ length: EARLIER }, (_each, index) => `Earlier message ${String(index)}.`);
  await postedInOrder(poster, channel, [...earlier, `See msg ${String(quoted.id)}.\n\n${LAST}`]);
  return { channel, reader };
}

async function quotesLate(page: Page): Promise<void> {
  await page.route("**/v1/messages/*/thread", async (route: Route) => {
    await page.waitForTimeout(QUOTE_DELAY);
    await route.continue();
  });
}

test("a channel whose newest message quotes another opens at its end, with the quote's card in view even when it arrives late", async ({
  page,
}) => {
  const { channel, reader } = await quotingAtTheEnd();
  await quotesLate(page);
  await logInWithStream({ page, token: reader.token, url: `/#/channels/${channel}` });
  const card = inPane(page)
    .getByRole("link")
    .filter({ has: page.getByText(QUOTED, { exact: true }) });

  await expect(inPane(page).getByText(LAST, { exact: true })).toBeInViewport();
  await expect(card).toBeInViewport({ ratio: 1 });
});
