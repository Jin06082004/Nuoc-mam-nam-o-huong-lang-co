# Deployment Preparation

This document describes a production deployment shape; it does not deploy the application or supply production credentials/domains.

## 1. Requirements

- Node.js 20 or later and npm.
- MySQL 8.0-compatible database with InnoDB and JSON support.
- A production HTTPS hostname and a reverse proxy/load balancer.
- Separate least-privilege application and migration database users.
- Persistent, encrypted database backups.

## 2. Environment variables

### Backend (`server/.env` or secret manager)

| Variable | Classification | Purpose |
|---|---|---|
| `DATABASE_HOST` | Secret configuration | MySQL hostname/private endpoint |
| `DATABASE_PORT` | Public configuration | MySQL port |
| `DATABASE_NAME` | Secret configuration | Application database name |
| `DATABASE_USER` | Secret configuration | Least-privilege application user |
| `DATABASE_PASSWORD` | Secret | Database password |
| `JWT_SECRET` | Secret | Random signing key, at least 32 characters |
| `PORT` | Public configuration | API listener port |
| `NODE_ENV` | Public configuration | Must be `production` |
| `FRONTEND_URL` | Public configuration | Exact HTTPS frontend origin allowed by API CORS |
| `SHIPPING_FEE` | Business configuration | Optional legacy fallback only when the database setting is null |

`ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_FULL_NAME` are optional development-only seed inputs. Do not configure development credentials in production. The seed script refuses to run when `NODE_ENV=production`; provision the first production administrator through an owner-approved secure process.

### Frontend (build-time public variables)

| Variable | Classification | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Public | HTTPS API base URL ending in `/api` |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical production HTTPS site origin |

Only variables prefixed with `NEXT_PUBLIC_` are compiled into browser-visible frontend code. Never place credentials or private keys in them.

## 3. Database setup

1. Provision MySQL on a private network; do not expose its listener publicly.
2. Create the production database using `utf8mb4` / `utf8mb4_unicode_ci`.
3. Apply `database/schema.sql`, then numbered migrations in ascending order. See [backup and restore](./backup-restore.md).
4. Use a migration-capable account only for schema changes. The application account should have only the runtime DML privileges it needs.
5. Verify `GET /api/health`, the Settings singleton, and all expected tables before starting customer traffic.

The current repository has a complete baseline schema plus an additive Settings migration, not a general migration runner. Plan an operational migration procedure before future schema releases.

## 4. Build

From `server`:

```powershell
npm ci
npm test
npm audit
npm run build
```

From `client`, set both public variables before building:

```powershell
npm ci
npm test
npx tsc --noEmit
npm run lint
npm audit
npm run build
```

Frontend `NEXT_PUBLIC_*` values are build-time configuration; rebuild after changing production origins.

## 5. Start commands

Backend:

```powershell
Set-Location server
npm run start
```

Frontend:

```powershell
Set-Location client
npm run start
```

Run each as a managed service with a non-root operating-system identity, restart policy, health monitoring, and resource limits. Do not expose development servers to the Internet.

## 6. Reverse proxy and HTTPS

Recommended request path:

```text
Internet -> HTTPS reverse proxy -> frontend -> HTTPS API -> private MySQL
```

Terminate TLS at a maintained proxy/load balancer, redirect HTTP to HTTPS, forward only required headers, set request/body/time limits, and restrict API CORS to the exact frontend origin. Keep MySQL private and do not publish its port.

The API auth cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when `NODE_ENV=production`. Confirm TLS termination and forwarded host/protocol configuration before enabling production traffic. The API currently trusts the exact configured `FRONTEND_URL` for browser CORS.

## 7. Backups

Follow [backup and restore](./backup-restore.md). Keep encrypted backups outside the application host and test restores into an isolated database on a regular schedule.

## 8. Rollback

1. Stop or drain application traffic.
2. Roll back application artifacts to the last known-good release.
3. If a schema migration is not backward-compatible, restore the approved pre-deployment backup into a separate database and validate it before switching connections.
4. Do not run destructive reverse SQL against live data without a reviewed recovery plan.
5. Verify health, public Settings, customer authentication, and admin authorization after rollback.

## 9. Release blockers

- A real production frontend domain and matching API CORS origin have not been supplied.
- The local development database connection currently uses MySQL `root`; production must use a separately provisioned least-privilege application account. Production database credentials, grants, TLS configuration, and reverse proxy have not been validated here.
- Authentication rate limiting currently uses an in-memory store. Configure a shared store or an equivalent edge-level policy before running multiple API instances.
- Backup and restore instructions are documented but have not been exercised against an actual backup; MySQL client utilities were unavailable in this environment.
- Official brand/contact/product content is still required; see [content required](./content-required.md).
- The development admin account is not a production account and must not be reused.
- The current configured development database required the additive baseline schema to create missing tables. Confirm the complete schema on the actual production database before release.
