import { Types } from 'mongoose';
import { TransactionModel } from '../models/transaction.model.js';
import { buildListFilter, toTransactionDTO } from './transaction.service.js';

/** All figures come from the database, scoped to the user. Amounts are integer paise. */
export async function getAnalytics(userId: string) {
  const uid = new Types.ObjectId(userId);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11, 1);
  twelveMonthsAgo.setUTCHours(0, 0, 0, 0);

  const [totalsAgg, byStatus, byCrop, monthly, recentDocs, overdueAgg] = await Promise.all([
    TransactionModel.aggregate<{ count: number; gross: number; net: number; received: number }>([
      { $match: { userId: uid } },
      { $group: { _id: null, count: { $sum: 1 }, gross: { $sum: '$grossAmountPaise' }, net: { $sum: '$netAmountPaise' }, received: { $sum: '$amountReceivedPaise' } } },
    ]),
    TransactionModel.aggregate<{ _id: string; count: number; net: number; outstanding: number }>([
      { $match: { userId: uid } },
      { $group: { _id: '$paymentStatus', count: { $sum: 1 }, net: { $sum: '$netAmountPaise' }, outstanding: { $sum: { $subtract: ['$netAmountPaise', '$amountReceivedPaise'] } } } },
    ]),
    TransactionModel.aggregate<{ _id: string; count: number; gross: number; net: number }>([
      { $match: { userId: uid } },
      { $group: { _id: '$cropName', count: { $sum: 1 }, gross: { $sum: '$grossAmountPaise' }, net: { $sum: '$netAmountPaise' } } },
      { $sort: { gross: -1 } },
      { $limit: 10 },
    ]),
    TransactionModel.aggregate<{ _id: string; count: number; gross: number; net: number; received: number }>([
      { $match: { userId: uid, transactionDate: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$transactionDate', timezone: 'Asia/Kolkata' } },
          count: { $sum: 1 }, gross: { $sum: '$grossAmountPaise' }, net: { $sum: '$netAmountPaise' }, received: { $sum: '$amountReceivedPaise' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    TransactionModel.find({ userId: uid }).sort({ transactionDate: -1, _id: -1 }).limit(5),
    TransactionModel.aggregate<{ count: number; outstanding: number }>([
      { $match: buildListFilter(userId, { status: 'overdue' }) },
      { $group: { _id: null, count: { $sum: 1 }, outstanding: { $sum: { $subtract: ['$netAmountPaise', '$amountReceivedPaise'] } } } },
    ]),
  ]);

  const t = totalsAgg[0] ?? { count: 0, gross: 0, net: 0, received: 0 };
  const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s]));
  const outstanding = byStatus.filter((s) => s._id !== 'paid').reduce((sum, s) => sum + s.outstanding, 0);

  // Fill missing months with zeros so charts have a continuous axis.
  const months: { month: string; count: number; grossPaise: number; netPaise: number; receivedPaise: number }[] = [];
  const cursor = new Date(twelveMonthsAgo);
  for (let i = 0; i < 12; i++) {
    const key = new Date(cursor.getTime() + 330 * 60_000).toISOString().slice(0, 7);
    const row = monthly.find((m) => m._id === key);
    months.push({ month: key, count: row?.count ?? 0, grossPaise: row?.gross ?? 0, netPaise: row?.net ?? 0, receivedPaise: row?.received ?? 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return {
    totals: {
      transactions: t.count,
      grossSalesPaise: t.gross,
      netPayablePaise: t.net,
      receivedPaise: t.received,
      pendingPaise: outstanding,
      partiallyPaidCount: statusMap.partially_paid?.count ?? 0,
      overdueCount: overdueAgg[0]?.count ?? 0,
      overduePaise: overdueAgg[0]?.outstanding ?? 0,
    },
    statusDistribution: ['pending', 'partially_paid', 'paid', 'disputed'].map((s) => ({
      status: s, count: statusMap[s]?.count ?? 0, netPaise: statusMap[s]?.net ?? 0,
    })),
    cropWise: byCrop.map((c) => ({ crop: c._id, count: c.count, grossPaise: c.gross, netPaise: c.net })),
    monthly: months,
    recent: recentDocs.map(toTransactionDTO),
  };
}
