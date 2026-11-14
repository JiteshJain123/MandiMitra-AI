import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDb } from '../src/db.js';

export const app = createApp();

export function useDatabase() {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) await connectDb(process.env.MONGODB_URI as string);
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

let n = 0;
export async function registerUser(overrides: Record<string, unknown> = {}) {
  n += 1;
  const body = { name: 'Test Farmer', email: `farmer${n}-${Date.now()}@example.test`, password: 'correct-horse-9', ...overrides };
  const res = await request(app).post('/api/auth/register').send(body).expect(201);
  return { token: res.body.token as string, user: res.body.user, password: body.password, email: body.email as string };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const WHEAT = {
  cropName: 'Wheat', quantity: 25, unit: 'quintal', ratePerUnit: 2400, commissionPercentage: 2, transportCharge: 500, otherDeductions: 0,
};

/** A valid 16 kHz mono 16-bit PCM WAV of the given length (silence). */
export function makeWav(seconds = 1, sampleRate = 16000): Buffer {
  const dataSize = Math.round(seconds * sampleRate) * 2;
  const b = Buffer.alloc(44 + dataSize);
  b.write('RIFF', 0, 'latin1'); b.writeUInt32LE(36 + dataSize, 4); b.write('WAVE', 8, 'latin1');
  b.write('fmt ', 12, 'latin1'); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'latin1'); b.writeUInt32LE(dataSize, 40);
  return b;
}
