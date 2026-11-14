import type { ZodType } from 'zod';

/** Parses untrusted input; throws ZodError (-> 400) on failure. */
export function parse<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
