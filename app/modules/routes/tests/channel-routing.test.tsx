import { adminClient, agentShown, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { inFormDialog as inDialog, inPane, inSettings } from "./regions.ts";
import { defaultBoardLimits } from "../../channels/index.ts";
import { openAt } from "./render.tsx";

async function openSettings(channel: string): Promise<() => void> {
  const close = openAt({ client: adminClient(), hash: `#/channels/${channel}` });
  fireEvent.click(await inPane().findByRole("button", { name: "Settings" }));
  await screen.findByRole("dialog", { name: "Channel settings" });
  return close;
}

async function pickOwner(agent: string): Promise<void> {
  fireEvent.click(inDialog().getByRole("button", { name: "Owner: No one" }));
  const list = await screen.findByRole("dialog", { name: "Owner" });
  fireEvent.click(within(list).getByRole("button", { name: agentShown(agent) }));
  await inDialog().findByRole("button", { name: `Owner: ${agent}` });
}

it("an admin picks a channel's owner in its settings, and the header names it", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await newIdentity({ kind: "agent", name: "web-route-owner-bot" });
  await adminClient().createChannel({ name: "web-route-owner" });
  const close = await openSettings("web-route-owner");
  await pickOwner("web-route-owner-bot");
  fireEvent.click(inDialog().getByRole("button", { name: "Save" }));
  await inPane().findByText("Owner @web-route-owner-bot");
  const { channel } = await adminClient().getChannel("web-route-owner");

  expect([channel.owner, screen.queryByRole("dialog")]).toStrictEqual(["web-route-owner-bot", null]);

  close();
});

it("setting a router shows its secret once, then Done closes the settings", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await adminClient().createChannel({ name: "web-route-router" });
  const close = await openSettings("web-route-router");
  fireEvent.change(inDialog().getByRole("textbox", { name: "Router URL" }), {
    target: { value: "https://router.example/route" },
  });
  fireEvent.click(inDialog().getByRole("button", { name: "Save" }));
  const secret = await screen.findByLabelText("Router secret");
  fireEvent.click(inDialog().getByRole("button", { name: "Done" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  expect([secret.textContent, inPane().getByText("Router").tagName]).toStrictEqual([
    expect.stringMatching(/^\S{16,}$/u),
    "P",
  ]);

  close();
});

it("a refused routing shows why, and the settings stay open", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await newIdentity({ kind: "agent", name: "web-route-both-bot" });
  await adminClient().createChannel({ name: "web-route-both" });
  const close = await openSettings("web-route-both");
  await pickOwner("web-route-both-bot");
  fireEvent.change(inDialog().getByRole("textbox", { name: "Router URL" }), {
    target: { value: "https://router.example/route" },
  });
  fireEvent.click(inDialog().getByRole("button", { name: "Save" }));
  const refusal = await inDialog().findByText(/^Couldn't save it\./u);

  expect(refusal.textContent).toMatch(/routing_conflict|owner/u);

  close();
});

it("a member sees the channel's owner but no Settings", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await newIdentity({ kind: "agent", name: "web-route-seen-bot" });
  await adminClient().createChannel({ name: "web-route-seen" });
  await adminClient().setChannelRouting("web-route-seen", { owner: "web-route-seen-bot" });
  const { client } = await newIdentity({ kind: "human", name: "web-route-member" });
  const close = openAt({ client, hash: "#/channels/web-route-seen" });
  await inPane().findByText("Owner @web-route-seen-bot");

  expect(inPane().queryByRole("button", { name: "Settings" })).toBeNull();

  close();
});

it("a person's message routed to the owner says so under it", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await newIdentity({ kind: "agent", name: "web-route-said-bot" });
  await adminClient().createChannel({ name: "web-route-said" });
  await adminClient().setChannelRouting("web-route-said", { owner: "web-route-said-bot" });
  await adminClient().createMessage({ channel: "web-route-said", text: "the deploy failed" });
  const close = openAt({ client: adminClient(), hash: "#/channels/web-route-said" });

  const said = await inPane().findByText("Routed to @web-route-said-bot, the channel's owner");

  expect(said.tagName).toBe("P");

  close();
});

async function openLimits(): Promise<() => void> {
  const close = openAt({ client: adminClient(), hash: "#/settings/board" });
  fireEvent.click(await inSettings().findByRole("button", { name: "Edit agent limits" }));
  await screen.findByRole("dialog", { name: "Agent limits" });
  return close;
}

it("an admin changes the board's agent limits from Settings", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = await openLimits();
  fireEvent.change(inDialog().getByRole("spinbutton", { name: /Agent turns in a row/u }), { target: { value: "8" } });
  fireEvent.click(inDialog().getByRole("button", { name: "Save" }));
  await inSettings().findByText(/takes 8 agent messages in a row/u);
  const { limits } = await adminClient().boardLimits();
  await adminClient().setBoardLimits(defaultBoardLimits);

  expect(limits).toStrictEqual({ ...defaultBoardLimits, agentTurns: 8 });

  close();
});
