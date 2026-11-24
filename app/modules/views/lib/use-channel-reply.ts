import type { Board, ThreadMessages, ThreadMessagesState } from "../../board/index.ts";
import type { ChannelName, Message, TopLevelMessage } from "../../sdk/index.ts";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Composer } from "./thread-draft.ts";
import type { Draft } from "../../composer/index.ts";
import type { Selection } from "../../unread/index.ts";
import { threadDraft } from "./thread-draft.ts";

interface ChannelReplyOf {
  readonly board: Board;
  readonly composer: Composer;
  readonly channel: ChannelName;
  readonly selection: Selection;
  readonly newest: TopLevelMessage;
  readonly me: string;
  readonly replied: () => void;
}

interface ChannelReply {
  readonly post: Message;
  readonly messages: ThreadMessages;
  readonly state: ThreadMessagesState;
  readonly draft: Draft;
  readonly field: string;
  readonly onReply: (name: string | null, message: Message) => void;
}

export function useChannelReply({
  board,
  channel,
  composer,
  me,
  newest,
  replied,
  selection,
}: ChannelReplyOf): ChannelReply {
  const { replyPost } = useSyncExternalStore(selection.subscribe, selection.snapshot);
  const post = replyPost ?? newest;
  const thread = board.thread(channel, post.id);
  const state = useSyncExternalStore(thread.subscribeWithoutAcking, thread.snapshot);
  const messages = useMemo(
    (): ThreadMessages => ({
      ...thread,
      reply: (text, posted) => {
        thread.reply(text, () => {
          posted();
          replied();
        });
      },
    }),
    [replied, thread],
  );
  const draft = threadDraft({ channel, composer, me, messages, thread: post.id });
  const onReply = useCallback(
    (_name: string | null, message: Message) => {
      selection.chooseReplyPost(message);
      const chosen = board.thread(channel, message.id);
      threadDraft({ channel, composer, me, messages: chosen, thread: message.id }).replyTo(null);
    },
    [board, channel, composer, me, selection],
  );
  return { draft, field: `Reply to @${post.author.name}`, messages, onReply, post, state };
}

export type { Composer } from "./thread-draft.ts";
