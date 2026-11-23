import type { AgentIdentity, IdentityName } from "../../../identities/index.ts";
import { Array as Arr, Effect, Order, Predicate, Schema } from "effect";
import type { Command, CommandName, CommandSecret } from "../../../commands/index.ts";
import { isCommandName, isCommandSecret } from "../../../commands/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import type { MemoryState } from "./memory-state.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface StoredCommand {
  readonly command: Command;
  readonly secret: CommandSecret;
}

type AddCommandResult = "added" | "name_taken" | "handler_is_human";

interface CommandsSection {
  readonly addCommand: (stored: StoredCommand, handler: AgentIdentity) => Fails<AddCommandResult>;
  readonly listCommands: Fails<readonly Command[]>;
  readonly findCommand: (name: CommandName) => Fails<StoredCommand | undefined>;
}

type PlaceHandler = (handler: AgentIdentity) => "placed" | "human";

const byName: Order.Order<StoredCommand> = Order.mapInput(Order.String, (stored: StoredCommand) => stored.command.name);

interface MemoryCommandsOptions {
  readonly state: MemoryState;
  readonly placeHandler: PlaceHandler;
}

function memoryCommands({ state, placeHandler }: MemoryCommandsOptions): CommandsSection {
  const commands = new Map<CommandName, StoredCommand>();
  function open<Value>(work: () => Value): Fails<Value> {
    return Effect.andThen(state.ensureOpen, Effect.sync(work));
  }
  function add(stored: StoredCommand, handler: AgentIdentity): AddCommandResult {
    if (commands.has(stored.command.name)) {
      return "name_taken";
    }
    if (placeHandler(handler) === "human") {
      return "handler_is_human";
    }
    commands.set(stored.command.name, stored);
    return "added";
  }
  return {
    addCommand: (stored, handler) => open(() => add(stored, handler)),
    findCommand: (name) => open(() => commands.get(name)),
    listCommands: Effect.suspend(() =>
      open(() => Arr.map(Arr.sort(commands.values(), byName), ({ command }) => command)),
    ),
  };
}

const JsonSchemaFromText = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Json));

const CommandRow = Schema.Struct({
  created_at: IsoTimeSchema,
  description: Schema.NullOr(Schema.String),
  handler_name: Schema.String.pipe(Schema.refine(isIdentityName)),
  name: Schema.String.pipe(Schema.refine(isCommandName)),
  schema: JsonSchemaFromText,
  secret: Schema.String.pipe(Schema.refine(isCommandSecret)),
  url: Schema.String,
});

const KindRow = Schema.Struct({ kind: Schema.Literals(["human", "agent"]) });

const COMMAND_COLUMNS = "name, url, schema, description, handler_name, secret, created_at";

function fromRow(row: typeof CommandRow.Type): StoredCommand {
  const fields = { createdAt: row.created_at, handler: row.handler_name, name: row.name, schema: row.schema };
  const withUrl = { ...fields, url: row.url };
  if (typeof row.description === "string") {
    return { command: { ...withUrl, description: row.description }, secret: row.secret };
  }
  return { command: withUrl, secret: row.secret };
}

function toStored(row: unknown): Fails<StoredCommand> {
  return Schema.decodeUnknownEffect(CommandRow)(row).pipe(
    Effect.mapBoth({ onFailure: unreadable, onSuccess: fromRow }),
  );
}

const encodeSchema = Schema.encodeEffect(JsonSchemaFromText);

function insertCommand(db: SqliteDatabase, { command, secret }: StoredCommand): Fails<void> {
  return Effect.flatMap(Effect.mapError(encodeSchema(command.schema), unreadable), (schema) =>
    db.run(
      `INSERT INTO commands (${COMMAND_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      command.name,
      command.url,
      schema,
      command.description ?? null,
      command.handler,
      secret,
      command.createdAt,
    ),
  );
}

function kindOf(db: SqliteDatabase, name: IdentityName): Fails<"human" | "agent" | undefined> {
  return db.get("SELECT kind FROM identities WHERE name = ?", name).pipe(
    Effect.flatMap((row) => {
      if (typeof row === "object" && row !== null) {
        return Schema.decodeUnknownEffect(KindRow)(row).pipe(
          Effect.mapBoth({ onFailure: unreadable, onSuccess: ({ kind }) => kind }),
        );
      }
      return Effect.undefined;
    }),
  );
}

function insertHandler(db: SqliteDatabase, handler: AgentIdentity): Fails<void> {
  return db.run(
    "INSERT INTO identities (name, kind, owner, admin, created_at) VALUES (?, 'agent', ?, 0, ?)",
    handler.name,
    handler.owner ?? null,
    handler.createdAt,
  );
}

function sqliteCommands(db: SqliteDatabase): CommandsSection {
  function find(name: CommandName): Fails<StoredCommand | undefined> {
    return db.get(`SELECT ${COMMAND_COLUMNS} FROM commands WHERE name = ?`, name).pipe(
      Effect.flatMap((row) => {
        if (typeof row === "object" && row !== null) {
          return toStored(row);
        }
        return Effect.undefined;
      }),
    );
  }
  return {
    addCommand: (stored, handler) =>
      db.transaction(
        Effect.gen(function* addCommand() {
          if (typeof (yield* find(stored.command.name)) === "object") {
            return "name_taken" as const;
          }
          const kind = yield* kindOf(db, handler.name);
          if (kind === "human") {
            return "handler_is_human" as const;
          }
          if (Predicate.isUndefined(kind)) {
            yield* insertHandler(db, handler);
          }
          yield* insertCommand(db, stored);
          return "added" as const;
        }),
      ),
    findCommand: find,
    listCommands: Effect.suspend(() =>
      db
        .all(`SELECT ${COMMAND_COLUMNS} FROM commands ORDER BY name`)
        .pipe(
          Effect.flatMap((rows) =>
            Effect.forEach(rows, (row) => Effect.map(toStored(row), ({ command }) => command), { concurrency: 1 }),
          ),
        ),
    ),
  };
}

export {
  type AddCommandResult,
  type CommandsSection,
  type PlaceHandler,
  type StoredCommand,
  memoryCommands,
  sqliteCommands,
};
