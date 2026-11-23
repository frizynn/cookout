import { anonymousClient, newIdentity, openAt } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { StartAgentJoinRequest } from "../../sdk/index.ts";
import { createAgentJoinApprovals } from "../../session/index.ts";

interface Opened {
  readonly close: () => void;
  readonly userCode: string;
  readonly requestId: Awaited<ReturnType<ReturnType<typeof anonymousClient>["startAgentJoin"]>>["requestId"];
  readonly expiresAt: string;
}

async function openedFor(
  human: Awaited<ReturnType<typeof newIdentity>>,
  asked: StartAgentJoinRequest,
): Promise<Opened> {
  const started = await anonymousClient().startAgentJoin(asked);
  const close = openAt({
    agentJoinApprovals: createAgentJoinApprovals(human.client),
    client: human.client,
    hash: `#/approve-join/${started.userCode}`,
  });
  return { close, expiresAt: started.expiresAt, requestId: started.requestId, userCode: started.userCode };
}

async function shownTexts(): Promise<readonly unknown[]> {
  const code = await screen.findByLabelText("Code");
  return [
    code.textContent,
    screen.getByText(/asks to join from build-box/u).textContent,
    screen.getByText(/^Creates /u).textContent,
    screen.getByLabelText<HTMLInputElement>(/^Idle expiry/u).value,
  ];
}

async function approvedLowered(): Promise<string | null> {
  fireEvent.change(screen.getByLabelText(/^Idle expiry/u), { target: { value: "7d" } });
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  const approved = await screen.findByText(/^Approved, /u);
  return approved.textContent;
}

it("the approval page shows the agent, host, code and asked expiry, and approves it lowered", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const human = await newIdentity({ kind: "human", name: "web-join-ada" });
  const opened = await openedFor(human, { as: "web-join-triage", host: "build-box", idleExpiry: "30d" });
  const shown = await shownTexts();
  const approved = await approvedLowered();
  const collected = await anonymousClient().collectAgentJoin(opened.requestId);
  opened.close();

  expect(shown).toStrictEqual([
    opened.userCode,
    `web-join-triage asks to join from build-box, until ${opened.expiresAt}.`,
    "Creates web-join-triage, owned by you, and joins as it.",
    "30d",
  ]);
  expect(approved).toMatch(/^Approved, with an idle expiry of 7d\./u);
  expect(collected).toMatchObject({ agentSession: { created: true, identity: "web-join-triage" }, status: "approved" });
});

async function refusedThenReplaced(): Promise<string | null> {
  await screen.findByText(/^Joins as web-join-live, which you own\./u);
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  const refused = await screen.findByRole("alert");
  const refusedText = refused.textContent;
  fireEvent.click(screen.getByLabelText(/^Replace its live session/u));
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await screen.findByText(/^Approved, /u);
  return refusedText;
}

it("for an agent with a live session, approving says so until the approver ticks replace", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const human = await newIdentity({ kind: "human", name: "web-join-grace" });
  await human.client.join({ as: "web-join-live" });
  const opened = await openedFor(human, { as: "web-join-live", host: "build-box" });
  const refusedText = await refusedThenReplaced();
  opened.close();

  expect(refusedText).toMatch(/^Couldn't approve \(agent_session_live\)/u);
});

it("a user code with no live agent join request says why it can't be shown", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const human = await newIdentity({ kind: "human", name: "web-join-gone" });
  const close = openAt({
    agentJoinApprovals: createAgentJoinApprovals(human.client),
    client: human.client,
    hash: "#/approve-join/ZZZZ-ZZZZ",
  });

  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toMatch(/^Couldn't show this agent join request \(agent_join_request_not_found\)/u);

  close();
});
