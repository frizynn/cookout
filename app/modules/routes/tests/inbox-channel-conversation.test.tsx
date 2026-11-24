import type { CookoutClient, EventStream, MessageId } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { inConversation, inPane } from "./regions.ts";
import { openWithClockStopped } from "./clock.ts";
import { subscribedReader } from "./inbox-reader.ts";
import { watched } from "./watched.ts";

const TEXTS = ["Oldest", "Old post", "New one", "New two", "Arrived live", "Mentioning you"] as const;

interface NewsChannel {
  readonly channel: string;
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
}

async function posted(news: NewsChannel, text: string): Promise<MessageId> {
  const { message } = await news.poster.createMessage({ channel: news.channel, text });
  return message.id;
}

async function channelWithNews(channel: string): Promise<NewsChannel & { readonly newest: MessageId }> {
  const { poster, reader } = await subscribedReader(channel);
  const news = { channel, poster, reader };
  await posted(news, "Oldest");
  const { message: old } = await poster.createMessage({ channel, text: "Old post" });
  await reader.ack(old.id);
  await posted(news, "New one");
  return { ...news, newest: await posted(news, "New two") };
}

function shownTexts(): readonly string[] {
  return TEXTS.filter((text) => within(inConversation().element()).queryByText(text) !== null);
}

async function channelRowClicked(channel: string): Promise<void> {
  const activity = await screen.findByRole("list", { name: "Activity" });
  fireEvent.click(within(activity).getByRole("link", { name: new RegExp(`New in #${channel}`, "u") }));
  await inConversation().findByText("New two");
}

async function firstPostsNew(channel: string): Promise<NewsChannel> {
  const { poster, reader } = await subscribedReader(channel);
  const news = { channel, poster, reader };
  await posted(news, "New one");
  await posted(news, "New two");
  return news;
}

async function mentionedElsewhere(channel: string): Promise<NewsChannel> {
  await adminClient().createChannel({ name: channel });
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  const news = { channel, poster: poster.client, reader: reader.client };
  await posted(news, "Old post");
  await posted(news, `Mentioning you, @${channel}-reader`);
  return news;
}

async function openLive(news: NewsChannel): Promise<() => Promise<void>> {
  const { live, stream } = watched(news.reader);
  const unmount = openWithClockStopped({ client: news.reader, hash: `#/inbox/${news.channel}`, live });
  const events: EventStream = await stream;
  await inConversation().findByText("Old post");
  return async () => {
    unmount();
    await events.close();
  };
}

it("selecting a channel row shows its new posts and the one message before them", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const news = await channelWithNews("web-channel-conversation");
  const unmount = openWithClockStopped({ client: news.reader, hash: "#/inbox" });
  await channelRowClicked(news.channel);
  await inConversation().findByText("Old post");

  expect([globalThis.location.hash, shownTexts()]).toStrictEqual([
    `#/inbox/${news.channel}`,
    ["Old post", "New one", "New two"],
  ]);

  unmount();
});

it("a channel whose first message is new shows no message before it", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { channel, reader } = await firstPostsNew("web-channel-conversation-first");
  const unmount = openWithClockStopped({ client: reader, hash: `#/inbox/${channel}` });
  await inConversation().findByText("New two");

  expect([shownTexts(), within(inConversation().element()).queryAllByRole("progressbar")]).toStrictEqual([
    ["New one", "New two"],
    [],
  ]);

  unmount();
});

it("a post arriving live joins the open channel conversation and its row", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const news = await channelWithNews("web-channel-conversation-live");
  const close = await openLive(news);
  await posted(news, "Arrived live");
  await inConversation().findByText("Arrived live");
  const row = await inPane().findByRole("link", { name: /Arrived live/u });

  expect([shownTexts(), row.getAttribute("href")]).toStrictEqual([
    ["Old post", "New one", "New two", "Arrived live"],
    `#/inbox/${news.channel}`,
  ]);

  await close();
});

it("a mention in a channel the reader doesn't subscribe to gets a row, and its conversation shows it after the message before", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { channel, reader } = await mentionedElsewhere("web-channel-conversation-mention");
  const unmount = openWithClockStopped({ client: reader, hash: "#/inbox" });
  const forYou = await screen.findByRole("list", { name: "For you" });
  fireEvent.click(within(forYou).getByRole("link", { name: /^Mentioned you/u }));
  await inConversation().findByText("Old post");

  expect([globalThis.location.hash, shownTexts()]).toStrictEqual([`#/inbox/${channel}`, ["Old post"]]);
  expect(within(inConversation().element()).getByText(/Mentioning you/u).textContent).toMatch(/^Mentioning you/u);

  unmount();
});

it("open in the channel goes to the channel", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const news = await channelWithNews("web-channel-conversation-open");
  const unmount = openWithClockStopped({ client: news.reader, hash: `#/inbox/${news.channel}` });
  fireEvent.click(await inConversation().findByRole("link", { name: `Open in #${news.channel}` }));
  await waitFor(() => {
    expect(globalThis.location.hash).toBe(`#/channels/${news.channel}`);
  });

  unmount();
});

it("a deleted channel's address says there is nothing there, beside the list", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const news = await channelWithNews("web-channel-conversation-deleted");
  await adminClient().deleteChannel(news.channel);
  const unmount = openWithClockStopped({ client: news.reader, hash: `#/inbox/${news.channel}` });
  const nothing = await inConversation().findByText("Nothing here");
  const empty = await inPane().findByText("You're all caught up.");

  expect([nothing.textContent, empty.textContent]).toStrictEqual(["Nothing here", "You're all caught up."]);

  unmount();
});

it("a read channel row selected from Earlier shows every read post it holds", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const news = await channelWithNews("web-channel-conversation-earlier");
  await news.reader.ack(news.newest);
  const unmount = openWithClockStopped({ client: news.reader, hash: "#/inbox" });
  const earlier = await screen.findByRole("list", { name: "Earlier" });
  fireEvent.click(within(earlier).getByRole("link", { name: /New two/u }));
  await inConversation().findByText("Oldest");

  expect(shownTexts()).toStrictEqual(["Oldest", "Old post", "New one", "New two"]);

  unmount();
});
