/**
 * Example sentences shown on the Help page, the landing page and the first-time dashboard hint.
 * An API test (help-examples.test.ts) runs every one through the extractor, so what the app tells
 * users to say is guaranteed to be understood.
 */
export interface ExampleSale {
  id: 'hinglish' | 'hindi' | 'english';
  language: string;
  text: string;
  /** What the sale slip will contain after "Fill the sale slip". */
  fills: {
    cropName: string;
    quantity: number;
    unit: 'quintal' | 'kg' | 'ton';
    ratePerUnit: number;
    commissionPercentage: number;
    transportCharge: number;
  };
}

export const EXAMPLE_SALES: readonly ExampleSale[] = [
  {
    id: 'hinglish',
    language: 'Hinglish',
    text: 'Bhaiya, 25 quintal gehu becha hai, rate 2400 rupaye per quintal. 2 percent commission aur 500 rupaye transport kaat lena.',
    fills: { cropName: 'Wheat', quantity: 25, unit: 'quintal', ratePerUnit: 2400, commissionPercentage: 2, transportCharge: 500 },
  },
  {
    id: 'hindi',
    language: 'Hindi',
    text: 'भैया, 50 क्विंटल प्याज बेचा है, रेट 2200 रुपये प्रति क्विंटल है। 2 प्रतिशत कमीशन और 500 रुपये ट्रांसपोर्ट चार्ज काट लेना।',
    fills: { cropName: 'Onion', quantity: 50, unit: 'quintal', ratePerUnit: 2200, commissionPercentage: 2, transportCharge: 500 },
  },
  {
    id: 'english',
    language: 'English',
    text: 'Sold 12 quintal onion at rate 1800 rupees per quintal. Commission 1 percent and transport 300 rupees.',
    fills: { cropName: 'Onion', quantity: 12, unit: 'quintal', ratePerUnit: 1800, commissionPercentage: 1, transportCharge: 300 },
  },
] as const;

/** The sentence used wherever the app shows a single "try saying" example. */
export const FIRST_EXAMPLE: ExampleSale = EXAMPLE_SALES[0] as ExampleSale;

/** Questions the dashboard "Ask about your money" box understands. */
export const EXAMPLE_QUESTIONS = [
  'Mera kitna paisa pending hai?',
  'Is mahine kitni gehun ki sale hui?',
  'Kaunse transactions ka payment abhi nahi aaya?',
] as const;
