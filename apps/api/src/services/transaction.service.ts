import { randomBytes } from 'node:crypto';
import { Types, type QueryFilter, type SortOrder } from 'mongoose';
import { z } from 'zod';
import type { transactionUpdateSchema} from '@mandimitra/shared';
import {
  PAYMENT_STATUSES, type PaymentRecordDTO, type PaymentStatus,
  type TransactionDTO, type TransactionInputParsed,
} from '@mandimitra/shared';
import { env } from '../config/env.js';
import { AppError, notFound } from '../lib/errors.js';
import { PaymentRecordModel, type PaymentRecordDoc } from '../models/payment-record.model.js';
import { TransactionModel, type Transaction, type TransactionDoc } from '../models/transaction.model.js';
import { calculateAmounts, rupeesToPaise } from './calculation.service.js';

const DAY_MS = 86_400_000;

export function generateReceiptNumber(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `MM-${ymd}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export function deriveStatus(netPaise: number, receivedPaise: number, current: PaymentStatus): PaymentStatus {
  if (current === 'disputed') return 'disputed';
  if (receivedPaise <= 0) return 'pending';
  if (receivedPaise >= netPaise) return 'paid';
  return 'partially_paid';
}

function effectiveDueDate(t: Pick<Transaction, 'paymentDueDate' | 'transactionDate'>): Date | undefined {
  if (t.paymentDueDate) return t.paymentDueDate;
  const days = env().DEFAULT_PAYMENT_TERM_DAYS;
  return days > 0 ? new Date(t.transactionDate.getTime() + days * DAY_MS) : undefined;
}

export function toTransactionDTO(t: TransactionDoc): TransactionDTO {
  const outstandingPaise = Math.max(0, t.netAmountPaise - t.amountReceivedPaise);
  const due = effectiveDueDate(t);
  return {
    id: t._id.toString(),
    receiptNumber: t.receiptNumber,
    cropName: t.cropName,
    quantity: t.quantity,
    unit: t.unit,
    ratePerUnitPaise: t.ratePerUnitPaise,
    commissionPercentage: t.commissionPercentage,
    grossAmountPaise: t.grossAmountPaise,
    commissionAmountPaise: t.commissionAmountPaise,
    transportChargePaise: t.transportChargePaise,
    otherDeductionsPaise: t.otherDeductionsPaise,
    netAmountPaise: t.netAmountPaise,
    amountReceivedPaise: t.amountReceivedPaise,
    outstandingPaise,
    buyerName: t.buyerName ?? undefined,
    sellerName: t.sellerName ?? undefined,
    transactionDate: t.transactionDate.toISOString(),
    paymentDueDate: due?.toISOString(),
    isOverdue: outstandingPaise > 0 && t.paymentStatus !== 'paid' && !!due && due.getTime() < Date.now(),
    paymentStatus: t.paymentStatus,
    paymentNotes: t.paymentNotes ?? undefined,
    transcript: t.transcript ?? undefined,
    extractedData: (t.extractedData as TransactionDTO['extractedData']) ?? undefined,
    confirmed: t.confirmed,
    confirmedAt: t.confirmedAt?.toISOString(),
    createdAt: (t as unknown as { createdAt: Date }).createdAt.toISOString(),
    updatedAt: (t as unknown as { updatedAt: Date }).updatedAt.toISOString(),
  };
}

export function toPaymentDTO(p: PaymentRecordDoc): PaymentRecordDTO {
  return {
    id: p._id.toString(),
    transactionId: p.transactionId.toString(),
    amountPaise: p.amountPaise,
    method: p.method,
    note: p.note ?? undefined,
    paidAt: p.paidAt.toISOString(),
    createdAt: (p as unknown as { createdAt: Date }).createdAt.toISOString(),
  };
}

export function previewAmounts(input: TransactionInputParsed) {
  return calculateAmounts(input);
}

function assertObjectId(id: string, what = 'Transaction'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw notFound(what);
  return new Types.ObjectId(id);
}

/** Ownership is enforced in every query by filtering on userId. */
export async function getOwnedTransaction(userId: string, id: string): Promise<TransactionDoc> {
  const t = await TransactionModel.findOne({ _id: assertObjectId(id), userId });
  if (!t) throw notFound('Transaction');
  return t;
}

export interface CreateOptions {
  idempotencyKey?: string;
  source?: 'voice' | 'manual' | 'offline_sync';
  isDemo?: boolean;
}

export async function createTransaction(
  userId: string,
  input: TransactionInputParsed,
  opts: CreateOptions = {},
): Promise<{ transaction: TransactionDoc; created: boolean }> {
  if (opts.idempotencyKey) {
    const existing = await TransactionModel.findOne({ userId, idempotencyKey: opts.idempotencyKey });
    if (existing) return { transaction: existing, created: false };
  }
  const amounts = calculateAmounts(input);
  const transactionDate = input.transactionDate ?? new Date();
  try {
    const transaction = await TransactionModel.create({
      userId,
      receiptNumber: generateReceiptNumber(transactionDate),
      cropName: input.cropName,
      quantity: input.quantity,
      unit: input.unit,
      commissionPercentage: input.commissionPercentage,
      ...amounts,
      amountReceivedPaise: 0,
      buyerName: input.buyerName || undefined,
      sellerName: input.sellerName || undefined,
      transactionDate,
      paymentDueDate: input.paymentDueDate,
      paymentStatus: input.paymentStatus,
      paymentNotes: input.paymentNotes || undefined,
      transcript: input.storeTranscript && input.transcript ? input.transcript : undefined,
      extractedData: input.extractedData,
      source: opts.source ?? (input.transcript ? 'voice' : 'manual'),
      confirmed: true,
      confirmedAt: new Date(),
      idempotencyKey: opts.idempotencyKey,
      isDemo: opts.isDemo ?? false,
    });
    return { transaction, created: true };
  } catch (err) {
    // Two concurrent requests with the same key: return the one that won.
    if ((err as { code?: number }).code === 11000 && opts.idempotencyKey) {
      const existing = await TransactionModel.findOne({ userId, idempotencyKey: opts.idempotencyKey });
      if (existing) return { transaction: existing, created: false };
    }
    throw err;
  }
}

export async function updateTransaction(userId: string, id: string, patch: z.infer<typeof transactionUpdateSchema>) {
  const t = await getOwnedTransaction(userId, id);
  const merged = {
    quantity: patch.quantity ?? t.quantity,
    ratePerUnit: patch.ratePerUnit ?? t.ratePerUnitPaise / 100,
    commissionPercentage: patch.commissionPercentage ?? t.commissionPercentage,
    transportCharge: patch.transportCharge ?? t.transportChargePaise / 100,
    otherDeductions: patch.otherDeductions ?? t.otherDeductionsPaise / 100,
  };
  const amounts = calculateAmounts(merged);
  if (amounts.netAmountPaise < t.amountReceivedPaise) {
    throw new AppError(409, 'NET_BELOW_RECEIVED', 'The new net amount is less than the payments already recorded. Remove a payment first.');
  }
  t.set({
    ...('cropName' in patch && { cropName: patch.cropName }),
    ...('unit' in patch && { unit: patch.unit }),
    ...('buyerName' in patch && { buyerName: patch.buyerName || undefined }),
    ...('sellerName' in patch && { sellerName: patch.sellerName || undefined }),
    ...('transactionDate' in patch && { transactionDate: patch.transactionDate }),
    ...('paymentDueDate' in patch && { paymentDueDate: patch.paymentDueDate ?? undefined }),
    ...('paymentNotes' in patch && { paymentNotes: patch.paymentNotes || undefined }),
    quantity: merged.quantity,
    commissionPercentage: merged.commissionPercentage,
    ...amounts,
  });
  const requested = patch.paymentStatus;
  const base: PaymentStatus = requested === 'disputed' ? 'disputed' : requested === 'pending' ? 'pending' : t.paymentStatus;
  t.paymentStatus = deriveStatus(t.netAmountPaise, t.amountReceivedPaise, base === 'disputed' ? 'disputed' : 'pending');
  await t.save();
  return t;
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const t = await getOwnedTransaction(userId, id);
  await PaymentRecordModel.deleteMany({ transactionId: t._id, userId });
  await t.deleteOne();
}

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().max(100).optional(),
  status: z.enum([...PAYMENT_STATUSES, 'outstanding', 'overdue'] as const).optional(),
  crop: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['date', '-date', 'net', '-net', 'gross', '-gross', 'crop', '-crop']).default('-date'),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildListFilter(userId: string, q: Omit<ListQuery, 'page' | 'pageSize' | 'sort'>): QueryFilter<Transaction> {
  const filter: QueryFilter<Transaction> = { userId: new Types.ObjectId(userId) };
  if (q.status === 'outstanding') filter.paymentStatus = { $in: ['pending', 'partially_paid', 'disputed'] };
  else if (q.status === 'overdue') {
    filter.paymentStatus = { $in: ['pending', 'partially_paid'] };
    const days = env().DEFAULT_PAYMENT_TERM_DAYS;
    const now = new Date();
    filter.$or = [
      { paymentDueDate: { $lt: now } },
      ...(days > 0 ? [{ paymentDueDate: { $exists: false }, transactionDate: { $lt: new Date(now.getTime() - days * DAY_MS) } }] : []),
    ];
  } else if (q.status) filter.paymentStatus = q.status;
  if (q.crop) filter.cropName = new RegExp(`^${escapeRegex(q.crop)}$`, 'i');
  if (q.from || q.to) {
    filter.transactionDate = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const textOr = [{ cropName: rx }, { buyerName: rx }, { sellerName: rx }, { receiptNumber: rx }];
    if (filter.$or) filter.$and = [{ $or: filter.$or }, { $or: textOr }];
    else filter.$or = textOr;
    if (filter.$and) delete filter.$or;
  }
  return filter;
}

const SORTS: Record<ListQuery['sort'], Record<string, SortOrder>> = {
  date: { transactionDate: 1 }, '-date': { transactionDate: -1 },
  net: { netAmountPaise: 1 }, '-net': { netAmountPaise: -1 },
  gross: { grossAmountPaise: 1 }, '-gross': { grossAmountPaise: -1 },
  crop: { cropName: 1 }, '-crop': { cropName: -1 },
};

export async function listTransactions(userId: string, q: ListQuery) {
  const filter = buildListFilter(userId, q);
  const [items, total] = await Promise.all([
    TransactionModel.find(filter).sort({ ...SORTS[q.sort], _id: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize),
    TransactionModel.countDocuments(filter),
  ]);
  return {
    items: items.map(toTransactionDTO),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export async function recordPayment(
  userId: string,
  transactionId: string,
  input: { amount: number; paidAt?: Date; method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other'; note?: string },
) {
  const t = await getOwnedTransaction(userId, transactionId);
  const amountPaise = rupeesToPaise(input.amount);
  const outstanding = t.netAmountPaise - t.amountReceivedPaise;
  if (outstanding <= 0) throw new AppError(409, 'ALREADY_PAID', 'This transaction is already fully paid.');
  if (amountPaise > outstanding) {
    throw new AppError(400, 'OVERPAYMENT', `Payment is more than the outstanding balance (₹${(outstanding / 100).toLocaleString('en-IN')}).`);
  }
  // Conditional update guards against concurrent payments exceeding the net amount.
  const updated = await TransactionModel.findOneAndUpdate(
    { _id: t._id, userId, amountReceivedPaise: t.amountReceivedPaise },
    { $inc: { amountReceivedPaise: amountPaise } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new AppError(409, 'CONCURRENT_UPDATE', 'Another payment was recorded at the same time. Please retry.');
  updated.paymentStatus = deriveStatus(updated.netAmountPaise, updated.amountReceivedPaise, updated.paymentStatus);
  await updated.save();
  const payment = await PaymentRecordModel.create({
    userId, transactionId: t._id, amountPaise, method: input.method, note: input.note, paidAt: input.paidAt ?? new Date(),
  });
  return { transaction: updated, payment };
}

export async function listPayments(userId: string, transactionId: string) {
  const t = await getOwnedTransaction(userId, transactionId);
  const payments = await PaymentRecordModel.find({ transactionId: t._id, userId }).sort({ paidAt: 1 });
  return payments.map(toPaymentDTO);
}

export async function deletePayment(userId: string, transactionId: string, paymentId: string) {
  const t = await getOwnedTransaction(userId, transactionId);
  const p = await PaymentRecordModel.findOneAndDelete({ _id: assertObjectId(paymentId, 'Payment'), transactionId: t._id, userId });
  if (!p) throw notFound('Payment');
  t.amountReceivedPaise = Math.max(0, t.amountReceivedPaise - p.amountPaise);
  t.paymentStatus = deriveStatus(t.netAmountPaise, t.amountReceivedPaise, t.paymentStatus === 'disputed' ? 'disputed' : 'pending');
  await t.save();
  return t;
}
