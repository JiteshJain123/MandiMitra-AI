import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request } from 'express';

const json = (code: string, message: string) => ({ error: { code, message } });
const skip = () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false, skip,
  message: json('RATE_LIMITED', 'Too many requests. Please slow down.'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, skip,
  message: json('RATE_LIMITED', 'Too many sign-in attempts. Please try again in a few minutes.'),
});

/** Gnani calls consume credits, so they are limited per user. */
export const voiceLimiter = rateLimit({
  windowMs: 10 * 60_000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false, skip,
  keyGenerator: (req: Request) => req.user?._id.toString() ?? ipKeyGenerator(req.ip ?? '0.0.0.0'),
  message: json('RATE_LIMITED', 'Too many voice requests. Please wait a few minutes.'),
});
