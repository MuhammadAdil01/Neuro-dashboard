import request from 'supertest';
import { createApp } from '../../src/app';

export const app = createApp();
export const api = (path: string) => `/api/v1${path}`;

let counter = 0;
export const uniqueEmail = (prefix = 'user') => `${prefix}.${Date.now()}.${process.pid}.${counter++}@test.neurotask.app`;

export const PASSWORD = 'Str0ngPass!';

/** Registers a fresh user and returns a cookie-carrying agent plus the user. */
export async function newUser(name = 'Test User') {
  const agent = request.agent(app);
  const email = uniqueEmail();
  const res = await agent.post(api('/auth/register')).send({ name, email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.data.user as { id: string; email: string }, token: res.body.data.token as string, email };
}

export async function adminAgent() {
  const agent = request.agent(app);
  const res = await agent.post(api('/auth/login')).send({
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@neurotask.app',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
  });
  if (res.status !== 200) throw new Error(`admin login failed (did you run the seed?): ${JSON.stringify(res.body)}`);
  return agent;
}
