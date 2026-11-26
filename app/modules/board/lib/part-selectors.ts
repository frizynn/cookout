import type { Identities, Sessions } from "./identity-parts.ts";
import type { IdentityName, Message, MessageId, ReactionCount, Refusal } from "../../sdk/index.ts";
import type { BoardState } from "./board-store.ts";
import type { Presences } from "./presence-slice.ts";
import { reactionsIn } from "./reactions-slice.ts";

function presences(state: BoardState): Presences {
  return state.presence;
}

interface MessageShown {
  readonly state: BoardState;
  readonly message: Message;
}

function reactionsOf({ message, state }: MessageShown): readonly ReactionCount[] {
  return reactionsIn({ held: state.reactions, message: state.messages.table.get(message.id) ?? message });
}

function reactionRefusal(state: BoardState): Refusal | null {
  return state.reactionRefusal;
}

const NO_SESSIONS = null;

function identityList(state: BoardState): Identities["listed"] {
  return state.identities.listed;
}

function deletedIdentities(state: BoardState): Identities["deleted"] {
  return state.identities.deleted;
}

function agentSessions(agent: IdentityName): (state: BoardState) => Sessions {
  function sessionsIn(state: BoardState): Sessions {
    return state.agentSessions.get(agent) ?? NO_SESSIONS;
  }
  return sessionsIn;
}

type Quoted = Message | null | "reading";

const READING = "reading";

function quoteOf(id: MessageId): (state: BoardState) => Quoted {
  function quoteIn(state: BoardState): Quoted {
    if (!state.quotes.has(id)) {
      return READING;
    }
    return state.quotes.get(id) ?? null;
  }
  return quoteIn;
}

function loggedInName(state: BoardState): IdentityName | null {
  if (state.session.status !== "logged-in") {
    return null;
  }
  return state.session.identity.name;
}

export {
  type Quoted,
  agentSessions,
  deletedIdentities,
  identityList,
  loggedInName,
  presences,
  quoteOf,
  reactionRefusal,
  reactionsOf,
};
