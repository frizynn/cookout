import type { CookoutClient, CreateChannelRequest, ListChannelsResponse } from "../../sdk/index.ts";
import { adminClient, clientWith, openAt, openBoard, sessionOf, watched } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { createBoard } from "../../board/index.ts";
import { createCookoutClient } from "../../sdk/index.ts";

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

interface Counted {
  readonly calls: readonly string[];
  readonly client: CookoutClient;
}

async function shownHrefs(): Promise<readonly (string | null)[]> {
  const list = await screen.findByRole("list", { name: "Channels" });
  const hrefs: (string | null)[] = [];
  for (const link of within(list).getAllByRole("link")) {
    hrefs.push(link.getAttribute("href"));
  }
  return hrefs;
}

function counting(client: CookoutClient): Counted {
  const calls: string[] = [];
  return {
    calls,
    client: {
      ...client,
      listChannels: async (): Promise<ListChannelsResponse> => {
        calls.push("listChannels");
        const answer = await client.listChannels();
        return answer;
      },
    },
  };
}

async function openLive(client: CookoutClient, shown: string): Promise<() => Promise<void>> {
  const { live, stream } = watched(client);
  const unmount = openAt({ client, hash: "#/", live });
  await screen.findByRole("link", { name: shown });
  const events = await stream;
  return async () => {
    unmount();
    await events.close();
  };
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
  const close = openAt({ client, hash: "" });

  const hrefs = await shownHrefs();

  expect(hrefs).toStrictEqual(expect.arrayContaining(channels.map((channel) => `#/channels/${channel.name}`)));
  expect(shownLink("#web-list-general Where the web lists channels.")).toStrictEqual([
    "#web-list-generalWhere the web lists channels.",
    "#/channels/web-list-general",
  ]);
  expect(shownLink("#web-list-deploys")).toStrictEqual(["#web-list-deploys", "#/channels/web-list-deploys"]);

  close();
});

it("following a channel's link opens that channel's route", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: await adminWithChannels({ name: "web-link-target" }), hash: "#/" });

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
  const counted = counting(client);
  const opening = { board: createBoard({ client: counted.client }), hash: "#/", session: sessionOf(client) };
  const closeFirst = openBoard(opening);
  await screen.findByRole("link", { name: "#web-loaded-once" });
  closeFirst();

  const close = openBoard(opening);

  expect([shownLink("#web-loaded-once"), counted.calls]).toStrictEqual([
    ["#web-loaded-once", "#/channels/web-loaded-once"],
    ["listChannels"],
  ]);

  close();
});

it("the channel list shows the server's refusal when the token is refused", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({
    client: clientWith("cookout_not-a-real-token"),
    hash: "#/",
    session: sessionOf(adminClient()),
  });

  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toContain("token_unknown");

  close();
});

it("a message in a channel created after the list loaded adds that channel to the list, without a reload", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const client = await adminWithChannels({ name: "web-list-live-known" });
  const close = await openLive(client, "#web-list-live-known");
  await client.createChannel({ name: "web-list-live-new" });
  await client.createMessage({ channel: "web-list-live-new", text: "Incident open" });

  const added = await screen.findByRole("link", { name: "#web-list-live-new" });

  expect(added.getAttribute("href")).toBe("#/channels/web-list-live-new");

  await close();
});

it("the channel list says so when the server can't be reached", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const client = createCookoutClient({ env: {}, token: "cookout_any", url: "http://127.0.0.1:1" });
  const close = openAt({ client, hash: "#/", session: sessionOf(adminClient()) });

  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toContain("unreachable");

  close();
});

it.each([
  { hash: "#/channels/general/threads/not-a-number", heading: "Nothing here" },
  { hash: "#/no-such-page", heading: "Nothing here" },
] as const)("$hash shows $heading", { timeout: 5000 }, async (route) => {
  expect.hasAssertions();

  const close = openAt({ client: adminClient(), hash: route.hash });

  const heading = await screen.findByRole("heading", { level: 1, name: route.heading });

  expect(heading.textContent).toBe(route.heading);

  close();
});
