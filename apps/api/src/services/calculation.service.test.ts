import { describe, expect, it } from 'vitest';
import { calculateAmounts, rupeesToPaise } from './calculation.service.js';

describe('calculateAmounts', () => {
  it('matches the reference wheat example (₹60,000 gross, ₹58,300 net)', () => {
    const r = calculateAmounts({ quantity: 25, ratePerUnit: 2400, commissionPercentage: 2, transportCharge: 500, otherDeductions: 0 });
    expect(r.grossAmountPaise).toBe(6_000_000);
    expect(r.commissionAmountPaise).toBe(120_000);
    expect(r.transportChargePaise).toBe(50_000);
    expect(r.netAmountPaise).toBe(5_830_000);
  });

  it('avoids floating-point drift', () => {
    // 0.1 * 3 in floats is 0.30000000000000004
    const r = calculateAmounts({ quantity: 3, ratePerUnit: 0.1, commissionPercentage: 0, transportCharge: 0, otherDeductions: 0 });
    expect(r.grossAmountPaise).toBe(30);
  });

  it('rounds commission half-up to the nearest paisa', () => {
    // gross = 12.5 * 1999.99 = 24999.875 -> 2499988 paise; 1.5% = 37499.82 -> 37500
    const r = calculateAmounts({ quantity: 12.5, ratePerUnit: 1999.99, commissionPercentage: 1.5, transportCharge: 0, otherDeductions: 0 });
    expect(r.grossAmountPaise).toBe(2_499_988);
    expect(r.commissionAmountPaise).toBe(37_500);
    expect(r.netAmountPaise).toBe(2_499_988 - 37_500);
  });

  it('supports fractional quantities and other deductions', () => {
    const r = calculateAmounts({ quantity: 10.25, ratePerUnit: 2200, commissionPercentage: 2.5, transportCharge: 300, otherDeductions: 150.5 });
    expect(r.grossAmountPaise).toBe(2_255_000);
    expect(r.commissionAmountPaise).toBe(56_375);
    expect(r.netAmountPaise).toBe(2_255_000 - 56_375 - 30_000 - 15_050);
  });

  it('rejects deductions larger than gross', () => {
    expect(() => calculateAmounts({ quantity: 1, ratePerUnit: 100, commissionPercentage: 0, transportCharge: 500, otherDeductions: 0 })).toThrow(/larger than the gross/);
  });

  it('rejects invalid quantity, rate and commission', () => {
    const base = { quantity: 1, ratePerUnit: 100, commissionPercentage: 0, transportCharge: 0, otherDeductions: 0 };
    expect(() => calculateAmounts({ ...base, quantity: 0 })).toThrow(/Quantity/);
    expect(() => calculateAmounts({ ...base, ratePerUnit: -5 })).toThrow(/Rate/);
    expect(() => calculateAmounts({ ...base, commissionPercentage: 101 })).toThrow(/Commission/);
  });

  it('converts rupees to paise exactly', () => {
    expect(rupeesToPaise(1.005)).toBe(101);
    expect(rupeesToPaise(58300)).toBe(5_830_000);
  });
});
