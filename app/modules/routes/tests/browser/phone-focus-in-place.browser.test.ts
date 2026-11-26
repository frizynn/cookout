import { PHONE_USE, logInOnPhone } from "./phone.ts";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { inPane } from "./regions.ts";
import { unique } from "./names.ts";

const NONE = 0;
const TYPED = "On my way";
const MESSAGE_BOX = { exact: true, name: "Message" } as const;
const FOCUSED_WITHOUT_SCROLL = "focusedWithoutScroll";
const TOUCH_POINTS = 5;
const UNSCROLLED = JSON.stringify([{ preventScroll: true }]);

interface Iphone {
  readonly name: string;
  readonly touchPoints: number;
}

function asAnIphone({ name, touchPoints }: Iphone): void {
  Object.defineProperty(globalThis.navigator, "platform", { get: () => "iPhone" });
  Object.defineProperty(globalThis.navigator, "maxTouchPoints", { get: () => touchPoints });
  const original: unknown = Reflect.get(HTMLElement.prototype, "focus");
  const seen: string[] = [];
  Object.defineProperty(globalThis, name, { value: seen });
  Object.defineProperty(HTMLElement.prototype, "focus", {
    value(this: unknown, ...rest: readonly unknown[]): void {
      if (this instanceof HTMLTextAreaElement) {
        seen.push(JSON.stringify(rest));
      }
      if (typeof original === "function") {
        Reflect.apply(original, this, rest);
      }
    },
  });
}

function focusedWithoutScroll(name: string): unknown {
  return Reflect.get(globalThis, name);
}

function pageScrollTop(): number {
  return globalThis.scrollY;
}

async function openChannel(page: Page): Promise<void> {
  const channel = unique("browser-phone-in-place");
  await adminClient().createChannel({ name: channel });
  const reader = await newIdentity({ kind: "human", name: unique("browser-phone-in-place-reader") });
  await reader.client.subscribe(channel);
  await logInOnPhone({ page, token: reader.token, url: `/#/channels/${channel}` });
}

test.use(PHONE_USE);

test("on an iPhone a tap on the message box focuses it without scrolling the page, and typing goes in", async ({
  page,
}) => {
  await page.addInitScript(asAnIphone, { name: FOCUSED_WITHOUT_SCROLL, touchPoints: TOUCH_POINTS });
  await openChannel(page);
  const box = inPane(page).getByRole("textbox", MESSAGE_BOX);

  await box.tap();

  await expect(box).toBeFocused();
  expect(await page.evaluate(focusedWithoutScroll, FOCUSED_WITHOUT_SCROLL)).toStrictEqual([UNSCROLLED]);
  expect(await page.evaluate(pageScrollTop)).toBe(NONE);

  await page.keyboard.type(TYPED);

  await expect(box).toHaveValue(TYPED);
});
