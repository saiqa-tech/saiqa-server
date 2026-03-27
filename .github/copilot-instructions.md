This repo is the backend API server.

Stack:

- Node.js CommonJS
- Motia step-based HTTP endpoints
- `pg` for database access
- JWT and cookie-based auth
- bcrypt for password hashing
- Winston logging
- Jest and Supertest for tests

Key locations:

- `steps/`: API handlers
- `middleware/`: auth, rate limit, logger
- `config/database.js`: PostgreSQL pool and query helper
- `lib/checkops-wrapper.js`: CommonJS to ESM bridge for CheckOps
- `lib/checkops-form-enricher.js`: response adaptation for forms
- `migrations/`: server-owned schema

Repo-specific rules:

- Preserve Motia step shape with `config` and `handler` exports.
- Keep auth and RBAC behavior consistent with middleware.
- Prefer existing SQL and migration patterns over introducing a new ORM.
- Treat CheckOps integration changes as API contract changes that also affect the client.
- Document whether a route returns raw package data, enriched data, or transformed data when changing response shapes.

Integration facts:

- The server fronts the CheckOps package rather than duplicating its business logic.
- The wrapper imports `@saiqa-tech/checkops` dynamically.
- The server owns users, units, designations, refresh tokens, audit logs, and config.
- CheckOps owns its own package tables and migrations.

Useful commands:

- `npm run dev`
- `npm start`
- `npm run migrate:up`
- `npm run migrate:down`
- `npm test`