import type { CookoutClient, CookoutEvent, Identity } from "../../sdk/index.ts";
import type { Live } from "../../live/index.ts";

interface IdentityList {
  readonly identities: () => readonly Identity[];
  readonly load: () => void;
  readonly onChange: (refresh: () => void) => void;
  readonly publish: (identities: readonly Identity[]) => void;
  readonly put: (identity: Identity) => void;
  readonly remove: (name: Identity["name"]) => void;
}

interface IdentityListOptions {
  readonly client: Pick<CookoutClient, "listIdentities">;
  readonly live: Live | null;
  readonly deleted: (name: Identity["name"]) => void;
}

function withIdentity(identities: readonly Identity[], changed: Identity): readonly Identity[] {
  const others = identities.filter((identity) => identity.name !== changed.name);
  return [...others, changed].toSorted((first, second) => first.name.localeCompare(second.name));
}

function listedAfter(
  identities: readonly Identity[],
  event: CookoutEvent,
  deleted: IdentityListOptions["deleted"],
): readonly Identity[] | null {
  if (event.type === "identity") {
    return withIdentity(identities, event.identity);
  }
  if (event.type === "identity-deleted") {
    const { name } = event.identity;
    deleted(name);
    return identities.filter((identity) => identity.name !== name);
  }
  return null;
}

function follow(live: Live | null, receive: (event: CookoutEvent) => void, reload: () => void): void {
  if (live !== null) {
    live.subscribe(receive);
    live.onBack(reload);
  }
}

function createIdentityList(options: IdentityListOptions): IdentityList {
  const refreshes = new Set<() => void>();
  let identities: readonly Identity[] = [];
  let loading: Promise<void> | null = null;

  function publish(next: readonly Identity[]): void {
    identities = next;
    for (const refresh of refreshes) {
      refresh();
    }
  }

  function receive(event: CookoutEvent): void {
    const next = listedAfter(identities, event, options.deleted);
    if (next !== null) {
      publish(next);
    }
  }

  async function loadIdentities(): Promise<void> {
    try {
      const listed = await options.client.listIdentities({ include: "deactivated" });
      publish(listed.identities);
    } catch {
      identities = [];
    }
  }

  return {
    identities: () => identities,
    load: () => {
      if (loading === null) {
        follow(options.live, receive, () => {
          loading = loadIdentities();
        });
        loading = loadIdentities();
      }
    },
    onChange: (refresh) => {
      refreshes.add(refresh);
    },
    publish,
    put: (identity) => {
      publish(withIdentity(identities, identity));
    },
    remove: (name) => {
      publish(identities.filter((identity) => identity.name !== name));
    },
  };
}

export { type IdentityList, createIdentityList };
