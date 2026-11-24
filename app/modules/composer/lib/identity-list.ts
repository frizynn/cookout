import type { BoardStore, IdentityCalls } from "../../board/index.ts";
import type { Command, Identity } from "../../sdk/index.ts";
import { identityList } from "../../board/index.ts";

type IdentityStore = Pick<
  BoardStore,
  "identityCalls" | "snapshot" | "subscribe" | "subscribeShowing" | "subscribeShowingSessions"
>;

interface CommandList {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => { readonly status: string; readonly commands?: readonly Command[] };
}

interface IdentityList {
  readonly identities: () => readonly Identity[];
  readonly show: () => () => void;
  readonly onChange: (refresh: () => void) => void;
  readonly refresh: () => void;
  readonly calls: IdentityCalls;
  readonly store: IdentityStore;
}

interface IdentityListOptions {
  readonly boardStore: IdentityStore;
  readonly commands: CommandList;
}

function createIdentityList({ boardStore, commands }: IdentityListOptions): IdentityList {
  const refreshes = new Set<() => void>();
  let seen: readonly Identity[] | null = null;
  let watchingCommands = false;

  function identities(): readonly Identity[] {
    return identityList(boardStore.snapshot());
  }

  function refresh(): void {
    for (const each of refreshes) {
      each();
    }
  }

  function checked(): void {
    const listed = identities();
    if (listed !== seen) {
      seen = listed;
      refresh();
    }
  }

  return {
    calls: boardStore.identityCalls,
    identities,
    onChange: (each) => {
      refreshes.add(each);
    },
    refresh,
    show: () => {
      if (!watchingCommands) {
        watchingCommands = true;
        commands.subscribe(refresh);
      }
      return boardStore.subscribeShowing("identities")(() => {
        checked();
      });
    },
    store: boardStore,
  };
}

export { type CommandList, type IdentityList, type IdentityStore, createIdentityList };
