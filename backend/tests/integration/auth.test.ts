import request from 'supertest';
import { prisma } from '../../src/lib/prisma';
import { api, app, newUser, PASSWORD, uniqueEmail } from './helpers';

afterAll(() => prisma.$disconnect());

describe('Authentication', () => {
  it('registers a user with the default USER role and hashes the password', async () => {
    const email = uniqueEmail();
    const res = await request(app).post(api('/auth/register')).send({ name: 'Alice', email, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email, role: 'USER', status: 'ACTIVE' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);

    const row = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(row.passwordHash).not.toBe(PASSWORD);
    expect(row.passwordHash.startsWith('$2')).toBe(true); // bcrypt
    expect(await prisma.userSettings.count({ where: { userId: row.id } })).toBe(1);
  });

  it('rejects invalid registration input with field errors', async () => {
    const res = await request(app).post(api('/auth/register')).send({ name: 'A', email: 'not-an-email', password: 'weak' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('rejects duplicate emails (case-insensitive)', async () => {
    const { email } = await newUser();
    const res = await request(app).post(api('/auth/register')).send({ name: 'Bob', email: email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it('logs in with valid credentials and rejects wrong passwords with a generic message', async () => {
    const { email } = await newUser();
    const good = await request(app).post(api('/auth/login')).send({ email, password: PASSWORD });
    expect(good.status).toBe(200);

    const bad = await request(app).post(api('/auth/login')).send({ email, password: 'Wrong1234' });
    const unknown = await request(app).post(api('/auth/login')).send({ email: uniqueEmail(), password: 'Wrong1234' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.error.message).toBe(unknown.body.error.message);
  });

  it('protects endpoints and rejects invalid tokens', async () => {
    expect((await request(app).get(api('/users/me'))).status).toBe(401);
    expect((await request(app).get(api('/users/me')).set('Authorization', 'Bearer not.a.jwt')).status).toBe(401);
  });

  it('supports Bearer tokens as well as cookies', async () => {
    const { token, email } = await newUser();
    const res = await request(app).get(api('/users/me')).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(email);
  });

  it('logout clears the cookie; logout-all revokes existing tokens', async () => {
    const { agent, token } = await newUser();
    const out = await agent.post(api('/auth/logout'));
    expect(out.headers['set-cookie'][0]).toMatch(/nt_token=;/);

    // token still valid until logout-all
    expect((await request(app).get(api('/users/me')).set('Authorization', `Bearer ${token}`)).status).toBe(200);
    await request(app).post(api('/auth/logout-all')).set('Authorization', `Bearer ${token}`).expect(200);
    expect((await request(app).get(api('/users/me')).set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('runs the full password-reset flow with single-use, hashed tokens', async () => {
    const { email, token: oldToken } = await newUser();
    const forgot = await request(app).post(api('/auth/forgot-password')).send({ email });
    expect(forgot.status).toBe(200);
    const resetUrl: string = forgot.body.data.devResetUrl;
    const rawToken = new URL(resetUrl).searchParams.get('token')!;

    // Only the hash is stored
    expect(await prisma.passwordResetToken.count({ where: { tokenHash: rawToken } })).toBe(0);

    const reset = await request(app).post(api('/auth/reset-password')).send({ token: rawToken, password: 'NewPassw0rd' });
    expect(reset.status).toBe(200);

    // single use
    const again = await request(app).post(api('/auth/reset-password')).send({ token: rawToken, password: 'An0therPass' });
    expect(again.status).toBe(400);

    // old sessions revoked, new password works
    expect((await request(app).get(api('/users/me')).set('Authorization', `Bearer ${oldToken}`)).status).toBe(401);
    expect((await request(app).post(api('/auth/login')).send({ email, password: 'NewPassw0rd' })).status).toBe(200);
  });

  it('does not reveal whether an email exists on forgot-password', async () => {
    const res = await request(app).post(api('/auth/forgot-password')).send({ email: uniqueEmail() });
    expect(res.status).toBe(200);
    expect(res.body.data.devResetUrl).toBeUndefined();
  });

  it('rejects expired reset tokens', async () => {
    const { email } = await newUser();
    const forgot = await request(app).post(api('/auth/forgot-password')).send({ email });
    const rawToken = new URL(forgot.body.data.devResetUrl).searchParams.get('token')!;
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await request(app).post(api('/auth/reset-password')).send({ token: rawToken, password: 'NewPassw0rd' });
    expect(res.status).toBe(400);
  });

  it('changes password with current-password verification', async () => {
    const { agent } = await newUser();
    const wrong = await agent.patch(api('/users/me/password')).send({ currentPassword: 'nope', newPassword: 'N3wPassword' });
    expect(wrong.status).toBe(422);
    const right = await agent.patch(api('/users/me/password')).send({ currentPassword: PASSWORD, newPassword: 'N3wPassword' });
    expect(right.status).toBe(200);
    // this browser stays signed in (cookie re-issued)
    expect((await agent.get(api('/users/me'))).status).toBe(200);
  });

  it('rate-limits repeated login attempts', async () => {
    process.env.RATE_LIMIT_IN_TESTS = 'true';
    try {
      const email = uniqueEmail('ratelimit');
      let last = 0;
      for (let i = 0; i < 25; i++) {
        last = (await request(app).post(api('/auth/login')).set('X-Forwarded-For', '203.0.113.77').send({ email, password: 'Wrong1234' })).status;
      }
      expect(last).toBe(429);
    } finally {
      delete process.env.RATE_LIMIT_IN_TESTS;
    }
  });
});
