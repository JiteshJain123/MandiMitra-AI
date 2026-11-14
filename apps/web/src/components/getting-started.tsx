import { BookOpen, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FIRST_EXAMPLE } from '@mandimitra/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const STEPS = [
  ['Tap the microphone', 'On "Record sale", then say your sale like the example on this page.'],
  ['Check the slip', 'The app fills in the crop, quantity, rate and deductions. Fix anything that is wrong.'],
  ['Confirm and save', 'You get a receipt, and the payment is tracked until it is paid.'],
] as const;

/** Shown on the dashboard only while the user has no sales yet. */
export function GettingStarted() {
  const example = FIRST_EXAMPLE;
  return (
    <Card className="mb-4 overflow-hidden border-mandi-200" data-testid="getting-started">
      <div className="grid gap-6 p-5 lg:grid-cols-[1.2fr_1fr] lg:p-6">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-mandi-900">New here? Record your first sale in 3 steps</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mandi-700 text-xs font-semibold text-white" aria-hidden>{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-ink">{title}</p>
                  <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild><Link to="/app/record"><Mic /> Record my first sale</Link></Button>
            <Button asChild variant="secondary"><Link to="/app/help"><BookOpen /> How it works</Link></Button>
          </div>
        </div>
        <div className="rounded-lg bg-mist p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Try saying</p>
          <blockquote className="mt-1.5 leading-relaxed text-ink">“{example.text}”</blockquote>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">Hindi, Hinglish and English all work. If the microphone is not available you can upload a recording or type the sale in.</p>
        </div>
      </div>
    </Card>
  );
}
