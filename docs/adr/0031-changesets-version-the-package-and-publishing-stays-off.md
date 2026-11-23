# Changesets version the package, and publishing stays off until Matt's OK

Superseded on 2026-11-23 by [ADR 0050](0050-the-cli-is-published-to-npm.md): the CLI is published to npm from CI, and the first release has its changeset.

2026-11-23 (mattpocock/cookout#84). Matt, 2026-11-23: "Can you add a changesets approach to the repo in anticipation of publishing to npm?" Keeping publishing off until he says so is his standing rule. That tickets add no changesets during the v1 build is the ticket's decision, pending Matt's review.

## Context

The only package meant for npm is the root `@ai-hero/cookout`, at version 0.0.0. `packages/e2e` and `packages/handler-example` are private and never publish. Nothing set a version or wrote a changelog.

## Decision

- [Changesets](https://changesets.dev) owns the version and CHANGELOG.md of `@ai-hero/cookout`. `.changeset/config.json` ignores the two private packages and turns off `privatePackages` versioning and tagging, so they are never bumped or published. `access` is `public`, since a scoped package is restricted by default. The base branch is `main`. `pnpm-workspace.yaml` lists the root (`.`), since Changesets only versions workspace packages and otherwise reports `@ai-hero/cookout` as "not in the workspace".
- `pnpm changeset` adds a changeset, `pnpm run version` runs `changeset version`, and `pnpm release` builds and runs `changeset publish`. No ticket runs `release`, `changeset publish` or `npm publish`, locally or in CI.
- `.github/workflows/release.yml` runs `changesets/action` on push to `main`. It opens or updates the "Version Packages" pull request. Its publish step is there but guarded by `if: false`, and the workflow has no `NPM_TOKEN`. Switching publishing on is one deliberate change of Matt's: remove the `if: false` guard on the separate "Publish to npm" step (which already runs `pnpm release`), add the `NPM_TOKEN` secret as `NODE_AUTH_TOKEN`, and grant `id-token: write`. That step is the only switch: passing `publish:` to the action as well would publish twice in one run.
- Tickets do not add changesets during the v1 build. The first release gets one hand-written changeset when Matt decides its version.

## Consequences

Until the first changeset lands on `main`, the release workflow finds nothing to do. `pnpm changeset status` fails on a branch with changes and no changeset; that is expected during the v1 build and no check runs it.
