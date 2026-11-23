import type { Message, ThreadResponse } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { callWithFields, openChannel, suggestedFor } from "./commands.ts";
import { expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";

const task = "Fix the flaky login test.";
const NONE = 0;

async function repliesIn(channel: string): Promise<readonly (readonly string[])[]> {
  const { messages } = await adminClient().listMessages(channel);
  const pending: Promise<ThreadResponse>[] = [];
  for (const { id } of messages) {
    pending.push(adminClient().getThread(id));
  }
  const threads = await Promise.all(pending);
  return threads.flatMap(({ replies }) => replies.map(({ author, text }) => [author.name, text]));
}

async function firstReplyIn(channel: string): Promise<readonly (readonly string[])[]> {
  const found = await waitFor(async () => {
    const replies = await repliesIn(channel);

    expect(replies).not.toHaveLength(NONE);

    return replies;
  });
  return found;
}

async function spawnedInChannel(): Promise<readonly Message[]> {
  await callWithFields({ checks: [], command: "spawn-agent", texts: { name: "web-spawned", task } });
  await screen.findByLabelText("Call to /spawn-agent");
  const { messages } = await adminClient().listMessages("web-spawn");
  return messages;
}

it("the message box offers /spawn-agent, and its prompt spawns the named agent with the task", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  await adminClient().createChannel({ name: "web-spawn" });
  const caller = await newIdentity({ kind: "human", name: "web-spawn-caller" });
  const close = await openChannel({ channel: "web-spawn", client: caller.client });

  const offered = await suggestedFor("/spawn");
  const messages = await spawnedInChannel();
  const replies = await firstReplyIn("web-spawn");
  const { identity } = await adminClient().getIdentity("web-spawned");

  expect([
    offered,
    messages.map(({ author, data, text }) => [author.name, text, data]),
    replies,
    identity,
  ]).toMatchObject([
    ["/spawn-agentStart a remote Claude Code session that works on this board as a new agent you own."],
    [["web-spawn-caller", "/spawn-agent", { command: "spawn-agent", data: { name: "web-spawned", task } }]],
    [
      [
        "spawn-agent",
        expect.stringMatching(/^Spawned @web-spawned, owned by @web-spawn-caller, in the session https:/u),
      ],
    ],
    { description: task, kind: "agent", name: "web-spawned", owner: "web-spawn-caller" },
  ]);

  close();
});
