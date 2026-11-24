import { channelOrder, openChannel } from "./channel-order.ts";
import { markRead, stepTo, stepToUnread, toggleSubscription } from "./channel-keys.ts";
import { moveFocus, roving, sidebar } from "./sidebar-roving.ts";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Board } from "../../board/index.ts";
import type { ChannelKeys } from "./channel-keys.ts";
import type { Keymap } from "../../keymap/index.ts";
import type { Route } from "../../paths/index.ts";
import type { Unread } from "../../unread/index.ts";
import { useSidebarCounts } from "./use-unread-levels.ts";

const FIRST = 0;
const ONE = 1;

interface SidebarKeys {
  readonly board: Board;
  readonly keymap: Keymap;
  readonly me: string;
  readonly route: Route;
  readonly unread: Unread;
}

interface Said {
  readonly count: number;
  readonly text: string;
}

function useChannelKeys(props: SidebarKeys, announce: (text: string) => void): ChannelKeys {
  const { board, route, unread } = props;
  const { channels } = useSyncExternalStore(board.subscribe, board.snapshot);
  const subscribed = useSyncExternalStore(board.subscriptions.subscribe, board.subscriptions.snapshot);
  const state = useSyncExternalStore(unread.subscribe, unread.snapshot);
  const counts = useSidebarCounts({ me: props.me, state }).channels;
  const open = openChannel(route);
  return useMemo(
    () => ({
      announce,
      counts,
      open,
      order: channelOrder(channels),
      subscribed,
      subscriptions: board.subscriptions,
      unread,
    }),
    [announce, board.subscriptions, channels, counts, open, subscribed, unread],
  );
}

function useSidebarKeys(props: SidebarKeys): Said {
  const { keymap } = props;
  const [said, setSaid] = useState<Said>({ count: FIRST, text: "" });
  const announce = useCallback((text: string) => {
    setSaid((last) => ({ count: last.count + ONE, text }));
  }, []);
  const keys = useChannelKeys(props, announce);
  useEffect(() => roving(sidebar), []);
  useEffect(() => {
    const unbind = [
      keymap.bind({
        actions: {
          nextChannel: stepTo({ keys, step: "next" }),
          nextUnreadChannel: stepToUnread({ keys, step: "next" }),
          previousChannel: stepTo({ keys, step: "previous" }),
          previousUnreadChannel: stepToUnread({ keys, step: "previous" }),
        },
        scope: "everywhere",
      }),
      keymap.bind({
        actions: {
          nextLink: moveFocus({ step: "next", within: sidebar }),
          previousLink: moveFocus({ step: "previous", within: sidebar }),
        },
        scope: "sidebar",
        within: sidebar,
      }),
      keymap.bind({
        actions: { markChannelRead: markRead(keys), toggleSubscription: toggleSubscription(keys) },
        scope: "channel row",
        within: sidebar,
      }),
    ];
    return (): void => {
      for (const each of unbind) {
        each();
      }
    };
  }, [keymap, keys]);
  return said;
}

export { type Said, useSidebarKeys };
