import { adminClient, clientWith, newIdentity } from "./identities.ts";
import { agentNamed, offline, online, readerOn, suggestionDot } from "./presence.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { openAt } from "./render.tsx";

it("the @-suggestions show each identity's dot", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const watching = await agentNamed("web-presence-suggest-on");
  await agentNamed("web-presence-suggest-off");
  await watching.watch();
  await adminClient().createChannel({ name: "web-presence-suggest" });
  await readerOn({ hash: "#/channels/web-presence-suggest", reader: "web-presence-suggest-reader" });

  fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "Hi @web-presence-suggest-o" } });

  await expect(
    Promise.all([
      suggestionDot({ at: "suggest-on", label: "Online" }),
      suggestionDot({ at: "suggest-off", label: "Offline" }),
    ]),
  ).resolves.toStrictEqual([online(), offline()]);
});

it("the logged-in human's own avatar in the sidebar shows them online while their tab watches", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  await readerOn({ hash: "#/people", reader: "web-presence-own-reader" });
  const sidebar = screen.getByRole("navigation", { name: "Sidebar" });

  await expect(within(sidebar).findByRole("img", { name: "Online" })).resolves.toHaveProperty(
    "dataset.presence",
    "online",
  );
});

it("when the server refuses presence, the People rows show no dot", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await agentNamed("web-presence-refused-bot");
  const reader = await newIdentity({ kind: "human", name: "web-presence-refused-reader" });
  const asked: string[] = [];
  openAt({
    client: {
      ...reader.client,
      presence: async () => {
        asked.push("presence");
        const answer = await clientWith("cookout_not_a_token").presence();
        return answer;
      },
    },
    hash: "#/people",
  });
  await waitFor(() => {
    expect(asked).toStrictEqual(["presence"]);
  });
  const rows = await screen.findByRole("list", { name: "Identities" });
  const row = await within(rows).findByRole("link", { name: /web-presence-refused-bot/u });

  expect(within(row).queryByRole("img")).toBeNull();
});
