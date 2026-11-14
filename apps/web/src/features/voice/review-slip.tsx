import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cloneElement, isValidElement, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { formatPaise, KNOWN_CROPS, UNITS, type TransactionDraft } from '@mandimitra/shared';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/states';
import type { ApiError } from '@/lib/api';
import { api } from '@/lib/api';
import type { ExtractionResult, PreviewResponse } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { SpeakButton } from './audio-player';
import { draftToValues, reviewSchema, valuesToPayload, type ReviewValues } from './review-form';

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function ReviewSlip({ extraction, transcript, storeTranscriptDefault, submitting, submitError, onConfirm, onSaveDraft, initialValues }: {
  extraction: ExtractionResult | null;
  transcript?: string;
  storeTranscriptDefault: boolean;
  submitting: boolean;
  submitError?: string;
  onConfirm: (payload: ReturnType<typeof valuesToPayload>, recordFullPayment: boolean) => void;
  onSaveDraft?: (values: ReviewValues) => void;
  initialValues?: ReviewValues;
}) {
  const missing = new Set(extraction?.missingFields ?? []);
  const form = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: initialValues ? { ...initialValues, confirmed: false } : draftToValues(extraction?.draft ?? null, storeTranscriptDefault),
    mode: 'onTouched',
  });
  const { register, handleSubmit, formState: { errors }, control } = form;
  const values = useWatch({ control });
  const calcInput = useDebounced({
    cropName: values.cropName, quantity: values.quantity, unit: values.unit, ratePerUnit: values.ratePerUnit,
    commissionPercentage: values.commissionPercentage, transportCharge: values.transportCharge, otherDeductions: values.otherDeductions,
  });
  const calcReady = reviewSchema.pick({ cropName: true, quantity: true, unit: true, ratePerUnit: true, commissionPercentage: true, transportCharge: true, otherDeductions: true }).safeParse(calcInput).success;

  // Amounts always come from the backend (decimal-safe); the browser never calculates money.
  const preview = useQuery({
    queryKey: ['preview', calcInput],
    queryFn: () => api.post<PreviewResponse>('/api/transactions/preview', calcInput),
    enabled: calcReady,
    retry: false,
  });

  const highlight = (f: keyof TransactionDraft) => missing.has(f) && 'border-turmeric-500 bg-turmeric-50';
  const ev = extraction?.evidence ?? {};
  const a = preview.data?.amounts;

  return (
    <form onSubmit={handleSubmit((v) => onConfirm(valuesToPayload(v, transcript, extraction?.draft), v.recordFullPayment))} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-slip border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Sale slip</h2>
            <p className="text-xs text-ink-faint">Check every line. Nothing is saved until you confirm.</p>
          </div>
          {extraction && <span className="text-xs text-ink-faint">Filled from your voice</span>}
        </div>

        {(missing.size > 0 || (extraction?.warnings.length ?? 0) > 0) && (
          <div className="mx-6 mt-4 space-y-1 rounded-lg bg-turmeric-50 p-3 text-sm text-turmeric-700" role="status">
            {missing.size > 0 && <p className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Not heard clearly: {[...missing].map((m) => FIELD_LABEL[m] ?? m).join(', ')}. Please fill these in.</p>}
            {extraction?.warnings.map((w) => <p key={w} className="pl-6">{w}</p>)}
          </div>
        )}

        <div className="grid gap-x-6 gap-y-4 px-6 py-5 sm:grid-cols-2">
          <Field label="Crop" error={errors.cropName?.message} evidence={ev.cropName} htmlFor="cropName">
            <Input id="cropName" list="crop-list" {...register('cropName')} className={cn(highlight('cropName'))} aria-invalid={!!errors.cropName} />
            <datalist id="crop-list">{KNOWN_CROPS.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,7.5rem)] gap-3">
            <Field label="Quantity" error={errors.quantity?.message} evidence={ev.quantity} htmlFor="quantity">
              <Input id="quantity" type="number" inputMode="decimal" step="any" {...register('quantity', { valueAsNumber: true })} className={cn('tabular', highlight('quantity'))} aria-invalid={!!errors.quantity} />
            </Field>
            <Field label="Unit" error={errors.unit?.message} htmlFor="unit">
              <Select id="unit" {...register('unit')} className={cn(highlight('unit'))} aria-invalid={!!errors.unit}>
                <option value="">Choose</option>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={`Rate per ${values.unit || 'unit'} (₹)`} error={errors.ratePerUnit?.message} evidence={ev.ratePerUnit} htmlFor="ratePerUnit">
            <Input id="ratePerUnit" type="number" inputMode="decimal" step="any" {...register('ratePerUnit', { valueAsNumber: true })} className={cn('tabular', highlight('ratePerUnit'))} aria-invalid={!!errors.ratePerUnit} />
          </Field>
          <Field label="Commission (%)" error={errors.commissionPercentage?.message} evidence={ev.commissionPercentage} htmlFor="commissionPercentage">
            <Input id="commissionPercentage" type="number" inputMode="decimal" step="any" {...register('commissionPercentage', { valueAsNumber: true })} className="tabular" />
          </Field>
          <Field label="Transport (₹)" error={errors.transportCharge?.message} evidence={ev.transportCharge} htmlFor="transportCharge">
            <Input id="transportCharge" type="number" inputMode="decimal" step="any" {...register('transportCharge', { valueAsNumber: true })} className="tabular" />
          </Field>
          <Field label="Other deductions (₹)" error={errors.otherDeductions?.message} evidence={ev.otherDeductions} htmlFor="otherDeductions">
            <Input id="otherDeductions" type="number" inputMode="decimal" step="any" {...register('otherDeductions', { valueAsNumber: true })} className="tabular" />
          </Field>
          <Field label="Buyer (optional)" htmlFor="buyerName"><Input id="buyerName" {...register('buyerName')} placeholder="e.g. Sharma Traders" /></Field>
          <Field label="Seller (optional)" htmlFor="sellerName"><Input id="sellerName" {...register('sellerName')} /></Field>
          <Field label="Sale date" error={errors.transactionDate?.message} htmlFor="transactionDate"><Input id="transactionDate" type="date" {...register('transactionDate')} /></Field>
          <Field label="Payment due by (optional)" htmlFor="paymentDueDate"><Input id="paymentDueDate" type="date" {...register('paymentDueDate')} /></Field>
          <div className="sm:col-span-2">
            <Field label="Notes (optional)" htmlFor="paymentNotes"><Textarea id="paymentNotes" rows={2} {...register('paymentNotes')} /></Field>
          </div>
        </div>

        <div className="space-y-2 border-t border-line px-6 py-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" {...register('recordFullPayment')} className="size-6 shrink-0 accent-mandi-700" /> Full payment already received: record it now</label>
          <label className="flex items-center gap-2"><input type="checkbox" {...register('disputed')} className="size-6 shrink-0 accent-mandi-700" /> Mark as disputed</label>
          {transcript && <label className="flex items-center gap-2"><input type="checkbox" {...register('storeTranscript')} className="size-6 shrink-0 accent-mandi-700" /> Keep the transcript with this record</label>}
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-slip border border-line bg-white p-5" aria-live="polite">
          <h3 className="text-sm font-semibold">Calculation</h3>
          {!calcReady ? (
            <p className="mt-3 text-sm text-ink-faint">Fill crop, quantity, unit and rate to see the amounts.</p>
          ) : preview.isError ? (
            <div className="mt-3"><ErrorState message={(preview.error as ApiError).message} /></div>
          ) : !a ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-ink-faint"><Loader2 className="size-4 animate-spin" /> Calculating…</div>
          ) : (
            <dl className={cn('tabular mt-3 space-y-2 text-sm', preview.isFetching && 'opacity-60')}>
              <Row label="Gross" value={formatPaise(a.grossAmountPaise)} />
              <Row label={`Commission (${values.commissionPercentage || 0}%)`} value={`− ${formatPaise(a.commissionAmountPaise)}`} />
              <Row label="Transport" value={`− ${formatPaise(a.transportChargePaise)}`} />
              <Row label="Other" value={`− ${formatPaise(a.otherDeductionsPaise)}`} />
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-medium">Net payable</dt>
                <dd className="font-display text-2xl font-semibold text-mandi-700" data-testid="net-amount">{formatPaise(a.netAmountPaise)}</dd>
              </div>
            </dl>
          )}
        </div>

        {preview.data && (
          <div className="rounded-slip border border-line bg-white p-5">
            <h3 className="mb-1 text-sm font-semibold">Hear it back</h3>
            <p className="mb-3 text-xs text-ink-faint">“{preview.data.summaryText}”</p>
            <SpeakButton text={preview.data.summaryText} label="Read summary aloud" />
          </div>
        )}

        <div className="rounded-slip border border-mandi-200 bg-mandi-50 p-5">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" {...register('confirmed')} className="size-6 shrink-0 accent-mandi-700" data-testid="confirm-checkbox" />
            <span>I have checked these details and they are correct.</span>
          </label>
          {submitError && <div className="mt-3"><ErrorState message={submitError} /></div>}
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={!values.confirmed || !a || submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Confirm and save
          </Button>
          {onSaveDraft && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onSaveDraft(form.getValues())}>
              Save as draft on this device
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

const FIELD_LABEL: Record<string, string> = { cropName: 'crop', quantity: 'quantity', unit: 'unit', ratePerUnit: 'rate' };

function Field({ label, error, evidence, htmlFor, children }: { label: string; error?: string; evidence?: string; htmlFor: string; children: React.ReactNode }) {
  const errorId = `${htmlFor}-error`;
  // Link the error to the field. Fields with extra siblings (the crop datalist) pass an array, so only a lone input is cloned.
  const control = error && isValidElement<{ 'aria-describedby'?: string }>(children) ? cloneElement(children, { 'aria-describedby': errorId }) : children;
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-1.5">{control}</div>
      {evidence && !error && <p className="mt-1 truncate text-xs text-ink-faint" title={evidence}>Heard: “{evidence}”</p>}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-ink-soft">{label}</dt><dd>{value}</dd></div>;
}
