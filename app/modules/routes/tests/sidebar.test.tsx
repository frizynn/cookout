import { adminClient, anonymousClient, newIdentity, openAt, sessionOf, sidebar } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CookoutClient } from "../../sdk/index.ts";
import { watched } from "./watched.ts";

interface Reader {
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
}

async function subscribedReader(name: string): Promise<Reader> {
  const poster = await newIdentity({ kind: "agent", name: `${name}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${name}-reader` });
  await adminClient().createChannel({ name });
  await reader.client.subscribe(name);
  return { poster: poster.client, reader: reader.client };
}

function inboxLink(): HTMLElement {
  return within(sidebar()).getByRole("link", { name: /^Inbox/u });
}

it("#/ opens the inbox, highlighted in the sidebar", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: adminClient(), hash: "#/" });

  const heading = await screen.findByRole("heading", { level: 1, name: "Inbox" });

  expect([heading.textContent, inboxLink().getAttribute("aria-current")]).toStrictEqual(["Inbox", "page"]);

  close();
});

it("a fresh login opens the inbox", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { client, token } = await newIdentity({ kind: "human", name: "web-sidebar-fresh" });
  const close = openAt({ client, hash: "", session: sessionOf(anonymousClient()) });
  fireEvent.change(await screen.findByLabelText("Token"), { target: { value: token } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  const heading = await screen.findByRole("heading", { level: 1, name: "Inbox" });

  expect([heading.textContent, within(sidebar()).getByText("web-sidebar-fresh").textContent]).toStrictEqual([
    "Inbox",
    "web-sidebar-fresh",
  ]);

  close();
});

const ONE = 1;
const TWO = 2;

async function postedAndCounted(poster: CookoutClient, text: string, count: number): Promise<boolean> {
  await poster.createMessage({ channel: "web-sidebar-total", text });
  await waitFor(() => {
    expect(inboxLink().textContent).toContain(`${String(count)} unread`);
  });
  return inboxLink().querySelector(".bg-unread") !== null;
}

it("the Inbox link counts every unread item, live, in the unread colour once one is a mention", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { poster, reader } = await subscribedReader("web-sidebar-total");
  const { live, stream } = watched(reader);
  const close = openAt({ client: reader, hash: "#/", live });
  const events = await stream;
  const plainIsLoud = await postedAndCounted(poster, "Plain news", ONE);

  await expect(postedAndCounted(poster, "Over to @web-sidebar-total-reader", TWO)).resolves.toBe(!plainIsLoud);

  close();
  await events.close();
});

it("a channel with unread messages is bold in the sidebar, with its mention count, and the open one is highlighted", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { poster, reader } = await subscribedReader("web-sidebar-bold");
  await adminClient().createChannel({ name: "web-sidebar-quiet" });
  await poster.createMessage({ channel: "web-sidebar-bold", text: "Hi @web-sidebar-bold-reader" });
  const close = openAt({ client: reader, hash: "#/channels/web-sidebar-quiet" });

  const bold = await within(await screen.findByRole("navigation", { name: "Sidebar" })).findByRole("link", {
    name: /^#web-sidebar-bold\s*1 mention$/u,
  });
  const quiet = within(sidebar()).getByRole("link", { name: "#web-sidebar-quiet" });

  expect([
    within(bold).getByText("#web-sidebar-bold").className.includes("font-semibold"),
    within(quiet).getByText("#web-sidebar-quiet").className.includes("font-semibold"),
    quiet.getAttribute("aria-current"),
    bold.getAttribute("aria-current"),
  ]).toStrictEqual([true, false, "page", "false"]);

  close();
});

it("the People & agents link goes to the directory of identities", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: adminClient(), hash: "#/" });
  fireEvent.click(
    await within(await screen.findByRole("navigation", { name: "Sidebar" })).findByRole("link", {
      name: "People & agents",
    }),
  );

  const heading = await screen.findByRole("heading", { level: 1, name: "People & agents" });

  expect([globalThis.location.hash, heading.textContent]).toStrictEqual(["#/people", "People & agents"]);

  close();
});
