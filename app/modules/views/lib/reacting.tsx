import type { ReactNode } from "react";
import { ReactionList } from "./reaction-list.ts";
import type { ReactionStore } from "../../reaction-store/index.ts";

interface ReactingProps {
  readonly reactions: ReactionStore;
  readonly children: ReactNode;
}

export function Reacting(props: ReactingProps): ReactNode {
  return <ReactionList value={props.reactions}>{props.children}</ReactionList>;
}
