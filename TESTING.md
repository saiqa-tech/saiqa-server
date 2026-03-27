# Testing

This repo uses Jest for automated tests and includes a small set of targeted utility and integration scripts.

## Prerequisites

- Install dependencies with `npm install`
- Create `.env` from `.env.example`
- Ensure the PostgreSQL connection in the environment is valid before running migration-dependent tests

## Main Commands

- `npm test`: run the Jest test suite
- `npm run test:cookies`: run the cookie utility script directly
- `npm run test:checkops`: run Jest tests matching `tests/checkops-*.test.js`
- `npm run test:findings`: run the findings implementation verification script

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
- `npm test` is the default automated test entry point for this repo.