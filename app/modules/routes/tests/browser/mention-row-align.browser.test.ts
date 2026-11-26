import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { createTestAgent } from "../../../testing/index.ts";
import { inPane } from "./regions.ts";
import { logIn } from "./login.ts";
import { unique } from "./names.ts";

const HALF = 2;
const PIXEL = 1;

async function middleOf(element: Locator): Promise<number> {
  const box = await element.boundingBox();
  if (box === null) {
    return Number.NaN;
  }
  return box.y + box.height / HALF;
}

async function dotOffsetOf(list: Locator, name: string): Promise<number> {
  const option = list.getByRole("option").filter({ has: list.getByText(`@${name}`, { exact: true }) });
  const dot = await middleOf(option.locator("svg[data-presence]"));
  const shown = await middleOf(option.getByText(`@${name}`, { exact: true }));
  return Math.abs(dot - shown);
}

async function suggestionsFor(page: Page, prefix: string): Promise<Locator> {
  const channel = unique("browser-mention-align");
  await adminClient().createChannel({ name: channel });
  const { token } = await newIdentity({ kind: "human", name: `${channel}-writer` });
  await logIn({ page, token, url: `/#/channels/${channel}` });
  await inPane(page).getByLabel("Message", { exact: true }).pressSequentially(`@${prefix}`);
  return inPane(page).getByRole("listbox", { exact: true, name: "Mention suggestions" });
}

test("a mention suggestion's presence dot sits level with its name, beside a person's avatar and an agent's", async ({
  page,
}) => {
  const prefix = unique("browser-align");
  const person = `${prefix}-person`;
  const agent = `${prefix}-agent`;
  await newIdentity({ kind: "human", name: person });
  await createTestAgent({ by: adminClient(), name: agent, owner: "admin" });
  const list = await suggestionsFor(page, prefix);

  await expect(list.getByRole("option")).toHaveCount(HALF);

  const offsets = [await dotOffsetOf(list, agent), await dotOffsetOf(list, person)];

  expect(offsets.map((offset) => offset < PIXEL)).toStrictEqual([true, true]);
});
