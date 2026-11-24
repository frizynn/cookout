import type { Board, ThreadMessages, ThreadMessagesState } from "../../board/index.ts";
import type { InboxItem, MessageId } from "../../sdk/index.ts";
import type { Newest, Reader, ReaderSources, Reading, Selection, Unread } from "../../unread/index.ts";
import type { InboxSelection } from "../../paths/index.ts";
import { useSyncExternalStore } from "react";

const LAST = -1;
const FIRST = 0;

interface ThreadReading {
  readonly board: Board;
  readonly unread: Unread;
  readonly reading: Reading;
  readonly selected: InboxSelection;
  readonly me: string;
}

function newestOf(state: ThreadMessagesState, me: string): Newest | null {
  if (state.status !== "loaded") {
    return null;
  }
  const newest = state.replies.at(LAST) ?? state.parent;
  return { id: newest.id, mine: newest.author.name === me };
}

function firstOf(items: readonly InboxItem[]): MessageId | null {
  return items.map((item) => item.message.id).at(FIRST) ?? null;
}

interface Sources {
  readonly messages: ThreadMessages;
  readonly selection: Selection;
  readonly unread: Unread;
  readonly me: string;
}

function readerSources({ me, messages, selection, unread }: Sources): ReaderSources {
  return {
    ack: messages.ack,
    firstUnread: () => firstOf(selection.snapshot().items),
    markUnread: unread.markUnread,
    newest: () => newestOf(messages.snapshot(), me),
    subscribe: messages.subscribeWithoutAcking,
    subscribeToUnread: selection.subscribe,
  };
}

function useThreadReader({ board, me, reading, selected, unread }: ThreadReading): Reader {
  const { channel, thread } = selected;
  const reader = reading.reader(
    `${channel}/${String(thread)}`,
    readerSources({ me, messages: board.thread(channel, thread), selection: unread.selection(selected), unread }),
  );
  useSyncExternalStore(reader.subscribe, reader.snapshot);
  return reader;
}

export { useThreadReader };
