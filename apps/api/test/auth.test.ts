import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { UserModel } from '../src/models/user.model.js';
import { app, auth, registerUser, useDatabase } from './helpers.js';

useDatabase();

describe('authentication', () => {
  it('registers a user, hashes the password and never returns it', async () => {
    const { token, user, email, password } = await registerUser({ role: 'trader', preferredLanguage: 'en' });
    expect(token).toBeTruthy();
    expect(user).toMatchObject({ email, role: 'trader', preferredLanguage: 'en', isDemo: false });
    expect(JSON.stringify(user)).not.toContain('password');
    const stored = await UserModel.findOne({ email }).select('+passwordHash');
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(stored?.passwordHash).not.toContain(password);
  });

  it('rejects duplicate emails and invalid input', async () => {
    const { email } = await registerUser();
    const dup = await request(app).post('/api/auth/register').send({ name: 'X Y', email, password: 'whatever-123' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
    const bad = await request(app).post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'short' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not allow self-registration as administrator', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Eve Admin', email: 'eve@example.test', password: 'password-123', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials only', async () => {
    const { email, password } = await registerUser();
    const ok = await request(app).post('/api/auth/login').send({ email: email.toUpperCase(), password });
    expect(ok.status).toBe(200);
    const bad = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.test', password: 'wrong-password' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(bad.body.error.message);
  });

  it('rejects NoSQL operator injection in login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('protects /me and invalidates tokens on logout', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth('garbage.token.value'))).status).toBe(401);
    const { token } = await registerUser();
    expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').set(auth(token))).status).toBe(204);
    expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(401);
  });

  it('updates profile language', async () => {
    const { token } = await registerUser();
    const res = await request(app).patch('/api/auth/me').set(auth(token)).send({ preferredLanguage: 'mr' });
    expect(res.body.user.preferredLanguage).toBe('mr');
    const bad = await request(app).patch('/api/auth/me').set(auth(token)).send({ role: 'admin' });
    expect(bad.status).toBe(400);
  });

  it('provides a labelled demo account with synthetic data', async () => {
    const res = await request(app).post('/api/auth/demo').expect(200);
    expect(res.body.user.isDemo).toBe(true);
    const list = await request(app).get('/api/transactions').set(auth(res.body.token));
    expect(list.body.total).toBe(10);
  });
});

describe('health', () => {
  it('reports status without exposing secrets', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.gnani.configured).toBe(true);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(process.env.GNANI_API_KEY);
    expect(text).not.toContain(process.env.JWT_SECRET);
  });
});
