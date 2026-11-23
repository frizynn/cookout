import type { ChannelName, InboxItem, MessageId } from "../../sdk/index.ts";

type UnreadWhy = "mentioned-you" | "replied-to-you" | "followed-thread" | "subscribed-channel";

interface UnreadCounts {
  readonly forYou: number;
  readonly activity: number;
}

interface ThreadNews {
  readonly count: number;
  readonly forYou: Extract<UnreadWhy, "mentioned-you" | "replied-to-you"> | null;
}

interface Reading {
  readonly item: InboxItem;
  readonly me: string;
}

interface ReadingAll {
  readonly items: readonly InboxItem[];
  readonly me: string;
}

const ONE_MORE = 1;
const NO_COUNTS: UnreadCounts = { activity: 0, forYou: 0 };
const NO_NEWS: ThreadNews = { count: 0, forYou: null };

function whyOf({ item, me }: Reading): UnreadWhy {
  if (item.reasons.includes("mention")) {
    return "mentioned-you";
  }
  if (item.message.kind === "reply" && item.parent.author.name === me) {
    return "replied-to-you";
  }
  if (item.message.kind === "reply") {
    return "followed-thread";
  }
  return "subscribed-channel";
}

function isForYou(reading: Reading): boolean {
  const why = whyOf(reading);
  return why === "mentioned-you" || why === "replied-to-you";
}

function counted(counts: UnreadCounts, forYou: boolean): UnreadCounts {
  if (forYou) {
    return { ...counts, forYou: counts.forYou + ONE_MORE };
  }
  return { ...counts, activity: counts.activity + ONE_MORE };
}

function countsOf({ items, me }: ReadingAll): UnreadCounts {
  let counts = NO_COUNTS;
  for (const item of items) {
    counts = counted(counts, isForYou({ item, me }));
  }
  return counts;
}

function countsByChannel({ items, me }: ReadingAll): ReadonlyMap<ChannelName, UnreadCounts> {
  const counts = new Map<ChannelName, UnreadCounts>();
  for (const item of items) {
    const { name } = item.channel;
    counts.set(name, counted(counts.get(name) ?? NO_COUNTS, isForYou({ item, me })));
  }
  return counts;
}

function strongest(news: ThreadNews, why: UnreadWhy): ThreadNews["forYou"] {
  if (why === "mentioned-you" || news.forYou === "mentioned-you") {
    return "mentioned-you";
  }
  if (why === "replied-to-you") {
    return why;
  }
  return news.forYou;
}

function newsByThread({ items, me }: ReadingAll): ReadonlyMap<MessageId, ThreadNews> {
  const news = new Map<MessageId, ThreadNews>();
  for (const item of items) {
    if (item.message.kind === "reply") {
      const before = news.get(item.parent.id) ?? NO_NEWS;
      news.set(item.parent.id, { count: before.count + ONE_MORE, forYou: strongest(before, whyOf({ item, me })) });
    }
  }
  return news;
}

export {
  NO_COUNTS,
  type ThreadNews,
  type UnreadCounts,
  type UnreadWhy,
  countsByChannel,
  countsOf,
  isForYou,
  newsByThread,
  whyOf,
};
