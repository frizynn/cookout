import { expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { CookoutClient } from "../../sdk/index.ts";
import { adminClient } from "./identities.ts";
import { createCookoutClient } from "../../sdk/index.ts";
import { inSidebar } from "./regions.ts";
import { openAt } from "./render.tsx";

interface NewChannel {
  readonly name: string;
  readonly description?: string;
}

async function openForm(): Promise<HTMLElement> {
  fireEvent.click(await inSidebar().findByRole("button", { name: "New channel" }));
  const form = await inSidebar().findByRole("form", { name: "New channel" });
  return form;
}

function fieldNamed(name: string): HTMLInputElement {
  const field = inSidebar().getByRole("textbox", { name });
  if (!(field instanceof HTMLInputElement)) {
    throw new TypeError(`${name} isn't an input.`);
  }
  return field;
}

async function submitNew(channel: NewChannel): Promise<void> {
  await openForm();
  fireEvent.change(fieldNamed("Name"), { target: { value: channel.name } });
  fireEvent.change(fieldNamed("Description"), { target: { value: channel.description ?? "" } });
  fireEvent.click(inSidebar().getByRole("button", { name: "Create" }));
}

async function openWithChannel(client: CookoutClient, name: string): Promise<() => void> {
  await client.createChannel({ name });
  const close = openAt({ client, hash: "#/" });
  await inSidebar().findByRole("link", { name: `#${name}` });
  return close;
}

const REFUSED = /^Couldn't create the channel/u;
const TOO_LONG = 501;

function refusedOn(name: string): boolean {
  return screen.queryByRole("textbox", { description: REFUSED, name }) !== null;
}

it("creating a channel from the sidebar adds it to the channel list and opens it", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const client = adminClient();
  const close = await openWithChannel(client, "web-create-earlier");

  await submitNew({ description: "Made in the web.", name: "web-create-made" });
  const heading = await screen.findByRole("heading", { level: 1, name: "#web-create-made" });
  const link = inSidebar().getByRole("link", { name: "#web-create-made" });
  const { channel } = await client.getChannel("web-create-made");

  expect([
    heading.textContent,
    link.getAttribute("href"),
    inSidebar().getByRole("link", { name: "#web-create-earlier" }).textContent,
    globalThis.location.hash,
    channel.description,
    inSidebar().queryByRole("form", { name: "New channel" }),
  ]).toStrictEqual([
    "#web-create-made",
    "#/channels/web-create-made",
    "#web-create-earlier",
    "#/channels/web-create-made",
    "Made in the web.",
    null,
  ]);

  close();
});

it("a taken channel name is refused beside the name field, keeping what was typed", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const client = adminClient();
  await client.createChannel({ name: "web-create-taken" });
  const close = openAt({ client, hash: "#/" });

  await submitNew({ description: "A second try.", name: "web-create-taken" });
  const note = await inSidebar().findByText(/channel_exists/u);

  expect([
    note.textContent,
    refusedOn("Name"),
    fieldNamed("Name").value,
    fieldNamed("Description").value,
  ]).toStrictEqual([
    "Couldn't create the channel (channel_exists): The channel web-create-taken already exists.",
    true,
    "web-create-taken",
    "A second try.",
  ]);

  close();
});

it("a channel name that breaks the name rules is refused beside the name field", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: adminClient(), hash: "#/" });

  await submitNew({ name: "Not A Name" });
  await inSidebar().findByText(/invalid_request/u);

  expect([refusedOn("Name"), refusedOn("Description"), fieldNamed("Name").value]).toStrictEqual([
    true,
    false,
    "Not A Name",
  ]);

  close();
});

it("a description that's too long is refused beside the description field", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: adminClient(), hash: "#/" });

  await submitNew({ description: "x".repeat(TOO_LONG), name: "web-create-long" });
  await inSidebar().findByText(/invalid_request/u);

  expect([refusedOn("Description"), refusedOn("Name")]).toStrictEqual([true, false]);

  close();
});

it("cancelling the new channel form closes it without creating anything", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const client = adminClient();
  const close = openAt({ client, hash: "#/" });

  await openForm();
  fireEvent.change(fieldNamed("Name"), { target: { value: "web-create-cancelled" } });
  fireEvent.click(inSidebar().getByRole("button", { name: "Cancel" }));
  const { channels } = await client.listChannels();

  expect([
    inSidebar().queryByRole("form", { name: "New channel" }),
    channels.some((channel) => channel.name === "web-create-cancelled"),
  ]).toStrictEqual([null, false]);

  close();
});

it("a server that can't be reached is refused beside the name field", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const unreachable = createCookoutClient({ env: {}, token: "cookout_any", url: "http://127.0.0.1:1" });
  const close = openAt({ client: { ...adminClient(), createChannel: unreachable.createChannel }, hash: "#/" });

  await submitNew({ name: "web-create-unreachable" });
  await inSidebar().findByText(/unreachable/u);

  expect([refusedOn("Name"), fieldNamed("Name").value]).toStrictEqual([true, "web-create-unreachable"]);

  close();
});
