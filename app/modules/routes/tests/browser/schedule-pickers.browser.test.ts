import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane } from "./regions.ts";
import { logInToChannels } from "./login.ts";
import { unique } from "./names.ts";

const NOON = "2026-11-26T12:00:00.000Z";

function scheduleDialog(page: Page): Locator {
  return page.getByRole("dialog", { exact: true, name: "Schedule a message" });
}

function picker(page: Page, label: string): Locator {
  return page.getByRole("dialog", { exact: true, name: label });
}

async function signedIn(page: Page): Promise<string> {
  const channel = unique("browser-schedule-pickers");
  await adminClient().createChannel({ name: channel });
  const person = await newIdentity({ kind: "human", name: `${channel}-ann` });
  await page.clock.setFixedTime(NOON);
  await logInToChannels({ page, token: person.token });
  return channel;
}

async function openSchedule(page: Page): Promise<Locator> {
  await page.goto(`/#/channels/${await signedIn(page)}`);
  const form = inPane(page).getByRole("form", { exact: true, name: "Post to the channel" });
  await form.getByRole("textbox", { exact: true, name: "Message" }).fill("The window opens");
  await form.getByRole("button", { exact: true, name: "Post later" }).click();
  await page.getByRole("menuitem", { exact: true, name: "Schedule…" }).click();
  return scheduleDialog(page);
}

test("the keyboard picks a schedule's day from a calendar opened on today", async ({ page }) => {
  const dialog = await openSchedule(page);

  await dialog.getByRole("button", { exact: true, name: "Date: Pick a day" }).press("Enter");

  await expect(
    picker(page, "Date").getByRole("button", { exact: true, name: "Thursday, 26 November 2026" }),
  ).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("PageDown");
  await page.keyboard.press("Enter");

  await expect(dialog.getByRole("button", { exact: true, name: "Date: Mon, 4 Jan 2027" })).toBeFocused();
});

async function dayPickedMonthAhead(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { exact: true, name: "Date: Pick a day" }).press("Enter");
  await dialog.page().keyboard.press("PageDown");
  await dialog.page().keyboard.press("Enter");

  await expect(dialog.getByRole("button", { exact: true, name: "Date: Sat 26 Dec" })).toBeFocused();
}

test("the keyboard picks a schedule's time from a list opened on 09:00, and the run shows both", async ({ page }) => {
  const dialog = await openSchedule(page);
  await dayPickedMonthAhead(dialog);

  await dialog.getByRole("button", { exact: true, name: "Time: Pick a time" }).press("Enter");

  await expect(picker(page, "Time").getByRole("button", { exact: true, name: "09:00" })).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(dialog.getByRole("button", { exact: true, name: "Time: 09:30" })).toBeFocused();
  await expect(dialog.getByRole("list", { exact: true, name: "Next runs" })).toContainText("Sat, 26 Dec 2026, 09:30");
});

test("the calendar's arrows show the month before and after, and a tap on a day picks it", async ({ page }) => {
  const dialog = await openSchedule(page);
  await dialog.getByRole("button", { exact: true, name: "Date: Pick a day" }).click();
  const calendar = picker(page, "Date");

  await calendar.getByRole("button", { exact: true, name: "Next month" }).click();
  await calendar.getByRole("button", { exact: true, name: "Next month" }).click();
  await calendar.getByRole("button", { exact: true, name: "Previous month" }).click();

  await expect(calendar.getByRole("table", { exact: true, name: "December 2026" })).toBeVisible();

  await calendar.getByRole("button", { exact: true, name: "Thursday, 24 December 2026" }).click();

  await expect(dialog.getByRole("button", { exact: true, name: "Date: Thu 24 Dec" })).toBeVisible();
  await expect(calendar).toBeHidden();
});
