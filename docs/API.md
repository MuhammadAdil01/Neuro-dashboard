# NeuroTask REST API (v1)

Base URL: `/api/v1`. All bodies are JSON.

**Authentication.** Login and register set an `httpOnly` cookie (`nt_token`). Non-browser clients can send `Authorization: Bearer <token>` using the `token` returned by login/register.

**Response envelope**

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed",
  "details": [{ "field": "title", "message": "Title is required" }] } }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (business rule, e.g. inactive category) |
| 401 | Not authenticated, or session expired/revoked |
| 403 | Authenticated but not allowed (wrong role, or the record belongs to another user) |
| 404 | Not found |
| 409 | Conflict (duplicate email / category name, ended focus session) |
| 422 | Validation failed (`details` lists the fields) |
| 429 | Rate limited |
| 503 | Maintenance mode (non-admin users) |

List endpoints accept `page` (default 1) and `limit` (default 20, max 100).

## Auth (public)

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | `name, email, password, timezone?` | Password: 8–72 chars with upper, lower and a digit. Assigns the USER role. Rate limited. |
| POST | `/auth/login` | `email, password` | Same error for unknown email and wrong password. Rate limited. |
| POST | `/auth/logout` | – | Clears the cookie |
| POST | `/auth/logout-all` | – | Auth required. Revokes every issued token (`token_version`). |
| POST | `/auth/forgot-password` | `email` | Always 200. Emails a single-use link valid for 30 minutes. |
| POST | `/auth/reset-password` | `token, password` | Marks the token used and signs out all sessions |

## Public

| Method | Path | Notes |
|--------|------|-------|
| GET | `/public/settings` | `allowRegistration, maintenanceMode, announcement` |
| GET | `/public/stats` | Aggregate platform counts for the landing page |
| POST | `/public/contact` | `name, email, subject, message`. Rate limited. |

## Users (auth)

| Method | Path | Body |
|--------|------|------|
| GET | `/users/me` | – (includes `settings`) |
| PATCH | `/users/me` | `name?, bio?, avatarUrl?` (unknown fields such as `role` are rejected) |
| PATCH | `/users/me/password` | `currentPassword, newPassword` (revokes other sessions) |
| GET | `/users/me/settings` | – |
| PATCH | `/users/me/settings` | `theme, timezone, dateFormat, timeFormat24h, weekStartsOn, emailNotifications, taskReminders, reminderLeadMinutes, focusMinutes, shortBreakMinutes, longBreakMinutes` (all optional) |
| DELETE | `/users/me` | `password`. Permanently deletes the account and all owned data. |

## Tasks (auth, owner only)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/tasks` | Query: `view=all\|active\|completed\|high\|overdue\|today\|upcoming`, `search`, `status=TODO,IN_PROGRESS`, `priority`, `categoryId`, `projectId` (or `none`), `dueFrom`, `dueTo`, `sortBy=createdAt\|updatedAt\|dueDate\|priority\|title\|status`, `sortOrder`, `page`, `limit` |
| POST | `/tasks` | `title, description?, priority=MEDIUM, status=TODO, dueDate?, categoryId?, projectId?`. The due date cannot be in the past. |
| GET | `/tasks/:id` | |
| PATCH | `/tasks/:id` | Any field. Setting `status=COMPLETED` stamps `completedAt`; reopening clears it. Changing `dueDate` re-arms reminders. |
| DELETE | `/tasks/:id` | 204 |

## Projects (auth, owner only)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/projects` | `status=ACTIVE\|ARCHIVED\|ALL`, `search`. Each project includes `taskCount, completedCount, inProgressCount, overdueCount, progress`. |
| POST | `/projects` | `name, description?, color?, dueDate?` |
| GET / PATCH | `/projects/:id` | PATCH also accepts `status` (archive or restore) |
| DELETE | `/projects/:id?deleteTasks=true` | By default tasks are kept and ungrouped |

## Categories (auth)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/categories` | Active global categories plus the user's own, with the user's task counts |
| POST | `/categories` | `name, color?, global?`. `global: true` requires ADMIN. |
| PATCH | `/categories/:id` | `name?, color?, isActive?`. Global categories: admin only; personal: owner only. |
| DELETE | `/categories/:id` | Tasks keep existing with no category |

## Focus sessions (auth, owner only)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/focus-sessions` | `type, status, from, to`, paginated |
| GET | `/focus-sessions/stats` | Today / week / all-time totals plus the active session |
| POST | `/focus-sessions` | `type=FOCUS\|SHORT_BREAK\|LONG_BREAK, plannedMinutes, taskId?`. Cancels any running session. |
| PATCH | `/focus-sessions/:id` | `status=COMPLETED\|CANCELLED, actualSeconds`. Capped server-side at wall-clock and planned time. |
| DELETE | `/focus-sessions/:id` | |

## Mood (auth, owner only)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/moods` | `mood, from, to`, paginated |
| POST | `/moods` | `mood=GREAT\|GOOD\|OKAY\|LOW\|STRESSED, note?, loggedAt?` (cannot be in the future) |
| PATCH / DELETE | `/moods/:id` | |

## Notes (auth, owner only)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/notes` | `search` (title and body), pinned notes first |
| POST | `/notes` | `title, body?, isPinned?` |
| GET / PATCH / DELETE | `/notes/:id` | |

## Notifications (auth, owner only)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/notifications` | `unread=true\|false, type`. `meta.unreadCount`. Also generates due reminders. |
| GET | `/notifications/unread-count` | Lightweight endpoint for the header bell |
| PATCH | `/notifications/read-all` | |
| PATCH | `/notifications/:id/read` | |
| DELETE | `/notifications/:id` | |

Reminders are created by a background job (`REMINDER_INTERVAL_SECONDS`, default 300) and on demand. A task gets one "due soon" reminder (inside the user's `reminderLeadMinutes`) and one "overdue" alert.

## Analytics (auth, own data only)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/analytics/overview` | Dashboard KPIs, streak, 7-day completion, focus and mood summary, upcoming tasks, recent activity |
| GET | `/analytics/productivity?days=7\|14\|30\|90` | Daily created/completed/focus series, 56-day heatmap, breakdowns by priority, status and category, summary |
| GET | `/analytics/mood?days=…` | Daily average score, distribution, average, trend |

Day boundaries use the user's time zone setting. Streak = consecutive days with at least one completed task or focus session.

## Export (auth, own data only)

`GET /export?format=json` returns all of the user's data. `GET /export?format=csv&type=tasks|projects|focus|moods|notes` returns one table as CSV.

## Admin (ADMIN role)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/stats` | User, content and focus totals, 14-day trend, recent security events |
| GET | `/admin/users` | `search, status, role, sortBy=createdAt\|name\|email\|lastLoginAt, sortOrder`, paginated |
| GET | `/admin/users/:id` | Account details plus **aggregate counts only** and sign-in events |
| PATCH | `/admin/users/:id/status` | `status=ACTIVE\|INACTIVE`. Deactivation revokes sessions. Not allowed on self or the last admin. |
| PATCH | `/admin/users/:id/role` | `role=ADMIN\|USER`. Not allowed on self or the last admin. |
| GET | `/admin/categories` | Global categories (including inactive) with usage |
| GET | `/admin/activity-logs` | `action` (exact, or a prefix ending in `.` such as `auth.`), `userId, search, from, to` |
| GET | `/admin/reports?days=7\|14\|30\|90` | Growth, DAU, task and focus trends, mood/priority distributions, top categories |
| GET / PATCH | `/admin/settings` | `allowRegistration, maintenanceMode, announcement, defaultFocusMinutes, maxTasksPerUser` |
| POST | `/admin/notifications/broadcast` | `title, message` to every active user |
| GET | `/admin/messages` | Contact form submissions (`unread` filter) |
| PATCH | `/admin/messages/:id/read` · DELETE `/admin/messages/:id` | |
