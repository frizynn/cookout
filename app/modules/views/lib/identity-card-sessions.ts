import type { IdentityCardSession, IdentityCardSource } from "../../design-system/index.tsx";
import type { IdentityName, ListedAgentSession } from "../../sdk/index.ts";
import { agentSessions, identityList } from "../../board/index.ts";
import type { BoardStore } from "../../board/index.ts";
import { isPast } from "../../format/index.ts";

type SessionSource = Pick<IdentityCardSource, "sessionOf" | "subscribeSession">;

const NO_SESSIONS: readonly ListedAgentSession[] = [];

function viewerOf(boardStore: BoardStore): string | null {
  const { session } = boardStore.snapshot();
  if (session.status !== "logged-in") {
    return null;
  }
  return session.identity.name;
}

function ownedAgent(boardStore: BoardStore, name: string): IdentityName | null {
  const viewer = viewerOf(boardStore);
  const agent =
    identityList(boardStore.snapshot()).find(
      (listed) => listed.name === name && listed.kind === "agent" && listed.owner === viewer,
    ) ?? null;
  if (agent === null) {
    return null;
  }
  return agent.name;
}

function watchedAt(sessions: readonly ListedAgentSession[]): string | null {
  for (const session of sessions) {
    if (typeof session.sessionUrl === "string" && !isPast(session.expiresAt)) {
      return session.sessionUrl;
    }
  }
  return null;
}

function sessionAt(href: string): IdentityCardSession {
  return { host: new URL(href).host, href };
}

function hrefOf(boardStore: BoardStore, name: string): string | null {
  const agent = ownedAgent(boardStore, name);
  if (agent === null) {
    return null;
  }
  return watchedAt(agentSessions(agent)(boardStore.snapshot()) ?? NO_SESSIONS);
}

export function createIdentityCardSessions(boardStore: BoardStore): SessionSource {
  const drawn = new Map<string, IdentityCardSession>();
  return {
    sessionOf: (name) => {
      const href = hrefOf(boardStore, name);
      if (href === null) {
        return null;
      }
      const shown = drawn.get(href) ?? sessionAt(href);
      drawn.set(href, shown);
      return shown;
    },
    subscribeSession: (name) => (listener) => {
      const stops = [
        boardStore.subscribeShowing("session")(listener),
        boardStore.subscribeShowing("identities")(listener),
      ];
      const agent = ownedAgent(boardStore, name);
      if (agent !== null) {
        stops.push(boardStore.subscribeShowingSessions(agent)(listener));
      }
      return () => {
        for (const stop of stops) {
          stop();
        }
      };
    },
  };
}
