import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane } from "./regions.ts";
import { logInToChannels } from "./login.ts";
import { unique } from "./names.ts";

const TYPED = "mail a@b.com, then ask @ops-team about it";

function messageBox(page: Page): Locator {
  return inPane(page).getByLabel("Message", { exact: true });
}

async function channelOpen(page: Page): Promise<void> {
  const channel = unique("browser-draft-mention");
  const person = await newIdentity({ kind: "human", name: unique("browser-draft-mention-person") });
  await adminClient().createChannel({ name: channel });
  await logInToChannels({ page, token: person.token });
  await page.goto(`/#/channels/${channel}`);

  await expect(messageBox(page)).toBeVisible();
}

const BEFORE = "mail a@b.com, then ask ";
const TOLERANCE = 2;

function pixels(length: string): number {
  return Number(length.replace("px", ""));
}

async function expectedLeft(box: Locator): Promise<number> {
  const shown = await box.evaluate((element: unknown, before: string) => {
    const context = globalThis.document.createElement("canvas").getContext("2d");
    if (!(element instanceof HTMLElement) || context === null) {
      return null;
    }
    const look = globalThis.getComputedStyle(element);
    context.font = look.font;
    context.letterSpacing = look.letterSpacing;
    return {
      border: look.borderLeftWidth,
      left: element.getBoundingClientRect().left,
      padding: look.paddingLeft,
      text: context.measureText(before).width,
    };
  }, BEFORE);
  if (shown === null) {
    return Number.NaN;
  }
  return shown.left + pixels(shown.border) + pixels(shown.padding) + shown.text;
}

async function markOffset(box: Locator, mark: Locator): Promise<number> {
  const [expected, found] = await Promise.all([expectedLeft(box), mark.boundingBox()]);
  if (found === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(found.x - expected);
}

test("an @name typed in the message box is marked behind its letters, and an address with an @ in it isn't", async ({
  page,
}) => {
  await channelOpen(page);
  const box = messageBox(page);

  await box.fill(TYPED);
  const marks = inPane(page).locator("[data-box-mirror] mark");

  await expect(marks).toHaveText(["@ops-team"]);
  expect(await markOffset(box, marks.first())).toBeLessThan(TOLERANCE);
});

const LINES = 14;
const TOP = 0;

function inView(box: Locator, mark: Locator): () => Promise<boolean> {
  return async () => {
    const [outer, inner] = await Promise.all([box.boundingBox(), mark.boundingBox()]);
    if (outer === null || inner === null) {
      return false;
    }
    return inner.y >= outer.y && inner.y + inner.height <= outer.y + outer.height;
  };
}

test("in a long draft, the mark of an @name at its end scrolls with the text, out of view when the box scrolls back up", async ({
  page,
}) => {
  await channelOpen(page);
  const box = messageBox(page);
  const mark = inPane(page).locator("[data-box-mirror] mark");

  await box.fill(`${"line\n".repeat(LINES)}ask @ops-team`);

  await expect.poll(inView(box, mark)).toBe(true);

  const scrolled = await box.evaluate((element: unknown, top: number) => {
    const mirror = globalThis.document.querySelector("main [data-box-mirror]");
    if (!(element instanceof HTMLTextAreaElement) || mirror === null) {
      return null;
    }
    element.scrollTop = top;
    element.dispatchEvent(new Event("scroll"));
    return { box: element.scrollTop, mirror: mirror.scrollTop };
  }, TOP);

  expect(scrolled).toStrictEqual({ box: TOP, mirror: TOP });
});
