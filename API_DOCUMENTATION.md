# API documentation

Base URL: `http://localhost:4000` (dev) or your Render URL. All bodies are JSON unless stated. Money in responses is **integer paise** (₹1 = 100). Money in requests is **rupees**.

**Auth:** `Authorization: Bearer <token>` on every endpoint except health, register, login and demo.

**Errors** always use this shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Quantity must be greater than 0", "details": [{ "path": "quantity", "message": "..." }] } }
```

## Health

### `GET /api/health`
Returns `200`, or `503` if the database is down. Never calls Gnani.
```json
{ "status": "ok", "uptimeSeconds": 12, "database": "up",
  "gnani": { "configured": true, "sttModel": "prisma-v3.0", "ttsModel": "timbre-v2.5",
             "stt": { "lastSuccessAt": "…", "lastErrorAt": "…", "lastErrorCode": "GNANI_TIMEOUT" }, "tts": {} },
  "demoMode": true }
```

## Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password (≥8), role?: "farmer"\|"trader", preferredLanguage?: "hi"\|"hinglish"\|"en"\|"mr"\|… }` | `201 { token, user }`. `409 EMAIL_TAKEN` |
| POST | `/api/auth/login` | `{ email, password }` | `200 { token, user }`. `401 INVALID_CREDENTIALS` |
| POST | `/api/auth/demo` | none | `200 { token, user }` (synthetic demo user). `403 DEMO_DISABLED` |
| GET | `/api/auth/me` | none | `{ user }` |
| PATCH | `/api/auth/me` | `{ name?, preferredLanguage?, saveTranscriptsByDefault? }` | `{ user }` |
| POST | `/api/auth/logout` | none | `204`. Revokes all of the user's tokens. |
| POST | `/api/auth/demo/reset` | none | `204` (demo user only) |

`user` = `{ id, name, email, role, preferredLanguage, saveTranscriptsByDefault, isDemo }`

Rate limit: 20 requests per 15 minutes per IP on register, login and demo.

## Voice

### `POST /api/voice/transcribe` (multipart)
Fields: `audio` (WAV/MP3/OGG/FLAC/AAC/M4A, at most 30 s, at most 5 MB) and `language` (an app language code or `auto`; defaults to the user's preference).
```json
{ "transcript": "Bhaiya, 25 quintal gehu becha hai, …", "requestId": "…", "model": "prisma-v3.0",
  "detectedLanguageCode": "hi-IN", "languageCodeSent": "hi-IN,en-IN", "truncated": false, "processingTimeSeconds": 0.8,
  "audio": { "format": "wav", "durationSeconds": 6.2 },
  "extraction": { "draft": { "cropName": "Wheat", "quantity": 25, "unit": "quintal", "ratePerUnit": 2400,
                             "commissionPercentage": 2, "transportCharge": 500, "otherDeductions": null, "paymentStatus": "pending" },
                  "missingFields": [], "warnings": [], "evidence": { "quantity": "25 quintal", … } } }
```
`extraction` is `null` when the transcript is empty (no speech is not treated as an error).

Errors: `400 AUDIO_MISSING | AUDIO_TOO_SHORT | AUDIO_TOO_LONG | AUDIO_INVALID`, `413 AUDIO_TOO_LARGE`, `415 AUDIO_UNSUPPORTED_FORMAT` (including WebM), `503 GNANI_NOT_CONFIGURED`, and the Gnani errors listed below.

### `POST /api/voice/extract`
`{ transcript }` → the `extraction` object above. Used after the user edits the transcript.

### `POST /api/voice/speak`
`{ text (≤600 chars), language? }` → `200` with **binary audio** (`Content-Type: audio/mpeg`). The header `X-TTS-Voice` names the Timbre voice used.

### `POST /api/voice/query`
`{ question }` → `{ intent, crop?, period, answerText, data, speechLanguage }`
Intents: `pending_total`, `unpaid_list`, `overdue_list`, `crop_sales`, `received_total`, `unknown`.

Voice endpoints that call Gnani are limited to 40 requests per 10 minutes per user.

### Gnani error mapping

| Upstream | Our response |
|---|---|
| 401 / 403 | `502 GNANI_AUTH_FAILED` |
| 402 | `502 GNANI_INSUFFICIENT_CREDIT` |
| 429 | `429 GNANI_RATE_LIMITED` |
| 504, `UPSTREAM_TIMEOUT`, or client timeout | `504 GNANI_TIMEOUT` |
| 400 / 422 | `400 GNANI_<UPSTREAM_CODE>`, e.g. `GNANI_AUDIO_CONVERSION_ERROR` |
| 503 | `503 GNANI_UNAVAILABLE` |
| Network failure | `502 GNANI_NETWORK_ERROR` |
| 200 with an unexpected body | `502 GNANI_INVALID_RESPONSE` |
| Other | `502 GNANI_UPSTREAM_ERROR` |

## Transactions

Transaction input (amounts in rupees):
```json
{ "cropName": "Wheat", "quantity": 25, "unit": "quintal|kg|ton", "ratePerUnit": 2400,
  "commissionPercentage": 2, "transportCharge": 500, "otherDeductions": 0,
  "buyerName": "…", "sellerName": "…", "transactionDate": "2026-11-13", "paymentDueDate": "2026-11-28",
  "paymentStatus": "pending|disputed", "paymentNotes": "…",
  "transcript": "…", "storeTranscript": false, "extractedData": { …draft… } }
```

| Method | Path | Notes |
|---|---|---|
| POST | `/api/transactions/preview` | Input as above → `{ amounts: { ratePerUnitPaise, grossAmountPaise, commissionAmountPaise, transportChargePaise, otherDeductionsPaise, netAmountPaise }, summaryText, speechLanguage }`. Saves nothing. |
| POST | `/api/transactions` | Input plus **`"confirmed": true`** and optional `source`. Header `Idempotency-Key: <8–100 chars [A-Za-z0-9_-]>`. Returns `201 { transaction, duplicate:false }`, or `200 { …, duplicate:true }` for a repeated key. |
| GET | `/api/transactions` | Query: `page`, `pageSize (≤100)`, `q`, `status (pending\|partially_paid\|paid\|disputed\|outstanding\|overdue)`, `crop`, `from`, `to`, `sort (date\|-date\|net\|-net\|gross\|-gross\|crop\|-crop)` → `{ items, page, pageSize, total, totalPages }` |
| GET | `/api/transactions/export.csv` | Same filters. Returns UTF-8 CSV with a BOM, with formula-injection protection. |
| GET | `/api/transactions/:id` | `{ transaction }`. Another user's ID returns 404. |
| PATCH | `/api/transactions/:id` | Any subset of the input fields. Amounts are recalculated. `409 NET_BELOW_RECEIVED` if payments already exceed the new net amount. |
| DELETE | `/api/transactions/:id` | `204`. Also deletes the payment records. |
| GET | `/api/transactions/:id/receipt.pdf` | `application/pdf` |
| GET | `/api/transactions/:id/payments` | `{ payments }` |
| POST | `/api/transactions/:id/payments` | `{ amount (rupees), method: cash\|upi\|bank_transfer\|cheque\|other, paidAt?, note? }` → `201 { transaction, payment }`. Returns `400 OVERPAYMENT`, `409 ALREADY_PAID` or `409 CONCURRENT_UPDATE` where applicable. |
| DELETE | `/api/transactions/:id/payments/:paymentId` | `{ transaction }` (status recalculated) |

`transaction` DTO: the input fields plus `id, receiptNumber, ratePerUnitPaise, grossAmountPaise, commissionAmountPaise, transportChargePaise, otherDeductionsPaise, netAmountPaise, amountReceivedPaise, outstandingPaise, isOverdue, confirmed, confirmedAt, createdAt, updatedAt`.

Other calculation errors: `400 DEDUCTIONS_EXCEED_GROSS | INVALID_QUANTITY | INVALID_RATE | INVALID_COMMISSION`.

## Payments and analytics

- `GET /api/payments?limit=50` → `{ payments: [ …PaymentRecord, cropName, receiptNumber ] }`, newest first.
- `GET /api/analytics` → `{ totals: { transactions, grossSalesPaise, netPayablePaise, receivedPaise, pendingPaise, partiallyPaidCount, overdueCount, overduePaise }, statusDistribution[], cropWise[], monthly[12], recent[5] }`.
