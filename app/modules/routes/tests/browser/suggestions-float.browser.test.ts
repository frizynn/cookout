import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane, inThread } from "./regions.ts";
import type { Locator } from "@playwright/test";
import { logIn } from "./login.ts";

const CHANNEL = "browser-suggestions-float";
const PARENT = "Who can take this one?";

interface Box {
  readonly form: Locator;
  readonly field: Locator;
  readonly region: Locator;
}

interface Size {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

async function sizeOf(form: Locator): Promise<Size | null> {
  const box = await form.boundingBox();
  if (box === null) {
    return null;
  }
  return { height: box.height, left: box.x, top: box.y, width: box.width };
}

interface Over {
  readonly list: Locator;
  readonly form: Locator;
}

async function isAbove({ form, list }: Over): Promise<boolean> {
  const [shown, under] = await Promise.all([sizeOf(list), sizeOf(form)]);
  return shown !== null && under !== null && shown.top + shown.height <= under.top;
}

async function expectUnmovedWhileSuggesting({ field, form, region }: Box): Promise<void> {
  await expect(field).toBeVisible();

  const before = await sizeOf(form);

  await field.pressSequentially("@");

  const list = region.getByRole("listbox", { name: "Mention suggestions" });

  await expect(list).toBeVisible();
  expect(await sizeOf(form)).toStrictEqual(before);
  expect(await isAbove({ form, list })).toBe(true);

  await field.page().keyboard.press("Escape");

  await expect(list).toBeHidden();
  expect(await sizeOf(form)).toStrictEqual(before);
}

async function readerToken(): Promise<string> {
  const admin = adminClient();
  await admin.createChannel({ name: CHANNEL });
  const { message } = await admin.createMessage({ channel: CHANNEL, text: PARENT });
  await admin.createMessage({ channel: CHANNEL, replyTo: message.id, text: "Maybe" });
  const { token } = await newIdentity({ kind: "human", name: `${CHANNEL}-reader` });
  return token;
}

test("the @ suggestion list floats over the channel's and the thread's message boxes without resizing them", async ({
  page,
}) => {
  await logIn({ page, token: await readerToken() });
  await page.goto(`/#/channels/${CHANNEL}`);

  await expectUnmovedWhileSuggesting({
    field: inPane(page).getByRole("textbox", { exact: true, name: "Message" }),
    form: inPane(page).getByRole("form", { name: "Post to the channel" }),
    region: inPane(page),
  });

  await inPane(page).getByRole("article").filter({ hasText: PARENT }).getByRole("link", { name: "1 reply" }).click();

  await expectUnmovedWhileSuggesting({
    field: inThread(page).getByRole("textbox", { exact: true, name: "Reply" }),
    form: inThread(page).getByRole("form", { name: "Reply to the thread" }),
    region: inThread(page),
  });
});
