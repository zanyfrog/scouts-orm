PostgreSQL CSV export for scouts.orm
Created: 2026-05-05 16:26:02 -04:00

Contents:
- schema.sql: schema-only PostgreSQL dump.
- import.sql: psql restore script that truncates target tables, then imports CSV files.
- manifest.csv: table row counts captured at export time.
- csv/*.csv: one CSV file per public table.

Restore into an empty or disposable PostgreSQL database:
1. From this folder, run: psql "$DATABASE_URL" -f schema.sql
2. Then run: psql "$DATABASE_URL" -f import.sql

Restore into an existing database with these tables:
1. From this folder, run: psql "$DATABASE_URL" -f import.sql

Note: import.sql truncates the target tables listed in the script before importing.
