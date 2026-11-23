import { ChipLink, Feed, Pane, PaneHeader, Toolbar } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import { ClosingRefusal } from "./closing-refusal.tsx";
import { OpenThreadList } from "./open-thread-list.tsx";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";

const TEXT = {
  all: "All",
  description: "Threads nobody has closed, the quietest first",
  mine: "Involving me",
  title: "Open threads",
} as const;

interface OpenThreadsProps {
  readonly all: boolean;
  readonly board: Board;
}

export function OpenThreadsView(props: OpenThreadsProps): ReactNode {
  const { all, board } = props;
  return (
    <Pane>
      <PaneHeader description={TEXT.description} sans title={TEXT.title} />
      <Toolbar>
        <ChipLink current={!all} href={hrefOf({ all: false, name: "open-threads" })}>
          {TEXT.mine}
        </ChipLink>
        <ChipLink current={all} href={hrefOf({ all: true, name: "open-threads" })}>
          {TEXT.all}
        </ChipLink>
      </Toolbar>
      <Feed label={TEXT.title}>
        <ClosingRefusal closing={board.closing} />
        <OpenThreadList closing={board.closing} key={String(all)} openThreads={board.openThreads(all)} />
      </Feed>
    </Pane>
  );
}
