import { describe, expect, it } from 'vitest';
import { parseQuestion, periodRange } from './voice-query.service.js';

describe('parseQuestion', () => {
  it.each([
    ['Mera kitna paisa pending hai?', 'pending_total', undefined, 'all_time'],
    ['Is mahine kitni gehun ki sale hui?', 'crop_sales', 'Wheat', 'this_month'],
    ['Kaunse transactions ka payment abhi nahi aaya?', 'unpaid_list', undefined, 'all_time'],
    ['मेरा कितना पैसा बाकी है?', 'pending_total', undefined, 'all_time'],
    ['पिछले महीने कितना चना बेचा?', 'crop_sales', 'Gram', 'last_month'],
    ['Is mahine kitni pyaaj ki sale hui?', 'crop_sales', 'Onion', 'this_month'],
    ['How much did I receive this month?', 'received_total', undefined, 'this_month'],
    ['Which payments are overdue?', 'overdue_list', undefined, 'all_time'],
    ['aaj mausam kaisa hai', 'unknown', undefined, 'today'],
  ])('%s', (q, intent, crop, period) => {
    expect(parseQuestion(q)).toEqual({ intent, crop, period });
  });
});

describe('periodRange (IST)', () => {
  it('starts this month at IST midnight on the 1st', () => {
    const { from } = periodRange('this_month', new Date('2026-11-13T10:00:00Z'));
    expect(from?.toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });
  it('last month ends just before this month', () => {
    const { from, to } = periodRange('last_month', new Date('2026-01-05T10:00:00Z'));
    expect(from?.toISOString()).toBe('2025-11-30T18:30:00.000Z');
    expect(to?.toISOString()).toBe('2025-12-31T18:29:59.999Z');
  });
});
