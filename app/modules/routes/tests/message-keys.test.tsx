import { adminClient, newIdentity, openAt } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, getDefaultNormalizer, screen, within } from "@testing-library/react";

const KEEP_SPACES = { normalizer: getDefaultNormalizer({ trim: false }) };

async function openChannel(channel: string): Promise<() => void> {
  await adminClient().createChannel({ name: channel });
  const close = openAt({ client: adminClient(), hash: `#/channels/${channel}` });
  await screen.findByLabelText("Message");
  return close;
}

function type(text: string): void {
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: text } });
}

function press(key: string, shiftKey = false): boolean {
  return fireEvent.keyDown(screen.getByLabelText("Message"), { key, shiftKey });
}

async function twoToMention(): Promise<void> {
  await newIdentity({ kind: "human", name: "keys-first" });
  await newIdentity({ kind: "agent", name: "keys-second" });
}

async function suggest(text: string): Promise<void> {
  type(text);
  await screen.findByRole("list", { name: "Mention suggestions" });
}

function pressEach(keys: readonly string[]): void {
  for (const key of keys) {
    press(key);
  }
}

async function shownMessages(): Promise<readonly (string | null)[]> {
  const list = await screen.findByRole("list", { name: "Messages" });
  const shown: (string | null)[] = [];
  for (const link of within(list).queryAllByRole("link")) {
    shown.push(link.textContent);
  }
  return shown;
}

function highlighted(): string | null {
  const list = screen.getByRole("list", { name: "Mention suggestions" });
  return within(list).getByRole("button", { current: true }).textContent;
}

it("pressing Enter in the message box sends the message and empties the box", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = await openChannel("web-keys-enter");
  type("Sent with Enter");
  press("Enter");
  await within(screen.getByRole("list", { name: "Messages" })).findByText("Sent with Enter");

  expect([await shownMessages(), screen.queryByDisplayValue("Sent with Enter")]).toStrictEqual([
    ["@adminSent with Enter0 replies"],
    null,
  ]);

  close();
});

it("pressing Shift+Enter sends nothing and leaves the key to start a new line", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = await openChannel("web-keys-shift-enter");
  type("First line");
  const notPrevented = press("Enter", true);

  expect([notPrevented, await shownMessages(), screen.queryByDisplayValue("First line")]).toStrictEqual([
    true,
    [],
    screen.getByLabelText("Message"),
  ]);

  close();
});

it("while suggestions show, the arrows move the highlight and Enter picks it instead of sending", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  await twoToMention();
  const close = await openChannel("web-keys-pick");
  await suggest("Ping @keys-");
  const first = highlighted();
  pressEach(["ArrowDown", "ArrowDown", "ArrowUp"]);
  const moved = highlighted();
  press("Enter");

  expect([
    first,
    moved,
    screen.queryByDisplayValue("Ping @keys-second ", KEEP_SPACES),
    screen.queryByRole("list", { name: "Mention suggestions" }),
    await shownMessages(),
  ]).toStrictEqual(["@keys-first", "@keys-second", screen.getByLabelText("Message"), null, []]);

  close();
});
