import { adminClient, openAt, sidebar } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

function inboxShown(): boolean {
  return within(sidebar()).queryByRole("link", { name: /^Inbox/u }) !== null;
}

async function collapseThenLeave(): Promise<boolean> {
  const close = openAt({ client: adminClient(), hash: "#/" });
  fireEvent.click(await screen.findByRole("button", { name: "Collapse sidebar" }));
  const shown = inboxShown();
  close();
  return shown;
}

it("the sidebar collapses to a rail, stays collapsed after a reload, and expands again", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const shownCollapsed = await collapseThenLeave();
  const close = openAt({ client: adminClient(), hash: "#/" });
  const expand = await screen.findByRole("button", { name: "Expand sidebar" });
  const shownAfterReload = inboxShown();
  fireEvent.click(expand);

  expect([shownCollapsed, shownAfterReload, expand.getAttribute("aria-expanded"), inboxShown()]).toStrictEqual([
    false,
    false,
    "true",
    true,
  ]);

  close();
});
