import type { AgentJoinApprovals, LoginApprovals, Session } from "../../session/index.ts";
import type { Board } from "../../board/index.ts";
import type { Composer } from "../../composer/index.ts";
import type { Layout } from "../../layout/index.ts";
import type { Unread } from "../../unread/index.ts";

interface Stores {
  readonly agentJoinApprovals: AgentJoinApprovals;
  readonly board: Board;
  readonly composer: Composer;
  readonly layout: Layout;
  readonly loginApprovals: LoginApprovals;
  readonly session: Session;
  readonly unread: Unread;
}

export type { Stores };
