import type { Keymap } from "../../keymap/index.ts";
import type { ReactNode } from "react";
import type { Search } from "../../search/web.ts";
import { SearchResults } from "./search-results.tsx";
import { useSearchBox } from "./use-search-box.ts";
import { useSyncExternalStore } from "react";

const TEXT = { label: "Search", placeholder: "Search messages" } as const;

interface SearchBoxProps {
  readonly keymap: Keymap;
  readonly search: Search;
}

export function SearchBox(props: SearchBoxProps): ReactNode {
  const { keymap, search } = props;
  const shortcut = keymap.shortcutOf("openSearch");
  const state = useSyncExternalStore(search.subscribe, search.snapshot);
  const { area, box } = useSearchBox({ keymap, search });
  return (
    <div className="relative shrink-0 border-b px-4 py-2" ref={area}>
      <input
        aria-keyshortcuts={shortcut.keys}
        aria-label={TEXT.label}
        autoComplete="off"
        className="h-8 w-full rounded-md border bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-muted-foreground"
        placeholder={`${TEXT.placeholder} (${shortcut.label})`}
        ref={box}
        spellCheck={false}
        type="search"
        defaultValue={state.query}
      />
      {state.open && state.found.status !== "idle" && <SearchResults state={state} />}
    </div>
  );
}
