# Coding standards

The judgement calls that no check makes. Everything mechanical is a check in `pnpm check`; decisions are in [adr/](adr/).

## Checks

- Never loosen a lint rule, a seam rule, a `tsconfig.json` flag or a test to get the check green. Fix the code, or change the rule in its own commit and say why.

## Names

- Name things with plain words a newcomer understands, using the domain words the spec already uses. Don't coin a word to save typing, and don't use two words for one thing.
- A new domain term is checked with Matt first. Only Matt approves a term, and a term counts as approved only with a dated decision of Matt's cited next to it, in an ADR or a comment on a mattpocock/cookout issue. Admin is approved ([ADR 0003](adr/0003-admin-is-a-flag-on-an-identity.md), 2026-11-22). Lease ID, command token, call ID, inbox reason and contract suite are still proposed.
- Name tests as behaviour ("a reply to a reply joins the parent thread"), not as functions.

## Tests

- Write the failing test first, then the code.
- A test drives the cookout the way a caller does and checks what the caller sees: the SDK against a real server, a `cookout` command line run in the test's process through `testing`, or the `Storage` service. It must keep passing through a refactor that doesn't change behaviour.
- If a test needs state no interface can make, extend `app/modules/testing/`; never reach into storage by hand.
- Storage behaviour goes in the shared contract tests in `app/modules/storage/tests/`, run on both Layers and never branching on which one. Only behaviour one Layer alone has (SQLite keeping data across a reopen) goes in that Layer's own tests.
- Spawn the binary as a process only for what the process alone shows (exit codes, stdout against stderr): each spawn is a cold start of about 0.4s locally, run one after another within a file.

## Storage

- An operation that must be atomic is one `Storage` method, so each Layer decides how to make it a transaction.
- Never edit or reorder a shipped migration; add a new one at the end.

## Errors

- An error `code` is a stable snake_case word callers branch on (`not_found`, `lease_lost`); the `message` is for people.
