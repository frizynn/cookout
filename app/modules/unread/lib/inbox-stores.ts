import type {
  AlertsShown,
  BoardState,
  BoardStore,
  EarlierShown,
  InboxShown,
  JoinsShown,
  MarkChannelRefusal,
  NudgesShown,
  OffersShown,
  QuietAgentsShown,
} from "../../board/index.ts";
import type {
  ChannelName,
  DeactivatedQuietAgentId,
  DeactivationOfferId,
  MessageId,
  Nudge,
  NudgeId,
  OfflineAlertId,
  Refusal,
} from "../../sdk/index.ts";
import { alertsOf, earlierOf, inboxOf, joinRefusalsOf, nudgesOf, offersOf, quietAgentsOf } from "../../board/index.ts";

type Subscribe = (listener: () => void) => () => void;

interface Shown<State> {
  readonly subscribe: Subscribe;
  readonly snapshot: () => State;
}

type UnreadState = InboxShown;

type EarlierState = EarlierShown;

interface Earlier extends Shown<EarlierState> {
  readonly loadMore: () => void;
}

type AlertsState = AlertsShown;

interface Alerts extends Shown<AlertsState> {
  readonly markRead: (id: OfflineAlertId) => void;
}

type NudgesState = NudgesShown;

interface Nudges extends Shown<NudgesState> {
  readonly markRead: (id: NudgeId) => void;
  readonly close: (nudge: Nudge) => void;
}

type DeactivationOffersState = OffersShown;

interface DeactivationOffers extends Shown<DeactivationOffersState> {
  readonly keep: (id: DeactivationOfferId) => void;
}

type DeactivatedQuietAgentsState = QuietAgentsShown;

interface DeactivatedQuietAgents extends Shown<DeactivatedQuietAgentsState> {
  readonly markRead: (id: DeactivatedQuietAgentId) => void;
  readonly hold: (id: DeactivatedQuietAgentId) => void;
  readonly release: (id: DeactivatedQuietAgentId) => void;
}

interface AgentJoinRequests extends Shown<JoinsShown> {
  readonly approve: (userCode: string) => void;
}

interface MarkChannel {
  readonly subscribe: Subscribe;
  readonly refusal: () => MarkChannelRefusal | null;
  readonly markChannelRead: (channel: ChannelName) => void;
}

interface MessageMenu {
  readonly subscribe: Subscribe;
  readonly refusal: () => Refusal | null;
  readonly markUnread: (messageId: MessageId) => void;
}

type InboxBoard = Pick<BoardStore, "inboxCalls" | "snapshot" | "subscribeShowing">;

interface InboxStores {
  readonly inbox: Shown<UnreadState>;
  readonly earlier: Earlier;
  readonly alerts: Alerts;
  readonly nudges: Nudges;
  readonly deactivationOffers: DeactivationOffers;
  readonly deactivatedQuietAgents: DeactivatedQuietAgents;
  readonly agentJoinRequests: AgentJoinRequests;
  readonly markChannel: MarkChannel;
  readonly menu: MessageMenu;
}

function shownBy<State>(board: InboxBoard, select: (state: BoardState) => State): Shown<State> {
  return { snapshot: () => select(board.snapshot()), subscribe: board.subscribeShowing("inbox") };
}

function noticeStores(
  board: InboxBoard,
): Pick<InboxStores, "alerts" | "deactivatedQuietAgents" | "deactivationOffers" | "nudges"> {
  const calls = board.inboxCalls;
  return {
    alerts: { ...shownBy(board, alertsOf), markRead: calls.markAlertRead },
    deactivatedQuietAgents: {
      ...shownBy(board, quietAgentsOf),
      hold: calls.hold,
      markRead: calls.markQuietAgentRead,
      release: calls.release,
    },
    deactivationOffers: { ...shownBy(board, offersOf), keep: calls.keep },
    nudges: {
      ...shownBy(board, nudgesOf),
      close: ({ parent }) => {
        calls.closeNudged(parent.id);
      },
      markRead: calls.markNudgeRead,
    },
  };
}

function inboxStoresOf(board: InboxBoard): InboxStores {
  const calls = board.inboxCalls;
  const { subscribe } = shownBy(board, inboxOf);
  return {
    ...noticeStores(board),
    agentJoinRequests: { ...shownBy(board, joinRefusalsOf), approve: calls.approve },
    earlier: { ...shownBy(board, earlierOf), loadMore: calls.loadEarlier },
    inbox: shownBy(board, inboxOf),
    markChannel: {
      markChannelRead: calls.markChannelRead,
      refusal: () => board.snapshot().inboxCalls.markChannel,
      subscribe,
    },
    menu: { markUnread: calls.markUnread, refusal: () => board.snapshot().inboxCalls.menu, subscribe },
  };
}

export {
  type AgentJoinRequests,
  type Alerts,
  type AlertsState,
  type DeactivatedQuietAgents,
  type DeactivatedQuietAgentsState,
  type DeactivationOffers,
  type DeactivationOffersState,
  type Earlier,
  type EarlierState,
  type InboxBoard,
  type MarkChannel,
  type MessageMenu,
  type Nudges,
  type NudgesState,
  type UnreadState,
  inboxStoresOf,
};
export type { MarkAllState } from "../../board/index.ts";
