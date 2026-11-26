import { PHONE_USE, logInOnPhone } from "./phone.ts";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inSidebar, inTopBar } from "./regions.ts";
import type { Page } from "@playwright/test";
import { unique } from "./names.ts";

const SMALLEST_UNZOOMED_PX = 16;
const NONE = 0;
const PX = "px";
const FIELDS = 'input:not([type="hidden"]), textarea, select, [contenteditable]';

interface Field {
  readonly field: string;
  readonly fontSize: number;
}

interface Measured {
  readonly screen: string;
  readonly fields: readonly Field[];
}

interface Shown {
  readonly field: string;
  readonly fontSize: string;
}

function fieldSizes(selector: string): Shown[] {
  const sizes: Shown[] = [];
  for (const element of globalThis.document.querySelectorAll(selector)) {
    const name = element.getAttribute("aria-label") ?? element.getAttribute("name") ?? "";
    const { fontSize } = globalThis.getComputedStyle(element);
    sizes.push({ field: `${element.tagName.toLowerCase()} ${name}`, fontSize });
  }
  return sizes;
}

async function measured(page: Page, screen: string): Promise<Measured> {
  const shown = await page.evaluate(fieldSizes, FIELDS);
  const fields = shown.map(({ field, fontSize }) => ({ field, fontSize: Number(fontSize.replace(PX, "")) }));
  return { fields, screen };
}

async function screenAt(page: Page, url: string): Promise<Measured> {
  await page.goto(url);

  await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();

  return measured(page, url);
}

async function screensAt(page: Page, urls: readonly string[]): Promise<readonly Measured[]> {
  const [first = "", ...rest] = urls;
  if (urls.length === NONE) {
    return [];
  }
  const shown = await screenAt(page, first);
  return [shown, ...(await screensAt(page, rest))];
}

interface Board {
  readonly channel: string;
  readonly thread: number;
  readonly token: string;
}

async function board(): Promise<Board> {
  const channel = unique("browser-phone-zoom");
  await adminClient().createChannel({ name: channel });
  const { message } = await adminClient().createMessage({ channel, text: "The parent." });
  await adminClient().createMessage({ channel, replyTo: message.id, text: "The reply." });
  const reader = await newIdentity({ kind: "human", name: unique("browser-phone-zoom-reader") });
  await reader.client.subscribe(channel);
  return { channel, thread: message.id, token: reader.token };
}

async function loginScreen(page: Page): Promise<Measured> {
  await page.goto("/");

  await expect(page.getByLabel("Token", { exact: true })).toBeVisible();

  return measured(page, "login");
}

async function newChannelForm(page: Page): Promise<Measured> {
  await inTopBar(page).getByRole("button", { exact: true, name: "Open the sidebar" }).tap();
  await inSidebar(page).getByRole("button", { exact: true, name: "New channel" }).tap();

  await expect(page.getByRole("form", { exact: true, name: "New channel" })).toBeVisible();

  return measured(page, "new channel");
}

async function everyScreen(page: Page): Promise<readonly Measured[]> {
  const { channel, thread, token } = await board();
  const login = await loginScreen(page);
  await logInOnPhone({ page, token });
  const urls = [
    `/#/channels/${channel}`,
    `/#/channels/${channel}/threads/${String(thread)}`,
    "/#/people",
    "/#/settings",
    "/#/inbox",
  ];
  const linked = await screensAt(page, urls);
  const form = await newChannelForm(page);
  return [login, ...linked, form];
}

test.use(PHONE_USE);

test("on a phone no text field on any screen is under 16 px, so none zooms the page when tapped", async ({ page }) => {
  const screens = await everyScreen(page);
  const small = screens.flatMap(({ fields, screen }) =>
    fields.filter(({ fontSize }) => fontSize < SMALLEST_UNZOOMED_PX).map(({ field }) => `${screen}: ${field}`),
  );
  const withoutFields = screens.filter(({ fields }) => fields.length === NONE).map(({ screen }) => screen);

  expect(small).toStrictEqual([]);
  expect(withoutFields).toStrictEqual([]);
});
