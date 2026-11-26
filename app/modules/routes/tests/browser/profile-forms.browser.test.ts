import type { Locator, Page } from "@playwright/test";
import { createdBy, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inProfile } from "./regions.ts";
import { logInToChannels } from "./login.ts";
import { unique } from "./names.ts";

interface Box {
  readonly top: number;
  readonly left: number;
  readonly right: number;
}

const NONE = -1;

async function boxOf(control: Locator): Promise<Box> {
  const box = await control.boundingBox();
  if (box === null) {
    return { left: NONE, right: NONE, top: NONE };
  }
  return { left: box.x, right: box.x + box.width, top: box.y };
}

interface Placement {
  readonly beside: boolean;
  readonly level: boolean;
}

async function savePlacement(form: Locator, field: string): Promise<Placement> {
  const box = await boxOf(form.getByRole("textbox", { exact: true, name: field }));
  const save = await boxOf(form.getByRole("button", { exact: true, name: "Save" }));
  return { beside: save.left > box.right, level: Math.round(save.top) === Math.round(box.top) };
}

async function ownedAgentProfile(page: Page): Promise<Locator> {
  const owner = await newIdentity({ kind: "human", name: unique("browser-profile-forms-owner") });
  const agent = unique("browser-profile-forms-bot");
  await createdBy({ by: owner.client, request: { kind: "agent", name: agent } });
  await logInToChannels({ page, token: owner.token });
  await page.goto(`/#/people/${agent}`);
  return inProfile(page);
}

test("the description's Save sits beside its box and level with it, as the display name's does", async ({ page }) => {
  const profile = await ownedAgentProfile(page);

  const placed = {
    description: await savePlacement(profile.getByRole("form", { exact: true, name: "Description" }), "Description"),
    displayName: await savePlacement(profile.getByRole("form", { exact: true, name: "Display name" }), "Display name"),
  };

  expect(placed).toStrictEqual({
    description: { beside: true, level: true },
    displayName: { beside: true, level: true },
  });
});
