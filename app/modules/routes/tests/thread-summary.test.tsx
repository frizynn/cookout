import type { Message, ServerSentEvent } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import type { Live } from "../../live/index.ts";
import { createLive } from "../../live/index.ts";
import { inPane } from "./regions.ts";
import { openWithClockStopped } from "./clock.ts";
import { within } from "@testing-library/react";

interface Scripted {
  readonly live: Live;
  readonly send: (event: ServerSentEvent) => void;
}

interface Summary {
  readonly repliers: readonly (readonly [string | undefined, string | undefined])[];
  readonly text: string;
}

interface Replied {
  readonly ada: Awaited<ReturnType<typeof newIdentity>>;
  readonly parent: Message;
}

const CHANNEL = "web-thread-summary";

function scripted(): Scripted {
  const opened: ((event: ServerSentEvent) => void)[] = [];
  const live = createLive({
    open: (onEvent) => {
      opened.push(onEvent);
    },
  });
  return {
    live,
    send: (event: Readonly<ServerSentEvent>) => {
      for (const onEvent of opened) {
        onEvent(event);
      }
    },
  };
}

function sent(message: Readonly<Message>): ServerSentEvent {
  return { data: JSON.stringify({ message, type: "message" }), event: "message" };
}

async function summaryShown(count: string): Promise<Summary> {
  const link = await inPane().findByRole("link", { name: (name) => name.startsWith(count) });
  const repliers: (readonly [string | undefined, string | undefined])[] = [];
  for (const avatar of within(link).getAllByTestId("replier-avatar")) {
    repliers.push([avatar.dataset["initials"], avatar.dataset["agent"]]);
  }
  return { repliers, text: link.textContent };
}

async function threadRepliedTo(): Promise<Replied> {
  const ada = await newIdentity({ kind: "human", name: "ada-summary" });
  const bot = await newIdentity({ kind: "agent", name: "bot-summary", owner: "admin" });
  await adminClient().createChannel({ name: CHANNEL });
  const { message: parent } = await adminClient().createMessage({ channel: CHANNEL, text: "The parent" });
  await ada.client.createMessage({ channel: CHANNEL, replyTo: parent.id, text: "First" });
  await bot.client.createMessage({ channel: CHANNEL, replyTo: parent.id, text: "Second" });
  return { ada, parent };
}

it("a message with replies shows who replied, how many and when, and the summary changes live as a reply arrives", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { ada, parent } = await threadRepliedTo();
  const { live, send } = scripted();
  const close = openWithClockStopped({ client: adminClient(), hash: `#/channels/${CHANNEL}`, live });

  await expect(summaryShown("2 replies")).resolves.toStrictEqual({
    repliers: [
      ["BS", "true"],
      ["AS", "false"],
    ],
    text: "2 repliesLast reply just nowView thread →",
  });

  const { message: reply } = await ada.client.createMessage({ channel: CHANNEL, replyTo: parent.id, text: "Third" });
  send(sent(reply));

  await expect(summaryShown("3 replies")).resolves.toMatchObject({
    repliers: [
      ["AS", "false"],
      ["BS", "true"],
    ],
  });

  close();
});
