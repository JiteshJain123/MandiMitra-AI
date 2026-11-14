const SUFFIX = 'MandiMitra AI';

const TITLES: Record<string, string> = {
  '/': 'MandiMitra AI: voice-first sale records for the mandi',
  '/help': `How it works · ${SUFFIX}`,
  '/login': `Sign in · ${SUFFIX}`,
  '/register': `Create your account · ${SUFFIX}`,
  '/app': `Dashboard · ${SUFFIX}`,
  '/app/record': `Record a sale · ${SUFFIX}`,
  '/app/transactions': `Transactions · ${SUFFIX}`,
  '/app/payments': `Payments · ${SUFFIX}`,
  '/app/analytics': `Analytics · ${SUFFIX}`,
  '/app/settings': `Settings · ${SUFFIX}`,
  '/app/help': `How it works · ${SUFFIX}`,
};

/** A descriptive <title> for every route, so screen-reader users and browser tabs can tell pages apart (WCAG 2.4.2). */
export function pageTitle(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (/^\/app\/transactions\/[^/]+$/.test(path)) return `Receipt · ${SUFFIX}`;
  return TITLES[path] ?? SUFFIX;
}
