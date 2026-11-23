import type { AgentIdentity, Identity, IdentityName, TokenHash } from "../../../identities/index.ts";
import { Effect, Option, Predicate, Schema } from "effect";
import { IdentityRow, toIdentity } from "./identity-row.ts";
import { memoryDisplayNames, sqliteDisplayNames } from "./display-names.ts";
import { memorySetAdmin, sqliteSetAdmin } from "./identity-admins.ts";
import type { DisplayNamesSection } from "./display-names.ts";
import type { Fails } from "./errors.ts";
import type { FindIdentity } from "./identity-row.ts";
import { INBOX_TABLES } from "./inbox-sqlite.ts";
import type { MemoryState } from "./memory-state.ts";
import type { PlaceHandler } from "./commands.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import { unreadable } from "./errors.ts";

export type TokenLookup =
  | { readonly status: "active"; readonly identity: Identity }
  | { readonly status: "revoked" }
  | { readonly status: "unknown" };

type ReplaceTokenResult =
  | { readonly status: "replaced"; readonly identity: Identity }
  | { readonly status: "not_found" };

type DeleteIdentityResult =
  | { readonly status: "deleted"; readonly identity: Identity }
  | { readonly status: "not_found" }
  | { readonly status: "last_admin" };

type SetOnlyTokenResult = "created" | "replaced" | "unchanged";

export type IdentitiesSection = DisplayNamesSection & {
  readonly createIdentity: (identity: Identity, hash: TokenHash) => Fails<"created" | "name_taken">;
  readonly setOnlyToken: (identity: Identity, hash: TokenHash) => Fails<SetOnlyTokenResult>;
  readonly listIdentities: () => Fails<readonly Identity[]>;
  readonly findIdentityByTokenHash: (hash: TokenHash) => Fails<TokenLookup>;
  readonly findIdentityByName: (name: IdentityName) => Fails<Identity | undefined>;
  readonly replaceToken: (name: IdentityName, hash: TokenHash) => Fails<ReplaceTokenResult>;
  readonly deleteIdentity: (name: IdentityName) => Fails<DeleteIdentityResult>;
  readonly setAdmin: ReturnType<typeof sqliteSetAdmin>;
};

type MemoryIdentities = {
  readonly identities: Map<IdentityName, Identity>;
  readonly activeTokens: Map<TokenHash, IdentityName>;
  readonly revokedTokens: Set<TokenHash>;
};

const byName = (a: Identity, b: Identity) => (a.name < b.name ? -1 : 1);

const revokeTokensOf = (data: MemoryIdentities, name: IdentityName) => {
  for (const [hash, holder] of data.activeTokens) {
    if (holder === name) {
      data.activeTokens.delete(hash);
      data.revokedTokens.add(hash);
    }
  }
};

const add = (data: MemoryIdentities, identity: Identity, hash: TokenHash) => {
  data.identities.set(identity.name, { ...identity });
  data.activeTokens.set(hash, identity.name);
};

function setOnlyTokenResultIn(data: MemoryIdentities, identity: Identity, hash: TokenHash): SetOnlyTokenResult {
  if (!data.identities.has(identity.name)) {
    return "created";
  }
  if (data.activeTokens.get(hash) === identity.name) {
    return "unchanged";
  }
  return "replaced";
}

function setOnlyTokenIn(data: MemoryIdentities, identity: Identity, hash: TokenHash): SetOnlyTokenResult {
  const result = setOnlyTokenResultIn(data, identity, hash);
  if (result === "created") {
    data.identities.set(identity.name, { ...identity });
  }
  revokeTokensOf(data, identity.name);
  data.revokedTokens.delete(hash);
  data.activeTokens.set(hash, identity.name);
  return result;
}

const lookUp = (data: MemoryIdentities, hash: TokenHash): TokenLookup => {
  const name = data.activeTokens.get(hash);
  const identity = name === undefined ? undefined : data.identities.get(name);
  if (identity !== undefined) {
    return { identity: { ...identity }, status: "active" };
  }
  return data.revokedTokens.has(hash) ? { status: "revoked" } : { status: "unknown" };
};

const isLastAdmin = (data: MemoryIdentities, identity: Identity) =>
  identity.admin && [...data.identities.values()].filter((found) => found.admin).length === 1;

const remove = (data: MemoryIdentities, name: IdentityName): DeleteIdentityResult => {
  const identity = data.identities.get(name);
  if (identity === undefined) {
    return { status: "not_found" };
  }
  if (isLastAdmin(data, identity)) {
    return { status: "last_admin" };
  }
  revokeTokensOf(data, name);
  data.identities.delete(name);
  return { identity: { ...identity }, status: "deleted" };
};

function placeHandlerIn(data: MemoryIdentities): PlaceHandler {
  return (handler: AgentIdentity) => {
    const found = data.identities.get(handler.name);
    if (Predicate.isUndefined(found)) {
      data.identities.set(handler.name, { ...handler });
      return "placed";
    }
    if (found.kind === "human") {
      return "human";
    }
    return "placed";
  };
}

type MemoryIdentitiesSection = IdentitiesSection & {
  readonly placeHandler: PlaceHandler;
  readonly findIdentity: FindIdentity;
};

export const memoryIdentities = (state: MemoryState): MemoryIdentitiesSection => {
  const data: MemoryIdentities = { activeTokens: new Map(), identities: new Map(), revokedTokens: new Set() };
  const open = <A>(work: () => A): Fails<A> => Effect.andThen(state.ensureOpen, Effect.sync(work));
  return {
    createIdentity: (identity, hash) =>
      open(() => (data.identities.has(identity.name) ? "name_taken" : (add(data, identity, hash), "created"))),
    deleteIdentity: (name) => open(() => remove(data, name)),
    findIdentity: (name) => data.identities.get(name),
    findIdentityByName: (name) => open(() => data.identities.get(name)),
    findIdentityByTokenHash: (hash) => open(() => lookUp(data, hash)),
    listIdentities: () => open(() => [...data.identities.values()].sort(byName).map((found) => ({ ...found }))),
    ...memoryDisplayNames({ identities: data.identities, open }),
    placeHandler: placeHandlerIn(data),
    replaceToken: (name, hash) =>
      open((): ReplaceTokenResult => {
        const identity = data.identities.get(name);
        if (identity === undefined) {
          return { status: "not_found" };
        }
        revokeTokensOf(data, name);
        data.activeTokens.set(hash, name);
        return { identity: { ...identity }, status: "replaced" };
      }),
    setAdmin: (name, admin) => open(() => memorySetAdmin(data.identities)(name, admin)),
    setOnlyToken: (identity, hash) => open(() => setOnlyTokenIn(data, identity, hash)),
  };
};

const TokenRow = Schema.Struct({ name: Schema.NullOr(Schema.String), revoked: Schema.Literals([0, 1]) });

const CountRow = Schema.Struct({ count: Schema.Int });

const decode =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (row: unknown): Fails<S["Type"]> =>
    Schema.decodeUnknownEffect(schema)(row).pipe(Effect.mapError(unreadable));

const toLookup = (row: unknown): Fails<TokenLookup> =>
  row === undefined
    ? Effect.succeed({ status: "unknown" })
    : Effect.flatMap(
        decode(TokenRow)(row),
        (token): Fails<TokenLookup> =>
          token.revoked === 1 || token.name === null
            ? Effect.succeed({ status: "revoked" })
            : Effect.map(decode(IdentityRow)(row), (identity) => ({
                identity: toIdentity(identity),
                status: "active",
              })),
      );

const identityColumns = "name, kind, owner, admin, created_at, display_name";

export const sqliteIdentities = (db: SqliteDatabase): IdentitiesSection => {
  const count = (sql: string, ...params: readonly string[]) =>
    db.get(sql, ...params).pipe(
      Effect.flatMap(decode(CountRow)),
      Effect.map((row) => row.count),
    );
  const find = (name: IdentityName) =>
    db
      .get(`SELECT ${identityColumns} FROM identities WHERE name = ?`, name)
      .pipe(Effect.flatMap((row) => (row === undefined ? Effect.succeed(undefined) : decode(IdentityRow)(row))));
  const insert = (identity: Identity, hash: TokenHash) =>
    Effect.andThen(
      db.run(
        "INSERT INTO identities (name, kind, owner, admin, created_at, display_name) VALUES (?, ?, ?, ?, ?, ?)",
        identity.name,
        identity.kind,
        identity.kind === "agent" ? (identity.owner ?? null) : null,
        identity.admin ? 1 : 0,
        identity.createdAt,
        identity.displayName ?? null,
      ),
      db.run("INSERT INTO tokens (token_hash, identity_name, revoked) VALUES (?, ?, 0)", hash, identity.name),
    );
  const revokeTokensOfName = (name: IdentityName) =>
    db.run("UPDATE tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0", name);
  return {
    createIdentity: (identity, hash) =>
      db.transaction(
        Effect.gen(function* () {
          if ((yield* find(identity.name)) !== undefined) {
            return "name_taken" as const;
          }
          yield* insert(identity, hash);
          return "created" as const;
        }),
      ),
    deleteIdentity: (name) =>
      db.transaction(
        Effect.gen(function* () {
          const row = yield* find(name);
          if (row === undefined) {
            return { status: "not_found" } as const;
          }
          if (row.admin === 1 && (yield* count("SELECT count(*) AS count FROM identities WHERE admin = 1")) === 1) {
            return { status: "last_admin" } as const;
          }
          yield* revokeTokensOfName(name);
          yield* Effect.forEach(INBOX_TABLES, (table) => db.run(`DELETE FROM ${table} WHERE identity_name = ?`, name), {
            concurrency: 1,
          });
          yield* db.run("DELETE FROM identities WHERE name = ?", name);
          return { identity: toIdentity(row), status: "deleted" } as const;
        }),
      ),
    findIdentityByName: (name) =>
      Effect.map(find(name), (row) => Option.getOrUndefined(Option.map(Option.fromUndefinedOr(row), toIdentity))),
    findIdentityByTokenHash: (hash) =>
      db
        .get(
          `SELECT tokens.revoked, identities.*
           FROM tokens LEFT JOIN identities ON identities.name = tokens.identity_name
           WHERE tokens.token_hash = ?`,
          hash,
        )
        .pipe(Effect.flatMap(toLookup)),
    listIdentities: () =>
      db
        .all(`SELECT ${identityColumns} FROM identities ORDER BY name`)
        .pipe(Effect.flatMap(Effect.forEach((row) => Effect.map(decode(IdentityRow)(row), toIdentity)))),
    replaceToken: (name, hash) =>
      db.transaction(
        Effect.gen(function* () {
          const row = yield* find(name);
          if (row === undefined) {
            return { status: "not_found" } as const;
          }
          yield* revokeTokensOfName(name);
          yield* db.run("INSERT INTO tokens (token_hash, identity_name, revoked) VALUES (?, ?, 0)", hash, name);
          return { identity: toIdentity(row), status: "replaced" } as const;
        }),
      ),
    setAdmin: sqliteSetAdmin(db),
    setOnlyToken: (identity, hash) =>
      db.transaction(
        Effect.gen(function* () {
          const existing = yield* count("SELECT count(*) AS count FROM identities WHERE name = ?", identity.name);
          if (existing === 0) {
            yield* Effect.andThen(db.run("DELETE FROM tokens WHERE token_hash = ?", hash), insert(identity, hash));
            return "created" as const;
          }
          const held = yield* count(
            "SELECT count(*) AS count FROM tokens WHERE token_hash = ? AND identity_name = ? AND revoked = 0",
            hash,
            identity.name,
          );
          yield* db.run(
            "UPDATE tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0 AND token_hash <> ?",
            identity.name,
            hash,
          );
          yield* db.run(
            `INSERT INTO tokens (token_hash, identity_name, revoked) VALUES (?, ?, 0)
             ON CONFLICT (token_hash) DO UPDATE SET identity_name = excluded.identity_name, revoked = 0`,
            hash,
            identity.name,
          );
          if (held > 0) {
            return "unchanged" as const;
          }
          return "replaced" as const;
        }),
      ),
    ...sqliteDisplayNames(db),
  };
};
