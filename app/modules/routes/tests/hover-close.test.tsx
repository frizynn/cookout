import { chose, pressed } from "./menus.ts";
import { expect, it, vi } from "vitest";
import { feedOf, idOf, postedIn } from "./feed.ts";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Posted } from "./feed.ts";
import { inPane } from "./regions.ts";
import { openAt } from "./render.tsx";

const TEXTS = ["Before.", "Deploy?", "After."] as const;

async function feedShows(shown: readonly string[]): Promise<void> {
  await vi.waitFor(async () => {
    await expect(feedOf(TEXTS)).resolves.toStrictEqual(shown);
  });
}

async function articleOf(list: string, text: string): Promise<HTMLElement> {
  const found = await within(await screen.findByRole("list", { name: list })).findByText(text);
  const article = found.closest("article");
  if (article === null) {
    throw new TypeError(`${text} is in no message`);
  }
  return article;
}

async function feedArticle(text: string): Promise<HTMLElement> {
  const article = await articleOf("Messages", text);
  return article;
}

interface Pressed {
  readonly shown: string;
  readonly reply: HTMLElement | null;
}

async function pressedCloseThread(text: string): Promise<Pressed> {
  const article = await feedArticle(text);
  const button = within(article).getByRole("button", { name: "Close thread" });
  const shown = button.textContent;
  const reply = within(article).queryByRole("link", { name: "Reply" });
  fireEvent.click(button);
  return { reply, shown };
}

async function closedByOf(posted: Posted): Promise<string | null> {
  const { parent } = await posted.poster.getThread(idOf({ posted, text: "Deploy?" }));
  return parent.closedBy ?? null;
}

it("hovering a top-level message in the channel feed shows Close thread, and pressing it closes the thread", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const posted = await postedIn({ channel: "web-hover-close", closed: [], texts: TEXTS });
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}` });

  const action = await pressedCloseThread("Deploy?");
  await feedShows(["Before.", "<1 closed thread>", "After."]);

  await expect(closedByOf(posted)).resolves.toBe(posted.readerName);
  expect(action).toStrictEqual({ reply: null, shown: "Close" });

  close();
});

it("a closed thread, unfolded, shows Reopen thread on hover, and pressing it reopens the thread", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const posted = await postedIn({ channel: "web-hover-reopen", closed: ["Deploy?"], texts: TEXTS });
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}` });
  fireEvent.click(await inPane().findByRole("button", { name: "1 closed thread" }));

  const article = await feedArticle("Deploy?");
  fireEvent.click(within(article).getByRole("button", { name: "Reopen thread" }));
  await feedShows(["Before.", "Deploy?", "After."]);

  await expect(closedByOf(posted)).resolves.toBeNull();

  close();
});

it("a top-level message's More actions menu holds Reply, which opens its thread's reply box", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const posted = await postedIn({ channel: "web-hover-menu-reply", closed: [], texts: TEXTS });
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}` });

  const article = await feedArticle("Deploy?");
  pressed(() => within(article).getByRole("button", { name: "More actions" }));
  await chose("Reply");
  const box = await within(await screen.findByRole("complementary", { name: "Thread" })).findByLabelText("Reply");

  await waitFor(() => {
    expect([document.activeElement === box, globalThis.location.hash]).toStrictEqual([
      true,
      `#/channels/${posted.channel}/threads/${String(idOf({ posted, text: "Deploy?" }))}`,
    ]);
  });

  close();
});

it("a reply in the thread panel still shows Reply on hover", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const posted = await postedIn({ channel: "web-hover-panel-reply", closed: [], texts: TEXTS });
  const parent = idOf({ posted, text: "Deploy?" });
  await posted.poster.createMessage({ channel: posted.channel, replyTo: parent, text: "Noon works." });
  const close = openAt({ client: posted.reader, hash: `#/channels/${posted.channel}/threads/${String(parent)}` });

  const reply = await articleOf("Replies", "Noon works.");

  expect([
    within(reply).getByRole("button", { name: "Reply" }).tagName,
    within(reply).queryByRole("button", { name: /thread$/u }),
  ]).toStrictEqual(["BUTTON", null]);

  close();
});
