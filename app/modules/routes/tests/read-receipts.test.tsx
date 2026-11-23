import type { CookoutClient, Message, ServerSentEvent } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { messagesIn, parentShown } from "./messages.ts";
import { screen, waitFor, within } from "@testing-library/react";
import type { Live } from "../../live/index.ts";
import { createLive } from "../../live/index.ts";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

type Link = ReturnType<Live["link"]>;

interface Scripted {
  readonly live: Live;
  readonly send: (event: ServerSentEvent) => void;
  readonly report: (link: Link) => void;
}

interface Asked {
  readonly bob: CookoutClient;
  readonly asked: Message;
}

interface Talk {
  readonly ann: CookoutClient;
  readonly bob: CookoutClient;
  readonly viewer: CookoutClient;
}

function scripted(): Scripted {
  const events: ((event: ServerSentEvent) => void)[] = [];
  const links: ((link: Link) => void)[] = [];
  const live = createLive({
    open: (onEvent, onLink) => {
      events.push(onEvent);
      links.push(onLink);
    },
  });
  return {
    live,
    report: (link) => {
      for (const onLink of links) {
        onLink(link);
      }
    },
    send: (event) => {
      for (const onEvent of events) {
        onEvent(event);
      }
    },
  };
}

async function person(channel: string, who: string): Promise<CookoutClient> {
  const { client } = await newIdentity({ kind: "human", name: `${channel}-${who}` });
  return client;
}

async function talkIn(channel: string): Promise<Talk> {
  const ann = await person(channel, "ann");
  const bob = await person(channel, "bob");
  const viewer = await person(channel, "viewer");
  await adminClient().createChannel({ name: channel });
  return { ann, bob, viewer };
}

async function post(client: CookoutClient, channel: string, text: string): Promise<Message> {
  const { message } = await client.createMessage({ channel, text });
  return message;
}

async function receiptsShown(label: string, expected: readonly string[]): Promise<void> {
  await waitFor(async () => {
    await expect(messagesIn(label)).resolves.toStrictEqual(expected);
  });
}

async function watchedChannel(channel: string): Promise<Asked> {
  const { ann, bob, viewer } = await talkIn(channel);
  const earlier = await post(ann, channel, `@${channel}-bob earlier`);
  await bob.ack(earlier.id);
  const asked = await post(ann, channel, `@${channel}-bob look`);
  const { live, stream } = watched(viewer);
  openAt({ client: viewer, hash: `#/channels/${channel}`, live });
  await stream;
  return { asked, bob };
}

async function scriptedThread(channel: string): Promise<Scripted & { readonly reply: Message }> {
  const { ann, bob, viewer } = await talkIn(channel);
  const parent = await post(ann, channel, "Deploy?");
  const { message: reply } = await bob.createMessage({ channel, replyTo: parent.id, text: "Noon" });
  const opened = scripted();
  openAt({ client: viewer, hash: `#/channels/${channel}/threads/${String(parent.id)}`, live: opened.live });
  return { ...opened, reply };
}

async function scriptedChannel(channel: string): Promise<Asked & Scripted> {
  const { ann, bob, viewer } = await talkIn(channel);
  const asked = await post(ann, channel, `@${channel}-bob look`);
  const opened = scripted();
  openAt({ client: viewer, hash: `#/channels/${channel}`, live: opened.live });
  return { ...opened, asked, bob };
}

function backfilled(identity: string, reply: Message): ServerSentEvent {
  return {
    data: JSON.stringify({ receipt: { identity, messageId: reply.id, seen: true }, type: "read-receipt" }),
    event: "read-receipt",
  };
}

function hrefsOf(name: string): readonly (string | null)[] {
  const hrefs: (string | null)[] = [];
  for (const link of within(screen.getByRole("list", { name: "Messages" })).getAllByRole("link", {
    name: `@${name}`,
  })) {
    hrefs.push(link.getAttribute("href"));
  }
  return hrefs;
}

it("a message mentioning @bob shows that bob hasn't seen it, and a read-receipt event shows that bob has, with no reload", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-receipts-live";
  const { asked, bob } = await watchedChannel(channel);

  await receiptsShown("Messages", [
    `${channel}-ann@${channel}-bob earlierSeen by @${channel}-bob just now`,
    `@${channel}-bob lookNot seen yet: @${channel}-bob`,
  ]);

  await bob.ack(asked.id);

  await receiptsShown("Messages", [
    `${channel}-ann@${channel}-bob earlierSeen by @${channel}-bob just now`,
    `@${channel}-bob lookSeen by @${channel}-bob just now`,
  ]);

  expect(hrefsOf(`${channel}-bob`)).toStrictEqual(
    Array.from({ length: 4 }, () => `#/channels/${channel}?profile=${channel}-bob`),
  );
});

it("a reply shows its parent author's receipt, a message that mentions nobody shows none, and a backfilled receipt shows no time", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-receipts-thread";
  const { reply, send } = await scriptedThread(channel);

  await receiptsShown("Replies", [`${channel}-bobNoonNot seen yet: @${channel}-ann`]);

  send(backfilled(`${channel}-ann`, reply));

  await receiptsShown("Replies", [`${channel}-bobNoonSeen by @${channel}-ann`]);

  await expect(parentShown()).resolves.toBe(`${channel}-annDeploy?`);
});

it("receipts seen while the live link was down show once it is back", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-receipts-back";
  const { asked, bob, report } = await scriptedChannel(channel);
  await receiptsShown("Messages", [`${channel}-ann@${channel}-bob lookNot seen yet: @${channel}-bob`]);

  report("down");
  await bob.ack(asked.id);
  report("up");

  await receiptsShown("Messages", [`${channel}-ann@${channel}-bob lookSeen by @${channel}-bob just now`]);
});
