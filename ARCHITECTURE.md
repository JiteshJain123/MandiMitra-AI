# Architecture

## Repository layout

```
packages/shared/     Zod schemas, constants (languages, voices, units, statuses), DTO types, formatting
apps/api/            Express 5 REST API
  src/config/env.ts          Zod-validated environment; fails fast on bad config
  src/middleware/            auth (JWT + tokenVersion), error handler, rate limits
  src/models/                User, Transaction, PaymentRecord (Mongoose)
  src/routes/                auth, voice, transactions, payments, analytics, health
  src/services/
    prisma.service.ts        Gnani Prisma STT client
    timbre.service.ts        Gnani Timbre TTS client
    audio-validation.service.ts  magic-byte format detection, WAV duration, size limits
    gnani-errors.ts          normalises the five documented Gnani error body shapes
    gnani-status.ts          last success/failure per service (status indicator)
    extraction.service.ts    transcript → TransactionDraft (deterministic)
    extraction.lexicon.ts    Hindi/Hinglish/English vocabulary
    calculation.service.ts   decimal.js money maths
    speech-text.service.ts   spoken-summary templates (hi / hinglish / en)
    voice-query.service.ts   whitelisted question intents → fixed queries
    transaction.service.ts   CRUD, idempotency, payments, derived status, filters
    analytics.service.ts     aggregations
    export.service.ts        CSV + PDF receipts
  src/scripts/               smoke-gnani.ts (real API, opt-in), seed-demo.ts
  test/                      Supertest integration tests
apps/web/            React SPA
  src/features/voice/        WAV encoder + recorder hook, capture step, review slip, TTS player
  src/pages/                 one file per route (lazy-loaded)
  src/lib/                   API client, auth context, queries, offline drafts
  e2e/                       Playwright tests + mock Gnani server
```

## Voice transaction flow

1. **Record.** `use-wav-recorder.ts` captures microphone PCM with an AudioWorklet (falling back to ScriptProcessor), downsamples to 16 kHz with a box filter, and encodes 16-bit mono WAV. Recording stops on its own at 29 s because the Prisma limit is 30 s.
2. **Upload.** The client sends `multipart/form-data` (`audio`, `language`) to `POST /api/voice/transcribe`. Multer keeps the file in memory, limited to 5 MB.
3. **Validate.** The server detects the format from magic bytes (it does not trust the client's MIME type), rejects WebM, and reads WAV duration from the header (0.3 to 30 s).
4. **Transcribe.** `prisma.service` posts `audio_file`, `model=prisma-v3.0`, `language_code` (e.g. `hi-IN`, `hi-IN,en-IN` or `indic-auto`), `format=transcribe` and `keyterms`, with a timeout. The response is validated with Zod. An unexpected body is reported as an error rather than treated as a transcript.
5. **Extract.** `extraction.service` tokenises the transcript (normalising Devanagari digits, nukta and chandrabindu, ₹, %), groups number spans (digits and Hindi or English number words, including multipliers and fractions), then assigns each number by context:
   - followed by a percent word next to a commission word → commission %
   - `<n> [rupaye] [per|prati|ka] <unit>` → rate
   - `<n> <unit>` → quantity
   - otherwise the nearest keyword within a window that stops at sentence and conjunction boundaries (`aur`, `और`), with ties resolved by the rupee word
   - anything ambiguous → `null` plus a warning
6. **Review.** The client shows the slip with missing fields highlighted and the "Heard: ..." evidence for each field.
7. **Calculate.** `POST /api/transactions/preview` → `calculation.service` returns integer paise and a spoken summary text.
8. **Read back.** `POST /api/voice/speak` → `timbre.service` → binary audio, returned to the browser unchanged.
9. **Confirm.** `POST /api/transactions` requires `confirmed: true` and an `Idempotency-Key` header. The server recalculates amounts, ignores any client amounts (the strict schema rejects unknown fields), and saves.
10. **Receipt.** The HTML receipt has a print stylesheet. `GET /:id/receipt.pdf` renders a PDF with PDFKit.

## Money

- Amounts are stored as **integer paise** (`Number.isSafeInteger` is validated).
- `gross = round(quantity × rate × 100)`, `commission = round(gross × pct / 100)`, `net = gross − commission − transport − other`, using decimal.js with ROUND_HALF_UP.
- If the net amount would be negative, the request is rejected (`DEDUCTIONS_EXCEED_GROSS`).
- An edit that would push the net amount below payments already received is rejected (`NET_BELOW_RECEIVED`).
- Payments use a conditional `findOneAndUpdate` on `amountReceivedPaise`, so two concurrent payments cannot exceed the net amount.

## Payment status

`pending | partially_paid | paid` is **derived** from `amountReceivedPaise` and `netAmountPaise`. `disputed` is the only status a user sets directly, and it persists while payments are recorded. A sale is overdue when money is still outstanding and `paymentDueDate` has passed. When there is no due date, the default is `transactionDate + DEFAULT_PAYMENT_TERM_DAYS`.

## Data model

| Collection | Key fields | Indexes |
|---|---|---|
| users | email (unique), passwordHash (`select:false`), role, preferredLanguage, saveTranscriptsByDefault, isDemo, tokenVersion | email unique |
| transactions | userId, receiptNumber (unique), crop/qty/unit, *Paise amounts, amountReceivedPaise, dates, paymentStatus, transcript (only with consent), extractedData, source, confirmed, confirmedAt, idempotencyKey | (userId, transactionDate), (userId, paymentStatus), (userId, cropName), (userId, idempotencyKey) unique partial |
| paymentrecords | userId, transactionId, amountPaise, method, note, paidAt | (transactionId, paidAt), (userId, paidAt) |

There is no VoiceSession collection: audio is never persisted, and the transcript is stored on the transaction only when the user consents.

## Security

- **Authentication:** bcrypt with 12 rounds and an equal-time comparison for unknown emails. HS256 JWT with the algorithm pinned and the issuer checked. `tokenVersion` is incremented on logout, which revokes every token for that user. Self-registration as admin is blocked.
- **Isolation:** every query filters on `userId`. Another user's ID returns 404, not 403. This is covered by tests.
- **Input:** strict Zod schemas on every body and query, so `{"$ne": null}` style operator injection fails validation. Search regexes are escaped. The JSON body limit is 50 kB and audio is limited to 5 MB.
- **Transport:** Helmet, CORS allowlist, and three rate limiters: global, auth, and a per-user limit on Gnani calls.
- **Errors:** a central handler returns no stack traces and never forwards Gnani's upstream messages verbatim. Logs redact fields that look like secrets.
- **Frontend:** CI checks that no secret-related strings appear in the bundle. `Permissions-Policy` allows the microphone only for the app's own origin.

## Voice questions (no generated queries)

`voice-query.service` classifies a question into one of `pending_total`, `unpaid_list`, `overdue_list`, `crop_sales`, `received_total` or `unknown`. It also extracts an optional crop and a period (today, this week, this month, last month, this year), evaluated in IST. Each intent runs a hard-coded aggregation that always matches the authenticated `userId`.

## Offline behaviour

`lib/drafts.ts` keeps device-local items separate from server records:
- `draft`: an unconfirmed slip that can be reopened later.
- `queued`: a sale confirmed while offline. It is sent when the browser's `online` event fires, using its stored idempotency key, so a retry after a lost response never creates a duplicate.

## Decisions and trade-offs

| Decision | Why |
|---|---|
| Browser WAV, not MediaRecorder | Prisma doesn't accept WebM, which is what Chrome and Edge produce. This also avoids an ffmpeg dependency on the server. |
| Deterministic extraction | The application uses Gnani Prisma (speech to text) and Gnani Timbre (text to speech) and does not depend on a language model. Extraction follows fixed rules, which are testable and never invent values. |
| bcryptjs | The same bcrypt algorithm in pure JS, which avoids native build problems on Windows and Render. |
| Bearer token in localStorage | The frontend (Vercel) and backend (Render) are on different sites, and browsers increasingly block third-party cookies. Mitigated by expiry and server-side revocation. |
| Merged Noto font for PDFs | Fontsource ships Latin and Devanagari as separate subsets, so they were merged with fontTools so a single font renders ₹, English and Hindi names. |
