import { Array as Arr, Effect, Option } from "effect";
import type { Message, MessageId } from "../../index.ts";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const HUMAN = { kind: "human" } as const;
const OWNER = "fisgon";
const HELPER = "helper";
const QUIET = "quiet";
const UNPROCESSABLE = 422;

interface Board {
  readonly cookout: TestCookoutService;
  readonly ada: TestIdentity;
  readonly owner: TestIdentity;
  readonly helper: TestIdentity;
}

const board: Effect.Effect<Board, never, TestCookout> = Effect.gen(function* boardWithAgents() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  const owner = yield* cookout.createIdentity(OWNER, { owner: "ada" });
  const helper = yield* cookout.createIdentity(HELPER, { owner: "ada" });
  yield* cookout.createIdentity(QUIET, { owner: "ada" });
  yield* answer(() => cookout.client.createChannel({ name: "general" }));
  return { ada, cookout, helper, owner };
});

function post(who: TestIdentity, text: string): Effect.Effect<Message> {
  return Effect.map(
    answer(() => who.client.createMessage({ channel: "general", text })),
    ({ message }) => message,
  );
}

function seenIn(who: TestIdentity, parent: Message): Effect.Effect<MessageId> {
  return Effect.map(
    answer(() => who.client.getThread(parent.id)),
    ({ replies }) => Option.match(Arr.last(replies), { onNone: () => parent.id, onSome: ({ id }) => id }),
  );
}

function reply(who: TestIdentity, parent: Message, text: string): Effect.Effect<Message> {
  return Effect.gen(function* replyAfterReading() {
    const seen = yield* seenIn(who, parent);
    const { message } = yield* answer(() =>
      who.client.createMessage({ channel: "general", replyTo: parent.id, seen, text }),
    );
    return message;
  });
}

it.effect("an agent's message mentioning more agents than the board allows is refused with agent_mention_limit", () =>
  Effect.gen(function* mentionLimit() {
    const on = yield* board;
    const limits = yield* answer(() => on.cookout.client.boardLimits());
    const refused = yield* refusal(() =>
      on.helper.client.createMessage({ channel: "general", text: `@${OWNER} @${QUIET} both of you` }),
    );
    const one = yield* post(on.helper, `@${OWNER} just you`);
    const person = yield* post(on.ada, `@${OWNER} @${QUIET} @${HELPER} all of you`);

    expect(limits).toStrictEqual({ limits: { agentMentions: 1, agentTurns: 6 } });
    expect(refused).toMatchObject({ code: "agent_mention_limit", status: UNPROCESSABLE });
    expect(refused.message).toContain("@ada");
    expect([one.mentions, person.mentions]).toStrictEqual([[OWNER], [OWNER, QUIET, HELPER]]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect(
  "past the board's agent turns, an agent's reply is refused with agent_turn_limit unless it mentions its owner",
  () =>
    Effect.gen(function* turnLimit() {
      const on = yield* board;
      yield* answer(() => on.cookout.client.setBoardLimits({ agentMentions: 1, agentTurns: 2 }));
      const parent = yield* post(on.owner, `@${HELPER} ping`);
      yield* reply(on.helper, parent, `@${OWNER} pong`);
      const seen = yield* seenIn(on.owner, parent);
      const refused = yield* refusal(() =>
        on.owner.client.createMessage({ channel: "general", replyTo: parent.id, seen, text: `@${HELPER} ping again` }),
      );
      yield* reply(on.owner, parent, "@ada over to you");
      yield* reply(on.ada, parent, "thanks, carry on");
      const after = yield* reply(on.owner, parent, `@${HELPER} ping again`);

      expect([refused.code, refused.status, after.mentions]).toStrictEqual([
        "agent_turn_limit",
        UNPROCESSABLE,
        [HELPER],
      ]);
    }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("past the board's agent turns, a reply that mentions its owner and another agent is still refused", () =>
  Effect.gen(function* noPingPong() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setBoardLimits({ agentMentions: 1, agentTurns: 2 }));
    const parent = yield* post(on.owner, `@${HELPER} ping`);
    yield* reply(on.helper, parent, `@${OWNER} pong`);
    const seen = yield* seenIn(on.owner, parent);
    const refused = yield* refusal(() =>
      on.owner.client.createMessage({ channel: "general", replyTo: parent.id, seen, text: `@ada @${HELPER} go on` }),
    );

    expect([refused.code, refused.status]).toStrictEqual(["agent_turn_limit", UNPROCESSABLE]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);
