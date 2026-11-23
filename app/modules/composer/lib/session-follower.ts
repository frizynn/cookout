import type { CookoutEvent, IdentityName, ListedAgentSession } from "../../sdk/index.ts";
import { everySecond, isPast } from "../../format/index.ts";
import type { Live } from "../../live/index.ts";

const NONE = 0;

type Sessions = readonly ListedAgentSession[] | null;

interface SessionFollower {
  readonly start: () => void;
}

interface SessionFollowerOptions {
  readonly live: Live | null;
  readonly name: IdentityName;
  readonly load: () => Promise<Sessions>;
}

function concerns(event: CookoutEvent, name: IdentityName): boolean {
  if (event.type === "agent-session") {
    return event.agent === name;
  }
  return event.type === "identity" && event.identity.name === name;
}

function untilExpired(sessions: Sessions, expired: () => void): (() => void) | null {
  const listed = sessions ?? [];
  if (listed.length === NONE) {
    return null;
  }
  return everySecond(() => {
    if (listed.some((session) => isPast(session.expiresAt))) {
      expired();
    }
  });
}

function createSessionFollower({ live, load, name }: SessionFollowerOptions): SessionFollower {
  let loading: Promise<void> | null = null;
  let stop: (() => void) | null = null;

  function stopTicking(): void {
    if (stop !== null) {
      stop();
      stop = null;
    }
  }

  async function reloadAfter(previous: Promise<void> | null, again: () => void): Promise<void> {
    await previous;
    const sessions = await load();
    stopTicking();
    stop = untilExpired(sessions, again);
  }

  function reload(): void {
    stopTicking();
    loading = reloadAfter(loading, reload);
  }

  return {
    start: () => {
      if (loading !== null) {
        return;
      }
      if (live !== null) {
        live.subscribe((event) => {
          if (concerns(event, name)) {
            reload();
          }
        });
      }
      reload();
    },
  };
}

export { type SessionFollower, createSessionFollower };
