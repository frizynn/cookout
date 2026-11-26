import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { inPane } from "./regions.ts";
import { logIn } from "./login.ts";
import { unique } from "./names.ts";

const PHONE = { height: 844, width: 390 };
const FONT_SIZE = "font-size";

async function openChannel(page: Page): Promise<void> {
  const channel = unique("browser-phone-fields");
  await adminClient().createChannel({ name: channel });
  const { token } = await newIdentity({ kind: "human", name: unique("browser-phone-fields") });
  await logIn({ page, token });
  await page.goto(`/#/channels/${channel}`);
}

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: PHONE });

  test("the text fields use 16 px letters, so the phone doesn't zoom in when one takes focus", async ({ page }) => {
    await openChannel(page);

    await expect(inPane(page).getByRole("textbox", { exact: true, name: "Message" })).toHaveCSS(FONT_SIZE, "16px");
    await expect(page.getByRole("combobox", { exact: true, name: "Search" })).toHaveCSS(FONT_SIZE, "16px");
  });
});

test.describe("with a mouse", () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { height: 900, width: 1440 } });

  test("the text fields keep their smaller letters", async ({ page }) => {
    await openChannel(page);

    await expect(inPane(page).getByRole("textbox", { exact: true, name: "Message" })).toHaveCSS(FONT_SIZE, "14.5px");
    await expect(page.getByRole("combobox", { exact: true, name: "Search" })).toHaveCSS(FONT_SIZE, "14px");
  });
});
