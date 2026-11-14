import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const paymentRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    method: { type: String, enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'], default: 'cash' },
    note: { type: String, trim: true, maxlength: 300 },
    paidAt: { type: Date, required: true },
  },
  { timestamps: true },
);

paymentRecordSchema.index({ transactionId: 1, paidAt: 1 });
paymentRecordSchema.index({ userId: 1, paidAt: -1 });

export type PaymentRecord = InferSchemaType<typeof paymentRecordSchema>;
export type PaymentRecordDoc = HydratedDocument<PaymentRecord>;
export const PaymentRecordModel = model('PaymentRecord', paymentRecordSchema);
