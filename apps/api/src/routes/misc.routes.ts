import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { parse } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { PaymentRecordModel } from '../models/payment-record.model.js';
import { getAnalytics } from '../services/analytics.service.js';
import { getGnaniStatus } from '../services/gnani-status.js';
import { toPaymentDTO } from '../services/transaction.service.js';

export const healthRouter = Router();

/** Reports health without exposing secrets. Does not call Gnani (that would consume credits). */
healthRouter.get('/', (_req, res) => {
  const e = env();
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    database: dbUp ? 'up' : 'down',
    gnani: {
      configured: e.GNANI_API_KEY.trim().length > 0,
      sttModel: e.GNANI_STT_MODEL,
      ttsModel: e.GNANI_TTS_MODEL,
      ...getGnaniStatus(),
    },
    demoMode: e.DEMO_MODE_ENABLED,
  });
});

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);
analyticsRouter.get('/', async (req, res) => {
  res.json(await getAnalytics(currentUser(req)._id.toString()));
});

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);
paymentsRouter.get('/', async (req, res) => {
  const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
  const user = currentUser(req);
  const payments = await PaymentRecordModel.find({ userId: user._id })
    .sort({ paidAt: -1 })
    .limit(limit)
    .populate<{ transactionId: { _id: mongoose.Types.ObjectId; cropName: string; receiptNumber: string } }>('transactionId', 'cropName receiptNumber');
  res.json({
    payments: payments.map((p) => {
      const tx = p.transactionId;
      return {
        ...toPaymentDTO({ ...p.toObject(), transactionId: tx?._id ?? p.transactionId, _id: p._id } as never),
        cropName: tx?.cropName,
        receiptNumber: tx?.receiptNumber,
      };
    }),
  });
});
