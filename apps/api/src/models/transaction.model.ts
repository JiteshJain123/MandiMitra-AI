import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAYMENT_STATUSES, UNITS } from '@mandimitra/shared';

const paise = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };

const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiptNumber: { type: String, required: true, unique: true },
    cropName: { type: String, required: true, trim: true, maxlength: 60 },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, enum: UNITS, required: true },
    ratePerUnitPaise: paise,
    commissionPercentage: { type: Number, required: true, min: 0, max: 100, default: 0 },
    grossAmountPaise: paise,
    commissionAmountPaise: paise,
    transportChargePaise: paise,
    otherDeductionsPaise: paise,
    netAmountPaise: paise,
    amountReceivedPaise: { ...paise, default: 0 },
    buyerName: { type: String, trim: true, maxlength: 100 },
    sellerName: { type: String, trim: true, maxlength: 100 },
    transactionDate: { type: Date, required: true },
    paymentDueDate: { type: Date },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending', required: true },
    paymentNotes: { type: String, trim: true, maxlength: 500 },
    /** Stored only when the user consented. */
    transcript: { type: String, maxlength: 2000 },
    extractedData: { type: Schema.Types.Mixed },
    source: { type: String, enum: ['voice', 'manual', 'offline_sync'], default: 'manual' },
    confirmed: { type: Boolean, required: true, default: true },
    confirmedAt: { type: Date, required: true },
    idempotencyKey: { type: String, maxlength: 100 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, paymentStatus: 1 });
transactionSchema.index({ userId: 1, cropName: 1 });
transactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export type Transaction = InferSchemaType<typeof transactionSchema>;
export type TransactionDoc = HydratedDocument<Transaction>;
export const TransactionModel = model('Transaction', transactionSchema);
