import type { CookoutClient, CreateChannelRequest } from "../../sdk/index.ts";
import { expect, inject, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Board } from "../../board/index.ts";
import { CookoutApp } from "../index.tsx";
import { createBoard } from "../../board/index.ts";
import { createCookoutClient } from "../../sdk/index.ts";

function adminClient(): CookoutClient {
  const { adminToken, url } = inject("cookout");
  return createCookoutClient({ env: {}, token: adminToken, url });
}

async function adminWithChannels(...channels: readonly CreateChannelRequest[]): Promise<CookoutClient> {
  const client = adminClient();
  await Promise.all(
    channels.map(async (channel) => {
      const created = await client.createChannel(channel);
      return created;
    }),
  );
  return client;
}

function openBoardAt(hash: string, board: Board): () => void {
  globalThis.location.hash = hash;
  return render(<CookoutApp board={board} />).unmount;
}

function openAt(hash: string, client: CookoutClient): () => void {
  return openBoardAt(hash, createBoard(client));
}

function shownLink(name: string): readonly (string | null)[] {
  const link = screen.getByRole("link", { name });
  return [link.textContent, link.getAttribute("href")];
}

it("the channel list shows the channels the server has, each linking to its channel", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const client = await adminWithChannels(
    { description: "Where the web lists channels.", name: "web-list-general" },
    { name: "web-list-deploys" },
  );
  const { channels } = await client.listChannels();
  const close = openAt("", client);

  const list = await screen.findByRole("list", { name: "Channels" });

  expect(within(list).getAllByRole("link")).toHaveLength(channels.length);
  expect(shownLink("#web-list-general Where the web lists channels.")).toStrictEqual([
    "#web-list-generalWhere the web lists channels.",
    "#/channels/web-list-general",
  ]);
  expect(shownLink("#web-list-deploys")).toStrictEqual(["#web-list-deploys", "#/channels/web-list-deploys"]);

  close();
});

it("following a channel's link opens that channel's route", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt("#/", await adminWithChannels({ name: "web-link-target" }));

  fireEvent.click(await screen.findByRole("link", { name: "#web-link-target" }));
  const heading = await screen.findByRole("heading", { level: 1, name: "#web-link-target" });

  expect([globalThis.location.hash, heading.textContent]).toStrictEqual([
    "#/channels/web-link-target",
    "#web-link-target",
  ]);

  close();
});

it("coming back to the channel list shows the channels already loaded, without asking the server again", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const client = await adminWithChannels({ name: "web-loaded-once" });
  const calls: string[] = [];
  const board = createBoard({
    listChannels: async () => {
      calls.push("listChannels");
      const answer = await client.listChannels();
      return answer;
    },
  });
  const closeFirst = openBoardAt("#/", board);
  await screen.findByRole("link", { name: "#web-loaded-once" });
  closeFirst();

  const close = openBoardAt("#/", board);

  expect([shownLink("#web-loaded-once"), calls]).toStrictEqual([
    ["#web-loaded-once", "#/channels/web-loaded-once"],
    ["listChannels"],
  ]);

  close();
});

it("the channel list shows the server's refusal when the token is refused", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { url } = inject("cookout");
  const close = openAt("#/", createCookoutClient({ env: {}, token: "cookout_not-a-real-token", url }));

  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toContain("token_unknown");

  close();
});

it("the channel list says so when the server can't be reached", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt("#/", createCookoutClient({ env: {}, token: "cookout_any", url: "http://127.0.0.1:1" }));

  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toContain("unreachable");

  close();
});

it.each([
  { hash: "#/login", heading: "Sign in" },
  { hash: "#/channels/general", heading: "#general" },
  { hash: "#/channels/general/threads/1", heading: "Thread 1 in #general" },
  { hash: "#/no-such-page", heading: "Nothing here" },
] as const)("$hash shows $heading, which isn't built yet", { timeout: 5000 }, (route) => {
  expect.hasAssertions();

  const close = openAt(route.hash, adminClient());

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(route.heading);

  close();
});
