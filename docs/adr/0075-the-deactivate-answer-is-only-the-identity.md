# The deactivate answer is only the identity

2026-11-24 (mattpocock/cookout#242). Decision (2026-11-23, on #242): one release with the deprecated field is enough.

[ADR 0061](0061-a-deactivated-persons-agents-stay-active.md) kept `agents`, always empty, in the answer to `POST /v1/identities/:name/deactivate` for one release, so that clients published before it kept working against a new server. `@ai-hero/cookout` 0.2.0, the first release with that change, is published.

## Decision

- **The answer is `{ identity }`.** `agents` is gone from the server, the wire schema, the SDK's types and validators, and so from what `cookout identity deactivate` prints.
- **Clients are upgraded with the server.** A 0.2.0 client's types only marked `agents` deprecated; its validator still requires it, so against a new server it reports a bad answer even though the identity was deactivated. The changeset says so.

## Considered options

- **Keep the field until a release whose validator no longer requires it is widespread.** Rejected: the decision on #242 is that one release is enough.

Superseded on 2026-11-24 by [ADR 0076](0076-removing-a-response-field-takes-two-releases.md): the server sends `agents: []` again until a release whose clients accept the answer without it is published (mattpocock/cookout#279).
