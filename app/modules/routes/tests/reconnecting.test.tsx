import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Live } from "../../live/index.ts";
import { createLive } from "../../live/index.ts";
import { openAt } from "./render.tsx";

type Link = ReturnType<Live["link"]>;

interface Cuttable {
  readonly live: Live;
  readonly report: (link: Link) => void;
}

function cuttable(): Cuttable {
  const reports: ((link: Link) => void)[] = [];
  const live = createLive({
    open: (_onEvent, onLink) => {
      reports.push(onLink);
    },
  });
  return {
    live,
    report: (link) => {
      for (const onLink of reports) {
        onLink(link);
      }
    },
  };
}

function rowTexts(): readonly string[] {
  const texts: string[] = [];
  for (const row of within(screen.getByRole("list", { name: "Identities" })).queryAllByRole("link")) {
    texts.push(row.textContent);
  }
  return texts;
}

function shows(name: string): boolean {
  return rowTexts().some((text) => text.includes(name));
}

async function openPeople(name: string): Promise<Cuttable["report"]> {
  const reader = await newIdentity({ kind: "human", name });
  const { live, report } = cuttable();
  openAt({ client: reader.client, hash: "#/people", live });
  await waitFor(() => {
    expect(shows(name)).toBe(true);
  });
  return report;
}

function barText(): string {
  return screen.getByRole("status", { name: "Live link" }).textContent;
}

it("a Reconnecting bar shows while the live link is down, and goes when it is back", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const report = await openPeople("web-reconnect-bar");

  expect(barText()).toBe("");

  report("down");

  await waitFor(() => {
    expect(barText()).toBe("Reconnecting…");
  });

  report("up");

  await waitFor(() => {
    expect(barText()).toBe("");
  });
});

it("an identity and a channel created while the live link was down show once it is back", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const report = await openPeople("web-reconnect-reader");

  report("down");
  await newIdentity({ kind: "agent", name: "web-reconnect-missed" });
  await adminClient().createChannel({ name: "web-reconnect-missed" });
  report("up");

  await waitFor(() => {
    expect(shows("web-reconnect-missed")).toBe(true);
  });

  await expect(
    within(screen.getByRole("list", { name: "Channels" })).findByRole("link", { name: /web-reconnect-missed/u }),
  ).resolves.toHaveProperty("hash", "#/channels/web-reconnect-missed");
});
