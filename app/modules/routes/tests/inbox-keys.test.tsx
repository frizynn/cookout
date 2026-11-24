import { INBOX, focusedHref, narrowWindow, pressed, rowAddresses, threadsWithReplies } from "./inbox-keys.ts";
import { expect, it } from "vitest";
import { inConversation, inThread } from "./regions.ts";
import { openWithClockStopped } from "./clock.ts";
import { screen } from "@testing-library/react";
import { subscribedReader } from "./inbox-reader.ts";

const NONE = 0;
const THREE = 3;
const TWO = 2;
const ONE = 1;

it("j and k (or the down and up arrows) step through the rows, from the first with nothing selected, stopping at the ends", {
  timeout: 8000,
}, async () => {
  expect.hasAssertions();

  const { reader } = await threadsWithReplies({ channel: "web-inbox-keys-steps", read: THREE, unread: NONE });
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  const [first = "", second = "", third = ""] = await rowAddresses({ count: THREE, label: "Earlier" });
  const lettered = [pressed("k"), pressed("j"), focusedHref(), pressed("j"), pressed("k")];
  const arrowed = [pressed("ArrowDown"), pressed("ArrowDown"), pressed("ArrowDown"), pressed("ArrowUp")];
  const ends = [pressed("j"), pressed("j"), pressed("k"), pressed("k"), pressed("k")];

  expect([lettered, arrowed, ends]).toStrictEqual([
    [INBOX, first, first, second, first],
    [second, third, third, second],
    [third, third, second, first, first],
  ]);

  unmount();
});

it("j moves from the last Activity row to the first Earlier row", { timeout: 8000 }, async () => {
  expect.hasAssertions();

  const { reader } = await threadsWithReplies({ channel: "web-inbox-keys-sections", read: TWO, unread: ONE });
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  const [activity = ""] = await rowAddresses({ count: ONE, label: "Activity" });
  const [earlier = ""] = await rowAddresses({ count: TWO, label: "Earlier" });

  expect([pressed("j"), pressed("j"), focusedHref()]).toStrictEqual([activity, earlier, earlier]);

  unmount();
});

it("o opens the selected row's thread", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { channel, parents, reader } = await threadsWithReplies({
    channel: "web-inbox-keys-open",
    read: ONE,
    unread: NONE,
  });
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  await rowAddresses({ count: ONE, label: "Earlier" });
  pressed("j");
  const open = await inConversation().findByRole("link", { name: "Open thread" });
  pressed("o");
  await inThread().findByText("Reply 0");

  expect([open.getAttribute("aria-keyshortcuts"), [globalThis.location.hash]]).toStrictEqual([
    "o",
    parents.map((parent) => `#/channels/${channel}/threads/${String(parent.id)}`),
  ]);

  unmount();
});

it("keys held with Ctrl or Meta do nothing", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { reader } = await threadsWithReplies({ channel: "web-inbox-keys-held", read: ONE, unread: NONE });
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  await rowAddresses({ count: ONE, label: "Earlier" });

  expect([pressed({ ctrlKey: true, key: "j" }), pressed({ key: "ArrowDown", metaKey: true })]).toStrictEqual([
    INBOX,
    INBOX,
  ]);

  unmount();
});

it("keys outside the map, and j with no rows, do nothing", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { reader } = await subscribedReader("web-inbox-keys-empty");
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  await screen.findByText("Nothing read yet.");

  expect([pressed("x"), pressed("j")]).toStrictEqual([INBOX, INBOX]);

  unmount();
});

it("esc goes back to the list from a conversation on a narrow window, and does nothing on a wide one", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { reader } = await threadsWithReplies({ channel: "web-inbox-keys-escape", read: ONE, unread: NONE });
  const unmount = openWithClockStopped({ client: reader, hash: INBOX });
  const [address = ""] = await rowAddresses({ count: ONE, label: "Earlier" });
  pressed("j");
  await inConversation().findByText("Thread 0");
  const wide = pressed("Escape");
  narrowWindow();

  expect([wide, pressed("Escape")]).toStrictEqual([address, INBOX]);

  unmount();
});
