import { Types } from 'mongoose';
import { TransactionModel } from '../models/transaction.model.js';
import { CROP_ALIASES } from './extraction.lexicon.js';
import { tokenize } from './extraction.service.js';
import { CROP_HI, rupees, type SpeechLang } from './speech-text.service.js';
import { buildListFilter, toTransactionDTO } from './transaction.service.js';

/**
 * Voice questions are mapped to a fixed whitelist of intents. Each intent runs a predefined,
 * parameterised query scoped to the authenticated user. No generated query is ever executed.
 */

export type VoiceIntent = 'pending_total' | 'unpaid_list' | 'received_total' | 'crop_sales' | 'overdue_list' | 'unknown';
export type Period = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all_time';

export interface ParsedQuestion {
  intent: VoiceIntent;
  crop?: string;
  period: Period;
}

const has = (tokens: string[], words: string[]) => words.some((w) => tokens.includes(w));
const phrase = (text: string, phrases: string[]) => phrases.some((p) => text.includes(p));

export function parseQuestion(question: string): ParsedQuestion {
  const tokens = tokenize(question);
  const text = ` ${tokens.join(' ')} `;
  const crop = tokens.map((t) => CROP_ALIASES[t]).find(Boolean);

  let period: Period = 'all_time';
  if (phrase(text, [' aaj ', ' today ', ' आज '])) period = 'today';
  else if (phrase(text, ['is hafte', 'this week', 'इस हफ्ते', 'is week'])) period = 'this_week';
  else if (phrase(text, ['pichle mahine', 'pichhle mahine', 'last month', 'पिछले महीने'])) period = 'last_month';
  else if (phrase(text, ['is mahine', 'is month', 'this month', 'इस महीने', 'is maheene'])) period = 'this_month';
  else if (phrase(text, ['is saal', 'this year', 'इस साल', 'is varsh'])) period = 'this_year';

  const notCame = phrase(text, ['nahi aaya', 'nahin aaya', 'nahi mila', 'nahin mila', 'नहीं आया', 'नहीं मिला', 'not received', 'not paid']);
  const listWords = has(tokens, ['kaunse', 'konse', 'kaun', 'kon', 'which', 'kin', 'list', 'कौन', 'कौनसे', 'किन', 'कौनसा', 'kaunsa']);
  const pendingWords = notCame || has(tokens, ['pending', 'baaki', 'baki', 'बाकी', 'पेंडिंग', 'outstanding', 'udhaar', 'udhar', 'उधार', 'due', 'unpaid']);
  const overdueWords = has(tokens, ['overdue', 'late', 'der', 'देर']) || phrase(text, ['time nikal', 'samay nikal']);
  const salesWords = has(tokens, ['sale', 'sales', 'bikri', 'becha', 'bechi', 'beche', 'bika', 'biki', 'sold', 'बिक्री', 'बेचा', 'बेची', 'बिका']);
  const receivedWords = has(tokens, ['mila', 'mile', 'aaya', 'aya', 'received', 'receive', 'got', 'collected', 'मिला', 'मिले', 'आया']) || phrase(text, ['mil gaya', 'मिल गया']);

  let intent: VoiceIntent = 'unknown';
  if (overdueWords) intent = 'overdue_list';
  else if (pendingWords && listWords) intent = 'unpaid_list';
  else if (pendingWords) intent = 'pending_total';
  else if (salesWords) intent = 'crop_sales';
  else if (receivedWords) intent = 'received_total';
  return { intent, crop, period };
}

export function periodRange(period: Period, now = new Date()): { from?: Date; to?: Date } {
  // Periods are evaluated in IST (UTC+05:30), where users are.
  const IST = 330 * 60_000;
  const local = new Date(now.getTime() + IST);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const at = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd) - IST);
  switch (period) {
    case 'today': return { from: at(y, m, d) };
    case 'this_week': {
      const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
      return { from: at(y, m, d - dow) };
    }
    case 'this_month': return { from: at(y, m, 1) };
    case 'last_month': return { from: at(y, m - 1, 1), to: new Date(at(y, m, 1).getTime() - 1) };
    case 'this_year': return { from: at(y, 0, 1) };
    default: return {};
  }
}

const PERIOD_TEXT: Record<SpeechLang, Record<Period, string>> = {
  hi: { today: 'आज', this_week: 'इस हफ्ते', this_month: 'इस महीने', last_month: 'पिछले महीने', this_year: 'इस साल', all_time: 'अब तक' },
  hinglish: { today: 'aaj', this_week: 'is hafte', this_month: 'is mahine', last_month: 'pichle mahine', this_year: 'is saal', all_time: 'ab tak' },
  en: { today: 'today', this_week: 'this week', this_month: 'this month', last_month: 'last month', this_year: 'this year', all_time: 'so far' },
};

export interface VoiceAnswer {
  intent: VoiceIntent;
  crop?: string;
  period: Period;
  answerText: string;
  data: Record<string, unknown>;
}

const txn = (n: number) => (n === 1 ? 'transaction' : 'transactions');

export async function answerQuestion(userId: string, question: string, lang: SpeechLang): Promise<VoiceAnswer> {
  const parsed = parseQuestion(question);
  const uid = new Types.ObjectId(userId);
  const range = periodRange(parsed.period);
  const P = PERIOD_TEXT[lang][parsed.period];
  const cropLabel = (c: string) => (lang === 'hi' ? (CROP_HI[c] ?? c) : c);

  switch (parsed.intent) {
    case 'pending_total': {
      const [agg] = await TransactionModel.aggregate<{ outstanding: number; count: number }>([
        { $match: { userId: uid, paymentStatus: { $in: ['pending', 'partially_paid', 'disputed'] } } },
        { $group: { _id: null, outstanding: { $sum: { $subtract: ['$netAmountPaise', '$amountReceivedPaise'] } }, count: { $sum: 1 } } },
      ]);
      const outstanding = agg?.outstanding ?? 0;
      const count = agg?.count ?? 0;
      const answerText = count === 0
        ? { hi: 'आपका कोई भी पैसा बाकी नहीं है।', hinglish: 'Aapka koi paisa pending nahi hai.', en: 'You have no pending payments.' }[lang]
        : {
            hi: `आपका कुल ${rupees(outstanding)} बाकी है, ${count} सौदों में।`,
            hinglish: `Aapka total ${rupees(outstanding)} pending hai, ${count} ${txn(count)} mein.`,
            en: `You have ${rupees(outstanding)} pending across ${count} ${txn(count)}.`,
          }[lang];
      return { ...parsed, answerText, data: { outstandingPaise: outstanding, count } };
    }
    case 'received_total': {
      const [agg] = await TransactionModel.aggregate<{ received: number }>([
        { $match: { userId: uid, ...(range.from || range.to ? { transactionDate: { ...(range.from && { $gte: range.from }), ...(range.to && { $lte: range.to }) } } : {}) } },
        { $group: { _id: null, received: { $sum: '$amountReceivedPaise' } } },
      ]);
      const received = agg?.received ?? 0;
      const answerText = {
        hi: `${P} के सौदों पर आपको ${rupees(received)} मिल चुके हैं।`,
        hinglish: `${P} ke transactions par aapko ${rupees(received)} mil chuke hain.`,
        en: `You have received ${rupees(received)} for transactions ${P}.`,
      }[lang];
      return { ...parsed, answerText, data: { receivedPaise: received } };
    }
    case 'crop_sales': {
      const match: Record<string, unknown> = { userId: uid };
      if (parsed.crop) match.cropName = parsed.crop;
      if (range.from || range.to) match.transactionDate = { ...(range.from && { $gte: range.from }), ...(range.to && { $lte: range.to }) };
      const rows = await TransactionModel.aggregate<{ _id: string; quantity: number; gross: number; count: number }>([
        { $match: match },
        { $group: { _id: '$unit', quantity: { $sum: '$quantity' }, gross: { $sum: '$grossAmountPaise' }, count: { $sum: 1 } } },
      ]);
      const gross = rows.reduce((s, r) => s + r.gross, 0);
      const count = rows.reduce((s, r) => s + r.count, 0);
      const qty = rows.map((r) => `${Math.round(r.quantity * 1000) / 1000} ${r._id}`).join(' + ');
      const what = parsed.crop ? cropLabel(parsed.crop) : { hi: 'फसल', hinglish: 'fasal', en: 'produce' }[lang];
      const answerText = count === 0
        ? { hi: `${P} ${what} की कोई बिक्री दर्ज नहीं है।`, hinglish: `${P} ${what} ki koi sale record nahi hai.`, en: `No ${what} sales recorded ${P}.` }[lang]
        : {
            hi: `${P} आपने ${qty} ${what} बेचा, कुल ${rupees(gross)} का।`,
            hinglish: `${P[0]?.toUpperCase()}${P.slice(1)} aapne ${qty} ${what} becha, total ${rupees(gross)} ka.`,
            en: `${P[0]?.toUpperCase()}${P.slice(1)} you sold ${qty} of ${what}, worth ${rupees(gross)} in total.`,
          }[lang];
      return { ...parsed, answerText, data: { grossPaise: gross, count, byUnit: rows.map((r) => ({ unit: r._id, quantity: r.quantity })) } };
    }
    case 'unpaid_list':
    case 'overdue_list': {
      const filter = buildListFilter(userId, { status: parsed.intent === 'overdue_list' ? 'overdue' : 'outstanding' });
      const docs = await TransactionModel.find(filter).sort({ transactionDate: 1 }).limit(5);
      const total = await TransactionModel.countDocuments(filter);
      const items = docs.map(toTransactionDTO);
      const label = parsed.intent === 'overdue_list'
        ? { hi: 'जिनका पेमेंट समय से ज़्यादा बाकी है', hinglish: 'jinka payment overdue hai', en: 'overdue' }[lang]
        : { hi: 'जिनका पेमेंट अभी नहीं आया', hinglish: 'jinka payment abhi nahi aaya', en: 'awaiting payment' }[lang];
      const list = items.map((t) => `${cropLabel(t.cropName)} ${rupees(t.outstandingPaise)}`).join(', ');
      const answerText = total === 0
        ? { hi: 'ऐसा कोई सौदा नहीं है।', hinglish: 'Aisa koi transaction nahi hai.', en: `No transactions are ${label}.` }[lang]
        : {
            hi: `${total} सौदे ऐसे हैं ${label}: ${list}।`,
            hinglish: `${total} ${txn(total)} ${label}: ${list}.`,
            en: `${total} ${txn(total)} ${total === 1 ? 'is' : 'are'} ${label}: ${list}.`,
          }[lang];
      return { ...parsed, answerText, data: { total, items } };
    }
    default:
      return {
        ...parsed,
        answerText: {
          hi: 'माफ़ कीजिए, मैं यह सवाल नहीं समझ पाया। आप पूछ सकते हैं: मेरा कितना पैसा बाकी है?',
          hinglish: 'Sorry, yeh sawaal samajh nahi aaya. Aap pooch sakte hain: Mera kitna paisa pending hai?',
          en: "Sorry, I didn't understand that. You can ask: How much money is pending?",
        }[lang],
        data: {},
      };
  }
}
