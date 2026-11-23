import type { Locator, Page } from "@playwright/test";
import { adminClient, logInWithStream, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Person } from "./people.ts";

interface Watching {
  readonly poster: Person;
  readonly reader: Person;
  readonly row: Locator;
}

async function watchList(page: Page, channel: string): Promise<Watching> {
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await reader.client.subscribe(channel);
  await logInWithStream({ page, token: reader.token });
  const row = page.getByRole("link", { name: new RegExp(`^#${channel}(?![a-z-])`, "u") });

  await expect(row).toBeVisible();

  return { poster, reader, row };
}

async function rowInSecondTab(page: Page, channel: string): Promise<Locator> {
  const other = await page.context().newPage();
  const streamOpen = other.waitForResponse((response) => response.url().includes("/v1/events"));
  await other.goto("/");
  await streamOpen;
  return other.getByRole("link", { name: new RegExp(`^#${channel}(?![a-z-])`, "u") });
}

async function openChannel(page: Page, row: Locator, newest: string): Promise<void> {
  await row.click();

  await expect(page.getByRole("list", { name: "Messages" })).toContainText(newest);
}

async function openAndGoBack(page: Page, row: Locator, newest: string): Promise<void> {
  await openChannel(page, row, newest);
  await page.getByRole("link", { name: "← Channels" }).click();
}

test("a channel's unread count goes up when another identity posts, then to zero once it is opened", async ({
  page,
}) => {
  const channel = "browser-unread";
  const { poster, row } = await watchList(page, channel);

  await expect(row).toHaveAccessibleName(`#${channel}`);

  await poster.client.createMessage({ channel, text: "Deploy at noon?" });

  await expect(row).toHaveAccessibleName(`#${channel} 1 unread`);

  await poster.client.createMessage({ channel, text: "Or at one?" });

  await expect(row).toHaveAccessibleName(`#${channel} 2 unread`);

  await openAndGoBack(page, row, "Or at one?");

  await expect(row).toHaveAccessibleName(`#${channel}`);
});

test("a message that mentions the reader shows in the channel's mention count, apart from its unread count", async ({
  page,
}) => {
  const channel = "browser-unread-mention";
  const { poster, row } = await watchList(page, channel);

  await poster.client.createMessage({ channel, text: "Deploy at noon?" });
  await poster.client.createMessage({ channel, text: `@${channel}-reader can you check the rollout?` });

  await expect(row).toHaveAccessibleName(`#${channel} 1 unread 1 mention`);
  await expect(row.getByText("@1")).toBeVisible();
});

test("a message that arrives in a channel the reader has open counts as read, in every tab", async ({ page }) => {
  const channel = "browser-unread-open";
  const { poster, reader, row } = await watchList(page, channel);
  const otherRow = await rowInSecondTab(page, channel);
  await poster.client.createMessage({ channel, text: "Deploy at noon?" });

  await expect(otherRow).toHaveAccessibleName(`#${channel} 1 unread`);

  await openChannel(page, row, "Deploy at noon?");

  await expect(otherRow).toHaveAccessibleName(`#${channel}`);

  await poster.client.createMessage({ channel, text: "Or at one?" });

  await expect
    .poll(async () => {
      const { items } = await reader.client.inbox();
      return items;
    })
    .toStrictEqual([]);
  await expect(otherRow).toHaveAccessibleName(`#${channel}`);
});
