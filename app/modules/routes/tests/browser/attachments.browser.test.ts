import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { hillsPng } from "../../../testing/index.ts";
import { inPane } from "./regions.ts";
import { logInToChannels } from "./login.ts";
import { unique } from "./names.ts";

const OUTSIDE = { left: 4, top: 4 } as const;
const NATURAL_WIDTH = 480;

interface Opened {
  readonly thumbnail: Locator;
  readonly dialog: Locator;
}

async function openChannelWithImage(page: Page, channel: string): Promise<Locator> {
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity({ kind: "human", name: `${channel}-ann` });
  await poster.client.createMessage({
    attachments: [{ bytes: hillsPng(), name: "hills.png" }],
    channel,
    text: "The view from the office",
  });
  await logInToChannels({ page, token: poster.token });
  await page.goto(`/#/channels/${channel}`);
  return inPane(page).getByRole("button", { exact: true, name: "hills.png" });
}

async function openedFullSize(page: Page, channel: string): Promise<Opened> {
  const thumbnail = await openChannelWithImage(page, channel);
  await thumbnail.focus();
  await page.keyboard.press("Enter");
  return { dialog: page.getByRole("dialog", { exact: true, name: "hills.png" }), thumbnail };
}

test("Enter on a thumbnail opens the image at full size, and Escape closes it, back on the thumbnail", async ({
  page,
}) => {
  const { dialog, thumbnail } = await openedFullSize(page, unique("browser-attachments-escape"));

  await expect(dialog.getByRole("img", { exact: true, name: "hills.png" })).toHaveJSProperty(
    "naturalWidth",
    NATURAL_WIDTH,
  );

  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(thumbnail).toBeFocused();
});

test("a click outside the full-size image closes it, back on the thumbnail", async ({ page }) => {
  const { dialog, thumbnail } = await openedFullSize(page, unique("browser-attachments-outside"));

  await expect(dialog.getByRole("img", { exact: true, name: "hills.png" })).toBeVisible();

  await page.mouse.click(OUTSIDE.left, OUTSIDE.top);

  await expect(dialog).toBeHidden();
  await expect(thumbnail).toBeFocused();
});

async function openComposer(page: Page, channel: string): Promise<Locator> {
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity({ kind: "human", name: `${channel}-ann` });
  await logInToChannels({ page, token: poster.token });
  await page.goto(`/#/channels/${channel}`);
  return inPane(page).getByRole("form", { exact: true, name: "Post to the channel" });
}

test("an image pasted into the message box shows its thumbnail before sending", async ({ page }) => {
  const form = await openComposer(page, unique("browser-compose-paste"));
  const bytes = [...hillsPng()];
  await form.getByRole("textbox").focus();
  await page.evaluate((png: readonly number[]) => {
    const pasted = new DataTransfer();
    pasted.items.add(new File([Uint8Array.from(png)], "hills.png", { type: "image/png" }));
    (document.activeElement ?? document.body).dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: pasted }),
    );
  }, bytes);

  await expect(form.getByRole("img", { exact: true, name: "hills.png" })).toHaveJSProperty(
    "naturalWidth",
    NATURAL_WIDTH,
  );
});

test("files picked with the Attach files button are sent with the message and show under it", async ({ page }) => {
  const form = await openComposer(page, unique("browser-compose-pick"));
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    form.getByRole("button", { exact: true, name: "Attach files" }).click(),
  ]);
  await fileChooser.setFiles([
    { buffer: Buffer.from(hillsPng()), mimeType: "image/png", name: "hills.png" },
    { buffer: Buffer.from("notes"), mimeType: "text/plain", name: "notes.txt" },
  ]);
  await form.getByRole("textbox").fill("The view");
  await form.getByRole("button", { exact: true, name: "Send" }).click();
  const shown = inPane(page).getByRole("list", { exact: true, name: "Attachments" });

  await expect(shown.getByRole("button", { exact: true, name: "hills.png" })).toBeVisible();
  await expect(shown.getByRole("link", { exact: true, name: "notes.txt 5 B" })).toBeVisible();
  await expect(form.getByRole("list", { exact: true, name: "Files to send" })).toBeHidden();
});
