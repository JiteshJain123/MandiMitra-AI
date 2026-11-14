import { CheckCircle2, FileText, IndianRupee, Mic, ShieldCheck, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FIRST_EXAMPLE } from '@mandimitra/shared';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';

const SPOKEN = FIRST_EXAMPLE.text;
const LINES = [
  ['Crop', 'Wheat'], ['Quantity', '25 quintal'], ['Rate', '₹2,400 / quintal'], ['Gross', '₹60,000.00'],
  ['Commission 2%', '− ₹1,200.00'], ['Transport', '− ₹500.00'],
] as const;

/** The one animated moment: a spoken sentence turning into a filled sale slip. */
function SlipDemo() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(LINES.length + 1); return; }
    const t = setInterval(() => setShown((s) => (s > LINES.length ? s : s + 1)), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative">
      <div className="mb-4 flex items-start gap-3 rounded-2xl rounded-bl-sm bg-mandi-800 p-4 text-sm leading-relaxed text-mandi-50 sm:text-[15px]">
        <Mic className="mt-0.5 size-4 shrink-0 text-turmeric-500" aria-hidden />
        <p lang="hi-Latn">{SPOKEN}</p>
      </div>
      <div className="rounded-slip border border-line bg-white shadow-[0_24px_60px_-30px_rgb(20_83_45/0.45)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs text-ink-faint">
          <span>Sale slip</span><span className="tabular">MM-20261113-4F1A</span>
        </div>
        <dl className="slip-ruled px-5 pt-1">
          {LINES.map(([k, v], i) => (
            <div key={k} className={`flex h-11 items-center justify-between text-sm ${i < shown ? 'ink-in' : 'opacity-0'}`}>
              <dt className="text-ink-soft">{k}</dt><dd className="tabular font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className={`flex items-baseline justify-between border-t border-line bg-mandi-50 px-5 py-4 ${shown > LINES.length ? 'ink-in' : 'opacity-0'}`}>
          <span className="text-sm font-medium">Net payable</span>
          <span className="tabular font-display text-3xl font-semibold text-mandi-700">₹58,300</span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { icon: Mic, title: 'Speak the sale', body: 'Hindi, Hinglish or English, the way you already say it at the mandi. Gnani Prisma turns your voice into text.' },
  { icon: FileText, title: 'Check the slip', body: 'Crop, quantity, rate and deductions are filled in for you. Anything it did not hear clearly is left blank for you to fill.' },
  { icon: Volume2, title: 'Hear it back', body: 'The calculated amounts are read aloud in your language with Gnani Timbre, so you can confirm without reading.' },
  { icon: CheckCircle2, title: 'Confirm and keep', body: 'Only confirmed sales are saved. You get a receipt to print or share, and the payment is tracked until it is paid.' },
];

export function LandingPage() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-3 px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><a href="#how-it-works">How it works</a></Button>
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/help">Help</Link></Button>
          <Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button>
          <Button asChild><Link to="/register">Get started</Link></Button>
        </nav>
      </header>

      <main>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-mandi-900 sm:text-5xl lg:text-6xl">
            Bolo sauda.<br />Paao pakka hisaab.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
            MandiMitra listens to your mandi sale, works out commission and deductions to the paisa, reads the total back to you, and keeps a record of every rupee still owed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/register">Create free account</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link to="/login">Try the demo</Link></Button>
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-faint">
            <span>Your voice. Your transactions. Your digital records.</span>
            <a href="#how-it-works" className="font-medium text-mandi-700 underline-offset-4 hover:underline">See how it works ↓</a>
          </p>
        </div>
        <SlipDemo />
      </section>

      <section id="how-it-works" className="scroll-mt-4 border-y border-line bg-mist">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-mandi-700">How it works</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">From a spoken sentence to a confirmed record</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title}>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-mandi-700 text-sm font-semibold text-white">{i + 1}</span>
                  <Icon className="size-5 text-mandi-500" aria-hidden />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 grid gap-6 rounded-slip border border-line bg-white p-6 lg:grid-cols-[1.3fr_1fr] lg:items-center" data-testid="try-it">
            <div>
              <h3 className="font-display text-xl font-semibold text-mandi-900">Try it in 30 seconds</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Press <strong className="text-ink">Try the demo</strong>, then <strong className="text-ink">Try the demo account</strong> on the sign-in page. Open <strong className="text-ink">Record sale</strong> and say something like:
              </p>
              <blockquote className="mt-3 rounded-lg bg-mist p-3 text-sm leading-relaxed text-ink" lang="hi-Latn">“{SPOKEN}”</blockquote>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button asChild size="lg"><Link to="/login">Try the demo</Link></Button>
              <Button asChild size="lg" variant="secondary"><Link to="/help">Read the full guide</Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
        <div>
          <IndianRupee className="size-6 text-mandi-700" />
          <h3 className="mt-3 font-semibold">Know what is still owed</h3>
          <p className="mt-1.5 text-sm text-ink-soft">Ask “Mera kitna paisa pending hai?” and hear the answer. Part payments and overdue amounts are tracked per sale.</p>
        </div>
        <div>
          <ShieldCheck className="size-6 text-mandi-700" />
          <h3 className="mt-3 font-semibold">Money maths you can trust</h3>
          <p className="mt-1.5 text-sm text-ink-soft">Amounts are calculated on the server with exact decimal arithmetic. AI never does the sums.</p>
        </div>
        <div>
          <FileText className="size-6 text-mandi-700" />
          <h3 className="mt-3 font-semibold">Your record, not a legal one</h3>
          <p className="mt-1.5 text-sm text-ink-soft">Receipts are personal records of what you confirmed. They are not proof of payment by the other party.</p>
        </div>
      </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-sm text-ink-faint">
          <Logo />
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/help" className="font-medium text-mandi-700 hover:underline">Help</Link>
            <span>Speech by Gnani AI (Prisma and Timbre)</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
