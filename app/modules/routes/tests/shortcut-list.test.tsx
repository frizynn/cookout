import { expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { newIdentity } from "./identities.ts";
import { openAt } from "./render.tsx";

const LIST = { name: "Keyboard shortcuts" } as const;
const ONE = 1;

async function openedList(): Promise<HTMLElement> {
  const { client } = await newIdentity({ kind: "human", name: "web-shortcut-list" });
  openAt({ client, hash: "#/people" });
  await screen.findByRole("list", { name: "Identities" });
  fireEvent.keyDown(globalThis.document.body, { key: "?" });
  return screen.findByRole("dialog", LIST);
}

it("the shortcut list is a named dialog whose every group is a list named by its heading", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const dialog = within(await openedList());
  const headings: string[] = [];
  for (const heading of dialog.getAllByRole("heading", { level: 3 })) {
    headings.push(heading.textContent);
  }
  const named = headings.filter((heading) => dialog.queryAllByRole("list", { name: heading }).length === ONE);

  expect({ everywhere: headings.includes("Everywhere"), named }).toStrictEqual({ everywhere: true, named: headings });
});
