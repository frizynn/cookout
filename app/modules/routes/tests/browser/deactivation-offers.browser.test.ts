import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane, inProfile } from "./regions.ts";
import type { Identity } from "../../../sdk/index.ts";
import type { Page } from "@playwright/test";
import { createIdentityAsBefore } from "../../../testing/index.ts";
import { logIn } from "./login.ts";

const OWNER = "browser-offers-owner";
const AGENT = `${OWNER}/scout`;
const OFFER = `@${AGENT} has had no activity for 30 days. Deactivate it?`;

async function offeredOn(page: Page, identity: Identity): Promise<void> {
  const offer = { cleared: false, id: 1, identity, quietDays: 30, raisedAt: identity.createdAt, text: OFFER };
  await page.route("**/v1/inbox", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      body: body.replace('"deactivationOffers":[]', `"deactivationOffers":[${JSON.stringify(offer)}]`),
      response,
    });
  });
}

test("an offer row's name opens the identity's profile panel", async ({ page }) => {
  const owner = await newIdentity({ kind: "human", name: OWNER });
  const { identity } = await createIdentityAsBefore({
    admin: adminClient(),
    by: adminClient(),
    request: { kind: "agent", name: AGENT, owner: OWNER },
  });
  await offeredOn(page, identity);
  await logIn({ page, token: owner.token, url: "/#/inbox" });

  await inPane(page).getByRole("list", { name: "For you" }).getByRole("link", { name: AGENT }).click();

  await expect(page).toHaveURL(/#\/inbox\?profile=browser-offers-owner\/scout$/u);
  await expect(inProfile(page).getByRole("heading", { name: new RegExp(AGENT, "u") })).toBeVisible();
});
