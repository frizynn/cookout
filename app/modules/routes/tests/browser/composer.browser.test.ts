import { adminClient, logIn } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function threadIn(channel: string): Promise<void> {
  const admin = adminClient();
  await admin.createChannel({ name: channel });
  await admin.createMessage({ channel, text: "Who can review this?" });
}

async function openThread(page: Page, token: string, channel: string): Promise<void> {
  await logIn({ page, token });
  await page.getByRole("link", { name: `#${channel}` }).click();
  await page.getByRole("link", { name: /Who can review this\?/u }).click();
}

async function mentionerAndReviewers(): Promise<string> {
  const admin = adminClient();
  const { token } = await admin.createIdentity({ kind: "human", name: "browser-mentioner" });
  await admin.createIdentity({ kind: "agent", name: "browser-reviewer-bot" });
  await admin.createIdentity({ kind: "human", name: "browser-reviewer-ada" });
  await threadIn("browser-composer");
  return token;
}

test("typing @ and a prefix in the reply box suggests the matching identities, and choosing one inserts the mention", async ({
  page,
}) => {
  const token = await mentionerAndReviewers();

  await openThread(page, token, "browser-composer");
  const box = page.getByLabel("Reply", { exact: true });
  await box.pressSequentially("Could @browser-rev");
  const suggestions = page.getByRole("list", { name: "Mention suggestions" });

  await expect(suggestions.getByRole("button")).toHaveText(["@browser-reviewer-ada", "@browser-reviewer-bot"]);

  await suggestions.getByRole("button", { name: "@browser-reviewer-bot" }).click();
  await page.keyboard.type("look?");

  await expect(box).toHaveValue("Could @browser-reviewer-bot look?");
  await expect(suggestions).toBeHidden();
});
