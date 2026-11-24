import type { Subscriptions, SubscriptionsState } from "../../board/index.ts";
import type { Unread, UnreadCounts } from "../../unread/index.ts";
import type { Act } from "../../keymap/index.ts";
import type { ChannelName } from "../../sdk/index.ts";
import { NO_COUNTS } from "../../unread/index.ts";
import type { Step } from "./channel-order.ts";
import { hasUnread } from "./unread-counts.ts";
import { hrefOf } from "../../paths/index.ts";
import { steppedTo } from "./channel-order.ts";

const TEXT = {
  markedRead: (channel: ChannelName) => `#${channel} marked read`,
  noUnread: "No unread channels",
  nothingUnread: (channel: ChannelName) => `Nothing unread in #${channel}`,
  subscribed: (channel: ChannelName) => `Subscribed to #${channel}`,
  unsubscribed: (channel: ChannelName) => `Unsubscribed from #${channel}`,
} as const;

interface ChannelKeys {
  readonly announce: (text: string) => void;
  readonly counts: ReadonlyMap<ChannelName, UnreadCounts>;
  readonly open: ChannelName | null;
  readonly order: readonly ChannelName[];
  readonly subscribed: SubscriptionsState;
  readonly subscriptions: Subscriptions;
  readonly unread: Unread;
}

function unreadIn(keys: ChannelKeys): (channel: ChannelName) => boolean {
  return (channel) => hasUnread(keys.counts.get(channel) ?? NO_COUNTS);
}

function opened(channel: ChannelName): true {
  globalThis.location.hash = hrefOf({ channel, name: "channel" });
  return true;
}

interface Stepping {
  readonly keys: ChannelKeys;
  readonly step: Step;
}

function stepTo({ keys, step }: Stepping): Act {
  return () => {
    const channel = steppedTo({ open: keys.open, order: keys.order, step, wanted: () => true });
    return channel !== null && opened(channel);
  };
}

function stepToUnread({ keys, step }: Stepping): Act {
  return () => {
    const channel = steppedTo({ open: keys.open, order: keys.order, step, wanted: unreadIn(keys) });
    if (channel === null) {
      keys.announce(TEXT.noUnread);
      return true;
    }
    return opened(channel);
  };
}

function rowChannel(keys: ChannelKeys, target: EventTarget | null): ChannelName | null {
  if (!(target instanceof HTMLAnchorElement)) {
    return null;
  }
  const href = target.getAttribute("href");
  return keys.order.find((channel) => hrefOf({ channel, name: "channel" }) === href) ?? null;
}

function markRead(keys: ChannelKeys): Act {
  return ({ target }) => {
    const channel = rowChannel(keys, target);
    if (channel === null) {
      return false;
    }
    if (!unreadIn(keys)(channel)) {
      keys.announce(TEXT.nothingUnread(channel));
      return true;
    }
    keys.unread.markChannelRead(channel);
    keys.announce(TEXT.markedRead(channel));
    return true;
  };
}

function subscriptionSaid(channel: ChannelName, subscribing: boolean): string {
  if (subscribing) {
    return TEXT.subscribed(channel);
  }
  return TEXT.unsubscribed(channel);
}

function toggleSubscription(keys: ChannelKeys): Act {
  return ({ target }) => {
    const channel = rowChannel(keys, target);
    const state = keys.subscribed;
    if (channel === null || state.status !== "loaded" || state.change.status === "changing") {
      return false;
    }
    const subscribing = !state.channels.includes(channel);
    keys.subscriptions.setSubscribed(channel, subscribing, "channel-menu");
    keys.announce(subscriptionSaid(channel, subscribing));
    return true;
  };
}

export { type ChannelKeys, markRead, stepTo, stepToUnread, toggleSubscription };
