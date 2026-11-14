import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/errors.js';
import { UserModel, type UserDoc } from '../models/user.model.js';
import { verifyToken } from '../services/auth.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDoc;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  const payload = verifyToken(header.slice(7));
  const user = await UserModel.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.ver) throw unauthorized('Your session has ended. Please sign in again.');
  req.user = user;
  next();
}

/** Returns the authenticated user; only call after requireAuth. */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw unauthorized();
  return req.user;
}
