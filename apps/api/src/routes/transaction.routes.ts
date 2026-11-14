import { Router } from 'express';
import { z } from 'zod';
import { paymentRecordInputSchema, transactionInputSchema, transactionUpdateSchema } from '@mandimitra/shared';
import { parse } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { receiptPdf, transactionsToCsv } from '../services/export.service.js';
import { speechLanguageFor, transactionSummaryText } from '../services/speech-text.service.js';
import {
  createTransaction, deletePayment, deleteTransaction, getOwnedTransaction, listPayments, listQuerySchema,
  listTransactions, previewAmounts, recordPayment, toPaymentDTO, toTransactionDTO, updateTransaction,
} from '../services/transaction.service.js';

export const transactionRouter = Router();
transactionRouter.use(requireAuth);

const idempotencyKey = z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/, 'Invalid Idempotency-Key').optional();

/** Calculates amounts without saving anything. */
transactionRouter.post('/preview', (req, res) => {
  const user = currentUser(req);
  const input = parse(transactionInputSchema, req.body);
  const amounts = previewAmounts(input);
  const lang = speechLanguageFor(user.preferredLanguage);
  const summaryText = transactionSummaryText({ ...input, ...amounts }, lang);
  res.json({ amounts, summaryText, speechLanguage: lang });
});

const createSchema = transactionInputSchema.extend({
  /** The user must explicitly confirm; unconfirmed transactions are never saved. */
  confirmed: z.literal(true, { message: 'Please confirm the transaction before saving.' }),
  source: z.enum(['voice', 'manual', 'offline_sync']).optional(),
}).strict();

transactionRouter.post('/', async (req, res) => {
  const user = currentUser(req);
  const key = parse(idempotencyKey, req.header('Idempotency-Key'));
  const { confirmed: _c, source, ...input } = parse(createSchema, req.body);
  const { transaction, created } = await createTransaction(user._id.toString(), input, { idempotencyKey: key, source, isDemo: user.isDemo });
  res.status(created ? 201 : 200).json({ transaction: toTransactionDTO(transaction), duplicate: !created });
});

transactionRouter.get('/', async (req, res) => {
  const q = parse(listQuerySchema, req.query);
  res.json(await listTransactions(currentUser(req)._id.toString(), q));
});

transactionRouter.get('/export.csv', async (req, res) => {
  const q = parse(listQuerySchema.omit({ page: true, pageSize: true }), req.query);
  const all = await listTransactions(currentUser(req)._id.toString(), { ...q, page: 1, pageSize: 5000 } as never);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="mandimitra-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(transactionsToCsv(all.items));
});

transactionRouter.get('/:id', async (req, res) => {
  const t = await getOwnedTransaction(currentUser(req)._id.toString(), req.params.id as string);
  res.json({ transaction: toTransactionDTO(t) });
});

transactionRouter.patch('/:id', async (req, res) => {
  const patch = parse(transactionUpdateSchema, req.body);
  const t = await updateTransaction(currentUser(req)._id.toString(), req.params.id as string, patch);
  res.json({ transaction: toTransactionDTO(t) });
});

transactionRouter.delete('/:id', async (req, res) => {
  await deleteTransaction(currentUser(req)._id.toString(), req.params.id as string);
  res.status(204).end();
});

transactionRouter.get('/:id/receipt.pdf', async (req, res) => {
  const user = currentUser(req);
  const t = await getOwnedTransaction(user._id.toString(), req.params.id as string);
  const pdf = await receiptPdf(toTransactionDTO(t), { name: user.name, isDemo: user.isDemo });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${t.receiptNumber}.pdf"`);
  res.send(pdf);
});

transactionRouter.get('/:id/payments', async (req, res) => {
  res.json({ payments: await listPayments(currentUser(req)._id.toString(), req.params.id as string) });
});

transactionRouter.post('/:id/payments', async (req, res) => {
  const input = parse(paymentRecordInputSchema, req.body);
  const { transaction, payment } = await recordPayment(currentUser(req)._id.toString(), req.params.id as string, input);
  res.status(201).json({ transaction: toTransactionDTO(transaction), payment: toPaymentDTO(payment) });
});

transactionRouter.delete('/:id/payments/:paymentId', async (req, res) => {
  const t = await deletePayment(currentUser(req)._id.toString(), req.params.id as string, req.params.paymentId as string);
  res.json({ transaction: toTransactionDTO(t) });
});
