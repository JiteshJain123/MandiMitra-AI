# MandiMitra AI: five-minute demonstration script

> The submission form asks for a **2 to 3 minute** video. Record the sections from 0:00 to 2:45 (problem, new user, speak a sale, confirm and receipt) and stop there (about 2:45). Skip Payments, History and the rest.

Every step below was exercised in real Chrome on this code base. Numbers shown are the ones the app produced.

## Before you start (2 minutes, not part of the five)

1. Servers running: API on http://localhost:4000 and web on http://localhost:5173. Open **http://localhost:5173** in **Chrome** (the microphone needs `localhost` or https).
2. The header must show a green **"Gnani AI connected"**. If it says "not configured", the key is missing in `apps/api/.env`.
3. Do one dry run of the microphone: press the mic once, press **Allow**, speak, stop. (The prompt appears the first time only.)
4. **Do not record your demo sales in the shared "demo account".** Everything saved there is visible to everyone who opens the demo. Use a new account (steps below). Use the demo account only to *show* sample data.
5. Keep a phone recording (WAV/MP3/M4A, under 30 s) of the sentence below as a backup for **Upload audio**.
6. Avoid repeated sign-ins during the demo: login is limited to 20 attempts per 15 minutes per address.

The sentence (Hinglish): *"Bhaiya, 25 quintal gehu becha hai, rate 2400 rupaye per quintal. 2 percent commission aur 500 rupaye transport kaat lena."*
The Hindi alternative: *"भैया, 50 क्विंटल प्याज बेचा है, रेट 2200 रुपये प्रति क्विंटल है। 2 प्रतिशत कमीशन और 500 रुपये ट्रांसपोर्ट चार्ज काट लेना।"*

## 0:00 to 0:30: The problem and the landing page
> "A farmer sells 25 quintal of wheat. The aadhat takes 2 percent, the truck costs ₹500, and the buyer pays half now and half later. Today that lives in a paper bahi or in memory. MandiMitra lets them just say it."

- Show the landing page: the slip fills in from the spoken sentence.
- Click **See how it works**, then point at **Try it in 30 seconds**.

## 0:30 to 1:00: A new user (this is the first-visit experience)
- Click **Create free account**. Name, email, password, language **Hinglish**, **Create account**.
- The dashboard shows ₹0 and the card **"New here? Record your first sale in 3 steps"**. Click **How it works** only if you want to show the Help page (otherwise skip it).

## 1:00 to 2:15: Speak a sale
1. **Record my first sale**. Keep the language on **Hinglish** (or choose **Hindi**).
2. Tap the mic, press **Allow**, say the sentence, press the square.
3. **Transcribe**. > "This is the actual transcript from Gnani Prisma. I can fix any word here."
4. **Fill the sale slip**. Point at the **"Heard: …"** line under each field. > "Anything it did not hear stays empty and highlighted. It never guesses."
5. Expected: **Wheat, 25 quintal, ₹2,400, commission 2%, transport ₹500, net ₹58,300.00**.
6. Change quantity to **30**: net becomes **₹70,060.00**. > "The server does the maths, with exact decimals. The AI never calculates money."
7. **Read summary aloud**: Gnani Timbre speaks the amounts back (replay and download are there).

## 2:15 to 2:45: Nothing is saved until you confirm
- Show that **Confirm and save** is **disabled**. Tick **"I have checked these details and they are correct."**, then **Confirm and save**.
- The receipt opens. Click **PDF**. Read the footer: *"not proof of payment"*.

## 2:45 to 3:30: Payments
- **Record a payment**, choose **Half**, **UPI**, **Save payment**: status becomes **Partially paid**, with the received and outstanding amounts.
- Open **Payments**, tap the suggestion **"Mera kitna paisa pending hai?"**: the answer is shown and can be read aloud.
  > "Questions map to a fixed list of safe queries on your own data. Nothing AI-written ever touches the database."

## 3:30 to 4:15: History, CSV and analytics (they all agree)
- **Transactions**: the sale, with net, outstanding and status. Click **Export CSV** and open it: same numbers, same receipt number.
- **Analytics**: totals, monthly trend, sales by crop, and paid / part-paid / pending.
- Optional, 20 seconds: record a second sale in **Hindi** (or **Upload audio**) to show the other language.

## 4:15 to 5:00: The demo account, trust, and honesty
- Sign out, click **Try the demo account**: the **"Demo account"** badge and sample sales with buyers marked *(demo)*. Open one receipt: it is marked as a demo.
- Say: **audio is never stored**; the transcript is kept only if you tick "Keep the transcript"; the demo account is shared, so do not enter private data.
- Be upfront: the speech accuracy was measured with synthetic speech plus your own live test; deployment and Docker images are not part of this submission.

## If something goes wrong
| Symptom | What to say or do |
|---|---|
| Microphone blocked or no device | The app explains it. Click the lock icon, allow the microphone, reload. Or use **Upload audio**, or **Enter manually**. |
| "Recording is too short" | Speak for at least a second after pressing the mic. Press **Discard** and try again. |
| Wrong word in the transcript | Edit the transcript box, press **Fill the sale slip** again. This is the intended flow. |
| "Too many sign-in attempts" | Wait a few minutes (or restart the API in development). |
| Header: "Gnani AI not configured" or `GNANI_AUTH_FAILED` | Key missing or rejected in `apps/api/.env`; restart the API after fixing it. |
| Internet drops | The speech services need internet. Finish with the already-saved data and Analytics. |
