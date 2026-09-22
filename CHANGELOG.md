# @teamgbg/encryption

## 0.3.91

### Patch Changes

- 3c7bf26: feat(logger): downgrade expected protocol-probe 4xx to INFO

## 0.3.90

### Patch Changes

- 822c964: feat(worker-pool): stack-free saturation errors + window-aggregated logging + respondAllowOnPoolError wrapper

## 0.3.89

### Patch Changes

- 8382d22: feat(executor-dispatch): in-process worker-thread dispatcher backed by @teamgbg/worker-pool

## 0.3.88

### Patch Changes

- 9ba3e3f: feat(@teamgbg/worker-pool): unified multi-CPU dispatch primitive

## 0.3.59

### Patch Changes

- d1844ad: chore: version bump

## 0.3.58

### Patch Changes

- f5d3dfe: feat(master-switch): add write-master-switch-cache export

## 0.3.57

### Patch Changes

- 46e3551: chore: version bump

## 0.3.53

### Patch Changes

- 49947dd: fix(tool-generator): classify fleet_* tables as public scope

## 0.3.32

### Patch Changes

- ffc1e81: refactor(encryption,notify-listener): add configure() — eliminate process.env reads

## 0.3.20

### Patch Changes

- 523d26a: chore: version bump

## 0.3.19

### Patch Changes

- 03248a8: chore: version bump

## 0.3.18

### Patch Changes

- f75188a: chore: version bump

## 0.3.17

### Patch Changes

- 4881a78: chore: version bump

## 0.3.16

### Patch Changes

- 6bb5e0e: chore: version bump

## 0.3.15

### Patch Changes

- a8186dd: chore: version bump

## 0.3.13

### Patch Changes

- 4348df2: refactor(tool-executor): remove internal executor and handler registry

## 0.3.0

### Minor Changes

- Promote `@teamgbg/encryption` from utilities tier to primitives tier (git mv only — package source unchanged). Removes 2 horizontal-deps violations:

  - `@teamgbg/mcp-tool-runtime (utilities) → @teamgbg/encryption` (now utilities → primitives = downward = legal)
  - `@teamgbg/opencode-session-spawn (utilities) → @teamgbg/encryption` (same)

  Encryption is a pure crypto primitive with zero `@teamgbg/*` source imports — its `@teamgbg/logger` package.json declaration was unused (logger is passed in as a parameter to `start-service`, never imported). Dropped the dead dep at the same time.

  Schema + transform support for `type: "primitive"` is in the same commit so future tier-1 packages can declare it via package_manifest.

  Follow-up: update encryption's package_manifest registry row to `type: primitive` once the schema publish lands and propagates to the MCP gateway.

## 0.2.103

### Patch Changes

- d1619e7: Republish past 0.2.102 drift: `src/crypto/secret-config.ts` exists in
  source but was added after 0.2.102 went to Verdaccio, so the installed
  exports map has no `./crypto/secret-config` entry.
  `@teamgbg/mcp-tool-runtime` imports that subpath, which means
  scala-dev-mcp is currently in a restart loop unable to find the module.
  This bump triggers a republish; the publisher's exports-derivation pass
  picks up the file automatically.

## 0.2.92

### Patch Changes

- Migrate server packages to proper tiers, split state-machine, rewrite fixa DB fixers for Prisma

## 0.2.76

### Patch Changes

- Updated dependencies [67873b0]
  - @teamgbg/logger@1.1.54

## 0.2.75

### Patch Changes

- Updated dependencies [2fab6a2]
  - @teamgbg/db@1.1.81

## 0.2.74

### Patch Changes

- Updated dependencies [807b08a]
  - @teamgbg/db@1.1.80
