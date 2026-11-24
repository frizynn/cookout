import type { MenuChoice, ThreadChoice } from "../../design-system/index.tsx";
import { expect, it } from "vitest";

function chosen(): void {
  expect.fail("never chosen");
}

it("a menu item without an icon fails the type check, so every menu draws one", { timeout: 1000 }, () => {
  expect.hasAssertions();

  // @ts-expect-error A menu item must name its icon.
  const choice: MenuChoice = { href: null, label: "Reply", onSelect: chosen };
  // @ts-expect-error A thread choice must name its icon.
  const thread: ThreadChoice = { label: "Close", name: "Close thread", onSelect: chosen };

  expect([choice.label, thread.label]).toStrictEqual(["Reply", "Close"]);
});
