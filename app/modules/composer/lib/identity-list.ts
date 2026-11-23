import type { CookoutClient, CookoutEvent, Identity } from "../../sdk/index.ts";
import type { Live } from "../../live/index.ts";

interface IdentityList {
  readonly identities: () => readonly Identity[];
  readonly load: () => void;
  readonly onChange: (refresh: () => void) => void;
  readonly publish: (identities: readonly Identity[]) => void;
  readonly put: (identity: Identity) => void;
}

interface IdentityListOptions {
  readonly client: Pick<CookoutClient, "listIdentities">;
  readonly live: Live | null;
}

function withIdentity(identities: readonly Identity[], changed: Identity): readonly Identity[] {
  const others = identities.filter((identity) => identity.name !== changed.name);
  return [...others, changed].toSorted((first, second) => first.name.localeCompare(second.name));
}

function follow(live: Live, receive: (event: CookoutEvent) => void, reload: () => void): void {
  live.subscribe(receive);
  live.onBack(reload);
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

  function put(identity: Identity): void {
    publish(withIdentity(identities, identity));
  }

  function receive(event: CookoutEvent): void {
    if (event.type === "identity") {
      put(event.identity);
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
        if (options.live !== null) {
          follow(options.live, receive, () => {
            loading = loadIdentities();
          });
        }
        loading = loadIdentities();
      }
    },
    onChange: (refresh) => {
      refreshes.add(refresh);
    },
    publish,
    put,
  };
}

export { type IdentityList, createIdentityList };
