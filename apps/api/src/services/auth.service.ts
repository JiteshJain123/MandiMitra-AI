import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { RegisterInput } from '@mandimitra/shared';
import { env } from '../config/env.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { UserModel, type UserDoc } from '../models/user.model.js';

const BCRYPT_ROUNDS = 12;

export interface TokenPayload {
  sub: string;
  ver: number;
}

export function signToken(user: UserDoc): string {
  const payload: TokenPayload = { sub: user._id.toString(), ver: user.tokenVersion };
  return jwt.sign(payload, env().JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env().JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'mandimitra-api',
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env().JWT_SECRET, { algorithms: ['HS256'], issuer: 'mandimitra-api' });
    if (typeof decoded !== 'object' || typeof decoded.sub !== 'string' || typeof decoded.ver !== 'number') throw new Error('bad payload');
    return { sub: decoded.sub, ver: decoded.ver };
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function registerUser(input: Required<Omit<RegisterInput, 'role' | 'preferredLanguage'>> & Pick<RegisterInput, 'role' | 'preferredLanguage'>) {
  const exists = await UserModel.exists({ email: input.email });
  if (exists) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: input.role ?? 'farmer',
    preferredLanguage: input.preferredLanguage ?? 'hi',
  });
  return user;
}

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export async function authenticate(email: string, password: string): Promise<UserDoc> {
  const user = await UserModel.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  return user;
}
