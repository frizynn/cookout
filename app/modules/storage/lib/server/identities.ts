import { Effect, Schema } from "effect";
import type { Identity, IdentityName, TokenHash } from "../../../identities/index.ts";
import { isIdentityName, isOwner } from "../../../identities/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import type { MemoryState } from "./memory-state.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import { StorageUnavailable } from "./errors.ts";

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

type Fails<A> = Effect.Effect<A, StorageUnavailable>;

export type IdentitiesSection = {
  readonly createIdentity: (identity: Identity, hash: TokenHash) => Fails<"created" | "name_taken">;
  readonly createIdentityIfNoneExist: (identity: Identity, hash: TokenHash) => Fails<boolean>;
  readonly listIdentities: () => Fails<readonly Identity[]>;
  readonly findIdentityByTokenHash: (hash: TokenHash) => Fails<TokenLookup>;
  readonly replaceToken: (name: IdentityName, hash: TokenHash) => Fails<ReplaceTokenResult>;
  readonly deleteIdentity: (name: IdentityName) => Fails<DeleteIdentityResult>;
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

export const memoryIdentities = (state: MemoryState): IdentitiesSection => {
  const data: MemoryIdentities = { activeTokens: new Map(), identities: new Map(), revokedTokens: new Set() };
  const open = <A>(work: () => A): Fails<A> => Effect.andThen(state.ensureOpen, Effect.sync(work));
  return {
    createIdentity: (identity, hash) =>
      open(() => (data.identities.has(identity.name) ? "name_taken" : (add(data, identity, hash), "created"))),
    createIdentityIfNoneExist: (identity, hash) =>
      open(() => data.identities.size === 0 && (add(data, identity, hash), true)),
    deleteIdentity: (name) => open(() => remove(data, name)),
    findIdentityByTokenHash: (hash) => open(() => lookUp(data, hash)),
    listIdentities: () => open(() => [...data.identities.values()].sort(byName).map((found) => ({ ...found }))),
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
  };
};

const IdentityRow = Schema.Struct({
  admin: Schema.Literals([0, 1]),
  created_at: IsoTimeSchema,
  name: Schema.String.pipe(Schema.refine(isIdentityName)),
  owner: Schema.NullOr(Schema.String.pipe(Schema.refine(isOwner))),
});

const TokenRow = Schema.Struct({ name: Schema.NullOr(Schema.String), revoked: Schema.Literals([0, 1]) });

const CountRow = Schema.Struct({ count: Schema.Int });

const unreadable = () => new StorageUnavailable({ message: "The database holds a row this cookout can't read." });

const decode =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (row: unknown): Fails<S["Type"]> =>
    Schema.decodeUnknownEffect(schema)(row).pipe(Effect.mapError(unreadable));

const toIdentity = (row: typeof IdentityRow.Type): Identity => {
  const fields = { admin: row.admin === 1, createdAt: row.created_at, name: row.name };
  return row.owner === null ? fields : { ...fields, owner: row.owner };
};

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

const identityColumns = "name, owner, admin, created_at";

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
        "INSERT INTO identities (name, owner, admin, created_at) VALUES (?, ?, ?, ?)",
        identity.name,
        identity.owner ?? null,
        identity.admin ? 1 : 0,
        identity.createdAt,
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
    createIdentityIfNoneExist: (identity, hash) =>
      db.transaction(
        Effect.gen(function* () {
          if ((yield* count("SELECT count(*) AS count FROM identities")) > 0) {
            return false;
          }
          yield* insert(identity, hash);
          return true;
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
          yield* db.run("DELETE FROM identities WHERE name = ?", name);
          return { identity: toIdentity(row), status: "deleted" } as const;
        }),
      ),
    findIdentityByTokenHash: (hash) =>
      db
        .get(
          `SELECT tokens.revoked, identities.name, identities.owner, identities.admin, identities.created_at
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
  };
};
