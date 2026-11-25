import { adminClient, newIdentity } from "./identities.ts";
import { expect, it, onTestFinished, vi } from "vitest";
import { WEB_SLOW_VARIABLE } from "../../config/index.ts";
import { openAt } from "./render.tsx";
import { profileOpened } from "./view-opened.ts";
import { screen } from "@testing-library/react";
import { slowCalls } from "./slow-calls.ts";

const DELAY_MS = 1500;

function delayed(delay: string): void {
  vi.stubEnv(WEB_SLOW_VARIABLE, delay);
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
}

async function profileHeading(): Promise<string> {
  const heading = await screen.findByRole("heading", { level: 3 });
  return heading.textContent;
}

it("without a delay set, the view's client is the client itself", { timeout: 1000 }, () => {
  expect.hasAssertions();

  delayed("");
  const client = adminClient();

  expect(slowCalls(client)).toBe(client);
});

it("with calls delayed, a test that reads the profile without waiting fails, and one that waits passes", {
  timeout: 10_000,
}, async () => {
  expect.hasAssertions();

  delayed(String(DELAY_MS));
  await newIdentity({ kind: "human", name: "web-slow-calls" });
  const unmount = openAt({ client: adminClient(), hash: "#/people/web-slow-calls" });
  const missingItsWait = await profileHeading().catch(() => "not shown yet");
  unmount();
  const { close } = await profileOpened({ client: adminClient(), name: "web-slow-calls" });
  const waited = await profileHeading();
  close();

  expect([missingItsWait, waited]).toStrictEqual(["not shown yet", "web-slow-calls"]);
});
