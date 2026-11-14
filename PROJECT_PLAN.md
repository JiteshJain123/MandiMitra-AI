# MandiMitra AI — Project Plan

_Last updated: 2026-11-13 (IST)_

## 1. Environment findings

| Item | Finding | Consequence |
|---|---|---|
| Project folder (MandiMitra AI project root) | Empty | Greenfield build |
| Build workspace | Linux cloud sandbox, Node 22.23, npm 10.9, Git 2.43, Docker 29, ffmpeg | Code is built, linted, tested here |
| Shell on your PC | **Not available** (file copy only) | I cannot run `npm`/`git` on your PC; files are copied into your folder |
| Network to `api.vachana.ai` (Gnani) | **Blocked from the sandbox** | Real Prisma/Timbre calls can only be made from your PC. Sandbox tests use mocks only |
| MongoDB | Not installed in sandbox | Tests use `mongodb-memory-server`; local dev uses Docker (`docker-compose`) or Atlas |
| GitHub auth in sandbox | None | Push needs a repo you create and grant access to |

## 2. Verified Gnani API facts (docs.gnani.ai, read 2026-11-13)

### Prisma STT — REST
- `POST https://api.vachana.ai/stt/v3`, `multipart/form-data`, header `X-API-Key-ID`.
- Fields: `audio_file` (required), `model=prisma-v3.0`, `language_code` (`hi-IN`, `en-IN`, `bn-IN`, `gu-IN`, `kn-IN`, `ml-IN`, `mr-IN`, `pa-IN`, `ta-IN`, `te-IN`; v3.0 also `indic-auto` or up to 4 comma-separated codes, e.g. `hi-IN,en-IN`), `format` (`verbatim` | `transcribe` (ITN) | `codemix` | `transliterate`), `keyterms` (v3.0, ≤200).
- Audio: WAV, MP3, OGG, FLAC, AAC, M4A. **Max 30 s.** Resampled to 16 kHz mono server-side.
- 200: `{ success, request_id, transcript, model, detected_language_code?, truncated?, processing_time, end_to_end_latency }`. Empty transcript is **not** an error.
- Errors: three body shapes (`{success:false,error:{type,message}}`, `{detail:[...]}` for 422, `{detail:{error_code,message,status_code}}` for 401/402/403/429) plus 504 `UPSTREAM_TIMEOUT`. No `Retry-After` on 429.

### Timbre TTS — REST
- `POST https://api.vachana.ai/api/v1/tts/inference`, JSON, header `X-API-Key-ID`.
- Body: `text`, `model` (`timbre-v2.5`), `voice` (must belong to model catalogue), `language` (`hi-IN`, `en-IN`, …, `hi-en` Hinglish, `auto`), `speed` 0.85–1.15, `audio_config` `{ sample_rate, container: wav|mp3|ogg|…, encoding, bitrate }`.
- 200 returns **raw binary audio** (e.g. `audio/mpeg` for mp3). Errors: `{success:false,message,status_code}` (400/500) or `{detail:{…}}` (401/402/403/429). Overlong text → 500.
- timbre-v2.5 voices have **one preferred language each**. Defaults chosen: Hindi → `Nalini` (hi-IN), English → `Devika` (en-IN), Hinglish → `Poorvi` (hi-en); full per-language map in `timbre.service.ts`.

## 3. Technical risks (ranked)

1. **Browser audio format mismatch (P0 blocker if ignored).** Chrome/Edge `MediaRecorder` produces WebM/Opus, which Prisma does **not** accept. Plan: capture PCM via Web Audio and encode **16 kHz mono WAV in the browser**. No server-side ffmpeg dependency. Uploads are still validated server-side by magic bytes.
2. **30-second hard limit.** Recorder auto-stops at 29 s; backend rejects longer WAVs by parsing the header.
3. **Transcript script/number form.** Hindi output may be Devanagari with numbers as words ("पच्चीस क्विंटल"). Mitigation: request `format=transcribe` (ITN → digits) by default; the parser handles Devanagari + Latin crop names, Hindi number words as fallback, and units (quintal/क्विंटल/kg/ton). Real-world accuracy must be measured on your PC with real audio. I will not quote accuracy numbers before that.
4. **Extraction is deterministic, not an LLM.** No LLM provider is in scope or keyed; Evon is optional and not wired as a dependency. Missing fields are returned as `null` and flagged for the user, never guessed.
5. **Real-API verification only on your PC.** Every Gnani call I write is tested against mocked responses built from the documented shapes. You run `npm run smoke:gnani` locally to verify for real.
6. **Deployment needs your accounts** (Vercel, Render, MongoDB Atlas, GitHub secrets). I'll prepare config; I won't call it deployed until it is.
7. **Git history location.** Files copied to your folder do not carry Git history. See decision below.

## 4. Architecture (summary)

```
apps/
  web/     React 18 + Vite + TS + Tailwind + shadcn/ui + TanStack Query + RHF + Zod + Recharts
  api/     Express + TS + Mongoose + Zod
    src/services/prisma.service.ts         STT (multipart, timeout, error normalisation)
    src/services/timbre.service.ts         TTS (binary audio, voice/language map)
    src/services/audio-validation.service.ts  magic bytes, size, WAV duration
    src/services/extraction.service.ts     transcript → TransactionDraft (Zod)
    src/services/calculation.service.ts    decimal-safe money math (integer paise / decimal.js)
    src/services/voice-query.service.ts    intent → fixed, parameterised Mongo queries
packages/
  shared/  Zod schemas + types shared by web and api
```
- Money is stored as integer paise; computed only on the backend.
- Transactions have `status: draft | confirmed`; only `confirmed` count as finalised; `idempotencyKey` (unique per user) prevents duplicates from retries/offline sync.
- Voice queries map to a **whitelist of intents** (pending total, crop sales for period, unpaid list). No AI-generated query is ever executed.
- Audio is processed in memory and never written to disk or DB unless the user opts in.

## 5. Phases & status

| # | Phase | Priority | Status |
|---|---|---|---|
| 0 | Environment inspection, docs review, plan | — | ✅ Done |
| 1 | Monorepo foundation, shared schemas, lint/TS/test tooling | P0 | ✅ Done |
| 2 | Backend: config, security middleware, auth, models, health | P0 | ✅ Done, tested |
| 3 | Calculation + extraction services | P0 | ✅ Done, 36 unit tests (7 calculation + 29 extraction, as of 2026-11-14) |
| 4 | Prisma / Timbre / audio-validation services | P0 | ✅ Done, 22 tests (mocked); **real API not yet verified** |
| 5 | Transaction API (confirm-before-save, CRUD, CSV, PDF) | P0 | ✅ Done, tested |
| 6 | Frontend: design system, auth, dashboard shell | P0 | ✅ Done |
| 7 | Voice page (WAV recorder) → review → TTS → confirm → receipt | P0 | ✅ Done, E2E tested with mock Gnani |
| 8 | History, payments, voice queries, analytics | P1 | ✅ Done, tested |
| 9 | Playwright E2E, CI workflow, Docker | P0/P1 | ✅ E2E + CI done; Dockerfiles written but **not built** (no Docker daemon in sandbox) |
| 10a | Offline drafts with idempotent sync | P2 | ✅ Done |
| 10b | Dispute comparison, voice stress-test page | P2 | ☐ Not started |
| 11 | Docs + deployment configs | P1 | ✅ Docs/configs done; **deployment not performed** |

## 6. What I need from you

1. **Gnani key**: put it in `apps/api/.env` on your PC yourself (template will be `.env.example`). Don't paste it into chat.
2. **GitHub repo** (`owner/name`, empty) so I can push the local history.
3. Later, for deployment: Vercel, Render and MongoDB Atlas accounts, plus GitHub repo secrets.

## 7. Progress log

- 2026-11-13 16:05 IST: inspected environment; read Gnani STT REST, TTS REST and voice catalogue docs; wrote this plan.
- 16:14 IST: monorepo + shared schemas; calculation + extraction services (28 tests). Commits 5ef396e, fbaa447.
- 16:28 IST: backend P0 complete: Gnani services, auth, transactions, payments, analytics, PDF/CSV (90 tests). Commit efbd2a9.
- 16:43 IST: frontend complete; Playwright E2E 4/4 against mock Gnani. Commit 458f590.
- 16:45 IST: CI/CD workflows, Docker, Render/Vercel configs. Commit 71391ef.
- 16:50 IST: documentation set. Commit 6419d3c.
- **Next:** real-API smoke test on your PC → push to GitHub → deploy (needs accounts) → P2 dispute comparison and stress-test page.
