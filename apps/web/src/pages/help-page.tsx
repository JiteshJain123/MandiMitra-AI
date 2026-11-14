import { ChevronDown, Keyboard, Lightbulb, Mic, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EXAMPLE_QUESTIONS, EXAMPLE_SALES, formatPaise } from '@mandimitra/shared';
import { Logo } from '@/components/layout/logo';
import { PageHeader } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STEPS = [
  { title: 'Open "Record sale" and tap the big microphone', body: 'Your browser will ask to use the microphone the first time. Press Allow.' },
  { title: 'Say the sale in one go', body: 'Crop, quantity, rate, commission and any deductions, like the examples below. You have up to 29 seconds. Press the square to stop.' },
  { title: 'Press "Transcribe" and check the words', body: 'You will see exactly what the app heard. Fix any mistake, then press "Fill the sale slip". Anything it did not hear is left empty and highlighted. The app never guesses.' },
  { title: 'Press "Read summary aloud"', body: 'The app reads the amounts back to you in your language, so you can confirm without reading.' },
  { title: 'Tick "I have checked these details" and press "Confirm and save"', body: 'Only now is the sale saved. You get a receipt to print or download as PDF, and the money still owed is tracked under Payments.' },
] as const;

const PAGES = [
  ['Dashboard', 'How much money is still to come, what you have received, and your latest sales.'],
  ['Record sale', 'Speak, upload a recording, or type a sale in by hand.'],
  ['Transactions', 'Every confirmed sale. Search, filter, open the receipt, edit, or export everything to CSV.'],
  ['Payments', 'Who still owes you. Record full or part payments; overdue sales are highlighted.'],
  ['Analytics', 'Sales by month and by crop, and how much is paid, part-paid or pending.'],
  ['Settings', 'Your name and language, and whether to keep transcripts of your recordings.'],
] as const;

const FAQ = [
  ['Is my voice recording saved?', 'No. The audio is sent for transcription and then discarded; it is never stored. Only the text is kept, and only if you tick "Keep the transcript with this record" on the sale slip.'],
  ['Who does the calculation?', 'The server, using exact decimal arithmetic, to the paisa. The speech service and the browser never calculate money. Every amount you see was calculated by the server.'],
  ['Is the receipt legal proof of payment?', 'No. It is your own record of what you confirmed. It is not proof of payment by the other party.'],
  ['What is the demo account?', 'A shared account filled with sample sales so you can look around. Everyone who opens it sees the same data, so do not enter anything private there. Create your own account to keep real records.'],
  ['Can I use it without speaking?', 'Yes. On "Record sale" press "Enter manually" and type the sale in, or use "Upload audio" for a recording you already have (WAV, MP3, OGG, FLAC or M4A, up to 30 seconds).'],
] as const;

const rupees = (n: number) => formatPaise(Math.round(n * 100), { decimals: false });

/** The guide itself. `signedIn` only decides where the call-to-action buttons point. */
export function HelpContent({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="space-y-4" data-testid="help-content">
      <Card>
        <CardHeader><CardTitle>What is MandiMitra?</CardTitle></CardHeader>
        <CardContent>
          <p className="max-w-3xl leading-relaxed text-ink-soft">
            MandiMitra is a voice-first record book for farmers, traders and mandi workers. You <strong className="text-ink">speak a sale</strong> in Hindi, Hinglish or English. The app
            writes it down, works out the commission and deductions, reads the total back to you, and keeps a record of every rupee still owed. It replaces the paper khata.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {signedIn ? (
              <Button asChild><Link to="/app/record"><Mic /> Record a sale now</Link></Button>
            ) : (
              <>
                <Button asChild><Link to="/register">Create free account</Link></Button>
                <Button asChild variant="secondary"><Link to="/login">Try the demo</Link></Button>
              </>
            )}
          </div>
          {!signedIn && <p className="mt-3 text-sm text-ink-faint">To look around first, press "Try the demo", then "Try the demo account" on the sign-in page. It has sample sales already.</p>}
        </CardContent>
      </Card>

      <Card id="first-sale">
        <CardHeader><CardTitle>Record your first sale in 5 steps</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mandi-700 text-sm font-semibold text-white" aria-hidden>{i + 1}</span>
                <div>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card id="what-to-say">
        <CardHeader><CardTitle>What to say</CardTitle></CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
            Say the crop, how much, the rate, then the commission and other deductions. Numbers can be digits or words ("do hazaar chaar sau"). You can leave out commission or transport if there is none.
          </p>
          <ul className="mt-4 space-y-4">
            {EXAMPLE_SALES.map((e) => (
              <li key={e.id} className="rounded-lg border border-line bg-mist p-4" data-testid={`example-${e.id}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{e.language}</p>
                <blockquote className="mt-1 text-[15px] leading-relaxed text-ink" lang={e.id === 'hindi' ? 'hi' : undefined}>“{e.text}”</blockquote>
                <p className="mt-2 text-sm text-ink-soft">
                  The slip will show: <span className="font-medium text-ink">{e.fills.cropName}</span> · {e.fills.quantity} {e.fills.unit} · {rupees(e.fills.ratePerUnit)} per {e.fills.unit} ·
                  commission {e.fills.commissionPercentage}% · transport {rupees(e.fills.transportCharge)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 text-sm text-ink-soft"><Lightbulb className="mt-0.5 size-4 shrink-0 text-turmeric-700" aria-hidden /> Speak clearly, close to the phone, and away from loud machines. If a word is wrong, fix it in the transcript box before you press "Fill the sale slip".</p>
        </CardContent>
      </Card>

      <Card id="microphone">
        <CardHeader><CardTitle>Microphone not working?</CardTitle></CardHeader>
        <CardContent>
          <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft marker:text-mandi-500">
            <li>Press <strong className="text-ink">Allow</strong> when the browser asks to use the microphone.</li>
            <li>If you pressed Block by mistake, click the lock icon next to the web address, switch Microphone to Allow, and reload the page.</li>
            <li>The microphone only works on a secure page (https, or localhost while testing). Chrome and Edge work best.</li>
            <li>No microphone, or it still fails? You can still record a sale: <span className="inline-flex items-center gap-1 font-medium text-ink"><Upload className="size-3.5" aria-hidden /> Upload audio</span> or <span className="inline-flex items-center gap-1 font-medium text-ink"><Keyboard className="size-3.5" aria-hidden /> Enter manually</span> on the "Record sale" page.</li>
          </ul>
        </CardContent>
      </Card>

      <Card id="pages">
        <CardHeader><CardTitle>What is on each page</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {PAGES.map(([name, body]) => (
              <div key={name}>
                <dt className="text-sm font-medium">{name}</dt>
                <dd className="text-sm text-ink-soft">{body}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card id="ask">
        <CardHeader><CardTitle>Ask about your money</CardTitle></CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm text-ink-soft">On the Dashboard and Payments pages you can type or speak a question and hear the answer, for example:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => <li key={q} className="rounded-full bg-mandi-50 px-3 py-1.5 text-sm text-mandi-800">{q}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card id="faq">
        <CardHeader><CardTitle>Common questions</CardTitle></CardHeader>
        <CardContent className="divide-y divide-line px-0 py-0">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {q}<ChevronDown className="size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">{a}</p>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** Inside the app (signed in): /app/help */
export function HelpPage() {
  return (
    <>
      <PageHeader title="How MandiMitra works" subtitle="Everything you need to record your first sale in under a minute." />
      <HelpContent signedIn />
    </>
  );
}

/** For visitors who are not signed in: /help */
export function PublicHelpPage() {
  return (
    <div className="min-h-dvh bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-y-3 px-5 py-4">
          <Link to="/" aria-label="MandiMitra home"><Logo /></Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button>
            <Button asChild><Link to="/register">Get started</Link></Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8">
        <PageHeader title="How MandiMitra works" subtitle="Everything you need to record your first sale in under a minute." />
        <HelpContent signedIn={false} />
      </main>
    </div>
  );
}
