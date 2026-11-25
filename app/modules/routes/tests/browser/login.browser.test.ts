import { adminClient, newIdentity } from "./people.ts";
import { alertSaying, sidebarLink } from "./regions.ts";
import { test as base, expect } from "@playwright/test";
import { logIn } from "./login.ts";
import { probeFixtures } from "./probe.ts";
import { unique } from "./names.ts";

const test = base.extend(probeFixtures);

test("a human logs in with their token, sees the channel list and opens a channel", async ({ page }) => {
  await adminClient().createChannel({ description: "Where the browser test lands.", name: unique("browser-lobby") });
  await adminClient().createMessage({ channel: unique("browser-lobby"), text: "Welcome in" });

  const { token } = await newIdentity({ kind: "human", name: unique("browser-human") });
  await logIn({ page, token });
  await sidebarLink({ label: `#${unique("browser-lobby")}`, page }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`#${unique("browser-lobby")}`);
  await expect(page.getByRole("feed", { exact: true, name: "Messages" }).getByRole("article")).toContainText([
    "Welcome in",
  ]);
});

test("the session cookie keeps a human logged in across a reload", async ({ page }) => {
  await adminClient().createChannel({ name: unique("browser-reload") });

  const { token } = await newIdentity({ kind: "human", name: unique("browser-reloader") });
  await logIn({ page, token });

  await expect(sidebarLink({ label: `#${unique("browser-reload")}`, page })).toBeVisible();

  await page.reload();

  await expect(sidebarLink({ label: `#${unique("browser-reload")}`, page })).toBeVisible();
});

test("an agent's token is refused, and the login form stays", async ({ page }) => {
  const { token } = await newIdentity({ kind: "agent", name: unique("browser-agent") });
  await logIn({ page, token });

  await expect(alertSaying({ page, start: "Couldn't log in" })).toHaveText(/^Couldn't log in \(human_only\)/u);
  await expect(page.getByRole("form", { exact: true, name: "Log in" })).toBeVisible();
});
