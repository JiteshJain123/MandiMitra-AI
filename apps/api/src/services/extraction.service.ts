import { REQUIRED_DRAFT_FIELDS, transactionDraftSchema, type TransactionDraft, type Unit } from '@mandimitra/shared';
import {
  AMBIGUOUS_NUMBER_WORDS, BOUNDARY_WORDS, COMMISSION_WORDS, COUNT_NOUNS, CROP_ALIASES, FRACTION_MODIFIERS, FRACTION_VALUES,
  HALF_WORDS, MULTIPLIERS, NUMBER_WORDS, OTHER_DEDUCTION_WORDS, PAID_PHRASES, PARTIAL_PHRASES, PERCENT_WORDS, PER_WORDS,
  RATE_WORDS, RUPEE_WORDS, TRANSPORT_WORDS, UNIT_WORDS,
} from './extraction.lexicon.js';

/**
 * Deterministic extraction of transaction fields from a (Hindi / Hinglish / English) transcript.
 * It never guesses: anything it cannot attribute confidently is left null and reported.
 * Financial amounts are NOT calculated here (see calculation.service.ts).
 */

export type DraftField = keyof Omit<TransactionDraft, 'paymentStatus'>;

export interface ExtractionResult {
  draft: TransactionDraft;
  missingFields: (typeof REQUIRED_DRAFT_FIELDS)[number][];
  warnings: string[];
  /** The words each value was taken from, for display to the user. */
  evidence: Partial<Record<DraftField | 'paymentStatus', string>>;
}

const BOUNDARY = '<s>';

export function normaliseDevanagari(s: string): string {
  return s
    .normalize('NFC')
    .replace(/़/g, '') // nukta
    .replace(/ँ/g, 'ं'); // chandrabindu -> anusvara
}

export function normaliseTranscript(raw: string): string {
  let s = normaliseDevanagari(raw).toLowerCase();
  s = s.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
  while (/\d,\d/.test(s)) s = s.replace(/(\d),(\d)/g, '$1$2');
  s = s
    .replace(/₹/g, ' rupaye ')
    .replace(/\brs\.?(?=\s|\d|$)/g, ' rs ')
    .replace(/%/g, ' % ')
    .replace(/\//g, ' per ')
    .replace(/(\d)([a-z\p{Script=Devanagari}])/gu, '$1 $2')
    .replace(/([a-z\p{Script=Devanagari}])(\d)/gu, '$1 $2')
    .replace(/[।॥!?]/g, ` ${BOUNDARY} `)
    .replace(/(?<!\d)\.|\.(?!\d)/g, ` ${BOUNDARY} `);
  return s;
}

export function tokenize(raw: string): string[] {
  return normaliseTranscript(raw)
    .split(/[\s,;:"'“”‘’()[\]{}\-–—]+/)
    .filter(Boolean)
    .map((t) => (BOUNDARY_WORDS.has(t) ? BOUNDARY : t));
}

interface NumberSpan {
  value: number;
  start: number;
  end: number;
}

const isDigits = (t: string) => /^\d+(\.\d+)?$/.test(t);
const baseValue = (t: string): number | undefined =>
  isDigits(t) ? Number(t) : (NUMBER_WORDS[t] ?? FRACTION_VALUES[t]);

/** Context that makes an ambiguous word like "do" (2 / "give") a number. A following digit does not count. */
function hasNumericContext(next: string | undefined): boolean {
  if (!next) return false;
  return (
    next in UNIT_WORDS || next in MULTIPLIERS || PERCENT_WORDS.has(next) || RUPEE_WORDS.has(next) ||
    next in CROP_ALIASES || (!isDigits(next) && baseValue(next) !== undefined)
  );
}

/** Groups digit tokens and number words (incl. "do hazaar chaar sau", "saadhe teen", "dedh lakh") into values. */
export function findNumberSpans(tokens: string[]): NumberSpan[] {
  const spans: NumberSpan[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i] as string;
    const startsNumber =
      t in FRACTION_MODIFIERS ? baseValue(tokens[i + 1] ?? '') !== undefined
      : t in MULTIPLIERS ? true
      : baseValue(t) !== undefined && (!AMBIGUOUS_NUMBER_WORDS.has(t) || hasNumericContext(tokens[i + 1]));
    if (!startsNumber) {
      i++;
      continue;
    }
    let total = 0;
    let current: number | null = null;
    let modifier = 0;
    let lastMultiplier = Infinity;
    let lastWasBase = false;
    const start = i;
    let j = i;
    for (; j < tokens.length; j++) {
      const tok = tokens[j] as string;
      if (tok in FRACTION_MODIFIERS && baseValue(tokens[j + 1] ?? '') !== undefined && !lastWasBase) {
        modifier = FRACTION_MODIFIERS[tok] as number;
        continue;
      }
      if (tok in MULTIPLIERS) {
        const m = MULTIPLIERS[tok] as number;
        if (m === 100) current = (current ?? 1) * 100;
        else {
          total += (current ?? 1) * m;
          current = null;
        }
        lastMultiplier = m;
        lastWasBase = false;
        continue;
      }
      const v = baseValue(tok);
      // A new base value can only join the span after a larger multiplier ("do hazaar | chaar sau").
      if (v !== undefined && !lastWasBase && (j === start || v < lastMultiplier)) {
        if (j !== start && AMBIGUOUS_NUMBER_WORDS.has(tok) && !hasNumericContext(tokens[j + 1])) break;
        current = (current ?? 0) + v + modifier;
        modifier = 0;
        lastWasBase = true;
        continue;
      }
      break;
    }
    const value = Math.round((total + (current ?? 0)) * 1000) / 1000;
    spans.push({ value, start, end: j - 1 });
    i = j;
  }
  return spans;
}

type KeywordKind = 'rate' | 'transport' | 'other' | 'commission';

function nearestKeyword(tokens: string[], span: NumberSpan, window = 4): { kind: KeywordKind; word: string } | null {
  const kindOf = (t: string): KeywordKind | null =>
    RATE_WORDS.has(t) ? 'rate'
    : TRANSPORT_WORDS.has(t) ? 'transport'
    : OTHER_DEDUCTION_WORDS.has(t) ? 'other'
    : COMMISSION_WORDS.has(t) ? 'commission'
    : null;
  let forward: { kind: KeywordKind; word: string; d: number; viaRupee: boolean } | null = null;
  let viaRupee = false;
  for (let k = span.end + 1, d = 1; k < tokens.length && d <= window; k++, d++) {
    const t = tokens[k] as string;
    if (t === BOUNDARY) break;
    if (RUPEE_WORDS.has(t)) viaRupee = true;
    const kind = kindOf(t);
    if (kind) { forward = { kind, word: t, d, viaRupee }; break; }
  }
  let backward: { kind: KeywordKind; word: string; d: number } | null = null;
  for (let k = span.start - 1, d = 1; k >= 0 && d <= window; k--, d++) {
    const t = tokens[k] as string;
    if (t === BOUNDARY) break;
    const kind = kindOf(t);
    if (kind) { backward = { kind, word: t, d }; break; }
  }
  if (!forward) return backward;
  if (!backward) return forward;
  if (forward.d < backward.d) return forward;
  if (backward.d < forward.d) return backward;
  // Tie: "rate 4500 commission ..." -> the keyword right before wins, unless the number is
  // tied to the next keyword by a rupee word ("500 rupaye transport").
  return forward.viaRupee ? forward : backward;
}

function windowHas(tokens: string[], from: number, to: number, set: Set<string>): boolean {
  for (let k = Math.max(0, from); k <= Math.min(tokens.length - 1, to); k++) {
    const t = tokens[k] as string;
    if (set.has(t)) return true;
  }
  return false;
}

/** Matches "<n> [rupaye] [per|prati|ka] <unit>" and returns the unit and the index of the last token. */
function matchRatePattern(tokens: string[], span: NumberSpan): { unit: Unit; end: number } | null {
  let k = span.end + 1;
  let sawConnector = false;
  if (RUPEE_WORDS.has(tokens[k] ?? '')) { k++; sawConnector = true; }
  if (PER_WORDS.has(tokens[k] ?? '')) { k++; sawConnector = true; }
  const unit = UNIT_WORDS[tokens[k] ?? ''];
  return unit && sawConnector ? { unit, end: k } : null;
}

const slice = (tokens: string[], a: number, b: number) =>
  tokens.slice(Math.max(0, a), b + 1).filter((t) => t !== BOUNDARY).join(' ');

export function extractTransaction(transcript: string): ExtractionResult {
  const rawTokens = tokenize(transcript);
  // "aadhe percent" -> 0.5 percent; "aadha" alone (e.g. "aadha payment") stays a plain word.
  const tokens = rawTokens.map((t, i) => (HALF_WORDS.has(t) && PERCENT_WORDS.has(rawTokens[i + 1] ?? '') ? '0.5' : t));
  const spans = findNumberSpans(tokens);
  const warnings: string[] = [];
  const evidence: ExtractionResult['evidence'] = {};
  const draft: TransactionDraft = {
    cropName: null, quantity: null, unit: null, ratePerUnit: null,
    commissionPercentage: null, transportCharge: null, otherDeductions: null, paymentStatus: 'pending',
  };
  let rateUnit: Unit | null = null;

  // Crop
  const crops = new Set<string>();
  for (const t of tokens) {
    const c = CROP_ALIASES[t];
    if (c) {
      if (!draft.cropName) { draft.cropName = c; evidence.cropName = t; }
      crops.add(c);
    }
  }
  if (crops.size > 1) warnings.push(`More than one crop mentioned (${[...crops].join(', ')}); using ${draft.cropName}.`);

  for (const span of spans) {
    const next = tokens[span.end + 1] ?? '';
    const ev = slice(tokens, span.start - 2, span.end + 3);

    if (PERCENT_WORDS.has(next)) {
      if (windowHas(tokens, span.start - 4, span.end + 5, COMMISSION_WORDS)) {
        if (draft.commissionPercentage === null) {
          draft.commissionPercentage = span.value;
          evidence.commissionPercentage = ev;
        } else warnings.push(`A second commission percentage (${span.value}%) was ignored.`);
      } else {
        warnings.push(`Found ${span.value}% but could not tell what it is for. Please enter it manually.`);
      }
      continue;
    }

    if (COUNT_NOUNS.has(next)) {
      warnings.push(`"${span.value} ${next}" looks like a count of sacks, so it was not used as an amount. Enter the weight in quintal, kg or ton.`);
      continue;
    }

    const rate = matchRatePattern(tokens, span);
    if (rate) {
      if (draft.ratePerUnit === null) {
        draft.ratePerUnit = span.value;
        rateUnit = rate.unit;
        evidence.ratePerUnit = slice(tokens, span.start - 2, rate.end);
      } else warnings.push(`A second rate (${span.value}) was ignored.`);
      continue;
    }

    const unit = UNIT_WORDS[next];
    const precededByRate = windowHas(tokens, span.start - 2, span.start - 1, RATE_WORDS);
    if ((unit || next in CROP_ALIASES) && !precededByRate) {
      if (draft.quantity === null) {
        draft.quantity = span.value;
        if (unit) draft.unit = unit;
        evidence.quantity = slice(tokens, span.start, span.end + 1);
      } else warnings.push(`A second quantity (${span.value}${unit ? ` ${unit}` : ''}) was ignored.`);
      continue;
    }

    const kw = nearestKeyword(tokens, span);
    if (!kw) {
      warnings.push(`Could not tell what the number ${span.value} refers to.`);
      continue;
    }
    switch (kw.kind) {
      case 'rate':
        if (draft.ratePerUnit === null) { draft.ratePerUnit = span.value; evidence.ratePerUnit = ev; }
        else warnings.push(`A second rate (${span.value}) was ignored.`);
        break;
      case 'transport':
        if (draft.transportCharge !== null) warnings.push('More than one transport amount found; they were added together.');
        draft.transportCharge = (draft.transportCharge ?? 0) + span.value;
        evidence.transportCharge = ev;
        break;
      case 'other':
        draft.otherDeductions = (draft.otherDeductions ?? 0) + span.value;
        evidence.otherDeductions = evidence.otherDeductions ? `${evidence.otherDeductions}; ${ev}` : ev;
        break;
      case 'commission':
        draft.otherDeductions = (draft.otherDeductions ?? 0) + span.value;
        evidence.otherDeductions = evidence.otherDeductions ? `${evidence.otherDeductions}; ${ev}` : ev;
        warnings.push(`Commission of ₹${span.value} was given as a flat amount, so it was added to other deductions.`);
        break;
    }
  }

  if (draft.unit === null && rateUnit) draft.unit = rateUnit;
  else if (draft.unit && rateUnit && draft.unit !== rateUnit) {
    warnings.push(`Quantity is in ${draft.unit} but the rate is per ${rateUnit}. Please check before confirming.`);
  }

  const joined = tokens.filter((t) => t !== BOUNDARY).join(' ');
  // Partial phrases are more specific ("aadha payment mil gaya" also contains "payment mil"), so they win.
  if (PARTIAL_PHRASES.some((p) => joined.includes(normaliseDevanagari(p)))) {
    draft.paymentStatus = 'partially_paid';
    evidence.paymentStatus = 'partial payment';
  } else if (PAID_PHRASES.some((p) => joined.includes(normaliseDevanagari(p)))) {
    draft.paymentStatus = 'paid';
    evidence.paymentStatus = 'payment received';
  }

  const parsed = transactionDraftSchema.safeParse(draft);
  if (!parsed.success) {
    // Drop any value that fails validation rather than passing bad data on.
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof TransactionDraft | undefined;
      if (field && field !== 'paymentStatus') {
        (draft as Record<string, unknown>)[field] = null;
        warnings.push(`Ignored an invalid value for ${field}.`);
      }
    }
  }

  const missingFields = REQUIRED_DRAFT_FIELDS.filter((f) => draft[f] === null);
  return { draft: transactionDraftSchema.parse(draft), missingFields, warnings, evidence };
}
