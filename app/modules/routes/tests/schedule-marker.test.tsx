import type { Message, ScheduledMessage, ServerSentEvent } from "../../sdk/index.ts";
import { channelMade, linesOf, listDialog, rowOf } from "./schedule-lists.ts";
import { expect, it } from "vitest";
import type { Live } from "../../live/index.ts";
import { adminClient } from "./identities.ts";
import { createLive } from "../../live/index.ts";
import { fireEvent } from "@testing-library/react";
import { inPane } from "./regions.ts";
import { openAt } from "./render.tsx";

interface Scripted {
  readonly live: Live;
  readonly send: (type: string, data: object) => void;
}

function scripted(): Scripted {
  const opened: ((event: ServerSentEvent) => void)[] = [];
  const live = createLive({
    open: (onEvent) => {
      opened.push(onEvent);
    },
  });
  return {
    live,
    send: (type, data) => {
      for (const onEvent of opened) {
        onEvent({ data: JSON.stringify({ ...data, type }), event: type });
      }
    },
  };
}

interface Page {
  readonly close: () => void;
  readonly send: Scripted["send"];
}

function pageOpened(schedule: ScheduledMessage): Page {
  const { live, send } = scripted();
  const close = openAt({ client: adminClient(), hash: `#/channels/${schedule.channel}`, live });
  return { close, send };
}

async function markerBoard(channel: string): Promise<ScheduledMessage> {
  await channelMade(channel);
  await adminClient().createMessage({ channel, text: "Before lunch" });
  const { scheduledMessage } = await adminClient().createScheduledMessage({
    at: "2099-06-01T09:30",
    channel,
    text: "Lunch",
    timeZone: "UTC",
  });
  return scheduledMessage;
}

async function postedBy(schedule: ScheduledMessage): Promise<Message> {
  await inPane().findByText("Before lunch");
  const { message } = await adminClient().createMessage({ channel: schedule.channel, text: schedule.text });
  return { ...message, scheduledMessage: { deleted: false, id: schedule.id } };
}

async function markerOpened(posted: Message): Promise<readonly unknown[]> {
  const marker = await inPane().findByRole("button", { name: "Scheduled" });
  fireEvent.click(marker);
  const row = await rowOf(posted.text);
  const opened = [row.getAttribute("aria-current"), await linesOf(posted.text)];
  fireEvent.keyDown(listDialog(), { key: "Escape" });
  return opened;
}

it("a scheduled post's Scheduled marker opens its schedule in the list, and deleting it elsewhere marks the post Schedule deleted", {
  timeout: 10_000,
}, async () => {
  expect.hasAssertions();

  const schedule = await markerBoard("web-schedule-list-marker");
  const { close, send } = pageOpened(schedule);
  const posted = await postedBy(schedule);
  send("message", { message: posted });
  const opened = await markerOpened(posted);
  send("scheduled-message", { deleted: true, scheduledMessage: schedule });
  const said = await inPane().findByText("Schedule deleted");

  expect([...opened, said.closest("button"), inPane().queryByRole("button", { name: "Scheduled" })]).toStrictEqual([
    "true",
    ["Lunch", "Once, at Mon, 1 Jun 2099, 09:30", "Next run Mon, 1 Jun 2099, 09:30 · UTC", "Created by @admin"],
    null,
    null,
  ]);

  close();
});
