import { inject } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = `${inject('mongoUri').replace(/\/$/, '')}/mandimitra-test-${process.pid}`;
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.GNANI_API_KEY = 'test-key-not-real';
process.env.GNANI_BASE_URL = 'https://gnani.test';
process.env.GNANI_TIMEOUT_MS = '2000';
process.env.DEMO_MODE_ENABLED = 'true';
