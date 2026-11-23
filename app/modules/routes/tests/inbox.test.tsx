import type { CookoutClient, EventStream, Message } from "../../sdk/index.ts";
import { adminClient, anonymousClient, sessionOf } from "./identities.ts";
import { expect, it, onTestFinished, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { rowsOf, subscribedReader } from "./inbox-reader.ts";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

const FIVE_MINUTES = 300_000;
const TWO_HOURS = 7_200_000;
const THREE_DAYS = 259_200_000;

interface Posted {
  readonly reader: CookoutClient;
  readonly first: Message;
  readonly parent: Message;
  readonly reply: Message;
  readonly other: Message;
}

interface OpenInbox {
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
  readonly close: () => Promise<void>;
}

async function postedIn(channel: string, also: string): Promise<Posted> {
  const { poster, reader } = await subscribedReader(channel, also);
  const { message: first } = await poster.createMessage({ channel: also, text: "Lunch?" });
  const { message: parent } = await reader.createMessage({
    channel,
    text: "Deploy at noon? The rollout notes are in the usual place and every dashboard is green.",
  });
  const { message: reply } = await poster.createMessage({
    channel,
    replyTo: parent.id,
    text: `@${channel}-reader noon`,
  });
  const { message: other } = await poster.createMessage({ channel, text: `Or at one, @${channel}-poster?` });
  return { first, other, parent, reader, reply };
}

function clockAt(moment: string): void {
  vi.useFakeTimers({ now: 0, toFake: ["Date"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  vi.setSystemTime(moment);
}

async function openWatched(channel: string): Promise<OpenInbox> {
  const { poster, reader } = await subscribedReader(channel);
  const { live, stream } = watched(reader);
  const unmount = openAt({ client: reader, hash: "#/inbox", live });
  await screen.findByText("You're all caught up.");
  await stream;
  return {
    close: async () => {
      unmount();
      const events: EventStream = await stream;
      await events.close();
    },
    poster,
    reader,
  };
}

async function openAndComeBack(href: string): Promise<void> {
  globalThis.location.hash = href;
  await screen.findByRole("list", { name: "Messages" });
  globalThis.location.hash = "#/inbox";
  await screen.findByRole("list", { name: "Earlier" });
}

async function timeShown(reader: CookoutClient, later: number): Promise<string> {
  vi.advanceTimersByTime(later);
  const unmount = openAt({ client: reader, hash: "#/inbox" });
  const row = await within(await screen.findByRole("list", { name: "Activity" })).findByRole("link");
  const shown = within(row).getByText(/ ago$/u).textContent;
  unmount();
  return shown;
}

it("the inbox lists unread items for you, then activity, newest first, each with why, who posted it where and its thread", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-inbox";
  const also = `${channel}-also`;
  const { first, other, parent, reader, reply } = await postedIn(channel, also);
  const unmount = openAt({ client: reader, hash: "#/inbox" });

  await screen.findByRole("list", { name: "Activity" });

  await waitFor(() => {
    expect([rowsOf("For you"), rowsOf("Activity")]).toStrictEqual([
      [
        `#/channels/${channel}/threads/${String(parent.id)} Mentioned you${channel}-posterreplied in a thread in#${channel}just nowre: Deploy at noon? The rollout notes are in the usual place and every da…${reply.text}`,
      ],
      [
        `#/channels/${channel} New in #${channel}${channel}-posterposted in#${channel}just now${other.text}`,
        `#/channels/${also} New in #${also}${channel}-posterposted in#${also}just now${first.text}`,
      ],
    ]);
  });

  unmount();
});

it("a live mention appears under For you, and opening it moves it to Earlier", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-inbox-live";
  const { close, poster } = await openWatched(channel);
  const { message } = await poster.createMessage({ channel, text: `@${channel}-reader look` });

  const row = await within(await screen.findByRole("list", { name: "For you" })).findByRole("link");

  expect(row.textContent).toContain("Mentioned you");

  await openAndComeBack(String(row.getAttribute("href")));

  expect([rowsOf("Earlier"), screen.getByText("You're all caught up.").tagName]).toStrictEqual([
    [`#/channels/${channel} Mentioned you${channel}-posterposted in#${channel}just now${message.text}`],
    "P",
  ]);

  await close();
});

it("each item's time is how long ago it was posted, in minutes, hours or days", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-inbox-times";
  const { poster, reader } = await subscribedReader(channel);
  const { message } = await poster.createMessage({ channel, text: "Deploy at noon?" });
  clockAt(message.createdAt);
  const minutes = await timeShown(reader, FIVE_MINUTES);
  const hours = await timeShown(reader, TWO_HOURS);
  const days = await timeShown(reader, THREE_DAYS);

  expect([minutes, hours, days]).toStrictEqual(["5m ago", "2h ago", "3d ago"]);
});

it("clicking a reply's row opens its thread", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-inbox-open";
  const { parent, reader } = await postedIn(channel, `${channel}-also`);
  const unmount = openAt({ client: reader, hash: "#/inbox" });
  const unread = await screen.findByRole("list", { name: "For you" });

  fireEvent.click(within(unread).getByRole("link", { name: /replied in a thread/u }));

  await waitFor(() => {
    expect(globalThis.location.hash).toBe(`#/channels/${channel}/threads/${String(parent.id)}`);
  });

  unmount();
});

it("an inbox that can't be read says why", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const unmount = openAt({ client: anonymousClient(), hash: "#/inbox", session: sessionOf(adminClient()) });

  await screen.findByRole("navigation", { name: "Sidebar" });
  const alert = await within(screen.getByRole("main")).findByRole("alert");

  expect(alert.textContent).toMatch(/^Couldn't load the inbox \(\w+\): /u);

  unmount();
});
