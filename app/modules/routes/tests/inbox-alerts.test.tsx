import { alertRaised, inboxCounts, inboxOfOwnerWithWatchingAgent } from "./owned-agent.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CookoutClient } from "../../sdk/index.ts";
import type { OwnedAgent } from "./owned-agent.ts";
import { inPane } from "./regions.ts";

const ONE_ROW = 1;
const TWO_ROWS = 2;

function failingMarkRead(owner: CookoutClient): CookoutClient {
  return {
    ...owner,
    markOfflineAlertRead: async () => {
      await Promise.resolve();
      throw new Error("refused");
    },
  };
}

async function raisedTwiceAndBack(open: OwnedAgent): Promise<void> {
  await alertRaised(open);
  await open.watchAgain();
  await alertRaised(open);
  await open.watchAgain();
}

it("an offline-alert event adds an inbox row and raises the sidebar count, and marking it read clears both", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const open = await inboxOfOwnerWithWatchingAgent({ owner: "web-alert-owner" });
  await alertRaised(open);
  const raised = inboxCounts();
  fireEvent.click(inPane().getByRole("button", { name: "Mark read" }));
  await screen.findByText("You're all caught up.");
  const earlier = await screen.findByRole("list", { name: "Earlier offline alerts" });

  expect([raised, inboxCounts(), within(earlier).queryAllByText(open.row).length]).toStrictEqual([
    ["1 for you"],
    [],
    ONE_ROW,
  ]);

  await waitFor(async () => {
    await expect(open.owner.inbox()).resolves.toMatchObject({ alerts: [] });
  });
  await open.close();
});

it("an alert row says when its agent is back online, and Mark all as read marks every alert read", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const open = await inboxOfOwnerWithWatchingAgent({ owner: "web-alert-back" });
  await raisedTwiceAndBack(open);
  await waitFor(() => {
    expect(within(inPane().element()).getAllByText(/Back online/u)).toHaveLength(TWO_ROWS);
  });
  fireEvent.click(inPane().getByRole("button", { name: "Mark all as read" }));
  await screen.findByText("You're all caught up.");
  await waitFor(async () => {
    await expect(open.owner.inbox()).resolves.toMatchObject({ alerts: [] });
  });
  await open.close();
});

it("an alert stays unread in the inbox when marking it read is refused", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const open = await inboxOfOwnerWithWatchingAgent({ client: failingMarkRead, owner: "web-alert-refused" });
  await alertRaised(open);
  fireEvent.click(inPane().getByRole("button", { name: "Mark read" }));
  await waitFor(async () => {
    await expect(open.owner.inbox()).resolves.toMatchObject({ alerts: [{ read: false }] });
  });

  expect(inPane().getByText(open.row)).toBeDefined();

  await open.close();
});
