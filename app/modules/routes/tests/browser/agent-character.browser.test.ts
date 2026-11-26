import type { Locator, Page } from "@playwright/test";
import { createdBy, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Person } from "./people.ts";
import { inProfile } from "./regions.ts";
import { logInToChannels } from "./login.ts";
import { unique } from "./names.ts";

const SIDE = 256;
const NONE = 0;

interface Owned {
  readonly owner: Person;
  readonly agent: string;
}

async function ownedAgent(page: Page): Promise<Owned> {
  const owner = await newIdentity({ kind: "human", name: unique("browser-character-owner") });
  const agent = unique("browser-character-bot");
  await createdBy({ by: owner.client, request: { displayName: "Pixel Helper", kind: "agent", name: agent } });
  await logInToChannels({ page, token: owner.token });
  await page.goto(`/#/people/${agent}`);
  return { agent, owner };
}

function hasAvatar({ agent, owner }: Owned): () => Promise<boolean> {
  return async () => {
    const { identity } = await owner.client.getIdentity(agent);
    return "avatar" in identity;
  };
}

function choice(group: Locator, name: string): Locator {
  return group.locator("label").filter({ has: group.page().getByRole("radio", { exact: true, name }) });
}

async function pickedAndSaved(avatar: Locator): Promise<void> {
  await choice(avatar, "Pixel").click();

  await expect(avatar.getByRole("radio", { exact: true, name: "Pixel" })).toBeChecked();

  await avatar.getByRole("button", { exact: true, name: "Shuffle" }).click();
  await choice(avatar, "Character 3").click();
  await avatar.getByRole("button", { exact: true, name: "Save avatar" }).click();
}

async function changeOpened(profile: Locator): Promise<Locator> {
  const change = profile.getByRole("button", { exact: true, name: "Change avatar" });

  await expect(change).toBeVisible();
  await expect(profile.getByRole("group", { exact: true, name: "Avatar" })).toHaveCount(NONE);

  await change.click();
  return profile.page().getByRole("dialog", { exact: true, name: "Change avatar" });
}

test("an agent's owner opens Change avatar from its picture, picks a character and saves it, and the dialog closes on the new avatar", async ({
  page,
}) => {
  const owned = await ownedAgent(page);
  const profile = inProfile(page);
  const dialog = await changeOpened(profile);
  await pickedAndSaved(dialog.getByRole("group", { exact: true, name: "Avatar" }));

  await expect(dialog).toBeHidden();
  await expect.poll(hasAvatar(owned)).toBe(true);
  await expect(profile.getByTestId("avatar")).not.toHaveAttribute("data-character");
  await expect(profile.getByTestId("avatar")).toHaveJSProperty("naturalWidth", SIDE);
});

test("someone else's agent's picture is no button", async ({ page }) => {
  const owned = await ownedAgent(page);
  const stranger = await newIdentity({ kind: "human", name: unique("browser-character-stranger") });
  await logInToChannels({ page, token: stranger.token });
  await page.goto(`/#/people/${owned.agent}`);

  await expect(inProfile(page).getByTestId("avatar")).toBeVisible();
  await expect(inProfile(page).getByRole("button", { exact: true, name: "Change avatar" })).toHaveCount(NONE);
});
