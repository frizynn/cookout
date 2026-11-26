import { PHONE_USE, logInOnPhone } from "./phone.ts";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inSidebar, inTopBar } from "./regions.ts";
import type { Page } from "@playwright/test";
import { unique } from "./names.ts";

const SEEN = "seenMotion";
const ENTER = "enter";
const PUSH_IN = "push-in";
const FIRST = 0;

function watchMotion(name: string): void {
  const seen: string[] = [];
  Object.defineProperty(globalThis, name, { value: seen });
  globalThis.document.addEventListener("animationstart", (event: Readonly<Pick<AnimationEvent, "animationName">>) => {
    seen.push(event.animationName);
  });
  const original: unknown = Reflect.get(Element.prototype, "animate");
  Object.defineProperty(Element.prototype, "animate", {
    value(this: unknown, ...rest: readonly unknown[]): unknown {
      seen.push("enter");
      if (typeof original === "function") {
        return Reflect.apply(original, this, rest);
      }
      return null;
    },
  });
}

function seenMotion(name: string): readonly string[] {
  const seen: unknown = Reflect.get(globalThis, name);
  if (!Array.isArray(seen)) {
    return [];
  }
  return seen.filter((motion) => typeof motion === "string");
}

function forgetMotion(name: string): void {
  const seen: unknown = Reflect.get(globalThis, name);
  if (Array.isArray(seen)) {
    seen.splice(FIRST);
  }
}

async function settled(): Promise<void> {
  await Promise.allSettled(
    globalThis.document.getAnimations().map(async (animation: Readonly<Pick<Animation, "finished">>) => {
      await animation.finished;
    }),
  );
}

interface Board {
  readonly first: string;
  readonly next: string;
  readonly thread: number;
  readonly token: string;
}

async function board(): Promise<Board> {
  const first = unique("browser-phone-motion");
  const next = unique("browser-phone-motion-next");
  await adminClient().createChannel({ name: first });
  await adminClient().createChannel({ name: next });
  const reader = await newIdentity({ kind: "human", name: unique("browser-phone-motion-reader") });
  await reader.client.subscribe(first);
  await reader.client.subscribe(next);
  const { message } = await reader.client.createMessage({ channel: next, text: "The parent." });
  await reader.client.createMessage({ channel: next, replyTo: message.id, text: "The reply." });
  return { first, next, thread: message.id, token: reader.token };
}

async function watched(page: Page): Promise<Board> {
  const shown = await board();
  await page.addInitScript(watchMotion, SEEN);
  await logInOnPhone({ page, token: shown.token, url: `/#/channels/${shown.first}` });
  await page.evaluate(forgetMotion, SEEN);
  return shown;
}

async function moves(page: Page): Promise<readonly string[]> {
  const { next, thread } = await watched(page);
  await inTopBar(page).getByRole("button", { exact: true, name: "Open the sidebar" }).tap();
  await inSidebar(page)
    .getByRole("link", { exact: true, name: `#${next}` })
    .tap();
  await page.goto(`/#/channels/${next}/threads/${String(thread)}`);

  await expect(page.getByRole("complementary", { exact: true, name: "Thread" })).toBeVisible();

  await page.evaluate(settled);

  const seen = await page.evaluate(seenMotion, SEEN);
  return [...new Set(seen.filter((motion) => motion === ENTER || motion === PUSH_IN))].toSorted();
}

test.use(PHONE_USE);

test("on a phone a channel slides in when it opens, and a thread slides in over it", async ({ page }) => {
  const seen = await moves(page);

  expect(seen).toStrictEqual([ENTER, PUSH_IN]);
});

test("on a phone with reduced motion nothing slides", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const seen = await moves(page);

  expect(seen).toStrictEqual([]);
});
