import { Router } from 'express';
import { loginSchema, profileUpdateSchema, registerSchema } from '@mandimitra/shared';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rate-limit.js';
import { toPublicUser } from '../models/user.model.js';
import { authenticate, registerUser, signToken } from '../services/auth.service.js';
import { getOrCreateDemoUser, resetDemoData } from '../services/demo.service.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const input = parse(registerSchema, req.body);
  const user = await registerUser(input);
  res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await authenticate(email, password);
  res.json({ token: signToken(user), user: toPublicUser(user) });
});

authRouter.post('/demo', authLimiter, async (_req, res) => {
  if (!env().DEMO_MODE_ENABLED) throw new AppError(403, 'DEMO_DISABLED', 'The demo account is disabled on this server.');
  const user = await getOrCreateDemoUser();
  res.json({ token: signToken(user), user: toPublicUser(user) });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(currentUser(req)) });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const patch = parse(profileUpdateSchema, req.body);
  user.set(patch);
  await user.save();
  res.json({ user: toPublicUser(user) });
});

/** Invalidates every token issued to this user. */
authRouter.post('/logout', requireAuth, async (req, res) => {
  const user = currentUser(req);
  if (!user.isDemo) {
    user.tokenVersion += 1;
    await user.save();
  }
  res.status(204).end();
});

authRouter.post('/demo/reset', requireAuth, async (req, res) => {
  const user = currentUser(req);
  if (!user.isDemo) throw new AppError(403, 'FORBIDDEN', 'Only the demo account can be reset.');
  await resetDemoData(user);
  res.status(204).end();
});
