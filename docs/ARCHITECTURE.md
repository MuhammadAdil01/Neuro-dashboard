# NeuroTask: Architecture & Design

## 1. System architecture

```
Browser ──HTTPS──▶ Next.js (Vercel)
                    ├─ public website, auth pages, user app, admin panel (React)
                    ├─ middleware.ts: redirect anonymous visitors / non-admins (UX only)
                    └─ rewrite /api/v1/* ──▶ Express API (Render)
                                              ├─ helmet, CORS, JSON limit, rate limits
                                              ├─ authenticate (JWT + DB re-check) → maintenance guard
                                              ├─ requireAdmin for /admin/*  (RBAC)
                                              ├─ zod validation → route handler → ownership check
                                              ├─ activity log / notifications
                                              └─ Prisma ──▶ Supabase PostgreSQL (RLS locked)
```

- The frontend never talks to the database. Every read and write goes through the REST API.
- **Express** was chosen over NestJS (both are allowed by the document). **Next.js** replaces React + Vite, as requested, and is only a presentation layer. All business rules live in the API.
- **Prisma** provides parameterised queries, typed models, and versioned migrations (`backend/prisma/migrations`).

## 2. Database design (ERD)

```mermaid
erDiagram
  roles ||--o{ users : has
  users ||--|| user_settings : has
  users ||--o{ password_reset_tokens : requests
  users ||--o{ projects : owns
  users ||--o{ tasks : owns
  users ||--o{ categories : "owns (personal)"
  users ||--o{ focus_sessions : owns
  users ||--o{ mood_logs : owns
  users ||--o{ notes : owns
  users ||--o{ notifications : receives
  users |o--o{ activity_logs : performs
  projects |o--o{ tasks : groups
  categories |o--o{ tasks : classifies
  tasks |o--o{ focus_sessions : "focused on"

  users { uuid id PK; varchar email UK; text password_hash; int role_id FK; enum status; int token_version; timestamptz last_login_at }
  tasks { uuid id PK; uuid user_id FK; uuid project_id FK; uuid category_id FK; varchar title; enum priority; enum status; timestamptz due_date; timestamptz completed_at; timestamptz reminder_sent_at; timestamptz overdue_sent_at }
  projects { uuid id PK; uuid user_id FK; varchar name; enum status; varchar color; timestamptz due_date }
  categories { uuid id PK; uuid user_id FK "NULL = global"; varchar name; varchar color; bool is_active }
  focus_sessions { uuid id PK; uuid user_id FK; uuid task_id FK; enum type; enum status; int planned_minutes; int actual_seconds; timestamptz started_at }
  mood_logs { uuid id PK; uuid user_id FK; enum mood; varchar note; timestamptz logged_at }
  notes { uuid id PK; uuid user_id FK; varchar title; varchar body; bool is_pinned }
  notifications { uuid id PK; uuid user_id FK; enum type; varchar title; bool is_read; varchar entity_type; uuid entity_id }
  activity_logs { uuid id PK; uuid user_id FK; varchar action; jsonb details; varchar ip_address }
  password_reset_tokens { uuid id PK; uuid user_id FK; text token_hash UK; timestamptz expires_at; timestamptz used_at }
  user_settings { uuid id PK; uuid user_id FK; enum theme; varchar timezone; int reminder_lead_minutes; int focus_minutes }
  system_settings { varchar key PK; jsonb value }
  contact_messages { uuid id PK; varchar email; varchar subject; bool is_read }
```

Rules the database enforces as well as the API:

- Foreign keys with `ON DELETE CASCADE` for owned data. Tasks use `SET NULL` when their project or category is deleted. Activity logs use `SET NULL` so the audit trail survives account deletion.
- Unique `users.email`, unique `(user_id, name)` for personal categories, and a partial unique index on the names of global categories.
- PostgreSQL enums for priority, status, mood, focus type, role and theme.
- Indexes on `(user_id, status)`, `(user_id, due_date)`, `(user_id, completed_at)`, `(user_id, logged_at)`, `(user_id, is_read, created_at)` and others, so filtered, paginated queries stay fast as data grows.
- Row Level Security is enabled on every table with no policies, so Supabase's public API keys cannot reach the data.

## 3. Authentication & authorization

| Concern | Implementation |
|---------|----------------|
| Password storage | bcrypt (12 rounds). Passwords and reset tokens are never returned or logged. |
| Session | JWT (`sub`, `role`, `ver`) in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production), 7-day expiry. Bearer header supported for API clients. |
| Revocation | Every request checks the user's status and `token_version` (cached in memory for 30 seconds; the cache entry is cleared on every password change/reset, deactivation, role change, "sign out everywhere" and account deletion). A changed `token_version` or an inactive status invalidates the token. |
| RBAC | `requireAdmin` on `/api/v1/admin/*` and checks for global categories. The Next.js middleware also redirects, but only for UX. |
| Ownership | Every `/:id` route loads the record and calls `assertOwner`: 404 when missing, **403** when it belongs to another user. List queries always filter by `user_id`. Referenced projects and categories are ownership-checked too. |
| Password reset | 32-byte random token, SHA-256 hash stored, 30-minute expiry, single use, older tokens invalidated. Forgot-password always returns the same response. |
| Admin privacy policy | Admins manage accounts and see aggregate counts and platform totals only. The admin API never returns the content of a user's tasks, notes, mood entries or focus sessions. |

## 4. Security controls (document §14)

- Zod validation on every body, query and route param. Unknown fields are rejected with `.strict()` (prevents mass assignment such as `role`). Control characters are stripped.
- XSS: React escapes all rendered text, and no user content is rendered as HTML (the E2E test checks this with a note containing markup).
- Rate limits: login/register/reset 20 per 15 minutes per IP; forgot-password/contact 5 per hour; whole API 300 per minute.
- Helmet security headers, CORS restricted to `FRONTEND_URL`, 100 KB JSON limit, `X-Frame-Options: DENY` on the frontend.
- Centralised error handler: Prisma constraint errors map to 409/400/404, and 5xx details are hidden in production.
- CSV export neutralises spreadsheet formula injection.
- Secrets only in environment variables, validated at boot (`src/config/env.ts`).

## 5. Frontend structure

- `app/(public)`: Home, Features, How it works, About, Contact (shared navbar/footer and announcement banner).
- `app/(auth)`: Login, Register, Forgot password, Reset password.
- `app/(app)`: Dashboard, Tasks, Projects (+ detail), Calendar, Focus, Mood, Notes, Analytics, Notifications, Profile, Settings.
- `app/admin`: Dashboard, Users (+ detail), Categories, Reports, Activity logs, Messages, System settings, Profile & security.
- Data fetching uses SWR through a single API client (`lib/api.ts`). Mutations invalidate the affected keys, so the dashboard and analytics refresh after every change.
- Every list has loading skeletons, empty states, error states with retry, and toasts for success and failure.
- Theme: light, dark or system, saved per user and applied before first paint. Responsive from 360 px phones to desktop. Charts follow a colour-blind-validated palette with legends and a table view.

## 6. Requirements checklist (document §25)

| Area | Requirement | Status |
|------|-------------|--------|
| Website | Responsive landing + Features, How it works, About, Contact | ✅ |
| Authentication | Register / Login / Logout / Forgot & Reset password | ✅ |
| Roles | Admin + Normal User RBAC enforced on the server | ✅ |
| Tasks | CRUD, status, priority, category, due dates, search, filters, sort, pagination | ✅ |
| Projects | Grouping, progress, task counts, archive | ✅ |
| Calendar | Month view by due date, add task on a date | ✅ |
| Focus | 25/5/15 Pomodoro, start/pause/resume/reset/finish, ring, history | ✅ |
| Mood | Five-level mood with note, history, edit/delete, trend | ✅ |
| Notes | CRUD, search, pin | ✅ |
| Dashboard | KPIs, weekly chart, focus and mood summary, upcoming, recent activity, quick actions | ✅ |
| Analytics | Completion trends, 8-week heatmap, mood trend, streaks, breakdowns | ✅ |
| Notifications | Reminders, overdue alerts, system/broadcast, read/unread, mark all | ✅ |
| Export | JSON + CSV of the user's own data | ✅ |
| Admin | Dashboard, users, categories, reports, activity logs, system settings, messages, profile & security | ✅ |
| Database | PostgreSQL (Supabase) + Prisma migrations + seed | ✅ |
| Security | Validation, ownership, RBAC, hashing, rate limits, secure cookies | ✅ |
| Testing | Unit + integration + security (Jest/Supertest) | ✅ (45 tests) |
| Deployment | Vercel + Render + Supabase config and instructions | ✅ |

## 7. Future enhancements

These are out of scope per document §26 and can be added on top of the current architecture: shared projects and teams, comments and attachments, recurring tasks, calendar sync, email and push reminders, AI prioritisation, a mobile app, multi-language support.
