import { Array as Arr, Effect } from "effect";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { AgentJoinCollectedResponse } from "../../../agent-sessions/index.ts";
import { identitiesPath } from "../../../identities/index.ts";
import { request } from "../../../http/client.ts";

const CREATED = 201;
const FORBIDDEN = 403;
const BAD_REQUEST = 400;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const HUMAN = { kind: "human" } as const;

interface Board {
  readonly cookout: TestCookoutService;
  readonly ada: TestIdentity;
  readonly chief: TestIdentity;
}

const board: Effect.Effect<Board, never, TestCookout> = Effect.gen(function* seedBoard() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  yield* cookout.createIdentity("bob", HUMAN);
  const chief = yield* cookout.createIdentity("chief", { owner: "ada" });
  return { ada, chief, cookout };
});

const worker = {
  admin: false,
  broughtInBy: "chief",
  createdAt: "2026-01-01T00:00:00.000Z",
  displayName: "Worker",
  kind: "agent",
  name: "worker",
  owner: "ada",
} as const;

function joinedAgentOf(joined: AgentJoinCollectedResponse): string {
  if (joined.status === "approved") {
    return joined.agentSession.identity;
  }
  return expect.unreachable("The new agent's join was not approved.");
}

it.effect(
  "an agent creates an agent owned by its owner and brought in by it, with a display name and description",
  () =>
    Effect.gen(function* agentCreatesAgent() {
      const { chief, cookout } = yield* board;
      const created = yield* answer(() =>
        chief.client.createAgentForOwner({ description: "Runs the build.", displayName: "Worker", name: "worker" }),
      );
      const listed = yield* answer(() => cookout.client.listIdentities());
      const expected = { ...worker, description: "Runs the build." };

      expect(created).toStrictEqual({ identity: expected });
      expect(Arr.filter(listed.identities, ({ name }) => name === "worker")).toStrictEqual([expected]);
    }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent's create answers 201 with a body that has no token field at all", () =>
  Effect.gen(function* noTokenInBody() {
    const { chief, cookout } = yield* board;
    const response = yield* answer(() =>
      request({
        baseUrl: cookout.url,
        body: { displayName: "Worker", kind: "agent", name: "worker" },
        headers: { authorization: `Bearer ${chief.token}` },
        method: "POST",
        path: identitiesPath,
      }),
    );

    expect(response.status).toBe(CREATED);
    expect(response.json).toStrictEqual({ identity: worker });
    expect(response.text).not.toMatch(/token|cookout_/u);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a human creating an agent still gets its token, and no brought-in-by", () =>
  Effect.gen(function* humanCreatesAgent() {
    const { ada } = yield* board;
    const created = yield* answer(() => ada.client.createIdentity({ kind: "agent", name: "helper" }));

    expect(created.identity).toStrictEqual({
      admin: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      kind: "agent",
      name: "helper",
      owner: "ada",
    });
    expect(created.token).toMatch(/^cookout_/u);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a human created with a description is refused with 400, since only an agent has one", () =>
  Effect.gen(function* humanHasNoDescription() {
    const cookout = yield* TestCookout;
    const refused = yield* refusal(() =>
      cookout.client.createIdentity({ description: "Writes code.", kind: "human", name: "eve" }),
    );

    expect(refused).toMatchObject({ status: BAD_REQUEST });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent can't create a human, an agent for anyone else, or a taken name", () =>
  Effect.gen(function* agentRefused() {
    const { chief, cookout } = yield* board;
    const refused = yield* Effect.all(
      [
        refusal(() => chief.client.createIdentity({ kind: "human", name: "eve" })),
        refusal(() => chief.client.createIdentity({ kind: "agent", name: "spy", owner: "bob" })),
        refusal(() => chief.client.createAgentForOwner({ name: "spy", owner: "bob" })),
        refusal(() => chief.client.createAgentForOwner({ name: "bob" })),
        refusal(() => chief.client.createAgentForOwner({ name: "bob/spy" })),
      ],
      ONE_AT_A_TIME,
    );
    const { identities } = yield* answer(() => cookout.client.listIdentities());

    expect(refused).toMatchObject([
      { code: "human_only", status: FORBIDDEN },
      { code: "admin_only", status: FORBIDDEN },
      { code: "admin_only", status: FORBIDDEN },
      { code: "identity_exists" },
      { code: "name_not_owned", status: BAD_REQUEST },
    ]);
    expect(Arr.map(identities, ({ name }) => name)).toStrictEqual(["ada", "admin", "bob", "chief"]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the new agent's join request shows in its creator's inbox, and the creator's approval joins it", () =>
  Effect.gen(function* creatorApproves() {
    const { ada, chief, cookout } = yield* board;
    yield* answer(() => chief.client.createAgentForOwner({ name: "worker" }));
    const started = yield* answer(() => cookout.clientFor().startAgentJoin({ as: "worker", host: "build-box" }));
    const creatorInbox = yield* answer(() => chief.client.inbox());
    const ownerInbox = yield* answer(() => ada.client.inbox());
    yield* answer(() => chief.client.approveAgentJoin(started.userCode));
    const joined = yield* answer(() => cookout.clientFor().collectAgentJoin(started.requestId));

    expect(creatorInbox.agentJoinRequests).toMatchObject([
      { agent: { broughtInBy: "chief", name: "worker", owner: "ada" }, userCode: started.userCode },
    ]);
    expect(ownerInbox.agentJoinRequests).toStrictEqual(creatorInbox.agentJoinRequests);
    expect(joinedAgentOf(joined)).toBe("worker");
  }).pipe(Effect.provide(testCookout())),
);
