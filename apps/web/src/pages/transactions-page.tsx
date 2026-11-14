import { ChevronLeft, ChevronRight, Download, ListChecks, Loader2, Mic, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatPaise, KNOWN_CROPS } from '@mandimitra/shared';
import { PageHeader } from '@/components/layout/app-shell';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api, downloadBlob } from '@/lib/api';
import { useTransactions } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

export function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [exporting, setExporting] = useState(false);
  const filters = {
    page: Number(params.get('page') ?? 1),
    pageSize: 10,
    q: params.get('q') ?? undefined,
    status: params.get('status') ?? undefined,
    crop: params.get('crop') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    sort: params.get('sort') ?? '-date',
  };
  const { data, isPending, isFetching, error, refetch } = useTransactions(filters);

  const set = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const t = setTimeout(() => { if (q !== (params.get('q') ?? '')) set('q', q || undefined); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function exportCsv() {
    setExporting(true);
    try {
      const qs = new URLSearchParams(Object.entries(filters).filter(([k, v]) => v && k !== 'page' && k !== 'pageSize').map(([k, v]) => [k, String(v)]));
      const { blob, filename } = await api.blob(`/api/transactions/export.csv?${qs}`);
      downloadBlob(blob, filename ?? 'transactions.csv');
    } finally { setExporting(false); }
  }

  return (
    <>
      <PageHeader title="Transactions" subtitle="Every confirmed sale, newest first." actions={
        <>
          <Button variant="secondary" onClick={exportCsv} disabled={exporting || !data?.total}>{exporting ? <Loader2 className="animate-spin" /> : <Download />} Export CSV</Button>
          <Button asChild><Link to="/app/record"><Mic /> Record a sale</Link></Button>
        </>
      } />

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr]">
        <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Crop, buyer, seller or receipt no." className="pl-9" aria-label="Search transactions" />
        </div>
        <Select aria-label="Payment status" value={filters.status ?? ''} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="outstanding">Not fully paid</option>
          <option value="overdue">Overdue</option>
          <option value="pending">Pending</option>
          <option value="partially_paid">Partially paid</option>
          <option value="paid">Paid</option>
          <option value="disputed">Disputed</option>
        </Select>
        <Select aria-label="Crop" value={filters.crop ?? ''} onChange={(e) => set('crop', e.target.value)}>
          <option value="">All crops</option>
          {KNOWN_CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input type="date" aria-label="From date" value={filters.from ?? ''} onChange={(e) => set('from', e.target.value)} />
        <Input type="date" aria-label="To date" value={filters.to ?? ''} onChange={(e) => set('to', e.target.value)} />
        <Select aria-label="Sort" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="-date">Newest first</option>
          <option value="date">Oldest first</option>
          <option value="-net">Net: high to low</option>
          <option value="net">Net: low to high</option>
          <option value="crop">Crop A–Z</option>
        </Select>
      </Card>

      {error && <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />}

      <Card className="overflow-hidden">
        {isPending ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.items.length ? (
          params.toString()
            ? <EmptyState icon={Search} title="No matching sales" body="Try a different search or clear the filters." action={<Button variant="secondary" onClick={() => { setQ(''); setParams({}); }}>Clear filters</Button>} />
            : <EmptyState icon={ListChecks} title="No sales recorded yet" body="Speak your first sale and it will appear here." action={<Button asChild><Link to="/app/record"><Mic /> Record a sale</Link></Button>} />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : ''}>
            <table className="hidden w-full text-sm md:table" data-testid="transactions-table">
              <thead className="bg-mist text-left text-xs text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Crop</th>
                  <th className="px-4 py-3 font-medium">Buyer</th>
                  <th className="px-4 py-3 text-right font-medium">Net payable</th>
                  <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((t) => (
                  <tr key={t.id} className="hover:bg-mist">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(t.transactionDate)}</td>
                    <td className="px-4 py-3"><Link to={`/app/transactions/${t.id}`} className="font-medium text-ink hover:text-mandi-700 hover:underline">{t.cropName}</Link><span className="text-ink-faint"> · {t.quantity} {t.unit}</span></td>
                    <td className="max-w-48 truncate px-4 py-3 text-ink-soft">{t.buyerName ?? '—'}</td>
                    <td className="tabular px-4 py-3 text-right font-medium">{formatPaise(t.netAmountPaise)}</td>
                    <td className="tabular px-4 py-3 text-right">{t.outstandingPaise ? formatPaise(t.outstandingPaise) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.paymentStatus} overdue={t.isOverdue} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {data.items.map((t) => (
                <li key={t.id}>
                  <Link to={`/app/transactions/${t.id}`} className="block px-4 py-3">
                    <div className="flex justify-between gap-2"><span className="font-medium">{t.cropName} · {t.quantity} {t.unit}</span><span className="tabular font-semibold">{formatPaise(t.netAmountPaise)}</span></div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-faint"><span>{formatDate(t.transactionDate)}</span><StatusBadge status={t.paymentStatus} overdue={t.isOverdue} /></div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-ink-soft">
              <span>{data.total} {data.total === 1 ? 'sale' : 'sales'} · page {data.page} of {data.totalPages}</span>
              <div className="flex gap-1">
                <Button variant="secondary" size="icon" aria-label="Previous page" disabled={data.page <= 1} onClick={() => set('page', String(data.page - 1))}><ChevronLeft /></Button>
                <Button variant="secondary" size="icon" aria-label="Next page" disabled={data.page >= data.totalPages} onClick={() => set('page', String(data.page + 1))}><ChevronRight /></Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
