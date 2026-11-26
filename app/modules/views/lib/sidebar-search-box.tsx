import type { Identities } from "../../composer/index.ts";
import type { Keymap } from "../../keymap/index.ts";
import type { ReactNode } from "react";
import type { Search } from "../../search/web.ts";
import { SearchBox } from "./search-box.tsx";
import { SidebarSearch } from "../../design-system/layout.tsx";

interface SidebarSearchBoxProps {
  readonly identities: Identities;
  readonly keymap: Keymap;
  readonly search: Search;
}

export function SidebarSearchBox(props: SidebarSearchBoxProps): ReactNode {
  return (
    <SidebarSearch>
      <SearchBox identities={props.identities} keymap={props.keymap} place="sidebar" search={props.search} />
    </SidebarSearch>
  );
}
