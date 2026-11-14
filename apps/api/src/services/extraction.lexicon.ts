/**
 * Vocabulary for deterministic transcript extraction.
 * All keys are stored in normalised form (lower-case, nukta removed, chandrabindu → anusvara);
 * see normaliseDevanagari() in extraction.service.ts.
 */

const DEVANAGARI_1_TO_99 = [
  'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ', 'दस',
  'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस',
  'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस',
  'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस', 'चालीस',
  'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास', 'पचास',
  'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ', 'साठ',
  'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर', 'सत्तर',
  'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी', 'अस्सी',
  'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी', 'नब्बे',
  'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पंचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे',
];

const ROMAN_NUMBERS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, panch: 5, paanch: 5, paach: 5, chhe: 6, che: 6, chhah: 6, chah: 6,
  saat: 7, sat: 7, aath: 8, ath: 8, nau: 9, das: 10, dus: 10, gyarah: 11, gyaarah: 11, barah: 12, baarah: 12,
  terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17, atharah: 18, athaarah: 18,
  unnis: 19, unnees: 19, bees: 20, bis: 20, ikkis: 21, ikkees: 21, bais: 22, baais: 22, baees: 22, teis: 23, teyis: 23,
  chaubis: 24, chaubees: 24, pachis: 25, pachees: 25, pachchis: 25, pacchis: 25, pachchees: 25,
  chhabbis: 26, chabbis: 26, sattais: 27, sattaees: 27, atthais: 28, athais: 28, untis: 29, untees: 29,
  tis: 30, tees: 30, battis: 32, paintis: 35, chalis: 40, chalees: 40, pachas: 50, pachaas: 50,
  saath: 60, sath: 60, sattar: 70, pachattar: 75, pachhattar: 75, assi: 80, nabbe: 90,
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

export const NUMBER_WORDS: Record<string, number> = { ...ROMAN_NUMBERS };
DEVANAGARI_1_TO_99.forEach((w, i) => {
  NUMBER_WORDS[w] = i + 1;
});
// Common spelling variants
Object.assign(NUMBER_WORDS, { 'पाँच': 5, 'छः': 6, 'छे': 6, 'पन्द्रह': 15 });

export const MULTIPLIERS: Record<string, number> = {
  sau: 100, hundred: 100, 'सौ': 100,
  hazaar: 1000, hazar: 1000, hajar: 1000, hajaar: 1000, thousand: 1000, 'हजार': 1000,
  lakh: 100_000, lac: 100_000, lakhs: 100_000, 'लाख': 100_000,
  crore: 10_000_000, karod: 10_000_000, 'करोड': 10_000_000,
};

/** Fraction words that are complete values on their own. */
export const FRACTION_VALUES: Record<string, number> = {
  dedh: 1.5, derh: 1.5, 'डेढ': 1.5, dhai: 2.5, dhaai: 2.5, 'ढाई': 2.5,
};

/** Fraction words that modify the next number. */
export const FRACTION_MODIFIERS: Record<string, number> = {
  saadhe: 0.5, sade: 0.5, saade: 0.5, sadhe: 0.5, 'साढे': 0.5,
  sava: 0.25, savaa: 0.25, 'सवा': 0.25,
  paune: -0.25, 'पौने': -0.25,
};

/** Words that are only numbers when followed by numeric context (they are also common verbs/words). */
export const AMBIGUOUS_NUMBER_WORDS = new Set(['ek', 'do', 'saath', 'sath', 'sat', 'tin', 'one', 'che', 'das', 'tis', 'bis']);

export const UNIT_WORDS: Record<string, 'quintal' | 'kg' | 'ton'> = {
  quintal: 'quintal', quintals: 'quintal', kuintal: 'quintal', kwintal: 'quintal', kvintal: 'quintal',
  quental: 'quintal', qtl: 'quintal', qtls: 'quintal', kuntal: 'quintal', 'क्विंटल': 'quintal',
  'क्विन्टल': 'quintal', 'कुंतल': 'quintal', 'कुन्तल': 'quintal',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', 'किलो': 'kg', 'किलोग्राम': 'kg',
  ton: 'ton', tons: 'ton', tonne: 'ton', tonnes: 'ton', 'टन': 'ton',
};

export const RUPEE_WORDS = new Set([
  'rupaye', 'rupaya', 'rupay', 'rupees', 'rupee', 'rs', 'rupiya', 'rupiye', 'rupye', 'inr',
  'रुपये', 'रुपए', 'रुपया', 'रूपये', 'रूपए', 'रुपैया',
]);

export const PER_WORDS = new Set(['per', 'prati', 'pratee', 'प्रति', 'पर', 'पर्', 'har', 'हर', 'ka', 'ke', 'ki', 'का', 'के', 'की', 'a', 'each']);

export const PERCENT_WORDS = new Set([
  '%', 'percent', 'percentage', 'pratishat', 'parsent', 'persent', 'prasent', 'pc', 'fisadi', 'takka',
  'प्रतिशत', 'परसेंट', 'पर्सेंट', 'फीसदी', 'टका',
]);

export const RATE_WORDS = new Set([
  'rate', 'ret', 'rait', 'bhav', 'bhaav', 'bhao', 'daam', 'dam', 'keemat', 'kimat', 'price', 'mulya',
  'रेट', 'भाव', 'दाम', 'कीमत', 'मूल्य',
]);

export const COMMISSION_WORDS = new Set([
  'commission', 'comission', 'commision', 'kamishan', 'kamission', 'kameeshan', 'aadhat', 'adhat', 'arhat', 'aadat',
  'dalali', 'brokerage', 'कमीशन', 'आढत', 'आडत', 'दलाली',
]);

export const TRANSPORT_WORDS = new Set([
  'transport', 'transportation', 'bhada', 'bhaada', 'bhara', 'bhaade', 'bhade', 'kiraya', 'kiraaya', 'freight',
  'gaadi', 'gadi', 'truck', 'tempo', 'ट्रांसपोर्ट', 'भाडा', 'किराया', 'गाडी', 'ट्रक',
]);

export const OTHER_DEDUCTION_WORDS = new Set([
  'hammali', 'hamali', 'palledari', 'palladari', 'tulai', 'tulaai', 'mazdoori', 'majdoori', 'labour', 'labor',
  'kharcha', 'kharch', 'deduction', 'fee', 'shulk', 'other', 'extra', 'bori', 'packing',
  'हम्माली', 'पल्लेदारी', 'तुलाई', 'मजदूरी', 'खर्चा', 'खर्च', 'कटौती', 'शुल्क', 'बोरी',
]);

/**
 * Packaging nouns. A number right before one of these is a count of sacks ("8 bori aloo"),
 * not a rupee amount, even though "bori" can also name a packing charge ("bori charge 40").
 */
export const COUNT_NOUNS = new Set([
  'bori', 'boriyan', 'boriyon', 'bora', 'bore', 'bag', 'bags', 'sack', 'sacks', 'katta', 'katte', 'thaila', 'thaile',
  'बोरी', 'बोरियां', 'बोरियाँ', 'बोरे', 'बोरा', 'कट्टा', 'कट्टे', 'थैला', 'थैले',
]);

/** "aadha percent" / "aadhe percent": half a percent (only when a percent word follows). */
export const HALF_WORDS = new Set(['aadha', 'aadhe', 'adha', 'adhe', 'आधा', 'आधे']);

/** Tokens that end a keyword search window. */
export const BOUNDARY_WORDS = new Set(['aur', 'and', 'tatha', 'plus', 'और', 'तथा', 'evam', 'एवं']);

export const CROP_ALIASES: Record<string, string> = {
  wheat: 'Wheat', gehu: 'Wheat', gehun: 'Wheat', gehoon: 'Wheat', gehoo: 'Wheat', gahu: 'Wheat', 'गेहूं': 'Wheat', 'गेहू': 'Wheat', 'गेंहू': 'Wheat',
  rice: 'Rice', chawal: 'Rice', chaawal: 'Rice', 'चावल': 'Rice',
  paddy: 'Paddy', dhan: 'Paddy', dhaan: 'Paddy', 'धान': 'Paddy',
  maize: 'Maize', corn: 'Maize', makka: 'Maize', makki: 'Maize', 'मक्का': 'Maize', 'मक्की': 'Maize',
  bajra: 'Bajra', baajra: 'Bajra', 'बाजरा': 'Bajra',
  jowar: 'Jowar', jwar: 'Jowar', 'ज्वार': 'Jowar',
  barley: 'Barley', jau: 'Barley', 'जौ': 'Barley',
  gram: 'Gram', chana: 'Gram', channa: 'Gram', chickpea: 'Gram', 'चना': 'Gram',
  tur: 'Tur', toor: 'Tur', arhar: 'Tur', tuar: 'Tur', 'अरहर': 'Tur', 'तुअर': 'Tur', 'तूर': 'Tur',
  moong: 'Moong', mung: 'Moong', 'मूंग': 'Moong',
  urad: 'Urad', udad: 'Urad', 'उडद': 'Urad',
  masoor: 'Masoor', masur: 'Masoor', 'मसूर': 'Masoor',
  mustard: 'Mustard', sarso: 'Mustard', sarson: 'Mustard', sarsoon: 'Mustard', 'सरसों': 'Mustard', 'सरसो': 'Mustard',
  soybean: 'Soybean', soyabean: 'Soybean', soya: 'Soybean', 'सोयाबीन': 'Soybean',
  groundnut: 'Groundnut', moongfali: 'Groundnut', mungfali: 'Groundnut', peanut: 'Groundnut', 'मूंगफली': 'Groundnut',
  cotton: 'Cotton', kapas: 'Cotton', kapaas: 'Cotton', 'कपास': 'Cotton',
  sugarcane: 'Sugarcane', ganna: 'Sugarcane', 'गन्ना': 'Sugarcane',
  onion: 'Onion', pyaz: 'Onion', pyaaz: 'Onion', pyaj: 'Onion', pyaaj: 'Onion', kanda: 'Onion', 'प्याज': 'Onion', 'कांदा': 'Onion',
  potato: 'Potato', aloo: 'Potato', alu: 'Potato', batata: 'Potato', 'आलू': 'Potato',
  tomato: 'Tomato', tamatar: 'Tomato', 'टमाटर': 'Tomato',
};

export const PAID_PHRASES = [
  'payment mil gaya', 'payment mil gayi', 'paisa mil gaya', 'paise mil gaye', 'paise mil gaya', 'bhugtan ho gaya',
  'payment ho gaya', 'payment ho gayi', 'fully paid', 'payment received', 'paid in full', 'poora paisa mil',
  'पेमेंट मिल गया', 'पैसा मिल गया', 'पैसे मिल गए', 'भुगतान हो गया', 'पूरा पैसा मिल',
];
export const PARTIAL_PHRASES = [
  'aadha paisa', 'aadha payment', 'kuch paisa mil', 'partial payment', 'partially paid', 'advance mil', 'baaki baad me',
  'आधा पैसा', 'कुछ पैसा मिल', 'आधा पेमेंट', 'एडवांस मिल',
];
