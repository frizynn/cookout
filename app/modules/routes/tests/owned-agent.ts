import type { CookoutClient, EventStream } from "../../sdk/index.ts";
import { adminClient, clientWith, newIdentity } from "./identities.ts";
import { inPane, inSidebar } from "./regions.ts";
import { screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

const ONE_MORE = 1;

interface OwnedAgent {
  readonly owner: CookoutClient;
  readonly agent: string;
  readonly row: string;
  readonly watchAgain: () => Promise<void>;
  readonly close: () => Promise<void>;
}

interface Opening {
  readonly owner: string;
  readonly client?: (owner: CookoutClient) => CookoutClient;
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

async function joinedWatch(owner: CookoutClient, agent: string): Promise<EventStream> {
  const { agentSessionToken } = await owner.join({ as: agent });
  const events = await connectedWatch(clientWith(agentSessionToken));
  return events;
}

function asItIs(owner: CookoutClient): CookoutClient {
  return owner;
}

async function inboxOfOwnerWithWatchingAgent({ client = asItIs, owner }: Opening): Promise<OwnedAgent> {
  const human = await newIdentity({ kind: "human", name: owner });
  const agent = `${owner}-agent`;
  await human.client.createIdentity({ kind: "agent", name: agent });
  const watches = [await joinedWatch(human.client, agent)];
  const { live, stream } = watched(human.client);
  const unmount = openAt({ client: client(human.client), hash: "#/inbox", live });
  await screen.findByText("You're all caught up.");
  watches.push(await stream);
  return {
    agent,
    close: async () => {
      unmount();
      await Promise.all(
        watches.map(async (events) => {
          await events.close();
        }),
      );
    },
    owner: human.client,
    row: `@${agent} went offline: session revoked`,
    watchAgain: async () => {
      watches.push(await joinedWatch(human.client, agent));
    },
  };
}

function rowsShown(row: string): number {
  return within(inPane().element()).queryAllByText(row).length;
}

async function alertRaised({ agent, row }: Pick<OwnedAgent, "agent" | "row">): Promise<void> {
  const before = rowsShown(row);
  await adminClient().revokeAgentSession(agent);
  await waitFor(() => {
    expect(rowsShown(row)).toBe(before + ONE_MORE);
  });
}

function inboxCounts(): readonly (string | null)[] {
  const link = inSidebar().getByRole("link", { name: /^Inbox/u });
  const counts: (string | null)[] = [];
  for (const count of within(link).queryAllByText(/^\d+ (?:unread|for you)$/u)) {
    counts.push(count.textContent);
  }
  return counts;
}

export { type OwnedAgent, alertRaised, inboxCounts, inboxOfOwnerWithWatchingAgent };
