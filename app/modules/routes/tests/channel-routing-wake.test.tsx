import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { inFormDialog as inDialog, inPane } from "./regions.ts";
import { openAt } from "./render.tsx";

const CHANNEL = "web-route-wake";
const FALLBACK = "web-route-wake-bot";

async function openSettings(): Promise<() => void> {
  const close = openAt({ client: adminClient(), hash: `#/channels/${CHANNEL}` });
  fireEvent.click(await inPane().findByRole("button", { name: "Settings" }));
  await screen.findByRole("dialog", { name: "Channel settings" });
  return close;
}

async function routedChannel(): Promise<void> {
  await newIdentity({ kind: "agent", name: FALLBACK });
  await adminClient().createChannel({ name: CHANNEL });
  await adminClient().setChannelRouting(CHANNEL, { fallback: FALLBACK, router: "https://router.example/route" });
}

async function newSessionShown(): Promise<void> {
  fireEvent.click(inDialog().getByRole("radio", { name: "A new session" }));
  await inDialog().findByRole("radiogroup", { name: "Harness" });
}

async function savedSonnetHigh(): Promise<void> {
  await newSessionShown();
  fireEvent.click(inDialog().getByRole("radio", { name: /^Sonnet/u }));
  fireEvent.click(inDialog().getByRole("radio", { name: "High" }));
  fireEvent.click(inDialog().getByRole("button", { name: "Save" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
}

function shownIn(group: string): string {
  return inDialog().getByRole("radiogroup", { name: group }).textContent;
}

function chosenIn(group: string): string {
  const chosen = within(inDialog().getByRole("radiogroup", { name: group })).getByRole("radio", { checked: true });
  return chosen.getAttribute("value") ?? "";
}

it("the fallback's new session lists the board's configured harnesses, models and efforts", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  await routedChannel();
  const close = await openSettings();
  await newSessionShown();
  const claude = [shownIn("Harness"), shownIn("Model"), shownIn("Effort")];
  fireEvent.click(inDialog().getByRole("radio", { name: "Pi" }));
  const pi = [shownIn("Model"), shownIn("Effort")];

  expect([claude, pi]).toStrictEqual([
    ["Claude CodePPi", "DefaultSonnetFor daily work", "DefaultHigh"],
    ["Pi Large", "Low"],
  ]);

  close();
});

it("an admin sets the fallback to wake in a new session, saves, and reopened it shows the same", {
  timeout: 8000,
}, async () => {
  expect.hasAssertions();

  const first = await openSettings();
  await savedSonnetHigh();
  first();
  const { channel } = await adminClient().getChannel(CHANNEL);
  const second = await openSettings();
  await inDialog().findByRole("radiogroup", { name: "Harness" });

  expect(channel.fallbackWake).toStrictEqual({ effort: "high", harness: "claude", model: "sonnet" });
  expect([chosenIn("Fallback wakes in"), chosenIn("Harness"), chosenIn("Model"), chosenIn("Effort")]).toStrictEqual([
    "ephemeral",
    "claude",
    "sonnet",
    "high",
  ]);

  second();
});
