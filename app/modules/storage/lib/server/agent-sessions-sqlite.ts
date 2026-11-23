import type {
  AgentSessionsSection,
  IssueAgentSession,
  IssueAgentSessionResult,
  UseAgentSession,
  UseAgentSessionResult,
} from "./agent-sessions.ts";
import { Effect, Option, Predicate, Schema } from "effect";
import { IdentityRow, toIdentity } from "./identity-row.ts";
import { isLive, renewedExpiry } from "./agent-sessions.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

const NOT_REVOKED = 0;
const REVOKED = 1;

const LiveRow = Schema.Struct({ expires_at: IsoTimeSchema });

const SessionRow = Schema.Struct({
  ...IdentityRow.fields,
  expires_at: IsoTimeSchema,
  idle_seconds: Schema.Int,
  revoked: Schema.Literals([NOT_REVOKED, REVOKED]),
});

const FIND_LIVE = `SELECT expires_at FROM agent_session_tokens
  WHERE identity_name = ? AND revoked = 0 AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`;

const FIND_SESSION = `SELECT i.name, i.kind, i.owner, i.admin, i.created_at, i.display_name,
  t.expires_at, t.idle_seconds, t.revoked
  FROM agent_session_tokens AS t JOIN identities AS i ON i.name = t.identity_name WHERE t.hash = ?`;

function liveOf(row: unknown): Fails<Option.Option<typeof LiveRow.Type>> {
  if (!Predicate.isObject(row)) {
    return Effect.succeedNone;
  }
  return Schema.decodeUnknownEffect(LiveRow)(row).pipe(
    Effect.mapBoth({ onFailure: unreadable, onSuccess: Option.some }),
  );
}

function sessionOf(row: unknown): Fails<Option.Option<typeof SessionRow.Type>> {
  if (!Predicate.isObject(row)) {
    return Effect.succeedNone;
  }
  return Schema.decodeUnknownEffect(SessionRow)(row).pipe(
    Effect.mapBoth({ onFailure: unreadable, onSuccess: Option.some }),
  );
}

function issue(db: SqliteDatabase, { force, session }: IssueAgentSession): Fails<IssueAgentSessionResult> {
  return Effect.gen(function* issueAgentSession() {
    const row = yield* db.get(FIND_LIVE, session.identity, session.issuedAt);
    const live = yield* liveOf(row);
    if (Option.isSome(live) && !force) {
      return { expiresAt: live.value.expires_at, status: "live" } as const;
    }
    yield* db.run(
      "UPDATE agent_session_tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0 AND expires_at > ?",
      session.identity,
      session.issuedAt,
    );
    yield* db.run(
      `INSERT INTO agent_session_tokens (hash, identity_name, issued_at, expires_at, idle_seconds, revoked)
        VALUES (?, ?, ?, ?, ?, 0)`,
      session.hash,
      session.identity,
      session.issuedAt,
      session.expiresAt,
      session.idleSeconds,
    );
    return { status: "issued" } as const;
  });
}

function useFound(db: SqliteDatabase, { hash, now }: UseAgentSession) {
  return (session: typeof SessionRow.Type): Fails<UseAgentSessionResult> => {
    if (session.revoked === REVOKED) {
      return Effect.succeed({ status: "revoked" });
    }
    if (!isLive(now)({ expiresAt: session.expires_at, revoked: false })) {
      return Effect.succeed({ status: "expired" });
    }
    const expiresAt = renewedExpiry({ idleSeconds: session.idle_seconds, now });
    return Effect.as(db.run("UPDATE agent_session_tokens SET expires_at = ? WHERE hash = ?", expiresAt, hash), {
      expiresAt,
      identity: toIdentity(session),
      status: "active",
    });
  };
}

const UNKNOWN: Fails<UseAgentSessionResult> = Effect.succeed({ status: "unknown" });

function use(db: SqliteDatabase, request: UseAgentSession): Fails<UseAgentSessionResult> {
  const renew = useFound(db, request);
  return db
    .get(FIND_SESSION, request.hash)
    .pipe(Effect.flatMap(sessionOf), Effect.flatMap(Option.match({ onNone: () => UNKNOWN, onSome: renew })));
}

function sqliteAgentSessions(db: SqliteDatabase): AgentSessionsSection {
  return {
    issueAgentSession: (request) => db.transaction(issue(db, request)),
    revokeAgentSession: (hash) => db.run("UPDATE agent_session_tokens SET revoked = 1 WHERE hash = ?", hash),
    useAgentSession: (request) => db.transaction(use(db, request)),
  };
}

export { sqliteAgentSessions };
