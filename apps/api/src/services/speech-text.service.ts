import type { Amounts, Unit } from '@mandimitra/shared';

/**
 * Builds text for Timbre to read aloud. Amounts are written as "₹58,300" with Indian grouping,
 * which the Timbre input-formatting guide says is normalised to spoken rupees.
 * Languages without a template here fall back to English text with the English voice.
 */

export type SpeechLang = 'hi' | 'hinglish' | 'en';

export function speechLanguageFor(appLanguage: string): SpeechLang {
  return appLanguage === 'hi' || appLanguage === 'hinglish' ? appLanguage : 'en';
}

const CROP_HI: Record<string, string> = {
  Wheat: 'गेहूं', Rice: 'चावल', Paddy: 'धान', Maize: 'मक्का', Bajra: 'बाजरा', Jowar: 'ज्वार', Barley: 'जौ',
  Gram: 'चना', Tur: 'अरहर', Moong: 'मूंग', Urad: 'उड़द', Masoor: 'मसूर', Mustard: 'सरसों', Soybean: 'सोयाबीन',
  Groundnut: 'मूंगफली', Cotton: 'कपास', Sugarcane: 'गन्ना', Onion: 'प्याज', Potato: 'आलू', Tomato: 'टमाटर',
};
const CROP_HINGLISH: Record<string, string> = {
  Wheat: 'gehu', Rice: 'chawal', Paddy: 'dhaan', Maize: 'makka', Gram: 'chana', Mustard: 'sarson',
  Onion: 'pyaaz', Potato: 'aloo', Tomato: 'tamatar', Cotton: 'kapas', Sugarcane: 'ganna', Tur: 'arhar',
};
const UNIT_HI: Record<Unit, string> = { quintal: 'क्विंटल', kg: 'किलो', ton: 'टन' };

export function rupees(paise: number): string {
  const r = paise / 100;
  const hasPaise = Math.round(paise) % 100 !== 0;
  return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 })}`;
}

const num = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });

export interface SummaryInput extends Amounts {
  cropName: string;
  quantity: number;
  unit: Unit;
  ratePerUnitPaise: number;
  commissionPercentage: number;
}

export function transactionSummaryText(t: SummaryInput, lang: SpeechLang): string {
  const parts: string[] = [];
  if (lang === 'hi') {
    const crop = CROP_HI[t.cropName] ?? t.cropName;
    const unit = UNIT_HI[t.unit];
    parts.push(`आपने ${num(t.quantity)} ${unit} ${crop} बेचा, रेट ${rupees(t.ratePerUnitPaise)} प्रति ${unit}।`);
    parts.push(`कुल रकम ${rupees(t.grossAmountPaise)}।`);
    if (t.commissionAmountPaise > 0) parts.push(`कमीशन ${num(t.commissionPercentage)}% यानी ${rupees(t.commissionAmountPaise)}।`);
    if (t.transportChargePaise > 0) parts.push(`ट्रांसपोर्ट ${rupees(t.transportChargePaise)}।`);
    if (t.otherDeductionsPaise > 0) parts.push(`अन्य कटौती ${rupees(t.otherDeductionsPaise)}।`);
    parts.push(`आपको कुल ${rupees(t.netAmountPaise)} मिलेंगे। क्या यह सही है?`);
  } else if (lang === 'hinglish') {
    const crop = CROP_HINGLISH[t.cropName] ?? t.cropName;
    parts.push(`Aapne ${num(t.quantity)} ${t.unit} ${crop} becha, rate ${rupees(t.ratePerUnitPaise)} per ${t.unit}.`);
    parts.push(`Total amount ${rupees(t.grossAmountPaise)}.`);
    if (t.commissionAmountPaise > 0) parts.push(`Commission ${num(t.commissionPercentage)}% yaani ${rupees(t.commissionAmountPaise)}.`);
    if (t.transportChargePaise > 0) parts.push(`Transport ${rupees(t.transportChargePaise)}.`);
    if (t.otherDeductionsPaise > 0) parts.push(`Baaki kharcha ${rupees(t.otherDeductionsPaise)}.`);
    parts.push(`Aapko net ${rupees(t.netAmountPaise)} milenge. Kya yeh sahi hai?`);
  } else {
    parts.push(`You sold ${num(t.quantity)} ${t.unit} of ${t.cropName.toLowerCase()} at ${rupees(t.ratePerUnitPaise)} per ${t.unit}.`);
    parts.push(`Gross amount ${rupees(t.grossAmountPaise)}.`);
    if (t.commissionAmountPaise > 0) parts.push(`Commission ${num(t.commissionPercentage)}%, which is ${rupees(t.commissionAmountPaise)}.`);
    if (t.transportChargePaise > 0) parts.push(`Transport ${rupees(t.transportChargePaise)}.`);
    if (t.otherDeductionsPaise > 0) parts.push(`Other deductions ${rupees(t.otherDeductionsPaise)}.`);
    parts.push(`Net payable ${rupees(t.netAmountPaise)}. Is this correct?`);
  }
  return parts.join(' ');
}

export { CROP_HI };
