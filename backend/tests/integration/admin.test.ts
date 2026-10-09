import request from 'supertest';
import { prisma } from '../../src/lib/prisma';
import { adminAgent, api, app, newUser, PASSWORD } from './helpers';

afterAll(async () => {
  // restore defaults changed by these tests
  const admin = await adminAgent();
  await admin.patch(api('/admin/settings')).send({ allowRegistration: true, maintenanceMode: false, announcement: '' });
  await prisma.$disconnect();
});

describe('Admin panel', () => {
  it('returns dashboard stats and paginated, searchable users', async () => {
    const admin = await adminAgent();
    const { email } = await newUser('Searchable Person');

    const stats = await admin.get(api('/admin/stats'));
    expect(stats.status).toBe(200);
    expect(stats.body.data.users.total).toBeGreaterThan(0);
    expect(stats.body.data.trend).toHaveLength(14);

    const users = await admin.get(api(`/admin/users?search=${encodeURIComponent(email)}`));
    expect(users.body.meta.total).toBe(1);
    expect(users.body.data[0]).toMatchObject({ email, role: 'USER' });
    expect(users.body.data[0].passwordHash).toBeUndefined();
  });

  it('shows user details as aggregates only (no private content)', async () => {
    const admin = await adminAgent();
    const { agent, user } = await newUser();
    await agent.post(api('/notes')).send({ title: 'Very private', body: 'secret body' });
    const res = await admin.get(api(`/admin/users/${user.id}`));
    expect(res.body.data.stats.notes).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain('secret body');
  });

  it('deactivates a user, which immediately revokes their session and blocks login', async () => {
    const admin = await adminAgent();
    const { agent, user, email } = await newUser();
    await admin.patch(api(`/admin/users/${user.id}/status`)).send({ status: 'INACTIVE' }).expect(200);

    expect((await agent.get(api('/users/me'))).status).toBe(401);
    expect((await request(app).post(api('/auth/login')).send({ email, password: PASSWORD })).status).toBe(403);

    await admin.patch(api(`/admin/users/${user.id}/status`)).send({ status: 'ACTIVE' }).expect(200);
    expect((await request(app).post(api('/auth/login')).send({ email, password: PASSWORD })).status).toBe(200);

    const logs = await admin.get(api(`/admin/activity-logs?action=admin.`));
    expect(logs.body.data.some((l: { action: string }) => l.action === 'admin.user_status_changed')).toBe(true);
  });

  it('prevents admins from demoting or deactivating themselves', async () => {
    const admin = await adminAgent();
    const me = (await admin.get(api('/users/me'))).body.data;
    expect((await admin.patch(api(`/admin/users/${me.id}/status`)).send({ status: 'INACTIVE' })).status).toBe(400);
    expect((await admin.patch(api(`/admin/users/${me.id}/role`)).send({ role: 'USER' })).status).toBe(400);
  });

  it('promotes a user to admin', async () => {
    const admin = await adminAgent();
    const { user, email } = await newUser();
    await admin.patch(api(`/admin/users/${user.id}/role`)).send({ role: 'ADMIN' }).expect(200);
    const login = await request(app).post(api('/auth/login')).send({ email, password: PASSWORD });
    expect(login.body.data.user.role).toBe('ADMIN');
    await admin.patch(api(`/admin/users/${user.id}/role`)).send({ role: 'USER' }).expect(200);
  });

  it('manages global categories', async () => {
    const admin = await adminAgent();
    const name = `Global ${Date.now()}`;
    const created = await admin.post(api('/categories')).send({ name, color: '#ff0000', global: true });
    expect(created.body.data.scope).toBe('global');

    const { agent } = await newUser();
    expect((await agent.get(api('/categories'))).body.data.some((c: { name: string }) => c.name === name)).toBe(true);

    await admin.patch(api(`/categories/${created.body.data.id}`)).send({ isActive: false }).expect(200);
    expect((await agent.get(api('/categories'))).body.data.some((c: { name: string }) => c.name === name)).toBe(false);
    expect((await agent.post(api('/tasks')).send({ title: 'x', categoryId: created.body.data.id })).status).toBe(400);

    const list = await admin.get(api('/admin/categories'));
    expect(list.body.data.some((c: { name: string }) => c.name === name)).toBe(true);
    await admin.delete(api(`/categories/${created.body.data.id}`)).expect(204);
  });

  it('controls registration and maintenance mode via system settings', async () => {
    const admin = await adminAgent();
    await admin.patch(api('/admin/settings')).send({ allowRegistration: false }).expect(200);
    const blocked = await request(app).post(api('/auth/register')).send({ name: 'Late', email: `late${Date.now()}@x.io`, password: PASSWORD });
    expect(blocked.status).toBe(403);
    await admin.patch(api('/admin/settings')).send({ allowRegistration: true }).expect(200);

    const { agent } = await newUser();
    await admin.patch(api('/admin/settings')).send({ maintenanceMode: true }).expect(200);
    expect((await agent.get(api('/tasks'))).status).toBe(503);
    expect((await admin.get(api('/admin/stats'))).status).toBe(200); // admins still work
    await admin.patch(api('/admin/settings')).send({ maintenanceMode: false }).expect(200);
    expect((await agent.get(api('/tasks'))).status).toBe(200);

    expect((await admin.patch(api('/admin/settings')).send({ defaultFocusMinutes: 1 })).status).toBe(422);
  });

  it('broadcasts system notifications and reads contact messages', async () => {
    const admin = await adminAgent();
    const { agent } = await newUser();
    const b = await admin.post(api('/admin/notifications/broadcast')).send({ title: 'Maintenance', message: 'Tonight at 10pm' });
    expect(b.body.data.recipients).toBeGreaterThan(0);
    const notes = await agent.get(api('/notifications'));
    expect(notes.body.data.some((n: { title: string }) => n.title === 'Maintenance')).toBe(true);

    await request(app).post(api('/public/contact')).send({ name: 'Visitor', email: 'v@example.com', subject: 'Hello', message: 'I love this project!' }).expect(201);
    const msgs = await admin.get(api('/admin/messages'));
    expect(msgs.body.data[0].subject).toBeDefined();
  });

  it('produces reports for a selected range', async () => {
    const admin = await adminAgent();
    const res = await admin.get(api('/admin/reports?days=30'));
    expect(res.body.data.daily).toHaveLength(30);
    expect(res.body.data.daily.at(-1).totalUsers).toBeGreaterThan(0);
  });
});
