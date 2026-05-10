# Testing

This repo uses Jest for automated tests and includes a small set of targeted utility and integration scripts.

## Trusted Merge Gate

Use this matrix to answer whether a server branch is safe to merge.

Always run on every PR:

- `npm test`

`npm test` is the trusted baseline because it runs the Jest-managed suites that cover the current high-risk server behaviors:

- `tests/cookie-utils.test.js`: harness sanity for cookie parsing and serialization helpers used in auth flows
- `tests/visibility-engine.test.js`: permission and visibility guardrails, including admin bypass behavior and deny-by-default for unknown scope types
- `tests/checkops-validation.test.js`: form and submission validation rules that reject malformed payloads before business logic runs
- `tests/checkops-wrapper.test.js`: CheckOps wrapper contract and failure behavior for uninitialized form and submission operations

Run these additional checks when the change touches the corresponding area:

- Findings behavior: `npm run test:findings`
- CheckOps integration or schema wiring: `npm run checkops:test`, plus the relevant migration or health checks below
- Database-backed migration behavior: `npm run migrate:up`, `npm run verify:migrations`

This keeps the default merge gate small and reliable while still requiring deeper validation for DB-backed or findings-specific changes.

## Multi-Step Write Safety

These workflows cross CheckOps-owned form rows and saiqa-server-owned applicability tables, so partial-failure behavior must stay explicit:

- Form create plus applicability sync: success means both the CheckOps form row and the applicability rows were persisted. If applicability sync fails after form creation, the API returns `500` and attempts a compensating `deleteForm(form.id)` so a restricted form is not left created in an unintended open state.
- Form update plus applicability sync: when `visibility` is part of the update, the API now treats applicability sync as part of the same business action. If sync fails after the CheckOps update, the API returns `500`, the applicability transaction rolls back, and the handler attempts to restore the previous `requireAll` value before surfacing the error.
- Form delete plus applicability cleanup: the form delete is authoritative. If CheckOps deletes the form successfully, the API returns `200` even if applicability cleanup logs an error afterward, because orphaned applicability rows are harmless and should not mislead the caller into thinking the form still exists.
- Tag deactivation while referenced by forms: deactivation is blocked with `409`. The tag remains active until all referencing form applicability rows are removed, so form visibility is never silently widened or narrowed by tag deactivation.

## Prerequisites

- Install dependencies with `npm install`
- Create `.env` from `.env.example`
- Ensure the PostgreSQL connection in the environment is valid before running migration-dependent tests

## Main Commands

- `npm test`: run the trusted merge-gate Jest suite for everyday server changes
- `npm run test:cookies`: run the cookie utility script directly
- `npm run test:checkops`: run Jest tests matching `tests/checkops-*.test.js`
- `npm run test:findings`: run the DB-backed findings verification script when findings behavior changes

## Migration-Dependent Checks

Use these when validating database-backed behavior before or after changes:

- `npm run migrate:up`
- `npm run migrate:down`
- `npm run verify:migrations`
- `npm run config:check`

## CheckOps Verification

These commands are useful when the change touches the CheckOps integration:

- `npm run checkops:validate-env`
- `npm run checkops:verify`
- `npm run checkops:health`
- `npm run checkops:test`

## Notes

- `npm run test:findings` and the CheckOps verification commands expect a working database and valid environment variables.
- `npm test` is the default automated test entry point for this repo and the smallest required merge gate.
- `npm test` currently gives direct coverage for permissions, visibility, and submission validation. Findings validation remains a change-scoped DB-backed check until findings coverage is moved into the normal Jest path.