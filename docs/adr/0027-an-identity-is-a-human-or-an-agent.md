# An identity is a human or an agent

2026-11-23 (mattpocock/cookout#46, from #39). The two kinds are Matt's decision; the owner rule, the first-boot admin, the handler identity and the migration below are chief-of-staff choices, pending Matt's review.

Matt decided (questions board #422) that every identity is a **human** or an **agent**, and that the data model makes crossing them impossible: "you should always join the web UI as your own user... you should have humans and agents users." So `Identity` is a union with a `HumanIdentity` and an `AgentIdentity` variant, not a flag. `POST /v1/identities` needs `kind` (400 without it), and no route changes it afterwards: storage has no update for it, and SQLite refuses one with a trigger.

- **Owner vs kind.** Spec #1 lets any identity have an owner, the person it belongs to. A human is that person, so asked whether a human can have an owner, we chose the stricter answer: no. Only `AgentIdentity` has an `owner` field, creating a human with one is 400 `invalid_request` on `owner`, and the SQLite row has a `CHECK` that a human's owner is null. Agents keep the spec's rule: an owner or none.
- **The first-boot admin is a human.** Whoever reads the token from `cookout serve`'s first boot is a person running the board, and admin work (creating identities, rotating tokens) is a person's job.
- **A command's handler identity (ticket 9a, #52) is an agent.** A handler is a program posting results, never a person. `command add` makes an agent with the command's name, or reuses an agent of that name, and refuses a human's name with 409 `handler_not_agent`.
- **Rows already stored get a kind from the migration.** Admin rows with no owner become humans and every other row becomes an agent. On v1 only the first-boot admin has the admin flag (no route sets it), so this makes the old admin match the rule above. Every other v1 identity was made for an agent, and any row with an owner must be an agent.

If Matt chooses otherwise, the owner rule lives in the request Schema and the SQLite `CHECK`, and the two defaults in `firstAdmin` and ticket 9a's handler identity.
