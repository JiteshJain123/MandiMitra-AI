# MandiMitra AI: submission for the Great Indian AI Internship Challenge

**Your voice. Your transactions. Your digital records.**

## Links

| | |
|---|---|
| Source code | https://github.com/JiteshJain123/MandiMitra-AI (the repository is currently **private**; give reviewers access or make it public before submitting) |
| Live site | _to be added after deployment_ |
| Live API health | _to be added after deployment_ (`/api/health`) |
| One-page pitch (required by the form) | [PITCH.md](PITCH.md) |
| Demo video | _to be added_ (the form asks for 2 to 3 minutes; script: [DEMO_SCRIPT.md](DEMO_SCRIPT.md), cut it to fit) |
| Public post (LinkedIn or X) | _to be added_ (tag Gnani AI, #GnaniAI #GreatIndianAIInternshipChallenge) |

Nothing in this file claims a deployment exists. Update the two "to be added" rows after following [DEPLOYMENT.md](DEPLOYMENT.md) and testing the live site.

## The problem

Most mandi sales are still written in a paper *bahi-khata* or not recorded at all. The commission (*aadhat*), transport (*bhada*) and labour (*hammali*) deductions are worked out by hand, part payments are tracked from memory, and disputes follow. Form-based apps do not help people who would rather speak than type, or who are more comfortable in Hindi than English.

## The solution

A farmer, trader or mandi worker **speaks a sale** in Hindi, Hinglish or English. MandiMitra:

1. records the voice in the browser and transcribes it with **Gnani Prisma**;
2. fills in a sale slip (crop, quantity, unit, rate, commission, transport and other deductions) and shows, next to each field, the exact words it heard. Anything it did not hear is left empty and highlighted; it never guesses;
3. calculates the amounts **on the server** to the paisa;
4. reads the result back in the user's language with **Gnani Timbre**;
5. saves only after the user explicitly confirms, then issues a receipt (print or PDF);
6. tracks payments (full and part) until the sale is paid, and answers questions such as "Mera kitna paisa pending hai?" by voice or text.

## Features

Voice capture in the browser (16 kHz WAV, timer, cancel, 29 second limit, upload as a fallback) · Hindi, Hinglish and English extraction (Devanagari digits, number words, units, rate, commission, transport, other deductions) · server-side decimal money maths · spoken read-back · explicit confirmation gate · idempotent saves · receipts and PDF · transaction history with search, filters and CSV export · payment tracking with derived status and overdue detection · analytics (monthly trend, by crop, by status) · fixed-intent voice questions · offline drafts with queued sync · demo account with synthetic data · in-app help and first-time guidance · accessibility work (keyboard, focus, contrast, landmarks) and layouts from 320 px phones to wide desktops.

## How the Gnani APIs are used

All Gnani calls are made by the **backend**. The key lives only in the API's environment, is never sent to the browser, never logged, and never appears in the production bundle (checked).

**Speech to text: Gnani Prisma** (`prisma-v3.0`, REST)
- `POST https://api.vachana.ai/stt/v3`, `multipart/form-data`, header `X-API-Key-ID`.
- Language: Hindi `hi-IN`; Hinglish `hi-IN,en-IN` (two codes together); English `en-IN`; plus `indic-auto` automatic detection and the other Indian languages.
- `format=transcribe`, which applies inverse text normalisation, so spoken numbers come back as digits ("पचास क्विंटल" becomes "50 quintal"). Mandi vocabulary is passed as `keyterms`.
- Prisma accepts at most 30 seconds and does not accept the WebM that Chrome records, so the browser encodes **16 kHz mono WAV** itself, stops at 29 seconds, and the server checks the file's magic bytes and length before calling Gnani.
- All documented error shapes (401, 402, 403, 422, 429, 504 and so on) are mapped to readable messages with no upstream text or key leaked.

**Text to speech: Gnani Timbre** (`timbre-v2.5`, REST)
- `POST https://api.vachana.ai/api/v1/tts/inference`, JSON, returns **binary audio** that the API passes to the browser unchanged.
- One voice per language from the Timbre v2.5 catalogue (for example Nalini for Hindi, Poorvi for Hinglish, Devika for English). The summary text is generated from templates in Hindi, Hinglish or English.

**Deliberately not used:** Evon, and any language model. Extraction is deterministic and testable, and never invents a value. Questions map to a fixed list of safe queries; no AI-written database query is ever executed.

**Accuracy honesty:** the automated tests mock Gnani. The live checks used Timbre-generated speech fed through Prisma (the same three sentences, all extracted correctly) and a real person's manual microphone test. Accuracy for accents and noisy mandi audio has **not** been measured.

## Trust and safety decisions

- Money is calculated only on the server, in integer paise, with `decimal.js`. The browser and the AI never calculate money.
- Nothing is saved until the user ticks "I have checked these details" and presses confirm; saves are idempotent, so retries never duplicate a sale.
- Audio is processed in memory and **never stored**. The transcript is kept only if the user chooses.
- Passwords are hashed with bcrypt; sessions are signed tokens that the server can revoke; every query is scoped to the signed-in user.
- Receipts say clearly that they are a personal record and not proof of payment by the other party.

## Technology stack

React 19, Vite, TypeScript, Tailwind CSS 4, Radix UI, TanStack Query, React Hook Form and Zod, Recharts · Node 22, Express 5, MongoDB with Mongoose, Zod, bcryptjs, jsonwebtoken, Helmet, express-rate-limit, Multer, decimal.js, PDFKit · Gnani Prisma and Timbre · Vitest, Testing Library, Supertest, Playwright · GitHub Actions, Docker files, Render (backend), Vercel (frontend), MongoDB Atlas.

Architecture and the voice flow step by step: [ARCHITECTURE.md](ARCHITECTURE.md). Every endpoint: [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

## Run it locally

`npm install`, copy `apps/api/.env.example` to `apps/api/.env` and fill it in, then `npm run dev:api` and `npm run dev:web`; open http://localhost:5173. Details in the [README](README.md). `npm run doctor` checks the configuration and the database without printing any secret.

## Evidence

Test results, what was verified and how: [TEST_REPORT.md](TEST_REPORT.md). Headlines: 106 API tests, 48 web tests and 10 end-to-end tests pass; lint, type check and production builds are clean; the production dependency audit reports no vulnerabilities; the three-language voice workflow, error and permission cases, accessibility audit and responsive audit were run in real Chrome.

## Known limitations

- **Real-world speech accuracy is unmeasured**; no human voice, accent or noisy-environment test beyond one manual microphone test.
- The extractor is rule-based and tuned for Hindi, Hinglish and English; other supported languages are transcribed but may leave more fields for the user to fill.
- Prisma's REST API takes at most 30 seconds per request; longer recordings would need its batch or streaming APIs.
- The demo account is shared by everyone who opens it.
- Sessions are stored in the browser's local storage so that the separate Vercel and Render sites work without third-party cookies; they expire after 7 days and logout revokes them on the server.
- Not built (planned as lower priority): buyer and seller dispute comparison, and a voice stress-test page. Shared or multi-party transactions are not supported.
- Accessibility was checked with automated and keyboard-driven audits only, not with a screen reader. Safari, Firefox and real phones were not tested.
- The Render free plan sleeps when idle, so the first request after a pause is slow.
- No official challenge brief was available in the project when this document was written, so coverage of every challenge requirement has **not** been checked against it.
