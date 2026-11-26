import type { Locator } from "@playwright/test";
import type { LogIn } from "./login.ts";
import { expect } from "@playwright/test";
import { logInThroughForm } from "./login.ts";

const PHONE = { height: 844, width: 390 } as const;

const PHONE_USE = { hasTouch: true, isMobile: true, viewport: PHONE } as const;

async function logInOnPhone({ page, token, url = "/" }: LogIn): Promise<void> {
  await logInThroughForm({ page, token });

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Inbox" })).toBeVisible();

  await page.goto(url);
}

const FINGER = { bubbles: true, button: 0, isPrimary: true, pointerId: 1, pointerType: "touch" } as const;

async function pressAndHold(target: Locator): Promise<void> {
  await target.dispatchEvent("pointerdown", FINGER);
}

async function liftFingerOver(target: Locator): Promise<void> {
  await target.dispatchEvent("pointerup", FINGER);
}

export { liftFingerOver, logInOnPhone, PHONE, PHONE_USE, pressAndHold };
