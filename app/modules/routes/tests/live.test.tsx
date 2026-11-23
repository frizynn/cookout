import type { CookoutClient, EventStream, Message } from "../../sdk/index.ts";
import { adminClient, newIdentity, openAt } from "./app.tsx";
import { createLive, watchAdapter } from "../../live/index.ts";
import { expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { Live } from "../../live/index.ts";

interface Watched {
  readonly live: Live;
  readonly stream: Promise<EventStream>;
}

interface LiveView {
  readonly parent: Message;
  readonly poster: CookoutClient;
  readonly close: () => Promise<void>;
}

function watched(client: CookoutClient): Watched {
  const { promise, resolve } = Promise.withResolvers<EventStream>();
  const live = createLive(
    watchAdapter({
      watch: async (options) => {
        const stream = await client.watch(options);
        resolve(stream);
        return stream;
      },
    }),
  );
  return { live, stream: promise };
}

async function shownIn(name: string): Promise<readonly (string | null)[]> {
  const list = await screen.findByRole("list", { name });
  const shown: (string | null)[] = [];
  for (const item of within(list).getAllByRole("listitem")) {
    shown.push(item.textContent);
  }
  return shown;
}

async function closeBoth(unmount: () => void, stream: Promise<EventStream>): Promise<void> {
  unmount();
  const events = await stream;
  await events.close();
}

async function openLive(name: string, at: (parent: Message) => string): Promise<LiveView> {
  const poster = await newIdentity({ kind: "agent", name: `${name}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${name}-reader` });
  await adminClient().createChannel({ name });
  const { message: parent } = await poster.client.createMessage({ channel: name, text: "Deploy at noon?" });
  const { live, stream } = watched(reader.client);
  const unmount = openAt({ client: reader.client, hash: at(parent), live });
  await screen.findByText("Deploy at noon?");
  await stream;
  return {
    close: async () => {
      await closeBoth(unmount, stream);
    },
    parent,
    poster: poster.client,
  };
}

it("a message posted by another identity appears in the open channel without a reload", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { close, parent, poster } = await openLive("web-live-channel", (message) => `#/channels/${message.channel}`);

  await poster.createMessage({ channel: parent.channel, text: "Or at one?" });
  await poster.createMessage({ channel: parent.channel, replyTo: parent.id, text: "Noon works" });
  await screen.findByText("1 reply");

  await expect(shownIn("Messages")).resolves.toStrictEqual([
    "@web-live-channel-posterDeploy at noon?1 reply",
    "@web-live-channel-posterOr at one?0 replies",
  ]);

  await close();
});

it("a reply posted by another identity appears in the open thread without a reload", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { close, parent, poster } = await openLive(
    "web-live-thread",
    (message) => `#/channels/${message.channel}/threads/${String(message.id)}`,
  );

  await poster.createMessage({ channel: parent.channel, text: "Not in this thread" });
  await poster.createMessage({ channel: parent.channel, replyTo: parent.id, text: "Noon works" });
  await screen.findByText("Noon works");

  expect([await shownIn("Replies"), screen.queryByText("Not in this thread")]).toStrictEqual([
    ["@web-live-thread-posterNoon works"],
    null,
  ]);

  await close();
});
