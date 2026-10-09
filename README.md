# NeuroTask Dashboard

A full-stack productivity platform for students and professionals: tasks, projects, calendar, Pomodoro focus sessions, mood tracking, notes, analytics, notifications, and a separate Admin Panel.

| Layer    | Technology |
|----------|------------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, SWR, React Hook Form + Zod, Recharts |
| Backend  | Node.js, Express 5, TypeScript, Zod validation, JWT (httpOnly cookie) + bcrypt, Helmet, rate limiting |
| Database | Supabase PostgreSQL, Prisma ORM with versioned migrations |
| Testing  | Jest + Supertest (unit, integration, security), PGlite for a local Postgres |

```
Neurotask project/
├── backend/            Express REST API  (/api/v1)
│   ├── prisma/         schema.prisma, migrations/, seed.ts
│   ├── src/
│   │   ├── modules/    auth, users, tasks, projects, categories, focus, mood,
│   │   │               notes, notifications, analytics, export, admin, public
│   │   ├── common/     middleware (auth, RBAC, validation, errors, rate limits),
│   │   │               services (activity log, notifications, system settings)
│   │   ├── lib/        prisma, jwt, session cookie, password hashing, mailer
│   │   └── config/     environment validation
│   ├── scripts/        test-db.ts (local Postgres without Docker)
│   └── tests/          unit/ and integration/
├── frontend/           Next.js app
│   └── src/
│       ├── app/        (public)/ website, (auth)/ pages, (app)/ user area, admin/ panel
│       ├── components/ ui primitives, layout shells, charts
│       ├── features/   tasks, projects, mood, account
│       ├── hooks/      use-auth, lookups
│       └── lib/        API client, types, utils
└── docs/               API.md, ARCHITECTURE.md
```

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) and note the database password.
2. Open **Project Settings → Database → Connection string** (or the **Connect** button) and copy:
   - **Transaction pooler** (port `6543`): this becomes `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=5`.
   - **Session pooler** or **Direct connection** (port `5432`): this becomes `DIRECT_URL` (used for migrations).

The API is the only client of the database. The migration enables Row Level Security on every table **with no policies**, which blocks Supabase's public Data API (anon/authenticated keys) from reading or writing your data. The API connects as the `postgres` role, which bypasses RLS. You do not need the Supabase anon key or Supabase Auth: authentication is handled by the backend, as the project document requires.

## 2. Run the backend

```bash
cd backend
npm install
cp .env.example .env          # then edit .env (see below)
npm run db:migrate            # creates all tables in Supabase
npm run db:seed               # roles, admin account, global categories, system settings
# optional demo user with ~2 months of realistic history:
SEED_DEMO=true npm run db:seed          # PowerShell: $env:SEED_DEMO='true'; npm run db:seed
npm run dev                   # http://localhost:4000  (health check: /health)
```

Required `.env` values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase transaction pooler URL with `?pgbouncer=true&connection_limit=5` |
| `DIRECT_URL` | Supabase session/direct URL (migrations) |
| `JWT_SECRET` | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | `http://localhost:3000` locally; your Vercel URL in production (used for CORS and reset links) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First admin account created by the seed. **Change the password.** |
| `SMTP_*` | Optional. Without SMTP, password-reset emails are printed to the API console, and in development the reset link is also shown on the Forgot Password page. |

## 3. Run the frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # BACKEND_URL=http://localhost:4000
npm run dev                   # http://localhost:3000
```

The browser only talks to the Next.js origin. Next.js proxies `/api/v1/*` to the Express backend (`next.config.ts`), so the session cookie stays first-party and `httpOnly`, with no third-party-cookie or CORS problems.

### Accounts

| Role  | Email | Password |
|-------|-------|----------|
| Admin | `admin@neurotask.app` (or `SEED_ADMIN_EMAIL`) | `Admin@12345` (or `SEED_ADMIN_PASSWORD`) |
| Demo user (with `SEED_DEMO=true`) | `demo@neurotask.app` | `Demo@12345` |

Anyone can register a normal account from `/register`. To promote someone to admin, use **Admin → Users → Make admin**.

---

## Running locally without Supabase (optional)

`npm run test:db` starts an embedded PostgreSQL (PGlite) on port 5433. No Docker is needed.

```bash
cd backend
PGLITE_DIR=.pglite npm run test:db      # keep running in its own terminal
# .env:
# DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable&pgbouncer=true&connection_limit=1"
# DIRECT_URL= (same value)
npm run db:migrate && SEED_DEMO=true npm run db:seed && npm run dev
```

## Testing

```bash
cd backend
npm test            # unit + integration + security tests (needs a migrated & seeded database)
npm run test:unit   # pure unit tests only (no database)
```

Integration tests use `TEST_DATABASE_URL` when it is set, otherwise `DATABASE_URL`. Point them at a disposable database (the PGlite one above is ideal), not production. The suites cover:

- **Auth:** registration and validation, bcrypt hashing, duplicate emails, generic login errors, cookie and Bearer sessions, logout-all token revocation, the full single-use and expiring password-reset flow, rate limiting.
- **Features:** task CRUD, search, filters, sorting and pagination, completion timestamps, projects and progress, global and personal categories, focus-session lifecycle and server-side time caps, mood, notes, reminder and overdue notifications, analytics computed from records, JSON/CSV export (including CSV formula-injection protection), profile, settings, and account deletion cascade.
- **Security:** a second user gets `403` for every read, update or delete of another user's task, project, note, mood, focus session or category; admin endpoints return `403` for normal users; mass assignment of `role` is rejected; deactivation revokes sessions immediately.
- **Admin:** stats, user search, aggregate-only user detail (no private content), activate/deactivate, role changes with self and last-admin protection, global categories, registration and maintenance switches, broadcasts, contact messages, reports.

## Deployment

| Part | Host | Settings |
|------|------|----------|
| Database | Supabase | Run `npm run db:migrate` and `npm run db:seed` once from your machine (or in the backend build step) |
| Backend | Render / Railway / VPS | Root `backend`, build `npm install --include=dev && npm run build`, start `npm run db:migrate && npm start`. Env: everything in `.env.example` with `NODE_ENV=production`, `FRONTEND_URL=https://<your-app>.vercel.app` |
| Frontend | Vercel | Root `frontend`, env `BACKEND_URL=https://<your-api>.onrender.com` |

A `backend/render.yaml` blueprint is included. In production the cookie is `Secure` (HTTPS only), errors never expose internals, and the forgot-password endpoint never returns the reset link.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the architecture, ERD, security model and requirements checklist, and **[docs/API.md](docs/API.md)** for the endpoint reference.
