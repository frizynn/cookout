import { adminClient, logIn, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";

test("a human logs in with their token, sees the channel list and opens a channel", async ({ page }) => {
  await adminClient().createChannel({ description: "Where the browser test lands.", name: "browser-lobby" });
  await adminClient().createMessage({ channel: "browser-lobby", text: "Welcome in" });

  const { token } = await newIdentity({ kind: "human", name: "browser-human" });
  await logIn({ page, token });
  await page.getByRole("link", { name: "#browser-lobby" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("#browser-lobby");
  await expect(page.getByRole("list", { name: "Messages" }).getByRole("link")).toHaveText([
    "@adminWelcome in0 replies",
  ]);
});

test("the session cookie keeps a human logged in across a reload", async ({ page }) => {
  await adminClient().createChannel({ name: "browser-reload" });

  const { token } = await newIdentity({ kind: "human", name: "browser-reloader" });
  await logIn({ page, token });

  await expect(page.getByRole("link", { name: "#browser-reload" })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("link", { name: "#browser-reload" })).toBeVisible();
});

test("an agent's token is refused, and the login form stays", async ({ page }) => {
  const { token } = await newIdentity({ kind: "agent", name: "browser-agent" });
  await logIn({ page, token });

  await expect(page.getByRole("alert")).toHaveText(/^Couldn't log in \(human_only\)/u);
  await expect(page.getByRole("form", { name: "Log in" })).toBeVisible();
});
