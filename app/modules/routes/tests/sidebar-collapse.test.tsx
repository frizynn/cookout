import { expect, it } from "vitest";
import { adminClient } from "./identities.ts";
import { fireEvent } from "@testing-library/react";
import { inSidebar } from "./regions.ts";
import { openAt } from "./render.tsx";

function inboxShown(): boolean {
  return inSidebar().queryByRole("link", { name: /^Inbox/u }) !== null;
}

async function collapseThenLeave(): Promise<boolean> {
  const close = openAt({ client: adminClient(), hash: "#/" });
  fireEvent.click(await inSidebar().findByRole("button", { name: "Collapse sidebar" }));
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
  const expand = await inSidebar().findByRole("button", { name: "Expand sidebar" });
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
