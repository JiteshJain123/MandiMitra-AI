import { describe, expect, it } from 'vitest';
import { calculateAmounts } from './calculation.service.js';
import { rupees, transactionSummaryText } from './speech-text.service.js';

const t = {
  cropName: 'Wheat', quantity: 25, unit: 'quintal' as const, commissionPercentage: 2,
  ...calculateAmounts({ quantity: 25, ratePerUnit: 2400, commissionPercentage: 2, transportCharge: 500, otherDeductions: 0 }),
};

describe('speech text', () => {
  it('formats rupees with Indian grouping', () => {
    expect(rupees(24_000_000)).toBe('₹2,40,000');
    expect(rupees(5_830_050)).toBe('₹58,300.50');
  });
  it('builds a Hindi summary with backend-calculated amounts', () => {
    const s = transactionSummaryText(t, 'hi');
    expect(s).toContain('25 क्विंटल गेहूं');
    expect(s).toContain('₹60,000');
    expect(s).toContain('₹1,200');
    expect(s).toContain('₹58,300');
  });
  it('builds English and Hinglish summaries', () => {
    expect(transactionSummaryText(t, 'en')).toContain('Net payable ₹58,300');
    expect(transactionSummaryText(t, 'hinglish')).toContain('25 quintal gehu');
  });
});
