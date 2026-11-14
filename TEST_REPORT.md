# Test report

_Latest full run: 2026-11-14 (IST), this code base checked out in a clean clone: Windows 11, Node 25.9, Google Chrome for Playwright, MongoDB test binary 8.2.6. The first run (2026-11-13, build sandbox, Node 22.23, MongoDB 8.0.23) had 96 / 11 / 4 tests; the dated sections further down record the numbers at the time of each run._

## Summary

| Suite | Tool | Result |
|---|---|---|
| Backend unit + API integration | Vitest + Supertest, real mongod | **106 / 106 passed** (9 files) |
| Frontend unit | Vitest + React Testing Library | **48 / 48 passed** (10 files) |
| End-to-end | Playwright (Chrome), real API + web, **mock Gnani server** | **10 / 10 passed** |
| Lint | ESLint 9 (typescript-eslint, react-hooks) | 0 problems |
| Type check | `tsc --noEmit`, strict | 0 errors (api, web, shared) |
| Builds | `vite build`, `tsc` | Pass. Initial JS about 281 kB (86 kB gzip); Recharts lazy-loaded (analytics chunk about 390 kB) |
| Dependency audit | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities. Including development tools, `npm audit` lists 7 moderate advisories in the ESLint toolchain (not shipped) |
| Bundle secret scan | grep for key/secret names in `apps/web/dist` | Clean (0 matching files) |

**All automated tests use mocked Gnani responses.** None of these results show how accurately the real Prisma service transcribes mandi speech. That has to be measured with `npm run smoke:gnani -- --yes` on a machine that has the API key (see the last section).

## Backend (106; 96 at the first run)

| File | Tests | Covers |
|---|---|---|
| `scripts/doctor.test.ts` | 3 | Secret-safe configuration and database check |
| `help-examples.test.ts` | 4 | Every example sentence shown on the Help page extracts exactly what the page promises; every example question is understood |
| `calculation.service.test.ts` | 7 | Reference example (₹60,000 → ₹58,300); float-drift avoidance; half-up paise rounding; fractional quantities; deductions exceeding gross; invalid quantity, rate and commission |
| `extraction.service.test.ts` | 29 | Added since the first run: sacks ("8 bori") are not a deduction, half a percent ("aadhe percent"), partial payment wins over paid, the real transcripts returned by Prisma. Original coverage: Reference Hinglish sentence (exact draft); Devanagari version with number words; Devanagari digits, ₹ and %; compound numbers ("do hazaar chaar sau", "saadhe barah"); English phrasing; summed deductions; **no invented fields**; unattributed % left empty; flat commission becoming other deductions with a warning; "payment mil gaya" detection; "bata do" not read as 2; unit mismatch warning; empty transcripts; 8 number-parsing cases |
| `speech-text.service.test.ts` | 3 | Indian grouping (₹2,40,000); Hindi, English and Hinglish summaries |
| `voice-query.service.test.ts` | 11 | The three example questions from the brief plus Hindi and English variants mapped to intents (including the "pyaaj" spelling of onion); IST period boundaries |
| `test/auth.test.ts` | 9 | Registration and bcrypt hash; duplicate email; validation; admin self-registration blocked; login success and failure with identical messages; NoSQL operator injection rejected; token revocation on logout; profile update; demo account; health endpoint exposes no secrets |
| `test/transactions.test.ts` | 18 | Preview saves nothing; unconfirmed saves refused; client amounts rejected; missing and invalid fields; transcript stored only with consent; **duplicate requests** (concurrent and sequential, same Idempotency-Key); **authorization isolation** across get, patch, delete, payments, PDF, list and analytics; malformed IDs; update recalculation; net below received; cascade delete; **partial → paid → reverted payments**; overpayment and already-paid errors; disputed status kept; **pending, received and overdue totals**; search, filter, sort and pagination; regex-escaped search; CSV formula-injection protection; PDF receipt |
| `test/voice.test.ts` | 22 | Exact Prisma request (URL, `X-API-Key-ID`, `model`, `language_code`, `format`, `audio_file`); `indic-auto`; empty transcript; invalid audio (WebM, junk, over 30 s, too short, missing) rejected before any Gnani call; **Gnani 401, 402, 429, 400, 422, 504 and 500 mapped** with no key leakage; **client timeout** and network failure; unexpected success body rejected; key not configured; status indicator records failures; **Timbre binary audio passed through byte-for-byte**; per-language voice choice; Timbre error and non-audio handling; text length validation; extraction endpoint; voice queries scoped to the current user only |

## Frontend (48; 11 at the first run)

| File | Tests | Covers |
|---|---|---|
| `lib/page-title.test.ts` | 14 | Every route has its own descriptive page title; trailing slash and unknown paths |
| `pages/help-page.test.tsx` | 6 | Help content (five first-sale steps, example sentences with what the slip will contain, microphone troubleshooting, FAQ); in-app and public Help pages |
| `pages/dashboard-page.test.tsx` | 4 | First-time hint shown at zero sales, hidden with sales, while loading and on error |
| `pages/landing-page.test.tsx` | 4 | "How it works" section and anchor, "Try it in 30 seconds", Help links, existing calls to action |
| `features/voice/capture-step.test.tsx` | 6 | Server error text is shown (never an empty box), cleared on Discard or a new file; upload type and size messages |
| `components/ui/dialog.test.tsx` | 3 | Dialog name, focus moves in and returns to the opening button; field errors are announced and linkable |
| `features/voice/wav.test.ts` | 4 | WAV header (16 kHz mono PCM), sample clipping, 48 → 16 kHz downsampling, chunk concatenation |
| `features/voice/review-form.test.ts` | 3 | Missing values stay empty and fail validation; payload contains no client-side amounts; disputed status and optional fields |
| `lib/api.test.ts` | 3 | Bearer token sent; server error code and message surfaced; network failures reported distinctly (used for offline queueing) |
| `components/ui/badge.test.tsx` | 1 | Status label and overdue marker |

## End-to-end (10; 4 at the first run), against `e2e/mock-gnani.mjs`

1. **Demo login** → dashboard shows synthetic data, the demo badge, and "Gnani AI connected".
2. **Full voice sale:** register (Hinglish) → upload sample WAV → transcript shown (sent as `hi-IN,en-IN`) → fill slip → fields extracted (Wheat, 25, quintal, 2400, 2%, 500) → net **₹58,300.00** → edit quantity to 30 → net **₹70,060.00** → read summary aloud (audio player and download shown) → confirm button disabled until the box is ticked → save → receipt with net ₹70,060.00, `MM-YYYYMMDD-XXXXXXXX` number and disclaimer → PDF downloads → history table lists it → Payments shows ₹70,060 pending → asking "Mera kitna paisa pending hai?" answers ₹70,060.
3. **Microphone recording:** Chrome's fake audio device → in-browser WAV → preview → backend validation passes → transcript returned.
4. **Missing fields:** the slip cannot be confirmed until crop, quantity, unit and rate are filled.
5. **New visitor:** landing page guide, public Help page, registration, first-time hint, in-app guide, first sale, hint disappears.
6. **Recording too short:** the reason is shown in words and Discard clears it.
7. **Keyboard users:** skip link is the first tab stop, `main` landmark, per-page titles, focus moves to the new content after navigation.
8. **Dialog focus:** the payment dialog returns focus to the button that opened it.
9. and 10. **No horizontal scrolling** on a 320 px and a 375 px phone (landing, dashboard, payments, record, transactions, help).

## Bugs found by tests and fixed

| Bug | Found by | Fix |
|---|---|---|
| "rate bata do, 25 quintal" read the verb *do* as the number 2 | extraction test | Ambiguous number words need a unit, multiplier, percent, rupee or number-word context; a following digit doesn't count |
| "rate 4500, commission 300" assigned 4500 to commission | extraction test | Keyword ties go to the word immediately before, unless a rupee word links the number forward |
| PATCH of only `quantity` reset commission and transport to 0 | transactions test | Zod 4 `.partial()` keeps defaults, so a separate update schema without defaults was added |
| "How much did I receive" was not recognised | voice-query test | Added English verb forms |
| Rate limiter IPv6 key warning | test run | Use `ipKeyGenerator` |
| Mongoose `sanitizeFilter` would have neutralised server-built `$in`/`$gte` filters | code review before tests | Removed; Zod strict parsing blocks operator injection (tested) |

## Not verified here

- **Real Gnani APIs.** The build sandbox cannot reach `api.vachana.ai`. Run `npm run smoke:gnani -- --yes` locally and append the output to this file.
- **Docker images.** The Dockerfiles and compose file are written, but no Docker daemon was available to build them.
- **Deployment.** Not yet performed. It needs your Vercel, Render and Atlas accounts.
- Safari and iOS microphone capture was not tested (Chrome only).

## Real API smoke test results

Run by the project owner on Windows, 2026-11-13 21:02 IST, against the live Gnani APIs (`prisma-v3.0`, `format=transcribe`, `timbre-v2.5`). 7 of 7 steps returned without error. The transcripts and extracted values below were then checked by hand against the spoken sentence; the script has since been changed to make that comparison itself.

| Step | Observed |
|---|---|
| Timbre TTS, Hindi (voice Nalini) | 69,120 bytes `audio/mpeg`, 1.9 s |
| Timbre TTS, Hinglish (voice Poorvi) | 75,840 bytes `audio/mpeg`, 1.7 s |
| Timbre TTS, English (voice Devika) | 31,488 bytes `audio/mpeg`, 0.6 s |
| Prisma STT, Hindi audio | `25 क्विंटल गेहूं बेचा है। rate 2400 रुपये प्रति क्विंटल है। 2% commission और 500 रुपये transport charge काट लेना।` Detected `hi-IN`, 0.5 s |
| Prisma STT, Hinglish audio | `भैया, 25 quintal गेहूँ बेचा है। rate 2400 रुपये पर quintal है। 2% commission और 500 रुपये transport charge काट लेना।` Detected `hi-IN`, 0.6 s |
| Prisma STT, `indic-auto` | Same transcript as the Hindi step; detected `hi-IN`, 0.4 s |
| Invalid API key | Rejected with `GNANI_AUTH_FAILED` |

**Accuracy:** both transcripts carry every word and number of the source sentences; no word was dropped or substituted. The Hindi sentence spoke the quantity as a word ("पच्चीस") and Prisma returned the digits "25", so inverse text normalisation works. Extraction returned all eight fields correctly for both (Wheat, 25, quintal, 2400, 2%, 500, no other deductions, pending) with nothing missing and no warnings.

**What this does and does not show:**
- The audio was clean synthetic speech from Timbre, which is the easiest input Prisma will ever get. It says nothing about a human voice, regional accents or mandi background noise. Use `npm run smoke:gnani -- --yes --audio <your recording>` for that.
- Prisma returns mixed script (Devanagari with Latin "rate", "commission", "transport charge"). The Hinglish transcript used "पर quintal" for "per quintal", a form the parser did not know; the rate was still found through the word "rate". The parser now recognises "पर", and both real transcripts are regression tests.

## Local verification on the owner's PC (2026-11-13)

Environment: Windows 11, Node 25.9 / npm 11.12, MongoDB Atlas for the dev servers, a local MongoDB (`mandimitra-e2e` database) for Playwright, system Google Chrome, live Gnani APIs. Test account: `qa.tester@mandimitra.test` (still in the Atlas `mandimitra` database; delete it from the `users`, `transactions` and `paymentrecords` collections if you do not want it).

### Automated suites, re-run after the fixes below

| Suite | Result |
|---|---|
| ESLint | 0 problems |
| `tsc --noEmit` (shared, api, web) | 0 errors |
| API unit + integration (Vitest, Supertest, mongodb-memory-server) | **101 / 101** |
| Web unit (Vitest + Testing Library) | **11 / 11** |
| Playwright E2E (system Chrome, mock Gnani) | **4 / 4** |
| `npm run build` (shared, api, web) | Pass |

`npm run doctor`: all 12 checks passed (env validates, Atlas ping, indexes for users, transactions and paymentrecords, write/read/delete round trip).

### Manual run through the real app (Vite dev server + API against Atlas + live Gnani)

| Area | What I did | Observed |
|---|---|---|
| Landing page | Opened `/` | Renders, no console errors |
| Registration | Created the test account through the form (Hinglish) | Redirected to the dashboard; user stored with a `$2b$12$` bcrypt hash and role `farmer` |
| Voice, TTS | Browser called `/api/voice/speak` (Hinglish) | 200, `audio/mpeg`, 81 KB, voice Poorvi |
| Voice, STT | Fed that audio through **Upload audio → Transcribe** | Prisma returned `भैया, 25 quintal गेहूँ बेचा है, rate 2,400 रुपये पर quintal है। 2% commission और 500 रुपये transport charge काट लेना।` (sent as `hi-IN,en-IN`, detected `hi-IN`, 0.4 s) |
| Extraction | **Fill the sale slip** on that transcript | Wheat, 25 quintal, ₹2,400, 2%, ₹500, nothing missing, no warnings |
| Calculation | Slip | Gross ₹60,000, commission ₹1,200, net **₹58,300.00** |
| Read-back | **Read summary aloud** | Timbre clip (16 s) played, with Replay and Download |
| Confirmation | Confirm button before ticking the box | Disabled; enabled after ticking; saved |
| Receipt | Redirect after save | Receipt `MM-20261113-9249E8E5`, net ₹58,300.00, status Pending, due date +15 days |
| PDF | `GET /api/transactions/:id/receipt.pdf` | 200, `application/pdf`, 12 KB, `%PDF-` header. **I did not open or review the PDF's visual layout.** |
| Payment | Recorded half (₹29,150, UPI) in the dialog | Status became Partially paid; received/outstanding ₹29,150 each |
| Payments page | Opened | Totals, "waiting for payment" list and payment history all correct |
| Analytics | Opened | Cards (₹60,000 gross, ₹29,150 received and pending), 12-month trend, crop and status charts; no console errors |
| Voice questions | Four questions through `/api/voice/query` | Correct intents and amounts: pending ₹29,150; wheat sales 25 quintal / ₹60,000; unpaid list; received ₹29,150 |
| Search and filters | `q=wheat`, receipt number, `q=zzzz`, `q=.*`, `status=paid`, `status=outstanding`; UI search box | 1, 1, 0, 0 (regex escaped), 0, 1 results; UI shows the empty state |
| CSV export | `GET /api/transactions/export.csv` | 200, `text/csv`, header plus one correct row |
| Logout / login | Signed out, visited a protected route, wrong password, correct password | Token cleared, redirect to `/login`, generic "Incorrect email or password", then back to the dashboard with the saved sale |
| Database | Read-only script against Atlas | 1 user, 1 confirmed transaction (6,000,000 / 5,830,000 / 2,915,000 paise, `partially_paid`), 1 payment record, transcript not stored (no consent given) |

### Bugs found in this run and fixed

| Bug | Found by | Fix |
|---|---|---|
| "8 bori aloo, rate 900 …": the 8 sacks became an ₹8 "other deduction", with no warning | Extra extraction sentences against the live API | A number directly before a sack word (`bori`, `bag`, `katta`, …) now raises a warning and is not used as an amount. "bori charge 40" still works. `extraction.lexicon.ts`, `extraction.service.ts` |
| "commission aadhe percent" (half a percent) left the commission empty | Same | `aadha/aadhe/आधा/आधे` followed by a percent word reads as 0.5 |
| "aadha payment mil gaya" (half the payment received) was saved as **paid** | Unit test written for the fix above | Partial-payment phrases are now checked before paid phrases |
| Payments card on the receipt page: "Received" and "Outstanding" amounts collided | Screenshot after recording a payment | Responsive auto-fit grid. `transaction-detail-page.tsx` |
| Transactions page: filter dropdowns crushed to a few pixels | Screenshot while testing search | Six-column filter row now starts at `xl`; three columns at `lg`. `transactions-page.tsx` |
| Sale slip: Unit select clipped at the card edge | Screenshot | `minmax(0, …)` columns, and the two-column layout starts at `xl`. `review-slip.tsx` |
| `npm test` failed at the first workspace because `packages/shared` has no tests (`vitest run` exits 1) | `npm test` | `--passWithNoTests` in `packages/shared/package.json` |
| Voice answers said "1 transactions" and started lowercase | Voice query output | Singular/plural helper and capitalised period in `voice-query.service.ts` |

Five regression tests were added to `extraction.service.test.ts` (sacks, bori charge, half percent in Hinglish and Devanagari, "aadha payment").

### Still not verified

- **A real human voice.** All speech I fed to Prisma was Timbre-generated. Microphone capture was only exercised by Chrome's fake audio device in Playwright, not by a person speaking, and not in the in-app browser.
- Accuracy on regional accents, noisy mandi audio, and languages other than Hindi, Hinglish and English.
- The PDF's visual layout (Devanagari and ₹ rendering), print view, and the receipt "Read aloud" button.
- Editing and deleting a sale, reverting a payment, the overdue state, the demo account and Settings page in the live app (these are covered by the automated API tests only).
- Offline draft queue, narrow phone widths, Safari/iOS.
- Docker images and any deployment. Nothing has been pushed or deployed.
- Note: the first API test run on a fresh install downloads a MongoDB binary (about 600 MB) and can time out once while it is unpacked; a re-run works.

## Help and onboarding (2026-11-14)

New: landing "How it works" additions, public `/help`, in-app `/app/help` (sidebar item, plus a Help link in the top bar on phones), and a first-time dashboard hint. Also fixed: the crop spelling "pyaaj" was not recognised as onion in voice questions.

| Check | Result |
|---|---|
| ESLint, `tsc --noEmit` | 0 problems |
| API tests | 106 / 106 (new: the three Help example sentences each extract exactly what the page promises; example questions are understood; `pyaaj` maps to Onion) |
| Web tests | 25 / 25 (new: Help content and both help pages, dashboard hint at 0 sales, with 1 sale, while loading and on error, landing guidance) |
| Playwright E2E | 5 / 5 (new: visitor opens the guide from the landing page, registers, sees the hint, opens the in-app guide, saves a first sale, and the hint is gone) |
| Production build | Pass |
| Seen in the browser pane | Landing anchor link and "Try it in 30 seconds"; public `/help` with the Devanagari example; new-user dashboard hint on phone and desktop widths; in-app guide |

Test-infrastructure fix: `apps/web/src/test/setup.ts` now unmounts rendered components after every test (Vitest globals are off, so Testing Library could not do it itself).

Not verified: the microphone itself (the browser pane blocks it), Safari/iOS, and screen-reader behaviour.

## Microphone, accessibility and responsive review (2026-11-14)

How it was tested: your installed Google Chrome, driven by Playwright against the running app (real API, MongoDB Atlas, live Gnani Prisma and Timbre). The microphone tests use **Chrome's own fake capture device**: a WAV file of Timbre speech is played as the microphone, so the app's real `getUserMedia`, AudioWorklet recorder, 16 kHz WAV encoder, upload and transcription code all run. **No human voice and no physical microphone were used**, and the in-app browser pane blocks the microphone entirely.

### Voice workflow, Hindi / Hinglish / English (51 checks, all passed)

Mic button, recording, stop, transcript (Prisma), extraction, server-side total, confirmation, saved sale, receipt, PDF, history.

| Language | Transcript from Prisma | Extracted | Net payable (matches an independent calculation) |
|---|---|---|---|
| Hinglish | `भैया, 25 quintal gehu बेचा है, rate 2,400 रुपये per quintal. 2% commission और 500 रुपये transport काट लेना।` | Wheat, 25 quintal, ₹2,400, 2%, ₹500 | ₹58,300.00 |
| Hindi | `भैया, 50 quintal प्याज बेचा है, rate 2,200 रुपये प्रति quintal है। 2% कमीशन और 500 रुपये transport charge काट लेना।` | Onion, 50 quintal, ₹2,200, 2%, ₹500 | ₹1,07,300.00 |
| English | `Sold 12 quintal onion at rate 1800 rupees per quintal. Commission 1% and transport 300 rupees.` | Onion, 12 quintal, ₹1,800, 1%, ₹300 | ₹21,084.00 |

Confirmation gate, verified against the database count: the Confirm button is disabled until the box is ticked; nothing is saved before confirming or after ticking alone; exactly one sale is saved on confirming.

### Recorder states (27 checks, all passed)

Permission denied (clear message, button usable again, retry after allowing works); no-microphone error (simulated browser error); cancel mid-recording; Discard; retry; keyboard start (Enter) and stop (Space); the microphone track is `live` while recording and `ended` after Cancel and after Stop; WAV header is RIFF/WAVE PCM, mono, 16000 Hz, 16-bit with a consistent data length; automatic stop at the 29 s limit; `.webm` upload rejected; file over 5 MB rejected; junk "audio" and a too-short recording rejected by the server with a readable message.

### Accessibility (own audit in real Chrome; no axe package was available)

Twelve pages (public and signed in): 0 issues for headings, landmarks, accessible names, duplicate ids, colour contrast (computed from rendered colours, WCAG AA 4.5:1 / 3:1 large text) and keyboard focus indicators on every tab stop. Also verified: skip link is the first tab stop and moves focus to the main content; focus moves to the new page content after navigation; each page has its own title; form errors are announced and linked to their fields; dialogs have a name, trap focus, close on Escape and return focus to the opening button; controls are at least 24 x 24 px on a 375 px phone.

### Responsive

65 page and width combinations (320, 375, 768, 1280, 1920 px x 13 pages): no horizontal overflow and no clipped text. Phones and tablets use the bottom bar; desktop uses the sidebar.

### Genuine bugs found and fixed

| Bug | Found by | Fix |
|---|---|---|
| Any server error on the Record page (too short, junk audio, rate limit, Gnani down) showed an **empty red box**: `rec.error?.message ?? uploadError ?? error` stopped at the initial empty string | Real-Chrome junk upload | `||` instead of `??` in `capture-step.tsx` |
| The error stayed after Discard or starting a new recording | Real-Chrome test | `onClearError` resets the mutation |
| **Payments page scrolled sideways on phones** (385 px in a 375 px screen): the question input could not shrink | Responsive audit | `min-w-0` on the input and grid children |
| Landing and public Help headers overflowed at 320 px | Responsive audit | header wraps |
| `ink-faint` text was 3.67:1 on white and 3.37:1 on the grey page (below 4.5:1) on almost every page | Contrast audit | token darkened to `#637166` (5.14:1 / 4.72:1) |
| No `<main>` landmark on the landing, sign-in and register pages; no `<h1>` on the receipt page | Structure audit | added |
| No skip link; the same title on every page; focus not moved after navigation | Keyboard audit | skip link, per-route titles, focus on the new content |
| Dialog did not return focus to the button that opened it | Keyboard audit | focus restored on close |
| Form errors not linked to their inputs (`aria-describedby`) | Forms audit | linked |
| Touch targets under 24 px (two dashboard links, all checkboxes) | Phone audit | enlarged |

Regression tests added: 5 unit tests for the error box, dialog focus, field errors, page titles; 5 end-to-end tests (too-short message, skip link and titles, dialog focus, no overflow at 320 and 375 px).

### Results of the final run

ESLint 0 problems; `tsc` 0 errors; API tests 106/106; web tests 48/48; Playwright 10/10; production builds pass; `npm audit --omit=dev` 0 vulnerabilities.

### Not verified / remaining limitations

- A real person speaking into a physical microphone, accents and noisy mandi audio.
- A screen reader (NVDA, VoiceOver, TalkBack). The accessibility checks are automated and keyboard-driven only. Placeholder text contrast was not measured separately.
- Safari, Firefox, iOS and Android devices (responsive checks use Chrome emulation).
- The two P2 items in the plan are not built: buyer/seller dispute comparison and a voice stress-test page. No assessment document is in the repository, so the README feature list and the plan were used as the specification.
- Login is limited to 20 attempts per 15 minutes per IP (by design), which the test scripts hit; they now reuse a session token.

## Final completion verification (2026-11-14)

- **Clean clone of the exact commit**: install, build, lint, type check, 106 API tests, 48 web tests and 10 end-to-end tests all passed; production dependency audit: 0 vulnerabilities.
- **Secrets**: no `.env` or key in tracked files or the full Git history.
- **Production-topology rehearsal** (built API with `NODE_ENV=production` and the built frontend on a different origin, throwaway database, real Gnani): 41-check user journey passed, including CORS allow and deny, safe error responses and the demo-mode switch.
- **Database**: the Atlas inventory was read-only. A backup and a dry-run cleanup script exist; nothing was deleted or changed.
- **Not done**: the real Render, Vercel and Atlas environments have not been deployed or tested, so no live-site result exists yet.

## Fresh public repository verification (2026-11-14)

The project was re-created as a new repository with a fresh history, so it was installed and tested again from scratch in the new folder.

| Check | Result |
|---|---|
| `npm ci` | 535 packages installed |
| ESLint (web, API and shared) | 0 problems |
| Type check | 0 errors |
| Web unit tests | **48 / 48 passed** (10 files) |
| API tests | **106 / 106 passed** (9 files) |
| Playwright end-to-end tests | **10 passed, 0 failed, 0 skipped** (installed Chrome, mock Gnani) |
| Production builds | Web and API pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| GitHub Actions on the first pushed commit | `CI` and `Deploy` both concluded successfully. `Deploy` skipped every step because no deployment secrets are configured, so nothing was deployed. |

One environment issue, not an application defect: the first API test run failed in three files with a MongoDB "available disk space is less than required minimum" error, because the drive was nearly full. After freeing disk space the same suite passed 106 / 106.

GitHub Actions results for commits pushed after the first one were not checked when this was written.
