# The seams cache is keyed on the installed dependencies

dependency-cruiser serves the seams check from its cache when git's HEAD, the changed files and its options all match the cached run; it never looks at `node_modules`. So a seams run between a merge that adds a dependency and `pnpm install` cached the dependency as unresolvable, and every later run kept flagging it under `no-undeclared-dependencies` until the cache was deleted (mattpocock/cookout#165). Both `.dependency-cruiser.cjs` and `packages/e2e/.dependency-cruiser.mjs` therefore put the SHA-256 of `node_modules/.pnpm/lock.yaml`, which pnpm rewrites on every install that changes `node_modules`, into their options as the exotic require string `installed-dependencies:<hash>`. The options are part of the cache key, so an install invalidates the cache, and the string can never name a call, so it changes nothing that is cruised. The hook's and `pnpm seams`' commands are unchanged.

## Considered Options

- **`--cache-strategy content`**: rejected, because it hashes only the cruised files, so a newly installed package still served the cached result.
- **Keying on the hash of `pnpm-lock.yaml`**: rejected, because the merge changes `pnpm-lock.yaml` and `pnpm install` doesn't, so the stale run before the install already has the new key.
- **A cache folder named by the hash, chosen by a wrapper script**: rejected, because it changes the commands every agent's pre-commit hook runs and leaves a folder behind per install.
