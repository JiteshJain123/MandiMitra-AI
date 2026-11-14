import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

 
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    // Upstream details (e.g. Gnani error codes) are useful to clients; they never contain secrets.
    const safeDetails = err.details && typeof err.details === 'object' && 'upstreamCode' in err.details
      ? { upstreamCode: (err.details as { upstreamCode: string }).upstreamCode }
      : err.details;
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...(safeDetails !== undefined && { details: safeDetails }) } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues[0]?.message ?? 'Invalid input',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooBig ? 413 : 400).json({ error: { code: tooBig ? 'AUDIO_TOO_LARGE' : 'UPLOAD_ERROR', message: tooBig ? 'Audio file is too large.' : 'Invalid upload.' } });
    return;
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
    return;
  }
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
    return;
  }
  if ((err as { name?: string })?.name === 'CastError') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid identifier.' } });
    return;
  }
  logger.error('Unhandled error', { path: req.path, method: req.method, error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
}
