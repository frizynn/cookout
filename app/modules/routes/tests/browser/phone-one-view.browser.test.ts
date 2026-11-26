import type { Locator, Page } from "@playwright/test";
import { PHONE_USE, logInOnPhone } from "./phone.ts";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane, inThread, inTopBar } from "./regions.ts";
import { unique } from "./names.ts";

const HEADER_ROW = 56;
const NONE = 0;
const HALF = 2;
const ONE_LINE = 24;
const QUESTION = "I don't get the last deploy note.";
const ANSWER = "It arrived on its own this time. Which part is unclear? I can explain it here in two lines.";
const AGENT_NAME = "Triage helper (build ops)";

interface Box {
  readonly left: number;
  readonly top: number;
  readonly bottom: number;
}

interface Edges extends Box {
  readonly right: number;
}

const NO_BOX: Box = { bottom: NONE, left: NONE, top: NONE };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    return NO_BOX;
  }
  return { bottom: box.y + box.height, left: box.x, top: box.y };
}

function middleOf(box: Box): number {
  return (box.top + box.bottom) / HALF;
}

interface Faces {
  readonly page: Page;
  readonly faces: string;
  readonly texts: string;
}

interface ShortThread {
  readonly channel: string;
  readonly thread: string;
}

async function shortThread(page: Page): Promise<ShortThread> {
  const channel = unique("browser-phone-view");
  await adminClient().createChannel({ name: channel });
  const { message } = await adminClient().createMessage({ channel, text: QUESTION });
  const agent = await newIdentity({ displayName: AGENT_NAME, kind: "agent", name: unique("browser-phone-view-agent") });
  await agent.client.createMessage({ channel, replyTo: message.id, text: ANSWER });
  const { token } = await newIdentity({ kind: "human", name: unique("browser-phone-view-reader") });
  const thread = `/#/channels/${channel}/threads/${String(message.id)}`;
  await logInOnPhone({ page, token, url: `/#/channels/${channel}` });
  return { channel, thread };
}

function edgesOf(selector: string): Edges[] {
  const found: Edges[] = [];
  for (const element of document.querySelectorAll(selector)) {
    const { bottom, left, right, top } = element.getBoundingClientRect();
    found.push({ bottom, left, right, top });
  }
  return found;
}

function overlap(face: Edges, text: Edges): boolean {
  return face.left < text.right && text.left < face.right && face.top < text.bottom && text.top < face.bottom;
}

async function overlaps({ faces, page, texts }: Faces): Promise<number> {
  const textEdges = await page.evaluate(edgesOf, texts);
  const faceEdges = await page.evaluate(edgesOf, faces);
  return faceEdges.filter((face) => textEdges.some((text) => overlap(face, text))).length;
}

test.use(PHONE_USE);

test("on a phone a channel's header is the only row above its messages, with the menu and search in it", async ({
  page,
}) => {
  const { channel } = await shortThread(page);
  const heading = inPane(page).getByRole("heading", { exact: true, name: `#${channel}` });

  await expect(heading).toBeVisible();

  const title = await boxOf(heading);
  const menu = await boxOf(inTopBar(page).getByRole("button", { exact: true, name: "Open the sidebar" }));
  const search = await boxOf(page.getByRole("combobox", { exact: true, name: "Search" }));

  expect(title.bottom).toBeLessThanOrEqual(HEADER_ROW);
  expect(Math.abs(middleOf(menu) - middleOf(title))).toBeLessThan(ONE_LINE / HALF);
  expect(Math.abs(middleOf(search) - middleOf(title))).toBeLessThan(ONE_LINE / HALF);
});

test("on a phone an open thread is one view: back, title and its close button in one row, the channel not drawn", async ({
  page,
}) => {
  const { thread } = await shortThread(page);
  await page.goto(thread);
  const title = inThread(page).getByRole("heading", { exact: true, name: "Thread" });

  await expect(inThread(page).getByText(ANSWER, { exact: true })).toBeVisible();

  const back = await boxOf(inThread(page).getByRole("link", { exact: true, name: "Close panel" }));
  const heading = await boxOf(title);
  const close = await boxOf(inThread(page).getByRole("button", { exact: true, name: "Close thread" }));

  expect(back.left).toBeLessThan(heading.left);
  expect(Math.abs(middleOf(close) - middleOf(heading))).toBeLessThan(ONE_LINE / HALF);
  expect(close.bottom).toBeLessThanOrEqual(HEADER_ROW);
});

test("on a phone an open thread hides the channel behind it and the search", async ({ page }) => {
  const { thread } = await shortThread(page);
  await page.goto(thread);

  await expect(inThread(page).getByText(ANSWER, { exact: true })).toBeVisible();
  await expect(page.locator("main > section").getByText(QUESTION, { exact: true })).toBeHidden();
  await expect(page.getByRole("combobox", { exact: true, name: "Search" })).toBeHidden();
});

test("on a phone an agent's reply has its name, tag and time on one line, and no face over any text", async ({
  page,
}) => {
  const { thread } = await shortThread(page);
  await page.goto(thread);
  const reply = inThread(page).getByRole("article").filter({ hasText: ANSWER });

  await expect(reply).toBeVisible();

  const header = await boxOf(reply.locator("header"));

  expect(header.bottom - header.top).toBeLessThanOrEqual(ONE_LINE);
  await expect(reply.getByRole("link", { exact: true, name: AGENT_NAME })).toBeVisible();
  expect(await overlaps({ faces: "[data-testid$='avatar'], img", page, texts: "article p, article header a" })).toBe(
    NONE,
  );
});
