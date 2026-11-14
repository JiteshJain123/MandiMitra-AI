import { Decimal } from 'decimal.js';
import type { Amounts } from '@mandimitra/shared';
import { AppError } from '../lib/errors.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export interface CalculationInput {
  quantity: number;
  /** Rupees per unit. */
  ratePerUnit: number;
  commissionPercentage: number;
  /** Rupees. */
  transportCharge: number;
  /** Rupees. */
  otherDeductions: number;
}

export interface CalculationResult extends Amounts {
  ratePerUnitPaise: number;
}

/** Converts a rupee amount to integer paise, rounding half-up. */
export function rupeesToPaise(rupees: number | string): number {
  return new D(rupees).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Financial calculation. All arithmetic uses decimal.js; results are integer paise.
 *   gross      = quantity × rate
 *   commission = gross × commission% / 100
 *   net        = gross − commission − transport − other deductions
 */
export function calculateAmounts(input: CalculationInput): CalculationResult {
  const quantity = new D(input.quantity);
  const rate = new D(input.ratePerUnit);
  const pct = new D(input.commissionPercentage);
  if (quantity.lte(0)) throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be greater than 0');
  if (rate.lte(0)) throw new AppError(400, 'INVALID_RATE', 'Rate must be greater than 0');
  if (pct.lt(0) || pct.gt(100)) throw new AppError(400, 'INVALID_COMMISSION', 'Commission must be between 0 and 100%');

  const ratePerUnitPaise = rupeesToPaise(input.ratePerUnit);
  const grossAmountPaise = quantity.times(rate).times(100).toDecimalPlaces(0).toNumber();
  const commissionAmountPaise = new D(grossAmountPaise).times(pct).dividedBy(100).toDecimalPlaces(0).toNumber();
  const transportChargePaise = rupeesToPaise(input.transportCharge);
  const otherDeductionsPaise = rupeesToPaise(input.otherDeductions);
  if (transportChargePaise < 0 || otherDeductionsPaise < 0) {
    throw new AppError(400, 'INVALID_DEDUCTION', 'Deductions cannot be negative');
  }
  const netAmountPaise = grossAmountPaise - commissionAmountPaise - transportChargePaise - otherDeductionsPaise;
  if (netAmountPaise < 0) {
    throw new AppError(400, 'DEDUCTIONS_EXCEED_GROSS', 'Total deductions are larger than the gross amount');
  }
  if (!Number.isSafeInteger(grossAmountPaise)) {
    throw new AppError(400, 'AMOUNT_TOO_LARGE', 'Amount is too large');
  }
  return { ratePerUnitPaise, grossAmountPaise, commissionAmountPaise, transportChargePaise, otherDeductionsPaise, netAmountPaise };
}
