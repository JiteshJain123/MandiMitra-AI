import { z } from 'zod';
import { LANGUAGE_CODES, PAYMENT_STATUSES, UNITS, USER_ROLES } from './constants.js';

const money = z.number().finite().min(0).max(1_000_000_000);
const trimmed = (max: number) => z.string().trim().max(max);

/** Output of the extraction layer. Missing values are null, never guessed. */
export const transactionDraftSchema = z
  .object({
    cropName: trimmed(60).min(1).nullable(),
    quantity: z.number().finite().positive().max(1_000_000).nullable(),
    unit: z.enum(UNITS).nullable(),
    ratePerUnit: money.positive().nullable(),
    commissionPercentage: z.number().finite().min(0).max(100).nullable(),
    transportCharge: money.nullable(),
    otherDeductions: money.nullable(),
    paymentStatus: z.enum(PAYMENT_STATUSES),
  })
  .strict();
export type TransactionDraft = z.infer<typeof transactionDraftSchema>;

export const REQUIRED_DRAFT_FIELDS = ['cropName', 'quantity', 'unit', 'ratePerUnit'] as const;

/** Fields a user submits when creating or editing a transaction. Amounts in rupees. */
export const transactionInputSchema = z
  .object({
    cropName: trimmed(60).min(1, 'Crop name is required'),
    quantity: z.number().finite().positive('Quantity must be greater than 0').max(1_000_000),
    unit: z.enum(UNITS),
    ratePerUnit: money.positive('Rate must be greater than 0'),
    commissionPercentage: z.number().finite().min(0).max(100).default(0),
    transportCharge: money.default(0),
    otherDeductions: money.default(0),
    buyerName: trimmed(100).optional(),
    sellerName: trimmed(100).optional(),
    transactionDate: z.coerce.date().optional(),
    paymentDueDate: z.coerce.date().optional(),
    /** 'paid'/'partially_paid' are derived from payment records; only 'pending' or 'disputed' may be set directly. */
    paymentStatus: z.enum(['pending', 'disputed']).default('pending'),
    paymentNotes: trimmed(500).optional(),
    transcript: trimmed(2000).optional(),
    storeTranscript: z.boolean().default(false),
    extractedData: transactionDraftSchema.optional(),
  })
  .strict();
export type TransactionInput = z.input<typeof transactionInputSchema>;
export type TransactionInputParsed = z.output<typeof transactionInputSchema>;

/**
 * PATCH body. Defined separately because in Zod 4 `.partial()` keeps `.default()` values,
 * which would silently reset omitted fields (e.g. commission) to 0.
 */
export const transactionUpdateSchema = z
  .object({
    cropName: trimmed(60).min(1, 'Crop name is required'),
    quantity: z.number().finite().positive('Quantity must be greater than 0').max(1_000_000),
    unit: z.enum(UNITS),
    ratePerUnit: money.positive('Rate must be greater than 0'),
    commissionPercentage: z.number().finite().min(0).max(100),
    transportCharge: money,
    otherDeductions: money,
    buyerName: trimmed(100),
    sellerName: trimmed(100),
    transactionDate: z.coerce.date(),
    paymentDueDate: z.coerce.date().nullable(),
    paymentStatus: z.enum(['pending', 'disputed']),
    paymentNotes: trimmed(500),
  })
  .partial()
  .strict();
export type TransactionUpdateInput = z.input<typeof transactionUpdateSchema>;

export const registerSchema = z
  .object({
    name: trimmed(80).min(2, 'Name must be at least 2 characters'),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(120),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    role: z.enum(['farmer', 'trader']).default('farmer'),
    preferredLanguage: z.enum(LANGUAGE_CODES).default('hi'),
  })
  .strict();
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const profileUpdateSchema = z
  .object({
    name: trimmed(80).min(2).optional(),
    preferredLanguage: z.enum(LANGUAGE_CODES).optional(),
    saveTranscriptsByDefault: z.boolean().optional(),
  })
  .strict();

export const paymentRecordInputSchema = z
  .object({
    amount: money.positive('Amount must be greater than 0'),
    paidAt: z.coerce.date().optional(),
    method: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']).default('cash'),
    note: trimmed(300).optional(),
  })
  .strict();
export type PaymentRecordInput = z.input<typeof paymentRecordInputSchema>;

export { USER_ROLES };
