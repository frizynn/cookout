import { Array as Arr, Effect, pipe } from "effect";
import {
  commandFixture as command,
  commandName,
  handlerFixture as handler,
  identityFixture,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { tokenHash } from "../../../identities/index.ts";

const AT_ONCE = 10;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const unavailable = { _tag: "StorageUnavailable" };

it.effect.each(storageLayers)("storage contract ($adapter): a new store has no commands", ({ layer }) =>
  Effect.gen(function* newStore() {
    const { storage } = yield* openStore(layer);
    const commands = yield* storage.listCommands;

    expect(commands).toStrictEqual([]);
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a command is added with or without a description, listed by name and found with its secret",
  ({ layer }) =>
    Effect.gen(function* addListFind() {
      const { storage } = yield* openStore(layer);
      const zed = command("zed", { description: "Last", secret: "hmac_zed-secret" });
      const alpha = command("alpha");
      const added = yield* Effect.forEach(
        [zed, alpha],
        (stored) => storage.addCommand(stored, handler(stored.command.name)),
        ONE_AT_A_TIME,
      );
      const commands = yield* storage.listCommands;
      const [found, missing] = yield* Effect.forEach(
        ["zed", "nowhere"],
        (name) => storage.findCommand(commandName(name)),
        ONE_AT_A_TIME,
      );

      expect({ added, commands, found }).toStrictEqual({
        added: ["added", "added"],
        commands: [alpha.command, zed.command],
        found: zed,
      });
      expect(missing).toBeUndefined();
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): adding a command makes its handler an agent identity, or reuses an agent of that name",
  ({ layer }) =>
    Effect.gen(function* handlerIdentity() {
      const { storage } = yield* openStore(layer);
      const owned = identityFixture("owned", { owner: "matt" });
      yield* storage.createIdentity(owned, tokenHash("hash:owned"));
      yield* storage.addCommand(command("fresh"), handler("fresh"));
      yield* storage.addCommand(command("owned"), handler("owned"));
      const identities = yield* storage.listIdentities();
      const ownedToken = yield* storage.findIdentityByTokenHash(tokenHash("hash:owned"));

      expect(identities).toStrictEqual([handler("fresh"), owned]);
      expect(ownedToken).toStrictEqual({ identity: owned, status: "active" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a command name in use, or a human's name, adds nothing",
  ({ layer }) =>
    Effect.gen(function* refused() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identityFixture("ada", { kind: "human" }), tokenHash("hash:ada"));
      yield* storage.addCommand(command("deploy"), handler("deploy"));
      const results = yield* Effect.forEach(
        [command("deploy", { secret: "hmac_other" }), command("ada")],
        (stored) => storage.addCommand(stored, handler(stored.command.name)),
        ONE_AT_A_TIME,
      );
      const commands = yield* storage.listCommands;
      const found = yield* storage.findCommand(commandName("deploy"));
      const identities = yield* storage.listIdentities();

      expect({ commands, results }).toStrictEqual({
        commands: [command("deploy").command],
        results: ["name_taken", "handler_is_human"],
      });
      expect(found).toStrictEqual(command("deploy"));
      expect(identities).toStrictEqual([identityFixture("ada", { kind: "human" }), handler("deploy")]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): only one command is added when one name is asked for many times at once",
  ({ layer }) =>
    Effect.gen(function* addAtOnce() {
      const { storage } = yield* openStore(layer);
      const results = yield* pipe(
        Arr.makeBy(AT_ONCE, () => command("grill")),
        Effect.forEach((wanted) => storage.addCommand(wanted, handler("grill")), { concurrency: "unbounded" }),
      );
      const commands = yield* storage.listCommands;

      expect(Arr.filter(results, (result) => result === "added")).toStrictEqual(["added"]);
      expect(commands).toStrictEqual([command("grill").command]);
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): commands cannot be used in a closed store", ({ layer }) =>
  Effect.gen(function* closedStore() {
    const { close, storage } = yield* openStore(layer);
    yield* close;
    const listed = yield* Effect.flip(storage.listCommands);
    const added = yield* Effect.flip(storage.addCommand(command("late"), handler("late")));
    const found = yield* Effect.flip(storage.findCommand(commandName("late")));

    expect([listed, added, found]).toMatchObject([unavailable, unavailable, unavailable]);
  }),
);
