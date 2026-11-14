import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Download, Loader2, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { formatPaise, PAYMENT_STATUS_LABELS, UNITS, type TransactionDTO } from '@mandimitra/shared';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/states';
import { SpeakButton } from '@/features/voice/audio-player';
import type { ApiError} from '@/lib/api';
import { api, downloadBlob } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePayments, useTransaction } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

export function TransactionDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: t, isPending, error } = useTransaction(id);
  const payments = usePayments(id);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const invalidate = () => qc.invalidateQueries();
  const del = useMutation({
    mutationFn: () => api.del(`/api/transactions/${id}`),
    onSuccess: () => { void invalidate(); toast.success('Transaction deleted'); navigate('/app/transactions'); },
  });
  const removePayment = useMutation({
    mutationFn: (pid: string) => api.del(`/api/transactions/${id}/payments/${pid}`),
    onSuccess: () => { void invalidate(); toast.success('Payment removed'); },
  });

  if (isPending) return <Skeleton className="h-[600px] max-w-2xl" />;
  if (error || !t) return <ErrorState message={(error as Error)?.message ?? 'Transaction not found.'} />;

  async function downloadPdf() {
    setDownloading(true);
    try {
      const { blob, filename } = await api.blob(`/api/transactions/${id}/receipt.pdf`);
      downloadBlob(blob, filename ?? `receipt-${t?.receiptNumber}.pdf`);
    } catch (e) { toast.error((e as Error).message); } finally { setDownloading(false); }
  }

  const summary = `${t.cropName}, ${t.quantity} ${t.unit}. Net payable ${formatPaise(t.netAmountPaise)}. ${t.outstandingPaise > 0 ? `Outstanding ${formatPaise(t.outstandingPaise)}.` : 'Fully paid.'}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,640px)_1fr]">
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Button asChild variant="ghost" size="sm"><Link to="/app/transactions"><ArrowLeft /> All transactions</Link></Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer /> Print</Button>
            <Button variant="secondary" size="sm" onClick={downloadPdf} disabled={downloading}>{downloading ? <Loader2 className="animate-spin" /> : <Download />} PDF</Button>
          </div>
        </div>

        {params.get('new') && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-mandi-50 p-3 text-sm text-mandi-700 print:hidden" role="status">
            <CheckCircle2 className="size-4" /> Saved. Here is your receipt.
          </div>
        )}

        <h1 className="sr-only">Receipt {t.receiptNumber}</h1>
        <Receipt t={t} ownerName={user?.name ?? ''} isDemo={!!user?.isDemo} />
      </div>

      <div className="space-y-4 print:hidden">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Payments</h2>
            <StatusBadge status={t.paymentStatus} overdue={t.isOverdue} />
          </div>
          <dl className="tabular mt-4 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3 text-sm">
            <div className="min-w-0"><dt className="text-ink-faint">Received</dt><dd className="break-words text-lg font-semibold">{formatPaise(t.amountReceivedPaise)}</dd></div>
            <div className="min-w-0"><dt className="text-ink-faint">Outstanding</dt><dd className="break-words text-lg font-semibold text-turmeric-700">{formatPaise(t.outstandingPaise)}</dd></div>
          </dl>
          {t.paymentDueDate && t.outstandingPaise > 0 && <p className="mt-2 text-xs text-ink-faint">Due by {formatDate(t.paymentDueDate)}{t.isOverdue ? ' (overdue)' : ''}</p>}
          {t.outstandingPaise > 0 && <Button className="mt-4 w-full" onClick={() => setPayOpen(true)}><Plus /> Record a payment</Button>}
          <ul className="mt-4 divide-y divide-line text-sm">
            {payments.data?.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div><p className="tabular font-medium">{formatPaise(p.amountPaise)}</p><p className="text-xs text-ink-faint">{formatDate(p.paidAt)} · {p.method.replace('_', ' ')}{p.note ? ` · ${p.note}` : ''}</p></div>
                <Button size="icon" variant="ghost" aria-label="Remove payment" disabled={removePayment.isPending} onClick={() => removePayment.mutate(p.id)}><Trash2 /></Button>
              </li>
            ))}
            {payments.data?.length === 0 && <li className="py-2 text-ink-faint">No payments recorded yet.</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Hear this record</h2>
          <SpeakButton text={summary} autoPlay />
        </Card>

        {t.transcript && (
          <Card className="p-5">
            <h2 className="font-semibold">Original transcript</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">“{t.transcript}”</p>
          </Card>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>
          <Button variant="ghost" className="flex-1 text-ledger-700 hover:bg-ledger-50" onClick={() => setDeleteOpen(true)}><Trash2 /> Delete</Button>
        </div>
      </div>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} t={t} onDone={() => { setPayOpen(false); void invalidate(); }} />
      <EditDialog open={editOpen} onOpenChange={setEditOpen} t={t} onDone={() => { setEditOpen(false); void invalidate(); }} />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this transaction?" description="The sale and all its payment records will be removed. This cannot be undone.">
        {del.error && <div className="mb-3"><ErrorState message={(del.error as Error).message} /></div>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Keep it</Button>
          <Button variant="danger" onClick={() => del.mutate()} disabled={del.isPending}>{del.isPending && <Loader2 className="animate-spin" />} Delete transaction</Button>
        </div>
      </Dialog>
    </div>
  );
}

function Receipt({ t, ownerName, isDemo }: { t: TransactionDTO; ownerName: string; isDemo: boolean }) {
  const rows: [string, string][] = [
    ['Crop', t.cropName],
    ['Quantity', `${t.quantity.toLocaleString('en-IN')} ${t.unit}`],
    [`Rate per ${t.unit}`, formatPaise(t.ratePerUnitPaise)],
    ['Gross amount', formatPaise(t.grossAmountPaise)],
    [`Commission (${t.commissionPercentage}%)`, `− ${formatPaise(t.commissionAmountPaise)}`],
    ['Transport charges', `− ${formatPaise(t.transportChargePaise)}`],
    ['Other deductions', `− ${formatPaise(t.otherDeductionsPaise)}`],
  ];
  return (
    <article className="overflow-hidden rounded-slip border border-line bg-white print:border-0" data-testid="receipt">
      <header className="flex items-start justify-between bg-mandi-800 px-6 py-5 text-white print:bg-mandi-800">
        <div><p className="font-display text-xl font-semibold">MandiMitra AI</p><p className="text-xs text-mandi-100">Digital transaction receipt</p></div>
        <div className="text-right"><p className="tabular text-sm font-semibold" data-testid="receipt-number">{t.receiptNumber}</p><p className="text-xs text-mandi-100">{formatDate(t.transactionDate)}</p></div>
      </header>
      {isDemo && <p className="bg-turmeric-50 px-6 py-2 text-center text-xs font-medium text-turmeric-700">Demo receipt: synthetic data</p>}
      <div className="grid grid-cols-2 gap-4 border-b border-line px-6 py-4 text-sm">
        <div><p className="text-xs text-ink-faint">Seller</p><p className="font-semibold">{t.sellerName ?? ownerName}</p></div>
        <div><p className="text-xs text-ink-faint">Buyer</p><p className="font-semibold">{t.buyerName ?? 'Not recorded'}</p></div>
      </div>
      <dl className="slip-ruled tabular px-6 text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex h-11 items-center justify-between"><dt className="text-ink-soft">{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <div className="flex items-baseline justify-between bg-mandi-50 px-6 py-4">
        <span className="font-medium">Net payable</span>
        <span className="tabular font-display text-3xl font-semibold text-mandi-700" data-testid="receipt-net">{formatPaise(t.netAmountPaise)}</span>
      </div>
      <dl className="tabular space-y-1.5 px-6 py-4 text-sm">
        <div className="flex justify-between"><dt className="text-ink-soft">Payment status</dt><dd>{PAYMENT_STATUS_LABELS[t.paymentStatus]}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-soft">Received so far</dt><dd>{formatPaise(t.amountReceivedPaise)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-soft">Outstanding</dt><dd>{formatPaise(t.outstandingPaise)}</dd></div>
        {t.confirmedAt && <div className="flex justify-between"><dt className="text-ink-soft">Confirmed at</dt><dd>{formatDate(t.confirmedAt, { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>}
        {t.paymentNotes && <div className="flex justify-between gap-4"><dt className="text-ink-soft">Notes</dt><dd className="text-right">{t.paymentNotes}</dd></div>}
      </dl>
      <p className="border-t border-line px-6 py-4 text-center text-xs leading-relaxed text-ink-faint">
        Generated by MandiMitra AI from details entered and confirmed by the account holder. This is a personal record. It is not proof of payment and not a legal acknowledgement by the other party.
      </p>
    </article>
  );
}

const paymentForm = z.object({
  amount: z.number({ message: 'Enter an amount' }).positive('Enter an amount more than 0'),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']),
  paidAt: z.string(),
  note: z.string().max(300),
});

function PaymentDialog({ open, onOpenChange, t, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; t: TransactionDTO; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<z.infer<typeof paymentForm>>({
    resolver: zodResolver(paymentForm),
    values: { amount: t.outstandingPaise / 100, method: 'cash', paidAt: new Date().toISOString().slice(0, 10), note: '' },
  });
  const pay = useMutation({
    mutationFn: (v: z.infer<typeof paymentForm>) => api.post(`/api/transactions/${t.id}/payments`, { amount: v.amount, method: v.method, paidAt: v.paidAt, ...(v.note && { note: v.note }) }),
    onSuccess: () => { toast.success('Payment recorded'); onDone(); },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Record a payment" description={`Outstanding: ${formatPaise(t.outstandingPaise)}`}>
      <form onSubmit={handleSubmit((v) => pay.mutate(v))} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="amount">Amount received (₹)</Label>
          <Input id="amount" type="number" step="0.01" inputMode="decimal" className="tabular mt-1.5" {...register('amount', { valueAsNumber: true })} aria-invalid={!!errors.amount} aria-describedby={errors.amount ? 'amount-error' : undefined} />
          <div className="mt-1.5 flex gap-2 text-xs">
            <button type="button" className="text-mandi-700 hover:underline" onClick={() => setValue('amount', t.outstandingPaise / 100)}>Full amount</button>
            <button type="button" className="text-mandi-700 hover:underline" onClick={() => setValue('amount', Math.floor(t.outstandingPaise / 2) / 100)}>Half</button>
          </div>
          <FieldError id="amount-error" message={errors.amount?.message} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="method">Method</Label><Select id="method" className="mt-1.5" {...register('method')}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other</option></Select></div>
          <div><Label htmlFor="paidAt">Date</Label><Input id="paidAt" type="date" className="mt-1.5" {...register('paidAt')} /></div>
        </div>
        <div><Label htmlFor="note">Note (optional)</Label><Input id="note" className="mt-1.5" {...register('note')} /></div>
        {pay.error && <ErrorState message={(pay.error as ApiError).message} />}
        <Button type="submit" className="w-full" disabled={pay.isPending}>{pay.isPending && <Loader2 className="animate-spin" />} Save payment</Button>
      </form>
    </Dialog>
  );
}

const editForm = z.object({
  cropName: z.string().trim().min(1, 'Crop is required'),
  quantity: z.number({ message: 'Required' }).positive(),
  unit: z.enum(UNITS),
  ratePerUnit: z.number({ message: 'Required' }).positive(),
  commissionPercentage: z.number({ message: 'Required' }).min(0).max(100),
  transportCharge: z.number({ message: 'Required' }).min(0),
  otherDeductions: z.number({ message: 'Required' }).min(0),
  buyerName: z.string().max(100),
  disputed: z.boolean(),
});

function EditDialog({ open, onOpenChange, t, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; t: TransactionDTO; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof editForm>>({
    resolver: zodResolver(editForm),
    values: {
      cropName: t.cropName, quantity: t.quantity, unit: t.unit, ratePerUnit: t.ratePerUnitPaise / 100, commissionPercentage: t.commissionPercentage,
      transportCharge: t.transportChargePaise / 100, otherDeductions: t.otherDeductionsPaise / 100, buyerName: t.buyerName ?? '', disputed: t.paymentStatus === 'disputed',
    },
  });
  const save = useMutation({
    mutationFn: ({ disputed, ...v }: z.infer<typeof editForm>) => api.patch(`/api/transactions/${t.id}`, { ...v, paymentStatus: disputed ? 'disputed' : 'pending' }),
    onSuccess: () => { toast.success('Changes saved. Amounts were recalculated.'); onDone(); },
  });
  const num = (name: keyof z.infer<typeof editForm>, label: string) => (
    <div><Label htmlFor={`e-${name}`}>{label}</Label><Input id={`e-${name}`} type="number" step="any" className="tabular mt-1.5" {...register(name, { valueAsNumber: true })} aria-invalid={!!errors[name]} /><FieldError message={errors[name]?.message} /></div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit transaction" description="Amounts are recalculated on the server when you save.">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid grid-cols-2 gap-3" noValidate>
        <div className="col-span-2"><Label htmlFor="e-crop">Crop</Label><Input id="e-crop" className="mt-1.5" {...register('cropName')} /></div>
        {num('quantity', 'Quantity')}
        <div><Label htmlFor="e-unit">Unit</Label><Select id="e-unit" className="mt-1.5" {...register('unit')}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></div>
        {num('ratePerUnit', 'Rate (₹)')}
        {num('commissionPercentage', 'Commission %')}
        {num('transportCharge', 'Transport (₹)')}
        {num('otherDeductions', 'Other (₹)')}
        <div className="col-span-2"><Label htmlFor="e-buyer">Buyer</Label><Input id="e-buyer" className="mt-1.5" {...register('buyerName')} /></div>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" className="size-6 shrink-0 accent-mandi-700" {...register('disputed')} /> Disputed</label>
        {save.error && <div className="col-span-2"><ErrorState message={(save.error as ApiError).message} /></div>}
        <Button type="submit" className="col-span-2" disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Save changes</Button>
      </form>
    </Dialog>
  );
}
