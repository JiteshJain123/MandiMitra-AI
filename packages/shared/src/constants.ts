/**
 * Values verified against docs.gnani.ai on 2026-11-13.
 * STT language codes: Prisma v3.0 REST. TTS voices: Timbre v2.5 catalogue
 * (each v2.5 voice has a single preferred language).
 */
export const USER_ROLES = ['farmer', 'trader', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PAYMENT_STATUSES = ['pending', 'partially_paid', 'paid', 'disputed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  disputed: 'Disputed',
};

export const UNITS = ['quintal', 'kg', 'ton'] as const;
export type Unit = (typeof UNITS)[number];

export interface AppLanguage {
  /** App-level identifier stored on the user profile. */
  code: string;
  label: string;
  nativeLabel: string;
  /** Value sent as Prisma `language_code`. */
  sttLanguageCode: string;
  /** Value sent as Timbre `language`. */
  ttsLanguage: string;
  /** Timbre v2.5 voice whose preferred language matches ttsLanguage. */
  ttsVoice: string;
}

export const APP_LANGUAGES: readonly AppLanguage[] = [
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', sttLanguageCode: 'hi-IN', ttsLanguage: 'hi-IN', ttsVoice: 'Nalini' },
  { code: 'hinglish', label: 'Hinglish (Hindi + English)', nativeLabel: 'Hinglish', sttLanguageCode: 'hi-IN,en-IN', ttsLanguage: 'hi-en', ttsVoice: 'Poorvi' },
  { code: 'en', label: 'English (India)', nativeLabel: 'English', sttLanguageCode: 'en-IN', ttsLanguage: 'en-IN', ttsVoice: 'Devika' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', sttLanguageCode: 'mr-IN', ttsLanguage: 'mr-IN', ttsVoice: 'Zahira' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', sttLanguageCode: 'pa-IN', ttsLanguage: 'pa-IN', ttsVoice: 'Mehuli' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', sttLanguageCode: 'gu-IN', ttsLanguage: 'gu-IN', ttsVoice: 'Falak' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', sttLanguageCode: 'bn-IN', ttsLanguage: 'bn-IN', ttsVoice: 'Kirra' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', sttLanguageCode: 'ta-IN', ttsLanguage: 'ta-IN', ttsVoice: 'Asmita' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', sttLanguageCode: 'te-IN', ttsLanguage: 'te-IN', ttsVoice: 'Lavanya' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', sttLanguageCode: 'kn-IN', ttsLanguage: 'kn-IN', ttsVoice: 'Saanvi' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', sttLanguageCode: 'ml-IN', ttsLanguage: 'ml-IN', ttsVoice: 'Reshma' },
] as const;

/** Prisma v3.0-only automatic language identification. */
export const AUTO_DETECT_LANGUAGE = 'indic-auto';

export const LANGUAGE_CODES = APP_LANGUAGES.map((l) => l.code) as [string, ...string[]];

export function getLanguage(code: string): AppLanguage {
  return APP_LANGUAGES.find((l) => l.code === code) ?? (APP_LANGUAGES[0] as AppLanguage);
}

/** Prisma REST rejects audio longer than 30 seconds. */
export const MAX_AUDIO_SECONDS = 30;
/** 30 s of 16 kHz mono 16-bit WAV is ~960 KB; allow headroom for other formats. */
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export const KNOWN_CROPS = [
  'Wheat', 'Rice', 'Paddy', 'Maize', 'Bajra', 'Jowar', 'Barley', 'Gram', 'Tur', 'Moong', 'Urad',
  'Masoor', 'Mustard', 'Soybean', 'Groundnut', 'Cotton', 'Sugarcane', 'Onion', 'Potato', 'Tomato',
] as const;
