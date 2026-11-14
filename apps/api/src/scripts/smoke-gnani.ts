/**
 * REAL Gnani API smoke test. Consumes a small amount of API credit.
 *
 *   npm run smoke:gnani -- --yes                       # TTS -> STT round trip with generated audio
 *   npm run smoke:gnani -- --yes --audio path/to.wav   # also transcribe your own recording
 *
 * Requires GNANI_API_KEY in apps/api/.env. Prints observed results only; nothing is simulated.
 * Round-trip steps FAIL unless the transcript contains the spoken numbers and every extracted
 * field equals the expected value; an HTTP success alone does not pass.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { validateAudio } from '../services/audio-validation.service.js';
import { extractTransaction } from '../services/extraction.service.js';
import { transcribe } from '../services/prisma.service.js';
import { synthesize } from '../services/timbre.service.js';

const args = process.argv.slice(2);
if (!args.includes('--yes')) {
  console.log('This calls the real Gnani APIs and uses credit. Re-run with --yes to proceed.');
  process.exit(0);
}
const e = env();
if (!e.GNANI_API_KEY) {
  console.error('GNANI_API_KEY is not set in apps/api/.env. Aborting.');
  process.exit(1);
}

const outDir = path.resolve('smoke-output');
mkdirSync(outDir, { recursive: true });
const results: { step: string; ok: boolean; detail: string; data?: Record<string, unknown> }[] = [];
/** Structured data from the step currently running, saved alongside its result. */
const current: { data?: Record<string, unknown> } = {};

/** What the generated test sentence says. A round trip only passes if extraction returns exactly this. */
const EXPECTED_DRAFT = {
  cropName: 'Wheat', quantity: 25, unit: 'quintal', ratePerUnit: 2400,
  commissionPercentage: 2, transportCharge: 500, otherDeductions: null, paymentStatus: 'pending',
} as const;
/** Numbers that must appear in the transcript as digits (format=transcribe turns spoken numbers into digits). */
const EXPECTED_NUMBERS = ['25', '2400', '2', '500'];

/** Compares a transcript and its extraction against the expected values; returns a list of problems. */
function checkAccuracy(transcript: string, draft: Record<string, unknown>, missing: readonly string[]): string[] {
  const problems: string[] = [];
  const numbers: string[] = transcript.replace(/(\d),(\d)/g, '$1$2').match(/\d+(\.\d+)?/g) ?? [];
  for (const n of EXPECTED_NUMBERS) if (!numbers.includes(n)) problems.push(`transcript is missing the number ${n}`);
  for (const [field, want] of Object.entries(EXPECTED_DRAFT)) {
    if (draft[field] !== want) problems.push(`${field}: expected ${JSON.stringify(want)}, got ${JSON.stringify(draft[field])}`);
  }
  if (missing.length) problems.push(`fields reported missing: ${missing.join(', ')}`);
  return problems;
}

async function step(name: string, fn: () => Promise<string>) {
  const t0 = Date.now();
  current.data = undefined;
  try {
    const detail = await fn();
    results.push({ step: name, ok: true, detail: `${detail} (${Date.now() - t0} ms)`, ...(current.data ? { data: current.data } : {}) });
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'ERROR';
    const upstream = (err as { details?: { upstreamCode?: string } }).details?.upstreamCode;
    results.push({ step: name, ok: false, detail: `${code}${upstream ? ` / ${upstream}` : ''}: ${(err as Error).message}`, ...(current.data ? { data: current.data } : {}) });
  }
}

const HINDI = 'पच्चीस क्विंटल गेहूं बेचा है, रेट 2400 रुपये प्रति क्विंटल है। 2 प्रतिशत कमीशन और 500 रुपये ट्रांसपोर्ट चार्ज काट लेना।';
const HINGLISH = 'Bhaiya, 25 quintal gehu becha hai, rate 2400 rupaye per quintal hai. 2 percent commission aur 500 rupaye transport charge kaat lena.';
const generated: Record<string, Buffer> = {};

console.log(`Gnani smoke test: STT=${e.GNANI_STT_MODEL} (format=${e.GNANI_STT_FORMAT}), TTS=${e.GNANI_TTS_MODEL}, base=${e.GNANI_BASE_URL}\n`);

for (const [lang, text] of [['hi', HINDI], ['hinglish', HINGLISH], ['en', 'Net payable ₹58,300. Is this correct?']] as const) {
  await step(`Timbre TTS (${lang})`, async () => {
    const r = await synthesize(text, lang);
    const file = path.join(outDir, `tts-${lang}.mp3`);
    writeFileSync(file, r.audio);
    generated[lang] = r.audio;
    return `${r.audio.length} bytes ${r.contentType}, voice=${r.voice}, saved ${file}`;
  });
}

for (const lang of ['hi', 'hinglish'] as const) {
  const audio = generated[lang];
  if (!audio) continue;
  await step(`Prisma STT round trip (${lang} TTS audio)`, async () => {
    const meta = validateAudio(audio);
    const r = await transcribe(audio, meta, { language: lang });
    const x = extractTransaction(r.transcript);
    const problems = checkAccuracy(r.transcript, x.draft, x.missingFields);
    current.data = { transcript: r.transcript, detected: r.detectedLanguageCode, extracted: x.draft, expected: EXPECTED_DRAFT, warnings: x.warnings, problems };
    // A successful HTTP response is not enough: the content has to match what was spoken.
    if (problems.length) throw Object.assign(new Error(`transcript="${r.transcript}" | ${problems.join('; ')}`), { code: 'ACCURACY_MISMATCH' });
    return `transcript and all ${Object.keys(EXPECTED_DRAFT).length} extracted fields match the spoken sentence | transcript="${r.transcript}" detected=${r.detectedLanguageCode ?? '-'}`;
  });
}

if (generated.hi) {
  await step('Prisma STT auto language detection (indic-auto)', async () => {
    const audio = generated.hi as Buffer;
    const r = await transcribe(audio, validateAudio(audio), { language: 'auto' });
    const x = extractTransaction(r.transcript);
    const problems = checkAccuracy(r.transcript, x.draft, x.missingFields);
    if (r.detectedLanguageCode !== 'hi-IN') problems.push(`detected language: expected hi-IN, got ${r.detectedLanguageCode ?? 'none'}`);
    current.data = { transcript: r.transcript, detected: r.detectedLanguageCode, extracted: x.draft, expected: EXPECTED_DRAFT, problems };
    if (problems.length) throw Object.assign(new Error(`transcript="${r.transcript}" | ${problems.join('; ')}`), { code: 'ACCURACY_MISMATCH' });
    return `detected hi-IN; transcript and extracted fields match | transcript="${r.transcript}"`;
  });
}

const audioIdx = args.indexOf('--audio');
if (audioIdx >= 0 && args[audioIdx + 1]) {
  const file = path.resolve(args[audioIdx + 1] as string);
  await step(`Prisma STT on ${path.basename(file)}`, async () => {
    const audio = readFileSync(file);
    const r = await transcribe(audio, validateAudio(audio), { language: 'hinglish' });
    const x = extractTransaction(r.transcript);
    current.data = { transcript: r.transcript, detected: r.detectedLanguageCode, extracted: x.draft, missing: x.missingFields, warnings: x.warnings };
    // Your own recording has no known expected values, so this step reports what was heard without judging it.
    return `NOT CHECKED AGAINST EXPECTED VALUES | transcript="${r.transcript}" | extracted=${JSON.stringify(x.draft)} missing=[${x.missingFields}] warnings=${JSON.stringify(x.warnings)}`;
  });
}

await step('Invalid API key is rejected', async () => {
  const real = e.GNANI_API_KEY;
  (e as { GNANI_API_KEY: string }).GNANI_API_KEY = 'invalid-key-for-smoke-test';
  try {
    await synthesize('test', 'en');
    throw new Error('Expected an authentication error but the call succeeded');
  } catch (err) {
    if ((err as { code?: string }).code !== 'GNANI_AUTH_FAILED') throw err;
    return 'got GNANI_AUTH_FAILED as expected';
  } finally {
    (e as { GNANI_API_KEY: string }).GNANI_API_KEY = real;
  }
});

console.log('Results:');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.step}\n      ${r.detail}`);
writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
