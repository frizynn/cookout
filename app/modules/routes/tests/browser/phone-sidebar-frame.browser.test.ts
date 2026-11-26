import { PHONE_USE, logInOnPhone } from "./phone.ts";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inSidebar, inTopBar } from "./regions.ts";
import type { Page } from "@playwright/test";
import { unique } from "./names.ts";

const VISIBLE = { height: 400, top: 120 } as const;

interface Edges {
  readonly bottom: number;
  readonly top: number;
}

function sidebarEdgesWithin({ height, top }: typeof VISIBLE): Edges {
  const root = globalThis.document.documentElement;
  root.style.setProperty("--visible-top", `${String(top)}px`);
  root.style.setProperty("--visible-height", `${String(height)}px`);
  const sidebar = globalThis.document.querySelector('nav[aria-label="Sidebar"]');
  if (sidebar === null) {
    return { bottom: Number.NaN, top: Number.NaN };
  }
  const box = sidebar.getBoundingClientRect();
  return { bottom: box.bottom, top: box.top };
}

async function sidebarOpen(page: Page): Promise<void> {
  const channel = unique("browser-phone-sidebar-frame");
  await adminClient().createChannel({ name: channel });
  const reader = await newIdentity({ kind: "human", name: unique("browser-phone-sidebar-reader") });
  await reader.client.subscribe(channel);
  await logInOnPhone({ page, token: reader.token, url: `/#/channels/${channel}` });
  await inTopBar(page).getByRole("button", { exact: true, name: "Open the sidebar" }).tap();
}

test.use(PHONE_USE);

test("on a phone the open sidebar stays inside the part of the screen the keyboard leaves visible", async ({
  page,
}) => {
  await sidebarOpen(page);

  await expect(inSidebar(page)).toBeVisible();

  const edges = await page.evaluate(sidebarEdgesWithin, VISIBLE);

  expect(edges.top).toBeGreaterThanOrEqual(VISIBLE.top);
  expect(edges.bottom).toBeLessThanOrEqual(VISIBLE.top + VISIBLE.height);
});
