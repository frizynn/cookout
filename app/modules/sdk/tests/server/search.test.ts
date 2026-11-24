import { Effect, Predicate } from "effect";
import type { MessageId, SearchResponse } from "../../index.ts";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { TestIdentity } from "../../../testing/server.ts";

const BAD_REQUEST = 400;
const PAGE_OF_ONE = 1;

interface Board {
  readonly ann: TestIdentity;
  readonly post: (text: string, replyTo?: MessageId) => Effect.Effect<MessageId>;
}

const aBoard = Effect.gen(function* annInTheGrill() {
  const cookout = yield* TestCookout;
  const ann = yield* cookout.createIdentity("ann");
  yield* answer(() => cookout.client.createChannel({ name: "grill" }));
  const board: Board = {
    ann,
    post: (text, replyTo) =>
      Effect.map(
        answer(() => ann.client.createMessage({ channel: "grill", text, ...(replyTo && { replyTo }) })),
        ({ message }) => message.id,
      ),
  };
  return board;
});

function nextPage(who: TestIdentity, page: SearchResponse): Effect.Effect<SearchResponse> {
  const { cursor } = page;
  if (Predicate.isNull(cursor)) {
    return Effect.succeed(page);
  }
  return answer(() => who.client.search({ cursor, limit: PAGE_OF_ONE, query: "deploy" }));
}

it.effect("a search answers the matching messages and replies, newest first, with their thread's Closed state", () =>
  Effect.gen(function* searchAnswer() {
    const { ann, post } = yield* aBoard;
    const parent = yield* post("Deploy freeze on Friday");
    const reply = yield* post("the **deployment** is done", parent);
    yield* post("lunch?");
    yield* answer(() => ann.client.closeThread(parent));
    const found = yield* answer(() => ann.client.search({ query: "deplo" }));

    expect(found).toMatchObject({
      cursor: null,
      hasMore: false,
      results: [
        { message: { id: reply, kind: "reply", replyTo: parent }, threadClosed: true },
        { message: { author: { name: "ann" }, channel: "grill", id: parent, replyCount: 1 }, threadClosed: true },
      ],
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("search pages newest first: each answer's cursor reads the next page", () =>
  Effect.gen(function* searchPages() {
    const { ann, post } = yield* aBoard;
    const first = yield* post("deploy one");
    const second = yield* post("deploy two");
    const page = yield* answer(() => ann.client.search({ limit: PAGE_OF_ONE, query: "deploy" }));
    const rest = yield* nextPage(ann, page);

    expect([page, rest]).toMatchObject([
      { hasMore: true, results: [{ message: { id: second } }] },
      { cursor: null, hasMore: false, results: [{ message: { id: first } }] },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a search with no words is refused as empty_query", () =>
  Effect.gen(function* emptyQuery() {
    const { ann } = yield* aBoard;
    const refused = yield* refusal(() => ann.client.search({ query: "  ** @ # " }));

    expect(refused).toMatchObject({ code: "empty_query", status: BAD_REQUEST });
  }).pipe(Effect.provide(testCookout())),
);
