import { z } from 'zod';
import { UNITS, type TransactionDraft } from '@mandimitra/shared';

const num = (label: string) => z.number({ message: `${label} is required` }).finite({ message: `${label} is required` });

export const reviewSchema = z.object({
  cropName: z.string().trim().min(1, 'Crop is required').max(60),
  quantity: num('Quantity').positive('Quantity must be more than 0').max(1_000_000),
  unit: z.enum(UNITS, { message: 'Choose a unit' }),
  ratePerUnit: num('Rate').positive('Rate must be more than 0').max(1_000_000_000),
  commissionPercentage: num('Commission').min(0).max(100, 'Commission cannot be more than 100%'),
  transportCharge: num('Transport').min(0, 'Cannot be negative'),
  otherDeductions: num('Other deductions').min(0, 'Cannot be negative'),
  buyerName: z.string().trim().max(100),
  sellerName: z.string().trim().max(100),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  paymentDueDate: z.string(),
  paymentNotes: z.string().trim().max(500),
  disputed: z.boolean(),
  recordFullPayment: z.boolean(),
  storeTranscript: z.boolean(),
  confirmed: z.boolean(),
});
export type ReviewValues = z.infer<typeof reviewSchema>;

export const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/** Empty numeric fields stay NaN (shown blank) so the user must fill them; nothing is invented. */
export function draftToValues(draft: TransactionDraft | null, storeTranscript: boolean): ReviewValues {
  return {
    cropName: draft?.cropName ?? '',
    quantity: draft?.quantity ?? Number.NaN,
    unit: (draft?.unit ?? '') as ReviewValues['unit'],
    ratePerUnit: draft?.ratePerUnit ?? Number.NaN,
    commissionPercentage: draft?.commissionPercentage ?? 0,
    transportCharge: draft?.transportCharge ?? 0,
    otherDeductions: draft?.otherDeductions ?? 0,
    buyerName: '',
    sellerName: '',
    transactionDate: todayIST(),
    paymentDueDate: '',
    paymentNotes: '',
    disputed: false,
    recordFullPayment: draft?.paymentStatus === 'paid',
    storeTranscript,
    confirmed: false,
  };
}

export function valuesToPayload(v: ReviewValues, transcript?: string, extracted?: TransactionDraft | null) {
  return {
    cropName: v.cropName,
    quantity: v.quantity,
    unit: v.unit,
    ratePerUnit: v.ratePerUnit,
    commissionPercentage: v.commissionPercentage,
    transportCharge: v.transportCharge,
    otherDeductions: v.otherDeductions,
    ...(v.buyerName && { buyerName: v.buyerName }),
    ...(v.sellerName && { sellerName: v.sellerName }),
    transactionDate: v.transactionDate,
    ...(v.paymentDueDate && { paymentDueDate: v.paymentDueDate }),
    ...(v.paymentNotes && { paymentNotes: v.paymentNotes }),
    paymentStatus: v.disputed ? ('disputed' as const) : ('pending' as const),
    ...(transcript && { transcript, storeTranscript: v.storeTranscript }),
    ...(extracted && { extractedData: extracted }),
  };
}
