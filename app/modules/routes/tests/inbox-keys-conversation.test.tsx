import { expect, it } from "vitest";
import { firstRowSelected, focusedHref, focusedTag, pressed, typedHere, unreadSettledAt } from "./inbox-keys.ts";
import { fireEvent } from "@testing-library/react";
import { inConversation } from "./regions.ts";

const NONE = 0;
const ONE = 1;

function replyBox(): HTMLElement {
  return inConversation().getByRole("textbox", { name: "Reply" });
}

function shortcutOf(name: string): string | null {
  return inConversation().getByRole("button", { name }).getAttribute("aria-keyshortcuts");
}

it("r and Enter focus the reply box, where j, e and u are typed, and Esc returns to the selected row keeping the draft", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { address, unmount } = await firstRowSelected({ channel: "web-inbox-keys-reply", section: "Earlier" });
  pressed("r");
  const typing = [focusedTag(), typedHere("j"), typedHere("e"), typedHere("u"), globalThis.location.hash];
  fireEvent.change(replyBox(), { target: { value: "Half a draft" } });
  pressed("Escape");
  const afterEscape = focusedHref();
  pressed("Enter");

  expect([typing, afterEscape, focusedTag(), replyBox()]).toStrictEqual([
    ["TEXTAREA", true, true, true, address],
    address,
    "TEXTAREA",
    expect.objectContaining({ value: "Half a draft" }),
  ]);

  unmount();
});

it("the @ suggestions keep the up and down arrows and Enter while they show", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { address, channel, unmount } = await firstRowSelected({
    channel: "web-inbox-keys-suggest",
    section: "Earlier",
  });
  pressed("r");
  fireEvent.change(replyBox(), { target: { value: `Ping @${channel}-po` } });
  await inConversation().findByRole("listbox", { name: "Mention suggestions" });
  const taken = [typedHere("ArrowDown"), typedHere("ArrowUp"), typedHere("Enter")];

  expect([taken, globalThis.location.hash, replyBox()]).toStrictEqual([
    [false, false, false],
    address,
    expect.objectContaining({ value: `Ping @${channel}-poster ` }),
  ]);

  unmount();
});

it("e reads the selected row at once, and u puts it back", { timeout: 8000 }, async () => {
  expect.hasAssertions();

  const selected = await firstRowSelected({ channel: "web-inbox-keys-read", section: "Activity" });
  const before = await unreadSettledAt({ ...selected, count: ONE });
  pressed("e");
  const afterE = await unreadSettledAt({ ...selected, count: NONE });
  pressed("u");
  const afterU = await unreadSettledAt({ ...selected, count: ONE });

  expect([shortcutOf("Mark conversation read"), shortcutOf("Mark unread"), before, afterE, afterU]).toStrictEqual([
    "e",
    "u",
    ONE,
    NONE,
    ONE,
  ]);

  selected.unmount();
});

it("enter on a focused button is left to the button, not taken to the reply box", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { unmount } = await firstRowSelected({ channel: "web-inbox-keys-enter-button", section: "Earlier" });
  inConversation().getByRole("button", { name: "Mark unread" }).focus();

  expect([typedHere("Enter"), focusedTag()]).toStrictEqual([true, "BUTTON"]);

  unmount();
});
