# Scouts ORM Maintenance Guide

This service intentionally keeps the public entrypoints stable while moving the implementation into smaller modules.

## Runtime Entry Points

- `server.js` starts the HTTP process and exports the server for tests.
- `index.js` is the stable data-access facade used by the HTTP layer.
- `db.js` is the stable Postgres facade for older imports.

New code should go under `src/`; keep root files thin.

## Module Ownership

- `src/http/` owns request parsing, routing, and HTTP responses.
- `src/query/` owns storage-independent query planning, schema metadata, predicates, and projection.
- `src/services/` owns business rules such as access policy and dashboard scoping.
- `src/config/` owns environment variable parsing and defaults.
- `src/stores/csv/` owns CSV/JSON-backed persistence and import/export normalization.
- `src/stores/postgres/` owns Postgres persistence, SQL row mapping, transactions, SQL building, and schema setup.
- `src/repositories/file/` and `src/repositories/postgres/` are compatibility wrappers for older imports.
- `src/repositories/repository-factory.js` selects the repository facade exposed from `index.js`.

## Data Store Direction

CSV/JSON remains the default store for now. The long-term direction is a shared query interface that can target either CSV or Postgres. New read behavior should use `select(resource, query, context)` where practical so the query planner can remove restricted field-group columns before the store adapter reads or materializes rows. Avoid making HTTP routes know whether the data came from CSV or Postgres.

## Adding A Field

1. Add the normalized JavaScript field in the relevant domain/read/write mapper.
2. Add query schema metadata in `src/query/schema.js` if the field can be selected.
3. Add CSV header and CSV row mapping in `src/stores/csv/`.
4. Add Postgres column, row mapper, and write mapping in `src/stores/postgres/`.
5. Add or update a migration in `src/migrations/`.
6. Add a repository or authorization test that proves the field survives a read/write round trip.

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
