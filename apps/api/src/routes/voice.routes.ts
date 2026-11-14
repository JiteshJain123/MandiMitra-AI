import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { LANGUAGE_CODES, MAX_AUDIO_BYTES } from '@mandimitra/shared';
import { parse } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { voiceLimiter } from '../middleware/rate-limit.js';
import { validateAudio } from '../services/audio-validation.service.js';
import { extractTransaction } from '../services/extraction.service.js';
import { transcribe } from '../services/prisma.service.js';
import { speechLanguageFor } from '../services/speech-text.service.js';
import { MAX_TTS_CHARS, synthesize } from '../services/timbre.service.js';
import { answerQuestion } from '../services/voice-query.service.js';

// Audio is held in memory only for the duration of the request and never written to disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 5 } });

export const voiceRouter = Router();
voiceRouter.use(requireAuth);

const languageField = z.object({ language: z.enum([...LANGUAGE_CODES, 'auto'] as [string, ...string[]]).optional() });

voiceRouter.post('/transcribe', voiceLimiter, upload.single('audio'), async (req, res) => {
  const user = currentUser(req);
  const { language } = parse(languageField, req.body ?? {});
  const audio = req.file?.buffer;
  const meta = validateAudio(audio);
  const result = await transcribe(audio as Buffer, meta, { language: language ?? user.preferredLanguage });
  const extraction = result.transcript ? extractTransaction(result.transcript) : null;
  res.json({
    transcript: result.transcript,
    requestId: result.requestId,
    model: result.model,
    detectedLanguageCode: result.detectedLanguageCode,
    languageCodeSent: result.languageCodeSent,
    truncated: result.truncated,
    processingTimeSeconds: result.processingTimeSeconds,
    audio: { format: meta.format, durationSeconds: meta.durationSeconds },
    extraction,
  });
});

const extractSchema = z.object({ transcript: z.string().trim().min(1, 'Transcript is empty').max(2000) }).strict();

voiceRouter.post('/extract', async (req, res) => {
  const { transcript } = parse(extractSchema, req.body);
  res.json(extractTransaction(transcript));
});

const speakSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_CHARS),
  language: z.enum(LANGUAGE_CODES).optional(),
}).strict();

voiceRouter.post('/speak', voiceLimiter, async (req, res) => {
  const user = currentUser(req);
  const { text, language } = parse(speakSchema, req.body);
  const out = await synthesize(text, language ?? speechLanguageFor(user.preferredLanguage));
  res.setHeader('Content-Type', out.contentType);
  res.setHeader('Content-Length', String(out.audio.length));
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-TTS-Voice', out.voice);
  res.send(out.audio);
});

const querySchema = z.object({ question: z.string().trim().min(1).max(500) }).strict();

voiceRouter.post('/query', async (req, res) => {
  const user = currentUser(req);
  const { question } = parse(querySchema, req.body);
  const lang = speechLanguageFor(user.preferredLanguage);
  const answer = await answerQuestion(user._id.toString(), question, lang);
  res.json({ ...answer, speechLanguage: lang });
});
