import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane } from "./regions.ts";
import { logIn } from "./login.ts";
import { unique } from "./names.ts";

const DISPLAY_NAME = "Support coordinator";

function inSettings(page: Page): Locator {
  return page.getByRole("dialog", { exact: true, name: "Channel settings" });
}

function inOwnerList(page: Page): Locator {
  return page.getByRole("dialog", { exact: true, name: "Owner" });
}

interface Opened {
  readonly agent: string;
  readonly channel: string;
}

async function openSettings(page: Page): Promise<Opened> {
  const channel = unique("browser-agent-field");
  const agent = unique("browser-agent-field-bot");
  const admin = unique("browser-agent-field-admin");
  await adminClient().createChannel({ name: channel });
  await newIdentity({ displayName: DISPLAY_NAME, kind: "agent", name: agent });
  const { token } = await newIdentity({ kind: "human", name: admin });
  await adminClient().makeAdmin(admin);
  await logIn({ page, token, url: `/#/channels/${channel}` });
  await inPane(page).getByRole("button", { exact: true, name: "Settings" }).click();
  return { agent, channel };
}

async function ownerOf(channel: string): Promise<string | null> {
  const { channel: found } = await adminClient().getChannel(channel);
  return found.owner ?? null;
}

test("a channel's owner is picked from a list of agents, each with its avatar, display name and handle", async ({
  page,
}) => {
  const { agent, channel } = await openSettings(page);
  await inSettings(page).getByRole("button", { exact: true, name: "Owner: No one" }).click();
  const option = inOwnerList(page).getByRole("button", { exact: true, name: `${DISPLAY_NAME} @${agent}` });

  await expect(option.getByTestId("avatar")).toBeVisible();

  await option.click();

  await expect(inSettings(page).getByRole("button", { exact: true, name: `Owner: ${agent}` })).toContainText(
    DISPLAY_NAME,
  );

  await inSettings(page).getByRole("button", { exact: true, name: "Save" }).click();

  await expect(inSettings(page)).toBeHidden();
  await expect
    .poll(async () => {
      const owner = await ownerOf(channel);
      return owner;
    })
    .toBe(agent);
});

test("the agent list opens on No one, and the arrows and Home move through it", async ({ page }) => {
  await openSettings(page);
  await inSettings(page).getByRole("button", { exact: true, name: "Owner: No one" }).click();
  const focused = page.locator(":focus");

  await expect(focused).toHaveAccessibleName("No one");

  await page.keyboard.press("ArrowDown");

  await expect(focused).not.toHaveAccessibleName("No one");

  await page.keyboard.press("Home");

  await expect(focused).toHaveAccessibleName("No one");
});

test("the agent list opens on the picked agent, and Enter keeps it and goes back to the field", async ({ page }) => {
  const { agent } = await openSettings(page);
  const owner = inSettings(page).getByRole("button", { exact: true, name: `Owner: ${agent}` });
  await inSettings(page).getByRole("button", { exact: true, name: "Owner: No one" }).click();
  await inOwnerList(page)
    .getByRole("button", { exact: true, name: `${DISPLAY_NAME} @${agent}` })
    .click();
  await owner.click();

  await expect(page.locator(":focus")).toHaveAccessibleName(`${DISPLAY_NAME} @${agent}`);

  await page.keyboard.press("Enter");

  await expect(owner).toBeFocused();
});
