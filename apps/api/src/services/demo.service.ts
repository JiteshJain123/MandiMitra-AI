import { randomBytes } from 'node:crypto';
import { TransactionModel } from '../models/transaction.model.js';
import { PaymentRecordModel } from '../models/payment-record.model.js';
import { UserModel, type UserDoc } from '../models/user.model.js';
import { hashPassword } from './auth.service.js';
import { createTransaction, recordPayment } from './transaction.service.js';

/** Synthetic demo data only. Names are fictional; no real personal or financial information. */
export const DEMO_EMAIL = 'demo@mandimitra.local';

const DEMO_ROWS = [
  { d: 2, cropName: 'Wheat', quantity: 25, unit: 'quintal', ratePerUnit: 2400, commissionPercentage: 2, transportCharge: 500, buyerName: 'Sharma Traders (demo)', paid: 0 },
  { d: 6, cropName: 'Mustard', quantity: 12, unit: 'quintal', ratePerUnit: 5650, commissionPercentage: 1.5, transportCharge: 300, buyerName: 'Gupta & Sons (demo)', paid: 0.5 },
  { d: 11, cropName: 'Gram', quantity: 18, unit: 'quintal', ratePerUnit: 5300, commissionPercentage: 2, transportCharge: 400, otherDeductions: 150, buyerName: 'Kisan Agro (demo)', paid: 1 },
  { d: 24, cropName: 'Wheat', quantity: 40, unit: 'quintal', ratePerUnit: 2380, commissionPercentage: 2, transportCharge: 800, buyerName: 'Sharma Traders (demo)', paid: 0 },
  { d: 38, cropName: 'Onion', quantity: 1200, unit: 'kg', ratePerUnit: 18, commissionPercentage: 3, transportCharge: 250, buyerName: 'Patel Mandi Agency (demo)', paid: 1 },
  { d: 52, cropName: 'Soybean', quantity: 15, unit: 'quintal', ratePerUnit: 4600, commissionPercentage: 2, transportCharge: 350, buyerName: 'Verma Oils (demo)', paid: 0.3 },
  { d: 75, cropName: 'Paddy', quantity: 30, unit: 'quintal', ratePerUnit: 2300, commissionPercentage: 2.5, transportCharge: 600, buyerName: 'Singh Rice Mill (demo)', paid: 1 },
  { d: 110, cropName: 'Maize', quantity: 22, unit: 'quintal', ratePerUnit: 2150, commissionPercentage: 2, transportCharge: 450, buyerName: 'Kisan Agro (demo)', paid: 1 },
  { d: 150, cropName: 'Wheat', quantity: 35, unit: 'quintal', ratePerUnit: 2275, commissionPercentage: 2, transportCharge: 700, buyerName: 'Gupta & Sons (demo)', paid: 1 },
  { d: 200, cropName: 'Cotton', quantity: 10, unit: 'quintal', ratePerUnit: 7100, commissionPercentage: 2, transportCharge: 500, buyerName: 'Rathi Ginning (demo)', paid: 0 },
] as const;

export async function getOrCreateDemoUser(): Promise<UserDoc> {
  let user = await UserModel.findOne({ email: DEMO_EMAIL });
  if (!user) {
    user = await UserModel.create({
      name: 'Ramesh Kumar (Demo)',
      email: DEMO_EMAIL,
      // Random password: the demo account can only be entered through the demo button.
      passwordHash: await hashPassword(randomBytes(24).toString('hex')),
      role: 'farmer',
      preferredLanguage: 'hi',
      isDemo: true,
    });
  }
  if ((await TransactionModel.countDocuments({ userId: user._id })) === 0) await seedDemoTransactions(user);
  return user;
}

export async function resetDemoData(user: UserDoc): Promise<void> {
  if (!user.isDemo) return;
  await PaymentRecordModel.deleteMany({ userId: user._id });
  await TransactionModel.deleteMany({ userId: user._id });
  await seedDemoTransactions(user);
}

async function seedDemoTransactions(user: UserDoc): Promise<void> {
  const uid = user._id.toString();
  for (const row of DEMO_ROWS) {
    const date = new Date(Date.now() - row.d * 86_400_000);
    const { transaction } = await createTransaction(
      uid,
      {
        cropName: row.cropName, quantity: row.quantity, unit: row.unit, ratePerUnit: row.ratePerUnit,
        commissionPercentage: row.commissionPercentage, transportCharge: row.transportCharge,
        otherDeductions: 'otherDeductions' in row ? row.otherDeductions : 0,
        buyerName: row.buyerName, sellerName: user.name, transactionDate: date, paymentStatus: 'pending', storeTranscript: false,
      },
      { isDemo: true, source: 'manual' },
    );
    if (row.paid > 0) {
      const amount = Math.floor((transaction.netAmountPaise * row.paid) / 100);
      await recordPayment(uid, transaction._id.toString(), { amount, method: 'upi', paidAt: new Date(date.getTime() + 3 * 86_400_000), note: 'Demo payment' });
    }
  }
}
