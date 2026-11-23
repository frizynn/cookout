# Any admin can make any human an admin

2026-11-23 (mattpocock/cookout#105). Matt asked for more than one admin, and decided the same day that any admin can make any human an admin, and that only humans can be admins.

## Context

Admin is a flag on an identity ([ADR 0003](0003-admin-is-a-flag-on-an-identity.md)), but no route set it: every identity made through the API was `admin: false`, and the only admin was the `admin` identity whose token comes from `COOKOUT_ADMIN_TOKEN` ([ADR 0032](0032-the-admin-token-is-a-required-setting.md)). A board run by several people had to share that one token.

## Decision

- **An admin makes or removes admins.** `PUT /v1/identities/:name/admin` makes the identity an admin and `DELETE` removes admin; both answer `{ identity }`. The SDK has `makeAdmin` and `removeAdmin`, the CLI `cookout identity admin <name>` and `cookout identity admin <name> --remove`. Making an admin of an admin, or removing admin from a non-admin, changes nothing and answers the identity.
- **Any admin, any human, only humans.** Every admin has the same power, so there is no owner or super-admin. Making an agent an admin is 403 `human_only` ("Only a human can be an admin."), the code and status web login already uses for an agent. This matches [ADR 0027](0027-an-identity-is-a-human-or-an-agent.md): admin work is a person's job.
- **The board keeps an admin.** Removing admin from the last admin is 409 `last_admin`, the rule deleting the last admin already keeps. An admin may remove its own admin while another admin remains; its next admin-only request is 403 `admin_only`. Storage sets the flag in one method on both Layers, checking the last-admin rule in the same transaction, so two removals at once can't leave none.
- **The boot gives the `admin` identity its admin back.** At every boot `COOKOUT_ADMIN_TOKEN` becomes the `admin` identity's only token, and the boot also sets its admin flag. Whoever holds the setting can always get admin back by restarting, as they can always get the token back.

## Consequences

- A refusal of a non-admin no longer means "not the `admin` identity": code checks the flag, never the name.
- Removing the `admin` identity's admin lasts only until the next boot. To take admin away from whoever holds `COOKOUT_ADMIN_TOKEN`, change the setting.
