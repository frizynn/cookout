import type { CookoutClient, CookoutEvent, Identity } from "../../sdk/index.ts";
import type { Live } from "../../live/index.ts";

interface IdentityList {
  readonly identities: () => readonly Identity[];
  readonly load: () => void;
  readonly onChange: (refresh: () => void) => void;
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

function createIdentityList(options: IdentityListOptions): IdentityList {
  const refreshes = new Set<() => void>();
  let identities: readonly Identity[] = [];
  let loading: Promise<void> | null = null;

  function changed(): void {
    for (const refresh of refreshes) {
      refresh();
    }
  }

  function put(identity: Identity): void {
    identities = withIdentity(identities, identity);
    changed();
  }

  function receive(event: CookoutEvent): void {
    if (event.type === "identity") {
      put(event.identity);
    }
  }

  async function loadIdentities(): Promise<void> {
    try {
      ({ identities } = await options.client.listIdentities());
      changed();
    } catch {
      identities = [];
    }
  }

  return {
    identities: () => identities,
    load: () => {
      if (loading === null) {
        if (options.live !== null) {
          options.live.subscribe(receive);
        }
        loading = loadIdentities();
      }
    },
    onChange: (refresh) => {
      refreshes.add(refresh);
    },
    put,
  };
}

export { type IdentityList, createIdentityList };
