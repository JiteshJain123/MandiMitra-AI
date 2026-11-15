# MandiMitra AI: Three-Minute Demonstration Script

> The final submission video is approximately 3 minutes long, within the challenge's 2–3 minute requirement. This document includes preparation instructions, the main recording sequence, and optional feature demonstrations for reference. The submitted video is the final source of truth.

## Before you start (not part of the video)

1. Ensure both servers are running:
   - API: http://localhost:4000
   - Web: http://localhost:5173
2. Open http://localhost:5173 in Chrome. Microphone access requires localhost or HTTPS.
3. Check that the header displays the green "Gnani AI connected" indicator.
4. Test the microphone once and grant permission when Chrome asks.
5. Use the demo account for the recording. It contains synthetic sample data.
6. Keep a backup audio recording (WAV/MP3/M4A, under 30 seconds) in case microphone recording fails.
7. Close unnecessary tabs and disable desktop notifications before recording.

### Test transaction

**Hinglish:**

"Bhaiya, 25 quintal gehu becha hai, rate 2400 rupaye per quintal. 2 percent commission aur 500 rupaye transport kaat lena."

Expected transaction details:

- Crop: Wheat (Gehu)
- Quantity: 25 quintals
- Rate: ₹2,400 per quintal
- Commission: 2%
- Transport: ₹500
- Gross amount: ₹60,000
- Commission deduction: ₹1,200
- Net payable: ₹58,300

## Final video recording sequence

### 0:00–0:20 — Introduction

**On screen:** Landing page.

**Say:**

"Hello, I'm Jitesh Jain, and this is MandiMitra AI, my entry for the Great Indian AI Internship Challenge. In India's mandis, many sales are still recorded in paper khatas, with deductions calculated manually. MandiMitra lets farmers and traders simply speak their transactions and maintain digital records."

### 0:20–0:35 — Open the demo

**Do:** Click "Try the demo account" and wait for the dashboard.

**Say:**

"I'll use the demo account with synthetic sample data. The dashboard displays received payments, pending amounts and overdue sales. The green badge indicates that Gnani AI is connected."

### 0:35–1:05 — Record a sale

**Do:**
1. Click "Record a sale".
2. Tap the microphone button.
3. Speak the Hinglish test transaction.
4. Stop the recording.

**Say while it processes:**

"My voice goes to the backend, which sends it to Gnani Prisma for speech-to-text. The browser never communicates directly with Gnani, so the API key remains protected."

### 1:05–1:45 — Review the transaction

**Do:** Show the extracted fields and calculation panel.

**Say:**

"The application has extracted the crop, quantity, rate, commission and transport charges. It also shows the exact words heard for each field. Anything it cannot identify remains empty instead of being guessed.

The financial calculations are performed on the server."

**Expected calculation:**

- Gross: ₹60,000
- Commission: ₹1,200
- Transport: ₹500
- Net payable: ₹58,300

**Do:** Press the read-back button.

**Say:**

"Gnani Timbre reads the transaction summary back in Hindi, allowing users to verify the details by listening."

### 1:45–2:00 — Confirmation and receipt

**Do:**
1. Tick "I have checked these details".
2. Click Confirm.
3. Show the generated receipt.

**Say:**

"Nothing is saved until the user reviews the details and explicitly confirms. The application then generates a receipt that can be printed or saved as a PDF."

### 2:00–2:25 — Payments, questions and analytics

**Do:**
1. Open Payments.
2. Return to the Dashboard.
3. Ask the suggested question: "Mera kitna paisa pending hai?"
4. Open Analytics.

**Say:**

"Users can track full and partial payments. They can also ask questions about their own transaction records using voice or text. Analytics provides monthly trends and sales breakdowns by crop."

### 2:25–2:50 — Closing

**Do:** Open the public GitHub repository.

https://github.com/JiteshJain123/MandiMitra-AI

**Say:**

"Transaction extraction uses deterministic application logic rather than relying on a language model to invent values. The project includes automated API, web and end-to-end tests. The complete source code is publicly available on GitHub.

Thank you, Gnani AI, for the opportunity to build with Prisma and Timbre APIs."

---

## Optional feature demonstrations (not included in the submitted video)

The following features are available for additional evaluation or a longer walkthrough:

### Payments
- Record full and partial payments.
- Track received and outstanding amounts.
- Detect overdue payments.
- View payment status.

### Transaction history
- Search and filter transactions.
- View transaction receipts.
- Export transaction records as CSV.

### Analytics
- Monthly sales trends.
- Sales grouped by crop.
- Paid, partially paid and pending transaction breakdowns.

### Language support
- Hindi, Hinglish and English voice input.
- Hindi voice read-back using Gnani Timbre.

### New-user experience
- Create a new account.
- View first-time guidance.
- Record the first transaction.

## Recording notes and troubleshooting (not part of the video)

| Problem | What to do |
|---|---|
| Microphone blocked or unavailable | Allow microphone access in Chrome site settings, reload, or use Upload audio. |
| Recording is too short | Speak for at least one second after starting the recording. |
| Incorrect transcript | Edit the transcript and fill the sale slip again. |
| Too many sign-in attempts | Wait a few minutes before trying again. |
| Gnani AI not configured | Check the Gnani API credentials in `apps/api/.env` and restart the API server. |
| Internet connection drops | Gnani speech services require internet access. Continue with already-saved data where possible. |

## Important implementation and accuracy notes

- Gnani Prisma provides speech-to-text functionality.
- Gnani Timbre provides text-to-speech functionality.
- Transaction extraction and financial calculations use deterministic application logic.
- Financial calculations are performed on the backend.
- Users must explicitly confirm transaction details before saving.
- The demo account contains synthetic sample data and is shared.
- Real-world speech accuracy across different accents and noisy mandi environments has not been measured.
- The application is demonstrated locally. A public production deployment is not currently available.

## Project links

- **GitHub:** https://github.com/JiteshJain123/MandiMitra-AI
- **Demo video:** https://youtu.be/eWOlTUGT_gc
- **LinkedIn announcement:** https://lnkd.in/p/gSGjv3UK
