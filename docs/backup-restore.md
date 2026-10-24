# MySQL Backup and Restore

## Requirements

- MySQL client utilities (`mysqldump` and `mysql`) installed on the operator workstation or database host.
- The application database name and host/port from the deployment environment.
- A database operator account with backup and restore privileges.
- Backups stored outside the web root and protected with appropriate filesystem access controls and encryption at rest.

Never put a database password directly in a command, script, shell history, or backup file. The examples below use `--password` without a value so the client prompts interactively.

## Backup

Run from a protected terminal. Replace `<database>` and `<host>` with values from the deployment environment; do not paste secrets into documentation.

```powershell
mysqldump --host=<host> --port=3306 --user=<backup-user> --password --single-transaction --routines --triggers --hex-blob --default-character-set=utf8mb4 <database> > .\nam-o-backup.sql
```

Use a unique, timestamped output path in the actual operating procedure. Verify the command exit code and that the resulting file is non-empty. Restrict access to the backup; it contains personal and order data.

## Restore

Restore into a newly provisioned, access-restricted database after confirming the target name:

```powershell
mysql --host=<host> --port=3306 --user=<restore-user> --password --default-character-set=utf8mb4 <database> < .\nam-o-backup.sql
```

For PowerShell installations where native input redirection is unavailable, use `cmd.exe /c` with the same command or use the vendor-provided MySQL shell/import utility. Do not overwrite a live database without an approved recovery procedure.

## Schema and migration order

1. Create the database using `utf8mb4` and `utf8mb4_unicode_ci`.
2. Apply `database/schema.sql` as the additive baseline. It creates missing tables without replacing existing tables and initializes the singleton Settings row without overwriting an existing row.
3. Apply files in `database/migrations/` in ascending numeric order. The current Settings migration is idempotent.
4. Verify required tables, indexes, foreign keys, and exactly one `store_settings` row.
5. Start the API and verify `GET /api/health` and `GET /api/settings`.

The schema bootstrap is currently maintained separately from numbered migrations; do not treat `001_store_settings.sql` as a complete fresh-database installation by itself.

## Recovery checks

- Restore a copy into an isolated database before relying on a backup.
- Verify row counts and representative relationships without exposing customer data.
- Verify the API against the restored copy before switching application traffic.
- Retain the previous database until the recovery has been confirmed.
