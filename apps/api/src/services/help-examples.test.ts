import { EXAMPLE_QUESTIONS, EXAMPLE_SALES } from '@mandimitra/shared';
import { describe, expect, it } from 'vitest';
import { extractTransaction } from './extraction.service.js';
import { parseQuestion } from './voice-query.service.js';

// The Help page tells users to say these sentences and shows what the slip will contain.
// If the extractor ever stops understanding one, this test fails before users are misled.
describe('Help page examples', () => {
  it.each(EXAMPLE_SALES.map((e) => [e.language, e] as const))('%s sale sentence fills the promised slip', (_name, example) => {
    const r = extractTransaction(example.text);
    expect(r.draft).toMatchObject(example.fills);
    expect(r.missingFields).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('every example question is understood (never "unknown")', () => {
    for (const q of EXAMPLE_QUESTIONS) expect(parseQuestion(q).intent).not.toBe('unknown');
  });
});
