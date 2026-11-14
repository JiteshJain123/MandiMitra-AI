import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPaise, PAYMENT_STATUS_LABELS } from '@mandimitra/shared';
import { PageHeader } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth';
import { useAnalytics } from '@/lib/queries';

const STATUS_COLOR: Record<string, string> = { pending: '#c98a12', partially_paid: '#0369a1', paid: '#1f7a4d', disputed: '#b42318' };
const compact = (paise: number) => {
  const r = paise / 100;
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(1)}Cr`;
  if (r >= 5e4) return `₹${(r / 1e5).toFixed(1)}L`;
  if (r >= 1e3) return `₹${(r / 1e3).toFixed(0)}k`;
  return `₹${r.toFixed(0)}`;
};
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });

export function AnalyticsPage() {
  const { user } = useAuth();
  const { data, isPending, error } = useAnalytics();
  return (
    <>
      <PageHeader title="Analytics" subtitle={user?.isDemo ? 'Figures from the demo account’s synthetic sales.' : 'Calculated from your recorded sales.'} />
      {error && <ErrorState message={(error as Error).message} />}
      {isPending ? <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div>
        : !data?.totals.transactions ? (
          <Card><EmptyState icon={BarChart3} title="No data yet" body="Charts appear once you have recorded sales." /></Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Transactions', String(data.totals.transactions)],
                ['Gross sales', formatPaise(data.totals.grossSalesPaise, { decimals: false })],
                ['Received', formatPaise(data.totals.receivedPaise, { decimals: false })],
                ['Pending', formatPaise(data.totals.pendingPaise, { decimals: false })],
              ].map(([k, v]) => <Card key={k} className="p-5"><p className="text-xs text-ink-faint">{k}</p><p className="tabular mt-1 text-2xl font-semibold">{v}</p></Card>)}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Monthly sales, last 12 months</CardTitle>
                  <div className="flex gap-4 text-xs text-ink-soft"><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-mandi-700" />Gross sales</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-turmeric-500" />Received</span></div>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer>
                    <LineChart data={data.monthly} margin={{ left: 8, right: 16, top: 8 }}>
                      <CartesianGrid stroke="#dfe6e0" vertical={false} />
                      <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 12, fill: '#4b5a50' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={compact} tick={{ fontSize: 12, fill: '#4b5a50' }} axisLine={false} tickLine={false} width={56} />
                      <Tooltip formatter={(v) => formatPaise(Number(v))} labelFormatter={(m) => monthLabel(String(m))} />
                      <Line type="linear" dataKey="grossPaise" name="Gross sales" stroke="#14532d" strokeWidth={2.5} dot={{ r: 3, fill: '#14532d' }} />
                      <Line type="linear" dataKey="receivedPaise" name="Received" stroke="#c98a12" strokeWidth={2} dot={{ r: 2.5, fill: '#c98a12' }} strokeDasharray="4 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Sales by crop</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={data.cropWise} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid stroke="#dfe6e0" horizontal={false} />
                      <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 12, fill: '#4b5a50' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="crop" tick={{ fontSize: 12, fill: '#16201a' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip formatter={(v) => formatPaise(Number(v))} />
                      <Bar dataKey="grossPaise" name="Gross sales" fill="#1f7a4d" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Payment status</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={data.statusDistribution.map((s) => ({ ...s, label: PAYMENT_STATUS_LABELS[s.status] }))} margin={{ left: 8, right: 16, top: 8 }}>
                      <CartesianGrid stroke="#dfe6e0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#4b5a50' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#4b5a50' }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip />
                      <Bar dataKey="count" name="Sales" radius={[4, 4, 0, 0]} barSize={36}>
                        {data.statusDistribution.map((s) => <Cell key={s.status} fill={STATUS_COLOR[s.status]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
    </>
  );
}
