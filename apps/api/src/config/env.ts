import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  GNANI_API_KEY: z.string().optional().default(''),
  GNANI_STT_MODEL: z.string().default('prisma-v3.0'),
  GNANI_TTS_MODEL: z.string().default('timbre-v2.5'),
  GNANI_BASE_URL: z.string().url().default('https://api.vachana.ai'),
  GNANI_STT_FORMAT: z.enum(['transcribe', 'verbatim', 'codemix', 'transliterate']).default('transcribe'),
  GNANI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  DEMO_MODE_ENABLED: bool.default(true),
  DEFAULT_PAYMENT_TERM_DAYS: z.coerce.number().int().min(0).max(365).default(15),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET.includes('replace-with')) {
    throw new Error('JWT_SECRET still has the placeholder value');
  }
  return parsed.data;
}

export function env(): Env {
  cached ??= loadEnv();
  return cached;
}

/** Test helper: forget cached env so tests can change process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
