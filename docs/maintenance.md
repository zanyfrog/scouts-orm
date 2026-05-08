# Scouts ORM Maintenance Guide

This service intentionally keeps the public entrypoints stable while moving the implementation into smaller modules.

## Runtime Entry Points

- `server.js` starts the HTTP process and exports the server for tests.
- `index.js` is the stable data-access facade used by the HTTP layer.
- `db.js` is the stable Postgres facade for older imports.

New code should go under `src/`; keep root files thin.

## Module Ownership

- `src/http/` owns request parsing, routing, and HTTP responses.
- `src/services/` owns business rules such as access policy and dashboard scoping.
- `src/config/` owns environment variable parsing and defaults.
- `src/repositories/file/` owns CSV/JSON-backed persistence and import/export normalization.
- `src/repositories/postgres/` owns Postgres persistence, SQL row mapping, transactions, and schema setup.
- `src/repositories/repository-factory.js` selects the repository facade exposed from `index.js`.

## Data Store Direction

CSV/JSON remains the default store for now. The long-term direction is relational storage, so new persistence behavior should be added behind the repository facade first. Avoid making HTTP routes know whether the data came from CSV or Postgres.

## Adding A Field

1. Add the normalized JavaScript field in the relevant domain/read/write mapper.
2. Add CSV header and CSV row mapping in `src/repositories/file/`.
3. Add Postgres column, row mapper, and write mapping in `src/repositories/postgres/`.
4. Add or update a migration in `src/migrations/`.
5. Add a repository or authorization test that proves the field survives a read/write round trip.

## Adding A Route

1. Put route handling in `src/http/server.js` or a route module if it grows large.
2. Put permission decisions in `src/services/access-policy.js`.
3. Put data shaping in a service module, not inside the route.
4. Use `index.js` facade methods for persistence.
5. Add an authorization test for public, denied, and allowed actors.

## Adult Record API

- `GET /api/adults` lists adult records for operational users.
- `GET /api/adults?ids=adult-1,adult-2` filters the adult list by id.
- `GET /api/adults/:id` returns one adult record.
- `POST /api/adults` accepts either `{ "adults": [...] }` for bulk replacement or `{ "adult": {...} }` for one-record upsert.
- `POST|PUT|PATCH /api/adults/:id` updates one adult record. `PATCH` preserves omitted fields.
- `DELETE /api/adults/:id` removes one adult and also removes adult-leader and adult-scout relationship rows for that adult.

## Testing

Use Node's built-in test runner:

```bash
npm test
```

For syntax-only checks:

```bash
node --check server.js
node --check index.js
node --check db.js
```
