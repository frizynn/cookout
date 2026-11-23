# Every agent has a human owner

2026-11-23 (mattpocock/cookout#113). Supersedes the owner rule of [ADR 0027](0027-an-identity-is-a-human-or-an-agent.md) ("agents keep the spec's rule: an owner or none"); the rest of ADR 0027 stands. Required ownership, self-service creation, no per-person cap and `<owner>/<name>` names are Matt's decisions (2026-11-23, recorded in #113). The refusal codes, the default owner when an admin leaves `--owner` out, and refusing to delete a human who still owns agents are chief-of-staff choices, pending Matt's review.

## Decision

- **An agent always has an owner, the name of an existing human.** `AgentIdentity.owner` is required. `POST /v1/identities` for an agent with no `owner` makes the caller its owner. An owner that names no human (an agent, or nobody) is 400 `owner_not_human`; one that isn't a human's name at all is 400 `invalid_request`. A human still has no owner.
- **Any human creates agents it owns.** Only an admin creates a human, or an agent owned by another human; a non-admin who tries is 403 `admin_only`. An agent creates nothing (403 `human_only`). There is no cap per person.
- **Namespaced names.** An identity name is a plain name (1–64 lowercase letters, digits or `-`) or two of them joined by one `/`, such as `matt/triage-agent`. Only an agent owned by `matt` may be named `matt/...`, whoever creates it; otherwise 400 `name_not_owned`. A human's name, and so an owner, never has a `/`, and neither does a command's name. Mentions parse `@matt/triage-agent`, and every route taking a name accepts one (the SDK percent-encodes it in the path).
- **A command's handler is owned by the admin who added it.** A handler that `command add` reuses keeps its owner.
- **A human who still owns agents is not deleted.** (Superseded by [ADR 0045](0045-identities-are-deactivated-never-deleted.md): no identity is deleted, and deactivating a human deactivates its agents.) `DELETE /v1/identities/:name` answers 409 `owns_agents`, naming them in `details.agents`, so no agent is left without an owner. Whether the agents should instead go with her, or pass to the admin who deleted her, is open in #113.

## Owner powers

2026-11-23 (mattpocock/cookout#118). That an owner manages its agents from the API, SDK and CLI, and that only an admin transfers one, are Matt's decisions (2026-11-23, recorded in #118); so is deactivating rather than deleting an identity (#124), so an owner gets no delete. The routes, the refusal codes, answering `revoked: false` when there is nothing to revoke, and refusing a namespaced transfer outright are chief-of-staff choices, pending Matt's review.

- **Owner or admin.** The human who owns an agent, or any admin, may rotate its Identity token (`POST /v1/identities/:name/token`) and list (`GET /v1/identities/:name/agent-session`) or revoke (`DELETE` there) its agent session token. Anyone else, the agent itself included, is 403 `not_owner`, as for display names; so is a non-admin naming a missing identity, so a name's existence doesn't leak. An admin naming one gets 404 `identity_not_found`. The check is `requireOwnerOrAdmin` in the identities module, for any later owner power to reuse.
- **Listing never shows the token.** It answers `{ agentSessions }`: the agent's live one, if any, with `issuedAt`, `expiresAt`, `lastUsedAt` once a request was sent with it, and `host` when the joining client sent one in `join`. Revoking answers `{ revoked }`, `false` when there was no live one; the session's next request is 401 `agent_session_revoked`, and its `watch` exits 4.
- **Only an admin transfers.** `PUT /v1/identities/:name/owner` with `{ owner }` gives an agent to another human; anyone else is 403 `admin_only`. A human is 403 `identity_kind`, an owner who is no human 400 `owner_not_human`. A namespaced agent (`@ada/x`) is 400 `name_not_owned`: it could only move with a rename, which isn't offered. The agent keeps its tokens.

## Storage

`createIdentity` checks the name and owner rules in the same transaction as the insert, and `deleteIdentity` checks for owned agents in the same transaction as the delete, so each stays one atomic `Storage` method. A new SQLite migration refuses an agent row with no owner, by trigger on insert and on update of `owner`, since a `CHECK` can't be added to an existing table. Being pre-release, it gives any agent row that has no human owner to the earliest admin rather than migrating owners properly.

`transferAgent` checks the agent, its new owner and the name's namespace in the same transaction as the update, and `revokeLiveAgentSession` finds and revokes the live agent session token as one step. A new SQLite migration adds `last_used_at` and `host` to `agent_session_tokens`.
