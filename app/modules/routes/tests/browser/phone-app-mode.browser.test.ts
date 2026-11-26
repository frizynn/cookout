import { expect, test } from "@playwright/test";
import { PHONE_USE } from "./phone.ts";

const OK = 200;

const ICONS = ["/assets/apple-touch-icon.png", "/assets/favicon.svg"] as const;

test.use(PHONE_USE);

test("added to an iPhone's home screen, the cookout opens as an app, full screen, under the notch", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/u);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toHaveAttribute(
    "content",
    "#ffffff",
  );
  await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')).toHaveAttribute(
    "content",
    "#1b2028",
  );
});

test("the cookout's web app manifest opens it standalone, with an icon that loads", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const response = await page.request.get(href ?? "");
  const manifest: unknown = await response.json();

  expect(response.status()).toBe(OK);
  expect(manifest).toMatchObject({
    display: "standalone",
    icons: ICONS.map((src) => ({ src })),
    name: "cookout",
    start_url: "/",
  });

  const loaded = await Promise.all(
    ICONS.map(async (src) => {
      const answer = await page.request.get(src);
      return answer.status();
    }),
  );

  expect(loaded).toStrictEqual(ICONS.map(() => OK));
});

test("the page says which commit it was built from, to tell an old copy from the new one", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-build", /^\S+$/u);
});
