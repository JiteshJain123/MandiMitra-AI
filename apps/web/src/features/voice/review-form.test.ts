import { describe, expect, it } from 'vitest';
import { draftToValues, reviewSchema, valuesToPayload } from './review-form';

describe('review form mapping', () => {
  it('leaves missing numeric fields empty instead of inventing values', () => {
    const v = draftToValues({ cropName: 'Wheat', quantity: 25, unit: 'quintal', ratePerUnit: null, commissionPercentage: null, transportCharge: null, otherDeductions: null, paymentStatus: 'pending' }, false);
    expect(Number.isNaN(v.ratePerUnit)).toBe(true);
    expect(reviewSchema.safeParse({ ...v, confirmed: true }).success).toBe(false);
  });

  it('builds a payload without client-side amounts', () => {
    const v = { ...draftToValues(null, true), cropName: 'Wheat', quantity: 25, unit: 'quintal' as const, ratePerUnit: 2400, commissionPercentage: 2, transportCharge: 500 };
    const p = valuesToPayload(v, '25 quintal gehu', null);
    expect(p).toMatchObject({ cropName: 'Wheat', quantity: 25, ratePerUnit: 2400, paymentStatus: 'pending', transcript: '25 quintal gehu', storeTranscript: true });
    expect(JSON.stringify(p)).not.toMatch(/Paise|netAmount|gross/i);
  });

  it('maps disputed and omits empty optional fields', () => {
    const v = { ...draftToValues(null, false), cropName: 'Gram', quantity: 1, unit: 'kg' as const, ratePerUnit: 50, disputed: true };
    const p = valuesToPayload(v);
    expect(p.paymentStatus).toBe('disputed');
    expect('buyerName' in p).toBe(false);
    expect('transcript' in p).toBe(false);
  });
});
