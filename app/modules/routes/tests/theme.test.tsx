import { adminClient, openAt } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

async function openSettings(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
}

function chosenTheme(): readonly string[] {
  return ["System", "Light", "Dark"].filter((name) => screen.queryByRole("radio", { checked: true, name }) !== null);
}

function themeSet(): string | null {
  return globalThis.document.documentElement.dataset["theme"] ?? null;
}

async function chooseLightThenLeave(): Promise<readonly [readonly string[], string | null]> {
  const close = openAt({ client: adminClient(), hash: "#/" });
  await openSettings();
  const before = chosenTheme();
  fireEvent.click(screen.getByRole("radio", { name: "Light" }));
  const applied = themeSet();
  close();
  return [before, applied];
}

it("the Settings panel's theme switch applies the theme at once and remembers it for the next visit", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const [before, applied] = await chooseLightThenLeave();
  const close = openAt({ client: adminClient(), hash: "#/" });
  await openSettings();

  expect([before, applied, chosenTheme(), themeSet()]).toStrictEqual([["System"], "light", ["Light"], "light"]);

  close();
});

it("choosing System leaves the theme to the operating system's setting", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: adminClient(), hash: "#/" });
  await openSettings();
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  const dark = themeSet();
  fireEvent.click(screen.getByRole("radio", { name: "System" }));

  expect([dark, themeSet(), chosenTheme()]).toStrictEqual(["dark", null, ["System"]]);

  close();
});

it("the Settings button opens and closes its panel", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: adminClient(), hash: "#/" });
  await openSettings();
  const opened = screen.queryByRole("region", { name: "Settings" });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));

  expect([opened === null, screen.queryByRole("region", { name: "Settings" })]).toStrictEqual([false, null]);

  close();
});
