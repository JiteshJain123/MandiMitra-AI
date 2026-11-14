import { AlarmClock, CheckCircle2, IndianRupee } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPaise } from '@mandimitra/shared';
import { PageHeader } from '@/components/layout/app-shell';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { VoiceAsk } from '@/components/voice-ask';
import { useAllPayments, useAnalytics, useTransactions } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

export function PaymentsPage() {
  const analytics = useAnalytics();
  const outstanding = useTransactions({ status: 'outstanding', sort: 'date', pageSize: 50 });
  const history = useAllPayments();
  const t = analytics.data?.totals;

  return (
    <>
      <PageHeader title="Payments" subtitle="Who still owes you, and what has come in." />
      {analytics.error && <ErrorState message={(analytics.error as Error).message} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Total sales (net)" value={t && formatPaise(t.netPayablePaise, { decimals: false })} />
        <Tile label="Received" value={t && formatPaise(t.receivedPaise, { decimals: false })} tone="mandi" />
        <Tile label="Pending" value={t && formatPaise(t.pendingPaise, { decimals: false })} tone="turmeric" testId="payments-pending" />
        <Tile label="Overdue" value={t && `${formatPaise(t.overduePaise, { decimals: false })}`} hint={t && `${t.overdueCount} sales`} tone="ledger" />
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0">
          <CardHeader><CardTitle>Waiting for payment</CardTitle><span className="text-xs text-ink-faint">Oldest first</span></CardHeader>
          <CardContent className="px-0 pb-2">
            {outstanding.isPending ? <div className="space-y-2 px-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
              : !outstanding.data?.items.length ? <EmptyState icon={CheckCircle2} title="Nothing outstanding" body="Every recorded sale has been paid in full." />
              : (
                <ul className="divide-y divide-line" data-testid="outstanding-list">
                  {outstanding.data.items.map((x) => (
                    <li key={x.id}>
                      <Link to={`/app/transactions/${x.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-mist">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{x.buyerName ?? 'Buyer not recorded'}</p>
                          <p className="truncate text-xs text-ink-faint">{x.cropName} · {formatDate(x.transactionDate)}{x.paymentDueDate ? ` · due ${formatDate(x.paymentDueDate)}` : ''}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="tabular font-semibold">{formatPaise(x.outstandingPaise)}</span>
                          <StatusBadge status={x.paymentStatus} overdue={x.isOverdue} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <VoiceAsk />
          <Card>
            <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
            <CardContent className="px-0 pb-2">
              {history.isPending ? <div className="px-5"><Skeleton className="h-24" /></div>
                : !history.data?.length ? <EmptyState icon={IndianRupee} title="No payments yet" body="Record a payment from any sale's page." />
                : (
                  <ul className="divide-y divide-line text-sm">
                    {history.data.slice(0, 15).map((p) => (
                      <li key={p.id}>
                        <Link to={`/app/transactions/${p.transactionId}`} className="flex justify-between px-5 py-2.5 hover:bg-mist">
                          <span><span className="font-medium">{p.cropName ?? 'Sale'}</span><span className="block text-xs text-ink-faint">{formatDate(p.paidAt)} · {p.method.replace('_', ' ')}</span></span>
                          <span className="tabular font-medium text-mandi-700">+{formatPaise(p.amountPaise)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Tile({ label, value, hint, tone, testId }: { label: string; value?: string; hint?: string; tone?: 'mandi' | 'turmeric' | 'ledger'; testId?: string }) {
  const color = tone === 'mandi' ? 'text-mandi-700' : tone === 'turmeric' ? 'text-turmeric-700' : tone === 'ledger' ? 'text-ledger-700' : 'text-ink';
  return (
    <Card className="p-5">
      <p className="flex items-center gap-1.5 text-xs text-ink-faint">{tone === 'ledger' && <AlarmClock className="size-3.5" />}{label}</p>
      {value ? <p className={`tabular mt-1 text-2xl font-semibold ${color}`} data-testid={testId}>{value}</p> : <Skeleton className="mt-2 h-7 w-28" />}
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </Card>
  );
}
