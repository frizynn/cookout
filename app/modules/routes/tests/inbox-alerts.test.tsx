import type { CookoutClient, EventStream } from "../../sdk/index.ts";
import { adminClient, clientWith, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { inPane, inSidebar } from "./regions.ts";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

const OWNER = "web-alert-owner";
const AGENT = "web-alert-agent";
const ROW = `@${AGENT} went offline: session revoked`;
const ONE_ROW = 1;

interface Open {
  readonly owner: CookoutClient;
  readonly close: () => Promise<void>;
}

async function connectedWatch(client: CookoutClient): Promise<EventStream> {
  const connected = Promise.withResolvers<null>();
  const events = await client.watch({
    onConnected: () => {
      connected.resolve(null);
    },
  });
  const reading = (async (): Promise<void> => {
    try {
      await events[Symbol.asyncIterator]().next();
    } catch {
      connected.resolve(null);
    }
  })();
  await Promise.race([connected.promise, reading]);
  return events;
}

async function inboxOfOwnerWithWatchingAgent(): Promise<Open> {
  const owner = await newIdentity({ kind: "human", name: OWNER });
  await owner.client.createIdentity({ kind: "agent", name: AGENT });
  const { agentSessionToken } = await owner.client.join({ as: AGENT });
  const agentWatch = await connectedWatch(clientWith(agentSessionToken));
  const { live, stream } = watched(owner.client);
  const unmount = openAt({ client: owner.client, hash: "#/inbox", live });
  await screen.findByText("You're all caught up.");
  const ownerWatch = await stream;
  return {
    close: async () => {
      unmount();
      await Promise.all([agentWatch.close(), ownerWatch.close()]);
    },
    owner: owner.client,
  };
}

async function alertRaised(): Promise<void> {
  await adminClient().revokeAgentSession(AGENT);
  await inPane().findByText(ROW);
}

function inboxCounts(): readonly (string | null)[] {
  const link = inSidebar().getByRole("link", { name: /^Inbox/u });
  const counts: (string | null)[] = [];
  for (const count of within(link).queryAllByText(/^\d+ (?:unread|for you)$/u)) {
    counts.push(count.textContent);
  }
  return counts;
}

it("an offline-alert event adds an inbox row and raises the sidebar count, and marking it read clears both", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const open = await inboxOfOwnerWithWatchingAgent();
  await alertRaised();
  const raised = inboxCounts();
  fireEvent.click(inPane().getByRole("button", { name: "Mark read" }));
  await screen.findByText("You're all caught up.");
  const earlier = await screen.findByRole("list", { name: "Earlier offline alerts" });

  expect([raised, inboxCounts(), within(earlier).queryAllByText(ROW).length]).toStrictEqual([
    ["1 for you"],
    [],
    ONE_ROW,
  ]);

  await waitFor(async () => {
    await expect(open.owner.inbox()).resolves.toMatchObject({ alerts: [] });
  });
  await open.close();
});
