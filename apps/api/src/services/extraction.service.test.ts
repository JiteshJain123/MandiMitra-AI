import { describe, expect, it } from 'vitest';
import { extractTransaction, findNumberSpans, tokenize } from './extraction.service.js';

const REFERENCE =
  'Bhaiya, 25 quintal gehu becha hai, rate 2400 rupaye per quintal hai. 2 percent commission aur 500 rupaye transport charge kaat lena.';

describe('extractTransaction', () => {
  it('extracts the reference Hinglish sentence exactly', () => {
    const r = extractTransaction(REFERENCE);
    expect(r.draft).toEqual({
      cropName: 'Wheat', quantity: 25, unit: 'quintal', ratePerUnit: 2400,
      commissionPercentage: 2, transportCharge: 500, otherDeductions: null, paymentStatus: 'pending',
    });
    expect(r.missingFields).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('extracts the same sentence in Devanagari with number words', () => {
    const r = extractTransaction(
      'भैया, पच्चीस क्विंटल गेहूँ बेचा है, रेट 2,400 रुपये प्रति क्विंटल है। दो प्रतिशत कमीशन और 500 रुपये ट्रांसपोर्ट चार्ज काट लेना।',
    );
    expect(r.draft).toMatchObject({ cropName: 'Wheat', quantity: 25, unit: 'quintal', ratePerUnit: 2400, commissionPercentage: 2, transportCharge: 500 });
    expect(r.missingFields).toEqual([]);
  });

  it('handles Devanagari digits, ₹ and % symbols', () => {
    const r = extractTransaction('१० क्विंटल सरसों, भाव ₹५६०० प्रति क्विंटल, 1.5% आढ़त');
    expect(r.draft).toMatchObject({ cropName: 'Mustard', quantity: 10, unit: 'quintal', ratePerUnit: 5600, commissionPercentage: 1.5 });
  });

  it('parses spoken compound numbers ("do hazaar chaar sau", "saadhe baarah")', () => {
    const r = extractTransaction('saadhe barah quintal dhan, bhav do hazaar chaar sau rupaye quintal');
    expect(r.draft).toMatchObject({ cropName: 'Paddy', quantity: 12.5, unit: 'quintal', ratePerUnit: 2400 });
  });

  it('handles English phrasing and "rate ... per kg"', () => {
    const r = extractTransaction('Sold 800 kg onion at 18 rupees per kg, labour 200 and transport 350');
    expect(r.draft).toMatchObject({ cropName: 'Onion', quantity: 800, unit: 'kg', ratePerUnit: 18, transportCharge: 350, otherDeductions: 200 });
  });

  it('sums multiple other deductions (hammali + tulai)', () => {
    const r = extractTransaction('20 quintal chana 5200 ke bhav se, hammali 150 aur tulai 100 rupaye');
    expect(r.draft).toMatchObject({ cropName: 'Gram', quantity: 20, ratePerUnit: 5200, otherDeductions: 250 });
  });

  it('does not invent missing fields', () => {
    const r = extractTransaction('25 quintal gehu becha hai');
    expect(r.draft.ratePerUnit).toBeNull();
    expect(r.draft.commissionPercentage).toBeNull();
    expect(r.missingFields).toEqual(['ratePerUnit']);
  });

  it('leaves an unattributed percentage empty and warns', () => {
    const r = extractTransaction('10 quintal makka 2100 rupaye quintal, 3 percent kaat lena');
    expect(r.draft.commissionPercentage).toBeNull();
    expect(r.warnings.join(' ')).toMatch(/3%/);
  });

  it('moves a flat commission amount into other deductions with a warning', () => {
    const r = extractTransaction('5 quintal soyabean rate 4500, commission 300 rupaye');
    expect(r.draft.commissionPercentage).toBeNull();
    expect(r.draft.otherDeductions).toBe(300);
    expect(r.warnings.join(' ')).toMatch(/flat amount/);
  });

  it('detects payment received', () => {
    expect(extractTransaction(`${REFERENCE} payment mil gaya`).draft.paymentStatus).toBe('paid');
    expect(extractTransaction('10 quintal gehu, पैसा मिल गया').draft.paymentStatus).toBe('paid');
  });

  it('does not treat the verb "do" (give) as the number 2', () => {
    const r = extractTransaction('rate bata do, 25 quintal gehu');
    expect(r.draft.quantity).toBe(25);
    expect(r.draft.ratePerUnit).toBeNull();
  });

  it('warns on unit mismatch between quantity and rate', () => {
    const r = extractTransaction('5 ton gehu 2400 rupaye per quintal');
    expect(r.warnings.join(' ')).toMatch(/per quintal/);
  });

  it('returns all-null draft for empty or irrelevant transcripts', () => {
    for (const t of ['', 'namaste bhaiya kaise ho']) {
      const r = extractTransaction(t);
      expect(r.missingFields).toEqual(['cropName', 'quantity', 'unit', 'ratePerUnit']);
    }
  });
});

/**
 * Transcripts returned by the real Gnani Prisma API (prisma-v3.0, format=transcribe) in the
 * smoke test of 2026-11-13. Prisma mixes scripts: Devanagari words with Latin "rate",
 * "commission", "transport charge", digits and "%".
 */
describe('transcripts observed from the real Prisma API', () => {
  const EXPECTED = {
    cropName: 'Wheat', quantity: 25, unit: 'quintal', ratePerUnit: 2400,
    commissionPercentage: 2, transportCharge: 500, otherDeductions: null, paymentStatus: 'pending',
  };
  it.each([
    ['Hindi voice', '25 क्विंटल गेहूं बेचा है। rate 2400 रुपये प्रति क्विंटल है। 2% commission और 500 रुपये transport charge काट लेना।'],
    ['Hinglish voice', 'भैया, 25 quintal गेहूँ बेचा है। rate 2400 रुपये पर quintal है। 2% commission और 500 रुपये transport charge काट लेना।'],
  ])('%s', (_name, transcript) => {
    const r = extractTransaction(transcript);
    expect(r.draft).toEqual(EXPECTED);
    expect(r.missingFields).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('reads "<n> रुपये पर quintal" as a rate even without the word "rate"', () => {
    const r = extractTransaction('25 quintal गेहूँ बेचा, 2400 रुपये पर quintal');
    expect(r.draft).toMatchObject({ quantity: 25, unit: 'quintal', ratePerUnit: 2400 });
    expect(r.missingFields).toEqual([]);
  });
});

describe('sacks and half percent', () => {
  it('does not turn a count of sacks into a deduction', () => {
    const r = extractTransaction('8 bori aloo, rate 900 rupaye quintal, 5 quintal');
    expect(r.draft).toMatchObject({ cropName: 'Potato', quantity: 5, unit: 'quintal', ratePerUnit: 900, otherDeductions: null });
    expect(r.warnings.some((w) => w.includes('count of sacks'))).toBe(true);
  });

  it('still reads a bori charge written as an amount', () => {
    const r = extractTransaction('5 quintal aloo, rate 900 rupaye quintal, bori charge 40 rupaye');
    expect(r.draft).toMatchObject({ quantity: 5, ratePerUnit: 900, otherDeductions: 40 });
  });

  it.each([
    ['commission aadhe percent'],
    ['आधा प्रतिशत कमीशन'],
  ])('reads half a percent: %s', (phrase) => {
    const r = extractTransaction(`2 quintal sarson, rate 5600 rupaye quintal, ${phrase}`);
    expect(r.draft.commissionPercentage).toBe(0.5);
  });

  it('does not treat "aadha payment" as a number', () => {
    const r = extractTransaction('10 quintal gehu, rate 2400 rupaye quintal, aadha payment mil gaya');
    expect(r.draft).toMatchObject({ quantity: 10, ratePerUnit: 2400, paymentStatus: 'partially_paid' });
    expect(r.warnings).toEqual([]);
  });
});

describe('number parsing', () => {
  const values = (s: string) => findNumberSpans(tokenize(s)).map((x) => x.value);
  it.each([
    ['do hazaar chaar sau', [2400]],
    ['pachees sau', [2500]],
    ['dedh lakh', [150000]],
    ['ek sau bees', [120]],
    ['दो हज़ार पाँच सौ', [2500]],
    ['2 hazaar 400', [2400]],
    ['25 2400', [25, 2400]],
    ['2,40,000', [240000]],
  ])('%s', (input, expected) => {
    expect(values(input)).toEqual(expected);
  });
});
