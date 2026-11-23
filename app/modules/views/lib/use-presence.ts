import type { IdentityName, LiveConnectionDetail, Presence } from "../../sdk/index.ts";
import { useContext, useSyncExternalStore } from "react";
import { PresenceList } from "./presence-list.ts";
import type { Presences } from "../../presence-store/index.ts";
import { onTick } from "./use-time-ago.ts";
import { timeAgo } from "../../format/index.ts";

const TEXT = {
  lastSeen: "last seen ",
  offline: "Offline",
  online: "Online",
  watching: "watching",
  watchingFrom: "watching from ",
  web: "web",
} as const;

interface PresenceShown {
  readonly online: boolean;
  readonly label: string;
  readonly spoken: string;
}

interface Among {
  readonly presences: Presences;
  readonly name: IdentityName;
}

function lastSeenOf(presence: Presence): string | null {
  const at = presence.lastSeenAt ?? null;
  if (at === null) {
    return null;
  }
  return `${TEXT.lastSeen}${timeAgo(at)}`;
}

function offlineText(presence: Presence, between: string): string {
  const lastSeen = lastSeenOf(presence);
  if (lastSeen === null) {
    return TEXT.offline;
  }
  return `${TEXT.offline}${between}${lastSeen}`;
}

function labelOf(presence: Presence): string {
  if (presence.online) {
    return TEXT.online;
  }
  return offlineText(presence, ", ");
}

function connectionOf(connection: LiveConnectionDetail): string {
  if (connection.via === "web") {
    return TEXT.web;
  }
  const host = connection.host ?? null;
  if (host === null) {
    return TEXT.watching;
  }
  return `${TEXT.watchingFrom}${host}`;
}

function offlineDetail(presence: Presence): string {
  const reason = presence.offlineReason ?? null;
  const text = offlineText(presence, " · ");
  if (reason === null) {
    return text;
  }
  return `${TEXT.offline}: ${reason}${text.slice(TEXT.offline.length)}`;
}

function detailOf(presence: Presence): string {
  if (!presence.online) {
    return offlineDetail(presence);
  }
  const connection = presence.connection ?? null;
  if (connection === null) {
    return TEXT.online;
  }
  return `${TEXT.online} · ${connectionOf(connection)}`;
}

function usePresences(): Presences {
  const store = useContext(PresenceList);
  return useSyncExternalStore(store.subscribe, store.snapshot);
}

function usePresenceOf(name: IdentityName): Presence | null {
  return usePresences().get(name) ?? null;
}

function shownIn({ name, presences }: Among): PresenceShown | null {
  const presence = presences.get(name) ?? null;
  if (presence === null) {
    return null;
  }
  const label = labelOf(presence);
  return { label, online: presence.online, spoken: label };
}

function useTicking(presence: Presence | null, text: (known: Presence) => string): string | null {
  return useSyncExternalStore(onTick, () => {
    if (presence === null) {
      return null;
    }
    return text(presence);
  });
}

function usePresence(name: IdentityName): PresenceShown | null {
  const presence = usePresenceOf(name);
  const label = useTicking(presence, labelOf);
  if (presence === null || label === null) {
    return null;
  }
  return { label, online: presence.online, spoken: label };
}

function briefOf(online: boolean): string {
  if (online) {
    return TEXT.online;
  }
  return TEXT.offline;
}

function useAuthorPresence(name: IdentityName): PresenceShown | null {
  const presence = usePresence(name);
  if (presence === null) {
    return null;
  }
  return { ...presence, spoken: briefOf(presence.online) };
}

function usePresenceDetail(name: IdentityName): string | null {
  return useTicking(usePresenceOf(name), detailOf);
}

export { type PresenceShown, shownIn, useAuthorPresence, usePresence, usePresenceDetail, usePresences };
