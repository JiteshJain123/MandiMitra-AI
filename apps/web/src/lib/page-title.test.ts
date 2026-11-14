import { describe, expect, it } from 'vitest';
import { pageTitle } from './page-title';

describe('pageTitle', () => {
  it.each([
    ['/', /voice-first/],
    ['/help', /How it works/],
    ['/login', /Sign in/],
    ['/register', /Create your account/],
    ['/app', /Dashboard/],
    ['/app/record', /Record a sale/],
    ['/app/transactions', /^Transactions/],
    ['/app/transactions/6af7f1c8a30bc6c2785bdd56', /^Receipt/],
    ['/app/payments', /Payments/],
    ['/app/analytics', /Analytics/],
    ['/app/settings', /Settings/],
    ['/app/help', /How it works/],
  ])('%s has its own descriptive title', (path, re) => {
    expect(pageTitle(path)).toMatch(re);
    expect(pageTitle(path)).toContain('MandiMitra');
  });

  it('ignores a trailing slash and falls back for unknown paths', () => {
    expect(pageTitle('/app/payments/')).toBe(pageTitle('/app/payments'));
    expect(pageTitle('/nope')).toBe('MandiMitra AI');
  });

  it('every known route has a different title except the two Help pages', () => {
    const paths = ['/', '/help', '/login', '/register', '/app', '/app/record', '/app/transactions', '/app/payments', '/app/analytics', '/app/settings'];
    expect(new Set(paths.map(pageTitle)).size).toBe(paths.length);
  });
});
