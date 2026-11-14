import { BarChart3, CircleHelp, Home, IndianRupee, ListChecks, LogOut, Mic, Settings } from 'lucide-react';
import { Suspense, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { IntegrationStatus } from './integration-status';
import { Logo } from './logo';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: Home, end: true },
  { to: '/app/record', label: 'Record sale', icon: Mic },
  { to: '/app/transactions', label: 'Transactions', icon: ListChecks },
  { to: '/app/payments', label: 'Payments', icon: IndianRupee },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
  // Keep Help last: the mobile bottom bar picks items by position (0-3 and 5), and mobile gets a Help link in the top bar instead.
  { to: '/app/help', label: 'Help', icon: CircleHelp },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const lastPath = useRef(pathname);
  // After moving to another page, put keyboard and screen-reader focus at the start of the new content.
  // Compare paths (not "first render") so React StrictMode's double effect run cannot steal focus on initial load.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr] print:block">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-mandi-700 focus:shadow-lg print:hidden">Skip to main content</a>
      <div className="hidden border-r border-line bg-white print:hidden lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col px-4 py-5">
        <Logo className="px-2" />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-mandi-50 text-mandi-700' : 'text-ink-soft hover:bg-mist hover:text-ink',
            )}>
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <div className="px-2">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-ink-faint">{user?.email}</p>
          </div>
          <button onClick={async () => { await signOut(); navigate('/'); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-mist">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>
      </div>

      <div className="flex min-h-dvh flex-col">
        <header className="print:hidden sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:px-8">
          <Logo className="lg:hidden" />
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <NavLink to="/app/help" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-mist hover:text-ink lg:hidden"><CircleHelp className="size-3.5" aria-hidden /> Help</NavLink>
            {user?.isDemo &&<span className="rounded-full bg-turmeric-50 px-2.5 py-1 text-xs font-medium text-turmeric-700"><span className="sm:hidden">Demo</span><span className="hidden sm:inline">Demo account</span></span>}
            <IntegrationStatus />
          </div>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 focus:outline-none lg:px-8 lg:pb-10">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-slip bg-white" />}><Outlet /></Suspense>
        </main>
      </div>

      {/* Mobile bottom navigation with the record action in the centre */}
      <nav aria-label="Main" className="print:hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {[NAV[0], NAV[2], NAV[1], NAV[3], NAV[5]].map((item) => {
          const { to, label, icon: Icon, end } = item as (typeof NAV)[number];
          const isRecord = to === '/app/record';
          return (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2 text-[11px]', isActive ? 'text-mandi-700' : 'text-ink-faint')}>
              {isRecord ? (
                <span className="-mt-6 grid size-14 place-items-center rounded-full bg-mandi-700 text-white shadow-lg ring-4 ring-white"><Icon className="size-6" /></span>
              ) : <Icon className="size-5" />}
              <span>{isRecord ? 'Record' : label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
