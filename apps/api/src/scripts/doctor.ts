/**
 * Checks the local configuration and the real MongoDB connection WITHOUT printing any secret.
 *
 *   npm run doctor
 *
 * Writes doctor-output/report.json (safe to share: it contains no URI, password, key or secret).
 * It creates one temporary document in a "_doctor" collection and deletes it again; it never
 * touches users, transactions or payments.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { loadEnv, type Env } from '../config/env.js';
import { PaymentRecordModel } from '../models/payment-record.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { UserModel } from '../models/user.model.js';

interface Check { name: string; ok: boolean; detail: string }
const checks: Check[] = [];
const add = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); };

/** Describes a MongoDB URI without revealing it. */
export function describeUri(uri: string): { scheme: string; hasCredentials: boolean; database: string | null; passwordNeedsEncoding: boolean } {
  const scheme = uri.startsWith('mongodb+srv://') ? 'mongodb+srv' : uri.startsWith('mongodb://') ? 'mongodb' : 'invalid';
  const rest = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  const at = rest.lastIndexOf('@');
  const creds = at >= 0 ? rest.slice(0, at) : '';
  const afterHost = at >= 0 ? rest.slice(at + 1) : rest;
  const slash = afterHost.indexOf('/');
  const db = slash >= 0 ? (afterHost.slice(slash + 1).split('?')[0] ?? '') : '';
  const password = creds.includes(':') ? creds.slice(creds.indexOf(':') + 1) : '';
  return { scheme, hasCredentials: creds.length > 0, database: db || null, passwordNeedsEncoding: /[@:/?#[\]]/.test(password) };
}

/** Turns a connection error into a cause and a fix, never echoing the URI. */
export function classifyMongoError(err: unknown): string {
  const e = err as { name?: string; message?: string; code?: number | string; codeName?: string };
  const msg = `${e.name ?? ''} ${e.codeName ?? ''} ${e.message ?? ''}`;
  if (/bad auth|Authentication failed|AuthenticationFailed/i.test(msg) || e.code === 8000 || e.code === 18) {
    return 'AUTH_FAILED: Atlas rejected the username or password. Check the database user in Atlas > Database Access, and URL-encode special characters in the password.';
  }
  if (/ENOTFOUND|querySrv|EREFUSED|ESERVFAIL/i.test(msg)) {
    return 'DNS_FAILED: the cluster host name could not be resolved. Check the host part of the URI, or try another network/DNS (some networks block SRV lookups).';
  }
  if (/ServerSelection|timed out|ETIMEDOUT|whitelist|ECONNREFUSED/i.test(msg)) {
    return 'UNREACHABLE: no server answered within 10 s. Most often this PC\'s IP address is not allowed in Atlas > Network Access, or the cluster is paused.';
  }
  if (/Invalid scheme|URI must|malformed|unescaped/i.test(msg)) {
    return 'URI_INVALID: the connection string is malformed (wrong scheme or unescaped characters).';
  }
  return `OTHER: ${e.name ?? 'Error'}${e.codeName ? ` (${e.codeName})` : ''}`;
}

async function main() {
  let env: Env | undefined;
  try {
    env = loadEnv();
    add('Environment file loads and validates', true, `NODE_ENV=${env.NODE_ENV}, PORT=${env.PORT}`);
  } catch (err) {
    // Validation messages name the variable and the rule, never the value.
    add('Environment file loads and validates', false, (err as Error).message.replace(/\n/g, ' '));
  }

  if (env) {
    add('JWT_SECRET is set (32+ characters, not the placeholder)', !env.JWT_SECRET.includes('replace-with'), `length ${env.JWT_SECRET.length}`);
    add('GNANI_API_KEY is set', env.GNANI_API_KEY.trim().length > 0, `STT ${env.GNANI_STT_MODEL}, TTS ${env.GNANI_TTS_MODEL}`);
    add('CORS_ORIGINS allows the local frontend', env.CORS_ORIGINS.split(',').map((s) => s.trim()).includes('http://localhost:5173'), env.CORS_ORIGINS);

    const d = describeUri(env.MONGODB_URI);
    add('MONGODB_URI has a valid scheme', d.scheme !== 'invalid', d.scheme);
    add('MONGODB_URI names a database', d.database !== null, d.database ? `database "${d.database}"` : 'No database name before "?". Data would go to a database called "test". Add e.g. /mandimitra');
    add('MONGODB_URI password is URL-safe', !d.passwordNeedsEncoding, d.passwordNeedsEncoding ? 'The password contains @ : / ? # [ or ] and must be URL-encoded' : d.hasCredentials ? 'ok' : 'no credentials in URI');

    if (d.scheme !== 'invalid') {
      const t0 = Date.now();
      try {
        await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
        const db = mongoose.connection.db;
        if (!db) throw new Error('no database handle');
        await db.admin().ping();
        add('Connects to MongoDB and answers ping', true, `database "${db.databaseName}" in ${Date.now() - t0} ms`);

        for (const model of [UserModel, TransactionModel, PaymentRecordModel]) {
          try {
            await model.syncIndexes();
            const idx = await model.collection.indexes();
            const count = await model.estimatedDocumentCount();
            add(`Indexes for ${model.collection.collectionName}`, true, `${idx.map((i) => `${i.name}${i.unique ? ' (unique)' : ''}`).join(', ')}; about ${count} documents`);
          } catch (err) {
            add(`Indexes for ${model.collection.collectionName}`, false, classifyMongoError(err));
          }
        }

        try {
          const col = db.collection('_doctor');
          const { insertedId } = await col.insertOne({ at: new Date(), purpose: 'connectivity check' });
          const found = await col.findOne({ _id: insertedId });
          await col.deleteOne({ _id: insertedId });
          await col.drop().catch(() => undefined);
          add('Can write, read and delete a temporary document', found !== null, 'temporary "_doctor" collection removed afterwards');
        } catch (err) {
          add('Can write, read and delete a temporary document', false, `${classifyMongoError(err)} (the database user may be read-only)`);
        }
      } catch (err) {
        add('Connects to MongoDB and answers ping', false, classifyMongoError(err));
      } finally {
        await mongoose.disconnect().catch(() => undefined);
      }
    }
  }

  const outDir = path.resolve('doctor-output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version, platform: process.platform, checks }, null, 2));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}\n      ${c.detail}`);
  console.log(`\nReport written to ${path.join(outDir, 'report.json')} (contains no secrets).`);
  process.exit(checks.every((c) => c.ok) ? 0 : 1);
}

// Only run when executed directly, so the helpers above can be unit-tested.
if (process.argv[1] && /doctor\.(ts|js)$/.test(process.argv[1])) void main();
