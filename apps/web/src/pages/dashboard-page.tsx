import { ArrowUpRight, Mic, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPaise } from '@mandimitra/shared';
import { PageHeader } from '@/components/layout/app-shell';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/card';
import { GettingStarted } from '@/components/getting-started';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { VoiceAsk } from '@/components/voice-ask';
import { useAuth } from '@/lib/auth';
import { useAnalytics } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isPending, error, refetch } = useAnalytics();
  const first = user?.name.split(' ')[0];

  return (
    <>
      <PageHeader title={`Namaste, ${first}`} subtitle="Here is where your money stands today." actions={<Button asChild size="lg"><Link to="/app/record"><Mic /> Record a sale</Link></Button>} />
      {error && <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />}
      {data?.totals.transactions === 0 && <GettingStarted />}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <div className="grid sm:grid-cols-[1.2fr_1fr]">
            <div className="bg-mandi-800 p-6 text-white">
              <p className="text-sm text-mandi-100">Still to be paid to you</p>
              {isPending ? <Skeleton className="mt-3 h-10 w-40 bg-white/10" /> : (
                <p className="tabular mt-2 font-display text-4xl font-semibold" data-testid="pending-total">{formatPaise(data?.totals.pendingPaise ?? 0, { decimals: false })}</p>
              )}
              {!!data?.totals.overdueCount && (
                <p className="mt-3 text-sm text-turmeric-50">
                  {formatPaise(data.totals.overduePaise, { decimals: false })} overdue across {data.totals.overdueCount} {data.totals.overdueCount === 1 ? 'sale' : 'sales'}
                </p>
              )}
              <Link to="/app/payments" className="mt-4 inline-flex items-center gap-1 py-1.5 text-sm font-medium text-white underline-offset-4 hover:underline">See who owes what <ArrowUpRight className="size-4" /></Link>
            </div>
            <dl className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-1 sm:divide-x-0">
              <Stat label="Received" value={data && formatPaise(data.totals.receivedPaise, { decimals: false })} />
              <Stat label="Total sales (gross)" value={data && formatPaise(data.totals.grossSalesPaise, { decimals: false })} />
              <Stat label="Sales recorded" value={data && String(data.totals.transactions)} />
              <Stat label="Part-paid" value={data && String(data.totals.partiallyPaidCount)} />
            </dl>
          </div>
        </Card>
        <VoiceAsk />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent sales</CardTitle>
          <Link to="/app/transactions" className="inline-flex items-center py-1.5 text-sm font-medium text-mandi-700 hover:underline">View all</Link>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {isPending ? <div className="space-y-2 px-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            : !data?.recent.length ? (
              <EmptyState icon={Receipt} title="No sales yet" body="Record your first sale by voice. It takes about half a minute." action={<Button asChild><Link to="/app/record"><Mic /> Record a sale</Link></Button>} />
            ) : (
              <ul className="divide-y divide-line">
                {data.recent.map((t) => (
                  <li key={t.id}>
                    <Link to={`/app/transactions/${t.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-mist">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.cropName} · {t.quantity} {t.unit}</p>
                        <p className="truncate text-xs text-ink-faint">{formatDate(t.transactionDate)}{t.buyerName ? ` · ${t.buyerName}` : ''}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="tabular font-semibold">{formatPaise(t.netAmountPaise)}</span>
                        <StatusBadge status={t.paymentStatus} overdue={t.isOverdue} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="tabular mt-1 text-lg font-semibold">{value ?? <Skeleton className="h-6 w-20" />}</dd>
    </div>
  );
}
