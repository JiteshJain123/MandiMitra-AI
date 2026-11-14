# MandiMitra AI: one-page solution pitch

**Great Indian AI Internship Challenge** · Your voice. Your transactions. Your digital records.

## Problem
Mandi sales are still written in a paper *bahi-khata* or not recorded at all. Commission (*aadhat*), transport and labour deductions are worked out by hand, part payments are remembered rather than tracked, and disputes follow. Form-based apps fail people who would rather speak than type, and who are more comfortable in Hindi or Hinglish than English.

## Who it is for
Farmers, small traders and mandi workers who sell crops and need a trustworthy record of what was sold, what was deducted and what is still owed.

## Solution
The user speaks a sale, for example *"25 quintal gehu becha, rate 2400 per quintal, 2 percent commission aur 500 rupaye transport kaat lena."* MandiMitra:
1. records the voice in the browser and transcribes it with **Gnani Prisma** (`prisma-v3.0`; Hindi, Hinglish and English);
2. fills a sale slip and shows the exact words heard for each field. Anything not heard stays empty and highlighted; nothing is guessed;
3. calculates every amount on the server to the paisa (integer paise, `decimal.js`);
4. reads the total back in the user's language with **Gnani Timbre** (`timbre-v2.5`);
5. saves only after explicit confirmation, then gives a receipt (print or PDF);
6. tracks full and part payments, and answers questions like "Mera kitna paisa pending hai?" by voice or text.

## Gnani technology used
- **Prisma speech-to-text** (`POST /stt/v3`): Hindi, Hinglish (`hi-IN,en-IN`), English and automatic language detection, with mandi key terms.
- **Timbre text-to-speech** (`/api/v1/tts/inference`): spoken read-back of the sale summary and of answers.
- Both are called only by the backend, so the API key never reaches the browser.

## Why it is trustworthy
Money is never calculated by AI or the browser. Extraction is rule-based and testable. Nothing is saved without confirmation, and saves are idempotent. Audio is processed in memory and never stored.

## What exists today
React and Node/Express with MongoDB. 106 API, 48 web and 10 end-to-end tests pass. Verified in real Chrome in Hindi, Hinglish and English. Includes history with search and CSV export, payments, analytics and in-app help.

## Honest limits
Accuracy on real accents and noisy mandi audio has not been measured. The extractor is tuned for Hindi, Hinglish and English.

## Contribution
**Jitesh Jain (solo entry):** project owner and developer. Defined the problem and requirements, directed the build, reviewed and tested the application, and prepared this submission. Developed with AI coding assistance.
