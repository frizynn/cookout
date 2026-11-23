import type { ListedAgentSession } from "../../sdk/index.ts";
import { timeOf } from "../../format/index.ts";

const NONE = "No live session";

function joinedOf(session: ListedAgentSession): string {
  const host = session.host ?? null;
  if (host === null) {
    return "Joined";
  }
  return `Joined from ${host}`;
}

function usedOf(session: ListedAgentSession): string {
  const used = session.lastUsedAt ?? null;
  if (used === null) {
    return "not used yet";
  }
  return `last used ${timeOf(used).full}`;
}

function sessionText(sessions: readonly ListedAgentSession[]): string {
  const lines = sessions.map(
    (session) => `${joinedOf(session)} · ${usedOf(session)} · expires ${timeOf(session.expiresAt).full}`,
  );
  return lines.join("; ") || NONE;
}

export { sessionText };
