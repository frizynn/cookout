import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { idOf, postedIn } from "./feed.ts";
import { inPane, inThread } from "./regions.ts";
import { openAt } from "./render.tsx";

const TEXTS = ["Before.", "Deploy?", "After."] as const;

interface Shown {
  readonly tooltip: string | null;
  readonly named: boolean;
  readonly text: string;
  readonly drawn: string;
}

function drawnOf(control: () => HTMLElement): string {
  if (control().querySelector('svg[aria-hidden="true"]') !== null) {
    return "icon";
  }
  return control().dataset["symbol"] ?? "nothing";
}

function namedAs(bar: () => HTMLElement, name: string): readonly HTMLElement[] {
  return [...within(bar()).queryAllByRole("button", { name }), ...within(bar()).queryAllByRole("link", { name })];
}

function hoverBarOf(article: () => HTMLElement): readonly Shown[] {
  const bar = within(article()).getByRole("group", { name: "Quick actions" });
  const shown: Shown[] = [];
  for (const control of bar.querySelectorAll<HTMLElement>("a, button")) {
    const tooltip = control.getAttribute("title");
    shown.push({
      drawn: drawnOf(() => control),
      named: namedAs(() => bar, tooltip ?? "").includes(control),
      text: control.textContent,
      tooltip,
    });
  }
  return shown;
}

function iconNamed(name: string): Shown {
  return { drawn: "icon", named: true, text: "", tooltip: name };
}

const THUMBS_UP: Shown = { drawn: "👍", named: true, text: "", tooltip: "React with 👍" };

async function articleIn(list: string, text: string): Promise<HTMLElement> {
  const found = await within(await screen.findByRole("list", { name: list })).findByText(text);
  const article = found.closest("article");
  if (article === null) {
    throw new TypeError(`${text} is in no message`);
  }
  return article;
}

it("a channel message's hover bar holds 👍, Reply, Close thread and More actions, each an icon with a tooltip", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const posted = await postedIn({ channel: "web-hover-bar", closed: [], texts: TEXTS });
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}` });

  const article = await articleIn("Messages", "Deploy?");

  expect(hoverBarOf(() => article)).toStrictEqual([
    THUMBS_UP,
    iconNamed("Reply"),
    iconNamed("Close thread"),
    iconNamed("More actions"),
  ]);

  close();
});

it("a closed thread's hover bar holds Reopen thread as an icon", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const posted = await postedIn({ channel: "web-hover-bar-closed", closed: ["Deploy?"], texts: TEXTS });
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}` });
  fireEvent.click(await inPane().findByRole("button", { name: "1 closed thread" }));

  const article = await articleIn("Messages", "Deploy?");

  expect(hoverBarOf(() => article)).toStrictEqual([
    THUMBS_UP,
    iconNamed("Reply"),
    iconNamed("Reopen thread"),
    iconNamed("More actions"),
  ]);

  close();
});

it("in a thread panel, neither the parent's hover bar nor a reply's holds Reply", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const posted = await postedIn({ channel: "web-hover-bar-panel", closed: [], texts: TEXTS });
  const parent = idOf({ posted, text: "Deploy?" });
  await posted.poster.createMessage({ channel: posted.channel, replyTo: parent, text: "Noon works." });
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}/threads/${String(parent)}` });
  const reply = await articleIn("Replies", "Noon works.");
  const shownParent = await inThread().findByRole("article", { name: "Parent message" });

  expect([hoverBarOf(() => shownParent), hoverBarOf(() => reply)]).toStrictEqual([
    [THUMBS_UP, iconNamed("More actions")],
    [THUMBS_UP, iconNamed("More actions")],
  ]);

  close();
});

it("pressing a channel message's hover Reply opens its thread with the cursor in the reply box", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const posted = await postedIn({ channel: "web-hover-bar-reply", closed: [], texts: TEXTS });
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}` });
  const article = await articleIn("Messages", "Deploy?");
  fireEvent.click(within(article).getByRole("link", { name: "Reply" }));
  const box = await within(await screen.findByRole("complementary", { name: "Thread" })).findByLabelText("Reply");

  await waitFor(() => {
    expect([document.activeElement === box, globalThis.location.hash]).toStrictEqual([
      true,
      `#/channels/${posted.channel}/threads/${String(idOf({ posted, text: "Deploy?" }))}`,
    ]);
  });

  close();
});
