import { prisma } from '../../src/lib/prisma';
import { generateTaskReminders } from '../../src/common/services/notify';
import { api, newUser } from './helpers';

afterAll(() => prisma.$disconnect());

const inHours = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();

describe('Tasks', () => {
  it('creates, lists, filters, updates, completes and deletes tasks', async () => {
    const { agent } = await newUser();

    const a = await agent.post(api('/tasks')).send({ title: 'Write report', priority: 'HIGH', dueDate: inHours(30) });
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ title: 'Write report', priority: 'HIGH', status: 'TODO', completedAt: null });
    await agent.post(api('/tasks')).send({ title: 'Buy milk', priority: 'LOW' }).expect(201);
    await agent.post(api('/tasks')).send({ title: 'Read chapter', description: 'Biology report notes' }).expect(201);

    const all = await agent.get(api('/tasks?limit=2'));
    expect(all.body.meta).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(all.body.data).toHaveLength(2);

    const high = await agent.get(api('/tasks?view=high'));
    expect(high.body.data.map((t: { title: string }) => t.title)).toEqual(['Write report']);

    const search = await agent.get(api('/tasks?search=report'));
    expect(search.body.meta.total).toBe(2); // matches title and description

    const byPriority = await agent.get(api('/tasks?sortBy=priority&sortOrder=asc'));
    expect(byPriority.body.data[0].priority).toBe('HIGH');

    const done = await agent.patch(api(`/tasks/${a.body.data.id}`)).send({ status: 'COMPLETED' });
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.completedAt).not.toBeNull();

    const reopened = await agent.patch(api(`/tasks/${a.body.data.id}`)).send({ status: 'IN_PROGRESS' });
    expect(reopened.body.data.completedAt).toBeNull();

    const completed = await agent.get(api('/tasks?view=completed'));
    expect(completed.body.meta.total).toBe(0);

    await agent.delete(api(`/tasks/${a.body.data.id}`)).expect(204);
    await agent.get(api(`/tasks/${a.body.data.id}`)).expect(404);
  });

  it('accepts null due dates and can clear a due date', async () => {
    const { agent } = await newUser();
    const t = await agent.post(api('/tasks')).send({ title: 'No deadline', dueDate: null, categoryId: null, projectId: null });
    expect(t.status).toBe(201);
    expect(t.body.data.dueDate).toBeNull();

    const withDue = (await agent.post(api('/tasks')).send({ title: 'Deadline', dueDate: inHours(5) })).body.data;
    const cleared = await agent.patch(api(`/tasks/${withDue.id}`)).send({ dueDate: null });
    expect(cleared.body.data.dueDate).toBeNull();

    const p = await agent.post(api('/projects')).send({ name: 'P', dueDate: null, description: null });
    expect(p.status).toBe(201);
    expect(p.body.data.dueDate).toBeNull();
  });

  it('validates task input', async () => {
    const { agent } = await newUser();
    expect((await agent.post(api('/tasks')).send({ title: '' })).status).toBe(422);
    expect((await agent.post(api('/tasks')).send({ title: 'x', priority: 'URGENT' })).status).toBe(422);
    expect((await agent.post(api('/tasks')).send({ title: 'x', dueDate: '2020-01-01' })).status).toBe(422);
    expect((await agent.patch(api('/tasks/not-a-uuid')).send({ title: 'y' })).status).toBe(422);
    expect((await agent.patch(api('/tasks/00000000-0000-4000-8000-000000000000')).send({ title: 'y' })).status).toBe(404);
  });

  it('groups tasks into projects with progress', async () => {
    const { agent } = await newUser();
    const project = (await agent.post(api('/projects')).send({ name: 'FYP' })).body.data;
    const t1 = (await agent.post(api('/tasks')).send({ title: 'One', projectId: project.id })).body.data;
    await agent.post(api('/tasks')).send({ title: 'Two', projectId: project.id });
    await agent.patch(api(`/tasks/${t1.id}`)).send({ status: 'COMPLETED' });

    const res = await agent.get(api(`/projects/${project.id}`));
    expect(res.body.data).toMatchObject({ taskCount: 2, completedCount: 1, progress: 50 });

    const tasks = await agent.get(api(`/tasks?projectId=${project.id}`));
    expect(tasks.body.meta.total).toBe(2);

    // deleting a project keeps its tasks by default
    await agent.delete(api(`/projects/${project.id}`)).expect(204);
    expect((await agent.get(api('/tasks'))).body.meta.total).toBe(2);
  });

  it('supports global and personal categories', async () => {
    const { agent } = await newUser();
    const list = await agent.get(api('/categories'));
    const global = list.body.data.find((c: { scope: string }) => c.scope === 'global');
    expect(global).toBeDefined();

    const mine = await agent.post(api('/categories')).send({ name: 'Side hustle', color: '#123456' });
    expect(mine.body.data.scope).toBe('personal');
    const task = await agent.post(api('/tasks')).send({ title: 'Categorised', categoryId: mine.body.data.id });
    expect(task.body.data.category.name).toBe('Side hustle');

    expect((await agent.post(api('/categories')).send({ name: 'Nope', global: true })).status).toBe(403);
    expect((await agent.patch(api(`/categories/${global.id}`)).send({ name: 'Hacked' })).status).toBe(403);
  });
});

describe('Ownership (security)', () => {
  it('blocks access to another user’s private records', async () => {
    const owner = await newUser('Owner');
    const intruder = await newUser('Intruder');

    const task = (await owner.agent.post(api('/tasks')).send({ title: 'Secret task' })).body.data;
    const project = (await owner.agent.post(api('/projects')).send({ name: 'Secret project' })).body.data;
    const note = (await owner.agent.post(api('/notes')).send({ title: 'Diary', body: 'private' })).body.data;
    const mood = (await owner.agent.post(api('/moods')).send({ mood: 'LOW' })).body.data;
    const focus = (await owner.agent.post(api('/focus-sessions')).send({ plannedMinutes: 25 })).body.data;
    const category = (await owner.agent.post(api('/categories')).send({ name: 'Mine only' })).body.data;

    const attempts = [
      intruder.agent.get(api(`/tasks/${task.id}`)),
      intruder.agent.patch(api(`/tasks/${task.id}`)).send({ title: 'pwned' }),
      intruder.agent.delete(api(`/tasks/${task.id}`)),
      intruder.agent.get(api(`/projects/${project.id}`)),
      intruder.agent.delete(api(`/projects/${project.id}`)),
      intruder.agent.get(api(`/notes/${note.id}`)),
      intruder.agent.patch(api(`/notes/${note.id}`)).send({ title: 'pwned' }),
      intruder.agent.delete(api(`/moods/${mood.id}`)),
      intruder.agent.patch(api(`/focus-sessions/${focus.id}`)).send({ status: 'COMPLETED', actualSeconds: 10 }),
      intruder.agent.patch(api(`/categories/${category.id}`)).send({ name: 'pwned' }),
      // cannot attach own task to someone else's project / category
      intruder.agent.post(api('/tasks')).send({ title: 'x', projectId: project.id }),
      intruder.agent.post(api('/tasks')).send({ title: 'x', categoryId: category.id }),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(403);

    // lists never leak
    expect((await intruder.agent.get(api('/tasks'))).body.meta.total).toBe(0);
    expect((await intruder.agent.get(api('/notes'))).body.meta.total).toBe(0);
    expect((await intruder.agent.get(api('/moods'))).body.meta.total).toBe(0);

    // and nothing changed
    expect((await owner.agent.get(api(`/tasks/${task.id}`))).body.data.title).toBe('Secret task');
  });

  it('forbids admin endpoints for normal users', async () => {
    const { agent } = await newUser();
    for (const path of ['/admin/users', '/admin/stats', '/admin/activity-logs', '/admin/reports', '/admin/settings']) {
      expect((await agent.get(api(path))).status).toBe(403);
    }
  });
});

describe('Focus, mood and notes', () => {
  it('tracks a focus session from start to completion', async () => {
    const { agent } = await newUser();
    const task = (await agent.post(api('/tasks')).send({ title: 'Deep work' })).body.data;
    const started = await agent.post(api('/focus-sessions')).send({ type: 'FOCUS', plannedMinutes: 25, taskId: task.id });
    expect(started.status).toBe(201);
    expect(started.body.data.status).toBe('IN_PROGRESS');

    const stats = await agent.get(api('/focus-sessions/stats'));
    expect(stats.body.data.active.id).toBe(started.body.data.id);

    // Backdate the start so the server-side cap (wall-clock) allows 25 minutes
    await prisma.focusSession.update({ where: { id: started.body.data.id }, data: { startedAt: new Date(Date.now() - 26 * 60 * 1000) } });
    const done = await agent.patch(api(`/focus-sessions/${started.body.data.id}`)).send({ status: 'COMPLETED', actualSeconds: 99999 });
    expect(done.status).toBe(422); // over the 4h maximum
    const ok = await agent.patch(api(`/focus-sessions/${started.body.data.id}`)).send({ status: 'COMPLETED', actualSeconds: 1500 });
    expect(ok.body.data).toMatchObject({ status: 'COMPLETED', actualSeconds: 1500 });

    expect((await agent.patch(api(`/focus-sessions/${started.body.data.id}`)).send({ status: 'CANCELLED', actualSeconds: 1 })).status).toBe(409);

    const history = await agent.get(api('/focus-sessions'));
    expect(history.body.data[0].task.title).toBe('Deep work');
  });

  it('caps reported focus time at wall-clock time', async () => {
    const { agent } = await newUser();
    const s = (await agent.post(api('/focus-sessions')).send({ plannedMinutes: 25 })).body.data;
    const res = await agent.patch(api(`/focus-sessions/${s.id}`)).send({ status: 'COMPLETED', actualSeconds: 1500 });
    expect(res.body.data.actualSeconds).toBeLessThan(60);
  });

  it('records moods and notes', async () => {
    const { agent } = await newUser();
    const m = await agent.post(api('/moods')).send({ mood: 'GREAT', note: 'Shipped it' });
    expect(m.body.data).toMatchObject({ mood: 'GREAT', score: 5, note: 'Shipped it' });
    expect((await agent.post(api('/moods')).send({ mood: 'HAPPY' })).status).toBe(422);

    const n = await agent.post(api('/notes')).send({ title: 'Idea', body: '<script>alert(1)</script>' });
    expect(n.status).toBe(201);
    expect((await agent.post(api('/notes')).send({ body: 'no title' })).status).toBe(422);
    const upd = await agent.patch(api(`/notes/${n.body.data.id}`)).send({ isPinned: true });
    expect(upd.body.data.isPinned).toBe(true);
  });
});

describe('Notifications and analytics', () => {
  it('generates due-soon and overdue notifications once per task', async () => {
    const { agent, user } = await newUser();
    const soon = (await agent.post(api('/tasks')).send({ title: 'Due soon', dueDate: inHours(0.5) })).body.data;
    const later = (await agent.post(api('/tasks')).send({ title: 'Due later', dueDate: inHours(48) })).body.data;
    const overdue = (await agent.post(api('/tasks')).send({ title: 'Late' })).body.data;
    await prisma.task.update({ where: { id: overdue.id }, data: { dueDate: new Date(Date.now() - 3600 * 1000) } });

    await generateTaskReminders(user.id);
    await generateTaskReminders(user.id); // idempotent

    const res = await agent.get(api('/notifications'));
    const related = res.body.data.filter((n: { entityId: string }) => [soon.id, later.id, overdue.id].includes(n.entityId));
    expect(related.map((n: { type: string }) => n.type).sort()).toEqual(['TASK_DUE', 'TASK_REMINDER']);
    expect(res.body.meta.unreadCount).toBeGreaterThanOrEqual(3); // + welcome notification

    await agent.patch(api(`/notifications/${related[0].id}/read`)).expect(200);
    await agent.patch(api('/notifications/read-all')).expect(200);
    expect((await agent.get(api('/notifications/unread-count'))).body.data.unreadCount).toBe(0);
  });

  it('computes analytics from database records', async () => {
    const { agent } = await newUser();
    const t = (await agent.post(api('/tasks')).send({ title: 'Analytics task', priority: 'HIGH' })).body.data;
    await agent.post(api('/tasks')).send({ title: 'Open task' });
    await agent.patch(api(`/tasks/${t.id}`)).send({ status: 'COMPLETED' });
    await agent.post(api('/moods')).send({ mood: 'GOOD' });

    const o = (await agent.get(api('/analytics/overview'))).body.data;
    expect(o.tasks).toMatchObject({ total: 2, completed: 1, active: 1, completionRate: 50 });
    expect(o.streak.current).toBe(1);
    expect(o.weeklyCompletion.at(-1).completed).toBe(1);
    expect(o.mood.latest.mood).toBe('GOOD');
    expect(o.recentActivity.length).toBeGreaterThan(0);

    const p = (await agent.get(api('/analytics/productivity?days=7'))).body.data;
    expect(p.daily).toHaveLength(7);
    expect(p.heatmap).toHaveLength(56);
    expect(p.summary.tasksCompleted).toBe(1);
    expect(p.byPriority.find((x: { priority: string }) => x.priority === 'HIGH').count).toBe(1);

    const m = (await agent.get(api('/analytics/mood?days=7'))).body.data;
    expect(m.entries).toBe(1);
    expect(m.average).toBe(4);
    expect((await agent.get(api('/analytics/productivity?days=5'))).status).toBe(422);
  });

  it('exports only the user’s own data', async () => {
    const other = await newUser();
    await other.agent.post(api('/tasks')).send({ title: 'Not yours' });
    const { agent } = await newUser();
    await agent.post(api('/tasks')).send({ title: '=cmd|calc' });

    const json = await agent.get(api('/export?format=json'));
    expect(json.body.tasks).toHaveLength(1);
    expect(JSON.stringify(json.body)).not.toContain('Not yours');

    const csv = await agent.get(api('/export?format=csv&type=tasks'));
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain("'=cmd|calc"); // formula injection neutralised
  });
});

describe('Account', () => {
  it('updates profile and settings, then deletes the account with cascade', async () => {
    const { agent, user } = await newUser();
    const p = await agent.patch(api('/users/me')).send({ name: 'Renamed', bio: 'Hello' });
    expect(p.body.data).toMatchObject({ name: 'Renamed', bio: 'Hello' });
    expect((await agent.patch(api('/users/me')).send({ role: 'ADMIN' })).status).toBe(422); // mass-assignment blocked

    const s = await agent.patch(api('/users/me/settings')).send({ theme: 'DARK', timezone: 'Asia/Karachi', focusMinutes: 50 });
    expect(s.body.data).toMatchObject({ theme: 'DARK', timezone: 'Asia/Karachi', focusMinutes: 50 });
    expect((await agent.patch(api('/users/me/settings')).send({ timezone: 'Mars/Base' })).status).toBe(422);

    await agent.post(api('/tasks')).send({ title: 'will be deleted' });
    expect((await agent.delete(api('/users/me')).send({ password: 'wrong' })).status).toBe(422);
    await agent.delete(api('/users/me')).send({ password: 'Str0ngPass!' }).expect(200);
    expect(await prisma.task.count({ where: { userId: user.id } })).toBe(0);
    expect((await agent.get(api('/users/me'))).status).toBe(401);
  });
});
