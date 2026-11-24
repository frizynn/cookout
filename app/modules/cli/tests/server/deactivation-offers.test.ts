import type { CommandLineNeeds, TestCookoutService } from "../../../testing/server.ts";
import { Effect, Fiber, Layer } from "effect";
import {
  TestCookout,
  answer,
  commandLineServices,
  freshStateFolder,
  runCookout,
  testCookout,
  watchCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";

interface Board {
  readonly cookout: TestCookoutService;
  readonly env: Readonly<Record<string, string>>;
}

const ONE_LINE = 1;
const EXIT_SUCCESS = 0;
const SETTLE = "30 millis";
const ALMOST_THIRTY_DAYS = "2591999 seconds";
const LAST_SECOND = "1 second";
const OFFER_TEXT = "@ada/scout has had no activity for 30 days. Deactivate it?";

const services = Layer.merge(testCookout(), commandLineServices);

const settled: Effect.Effect<void> = TestClock.withLive(Effect.sleep(SETTLE));

const adaOwnsAQuietAgent: Effect.Effect<Board, never, TestCookout | CommandLineNeeds | Scope.Scope> = Effect.gen(
  function* adaOwnsAnAgent() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", { kind: "human" });
    yield* cookout.createIdentity("ada/scout", { owner: "ada" });
    const folder = yield* freshStateFolder;
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: ada.token, COOKOUT_URL: cookout.url };
    yield* Effect.andThen(settled, TestClock.adjust(ALMOST_THIRTY_DAYS));
    return { cookout, env };
  },
);

const lastQuietSecond: Effect.Effect<void> = Effect.andThen(
  Effect.andThen(settled, TestClock.adjust(LAST_SECOND)),
  settled,
);

it.effect("cookout inbox prints the caller's open deactivation offers, and cookout keep clears one", () =>
  Effect.gen(function* inboxAndKeep() {
    const { env } = yield* adaOwnsAQuietAgent;
    yield* lastQuietSecond;
    const listed = yield* runCookout({ args: ["inbox"], env });
    const kept = yield* runCookout({ args: ["keep", "1"], env });
    const notAnId = yield* runCookout({ args: ["keep", "0"], env });

    expect(listed).toMatchObject({
      exitCode: EXIT_SUCCESS,
      stdoutJson: { deactivationOffers: [{ identity: { name: "ada/scout" }, text: OFFER_TEXT }] },
    });
    expect(kept).toMatchObject({ exitCode: EXIT_SUCCESS, stdoutJson: { deactivationOffer: { cleared: true, id: 1 } } });
    expect(notAnId.exitCode).not.toBe(EXIT_SUCCESS);
  }).pipe(Effect.provide(services)),
);

it.effect("cookout watch prints a line for a deactivation offer as it is raised", () =>
  Effect.gen(function* watchOffer() {
    const { env } = yield* adaOwnsAQuietAgent;
    const { stdoutLines } = yield* watchCookout({
      args: ["watch"],
      env,
      lines: ONE_LINE,
      whileWatching: lastQuietSecond,
    });

    expect(stdoutLines).toStrictEqual([`${OFFER_TEXT} (deactivation offer 1)`]);
  }).pipe(Effect.provide(services)),
);

it.effect("cookout watch --until-mention exits 0 at a deactivation offer raised while it watches", () =>
  Effect.gen(function* untilMentionLive() {
    const { env } = yield* adaOwnsAQuietAgent;
    const watching = yield* Effect.forkScoped(runCookout({ args: ["watch", "--until-mention", "--json"], env }));
    yield* Effect.andThen(settled, lastQuietSecond);
    const result = yield* Fiber.join(watching);

    expect(result).toMatchObject({
      exitCode: EXIT_SUCCESS,
      stdoutJson: { deactivationOffer: { quietDays: 30 }, type: "deactivation-offer" },
    });
  }).pipe(Effect.provide(services)),
);

it.effect("cookout watch --until-mention exits 0 at start-up when an open deactivation offer is waiting", () =>
  Effect.gen(function* untilMentionAtStart() {
    const { cookout, env } = yield* adaOwnsAQuietAgent;
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    yield* answer(() => cookout.client.createMessage({ channel: "grill", text: "morning" }));
    yield* lastQuietSecond;
    const result = yield* runCookout({ args: ["watch", "--until-mention"], env });

    expect(result).toMatchObject({ exitCode: EXIT_SUCCESS, stdout: "1 unread, run cookout inbox" });
  }).pipe(Effect.provide(services)),
);
