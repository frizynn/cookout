import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane } from "./regions.ts";
import { logIn } from "./login.ts";
import { unique } from "./names.ts";

const CORNER = 0;
const FIRST = "The first paragraph of the first message.";
const SECOND = "The second paragraph of the first message.";
const FOLLOW_UP = "A second message a moment later.";

interface Edges {
  readonly top: number;
  readonly bottom: number;
}

async function edgesOf(locator: Locator): Promise<Edges> {
  const box = await locator.boundingBox();
  if (box === null) {
    return { bottom: CORNER, top: CORNER };
  }
  return { bottom: box.y + box.height, top: box.y };
}

async function twoMessagesFromOneAuthor(page: Page): Promise<void> {
  const channel = unique("browser-follow-up");
  await adminClient().createChannel({ name: channel });
  const agent = await newIdentity({ kind: "agent", name: unique("browser-follow-up") });
  await agent.client.createMessage({ channel, text: `${FIRST}\n\n${SECOND}` });
  await agent.client.createMessage({ channel, text: FOLLOW_UP });
  const { token } = await newIdentity({ kind: "human", name: unique("browser-follow-up-reader") });
  await logIn({ page, token, url: `/#/channels/${channel}` });
  await page.mouse.move(CORNER, CORNER);
}

test("a message right after another from the same author shows its time and sits further off than a paragraph break", async ({
  page,
}) => {
  await twoMessagesFromOneAuthor(page);
  const messages = inPane(page).getByRole("article");
  const followUp = messages.filter({ hasText: FOLLOW_UP });

  await expect(followUp.locator("time")).toBeVisible();

  const first = await edgesOf(messages.getByText(FIRST, { exact: true }));
  const second = await edgesOf(messages.getByText(SECOND, { exact: true }));
  const next = await edgesOf(followUp.getByText(FOLLOW_UP, { exact: true }));

  expect(next.top - second.bottom).toBeGreaterThan(second.top - first.bottom);
});
