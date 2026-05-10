## What does this PR do?

<!-- One sentence: what behavior changes and why. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Contract / schema change
- [ ] Refactor / cleanup
- [ ] Docs / config only

---

## Cross-boundary checklist

Fill this in when the change touches an API boundary, shared contract, permission rule, or anything that affects more than one repo.

**Contract drift check**
- [ ] Did any API response shape change (keys added, renamed, removed, nullability changed)?
  - If yes: shared schema in `saiqa-contracts` updated?
  - If yes: client endpoint wrapper and Zod schema updated?
  - If yes: server contract test updated?

**Shared package (`saiqa-contracts`) check**
- [ ] Is `src/index.js` (ESM) and `src/index.cjs` (CJS) in sync?
- [ ] Is `src/index.d.ts` updated with TypeScript declarations?
- [ ] Is `scripts/validate-package.mjs` expected-keys list updated?
- [ ] Did `node scripts/validate-package.mjs` pass?

**Permissions and visibility check**
- [ ] Does any capability action (`SUBMIT_FORM`, `VIEW_FINDING`, etc.) change behavior?
- [ ] Is deny-by-default preserved for new or changed capability rules?
- [ ] Is `scopeType: null` handled wherever `DesignationPermissionSchema` is parsed?

**CheckOps integration check**
- [ ] Did any CheckOps output shape change (question enrichment, form structure)?
- [ ] Is `checkops-form-enricher.js` or `checkops-form-visibility.js` still correct?
- [ ] Did server enrichment tests pass (`checkops-enrichment-paths.test.js`)?

**Database check**
- [ ] Is this a saiqa-server migration, a checkops migration, or both?
  - saiqa-server: run `npm run migrate:up` and verify
  - checkops: run `npm run migrate` and verify

---

## Ownership — which repos are affected?

| Repo | Changed | Tests updated | Validation run |
|------|---------|---------------|----------------|
| `saiqa-contracts` | [ ] | [ ] | [ ] |
| `saiqa-server` | [ ] | [ ] | `npm test` [ ] |
| `saiqa-client` | [ ] | [ ] | `npm run test` [ ] |
| `checkops` | [ ] | [ ] | `npm run test:all` [ ] |

> **Ownership rules:**
> - `saiqa-contracts`: any developer touching a shared API boundary.
> - `saiqa-server`: API behavior, auth, RBAC, SQL, enrichment, migrations.
> - `saiqa-client`: UI, route behavior, client parsing, endpoint wrappers.
> - `checkops`: forms/submissions/findings package internals, package migrations.

---

## Release checklist (for changes touching more than one repo)

- [ ] All affected repos have been updated in this PR or have a linked companion PR.
- [ ] All linked PRs are mergeable (no unresolved conflicts, all checks green).
- [ ] Merge order is documented if one repo must be deployed before another.
- [ ] No hard dependency on a config or env var that is not yet present in production.
- [ ] DB migrations are backward-compatible with the currently-running code version.

---

## Validation summary

<!-- What command did you run to verify this change? Paste the output or a link. -->

```
# Example:
cd saiqa-server && npm test
# Tests: 121 passed
```
