import type { Locator, Page } from "@playwright/test";
import { PHONE, PHONE_USE, logInOnPhone } from "./phone.ts";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane } from "./regions.ts";
import { unique } from "./names.ts";

const MESSAGES = 20;
const NONE = 0;
const FAR = 2000;
const KEYBOARD = { height: 420, top: 300 } as const;
const OPEN_KEYBOARD = "openKeyboard";

interface Span {
  readonly top: number;
  readonly bottom: number;
}

interface Keyboard {
  readonly height: number;
  readonly top: number;
}

interface NamedKeyboard extends Keyboard {
  readonly name: string;
}

async function spanOf(locator: Locator): Promise<Span> {
  const box = await locator.boundingBox();
  if (box === null) {
    return { bottom: NONE, top: NONE };
  }
  return { bottom: box.y + box.height, top: box.y };
}

async function topOf(locator: Locator): Promise<number> {
  const { top } = await spanOf(locator);
  return top;
}

async function longChannel(page: Page): Promise<string> {
  const channel = unique("browser-phone-page");
  await adminClient().createChannel({ name: channel });
  const author = await newIdentity({ kind: "human", name: unique("browser-phone-page-author") });
  await Promise.all(
    Array.from({ length: MESSAGES }, async (_value, index) => {
      await author.client.createMessage({ channel, text: `Line ${String(index)} of a long channel.` });
    }),
  );
  const { token } = await newIdentity({ kind: "human", name: unique("browser-phone-page-reader") });
  await logInOnPhone({ page, token, url: `/#/channels/${channel}` });
  return channel;
}

function pageScroll(far: number): Span {
  const root = document.scrollingElement ?? document.documentElement;
  globalThis.scrollTo({ top: far });
  return { bottom: root.scrollHeight, top: root.scrollTop };
}

function fakeVisualViewport(name: string): void {
  const area = new EventTarget();
  const shown = { height: globalThis.innerHeight, top: 0 };
  Object.defineProperties(area, {
    height: { get: () => shown.height },
    offsetTop: { get: () => shown.top },
    width: { get: () => globalThis.innerWidth },
  });
  Object.defineProperty(globalThis, "visualViewport", { configurable: true, value: area });
  Object.defineProperty(globalThis, name, {
    value: (keyboard: Keyboard) => {
      shown.height = keyboard.height;
      shown.top = keyboard.top;
      area.dispatchEvent(new Event("resize"));
    },
  });
}

function openKeyboard(keyboard: NamedKeyboard): void {
  const open: unknown = Reflect.get(globalThis, keyboard.name);
  if (typeof open === "function") {
    Reflect.apply(open, globalThis, [keyboard]);
  }
}

test.use(PHONE_USE);

test("on a phone the page itself never scrolls: only the message list does", async ({ page }) => {
  await longChannel(page);

  await expect(inPane(page).getByRole("textbox", { exact: true, name: "Message" })).toBeVisible();

  const scrolled = await page.evaluate(pageScroll, FAR);

  expect(scrolled.bottom).toBeLessThanOrEqual(PHONE.height);
  expect(scrolled.top).toBe(NONE);
});

test("on a phone with the keyboard open the channel's header and message box stay in the part left visible", async ({
  page,
}) => {
  await page.addInitScript(fakeVisualViewport, OPEN_KEYBOARD);
  const channel = await longChannel(page);
  const header = inPane(page).getByRole("heading", { exact: true, name: `#${channel}` });
  const box = inPane(page).getByRole("textbox", { exact: true, name: "Message" });

  await expect(box).toBeVisible();

  await page.evaluate(openKeyboard, { ...KEYBOARD, name: OPEN_KEYBOARD });

  await expect
    .poll(async () => {
      const top = await topOf(header);
      return top;
    })
    .toBeGreaterThanOrEqual(KEYBOARD.top);

  const { bottom } = await spanOf(box);

  expect(bottom).toBeLessThanOrEqual(KEYBOARD.top + KEYBOARD.height);
});

test.describe("with a mouse on a wide screen", () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { height: 900, width: 1440 } });

  test("zooming in on a wide screen neither moves nor shrinks the board", async ({ page }) => {
    await page.addInitScript(fakeVisualViewport, OPEN_KEYBOARD);
    const channel = await longChannel(page);
    const header = inPane(page).getByRole("heading", { exact: true, name: `#${channel}` });

    await expect(header).toBeVisible();

    const before = await topOf(header);
    await page.evaluate(openKeyboard, { ...KEYBOARD, name: OPEN_KEYBOARD });
    const after = await topOf(header);

    expect(after).toBe(before);
  });
});
