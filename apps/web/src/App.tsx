import { Loader2 } from 'lucide-react';
import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/auth';
import { useOfflineSync } from '@/lib/drafts';
import { pageTitle } from '@/lib/page-title';
import { LandingPage } from '@/pages/landing-page';

const lazyNamed = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const LoginPage = lazyNamed(() => import('@/pages/auth-pages'), 'LoginPage');
const RegisterPage = lazyNamed(() => import('@/pages/auth-pages'), 'RegisterPage');
const DashboardPage = lazyNamed(() => import('@/pages/dashboard-page'), 'DashboardPage');
const RecordPage = lazyNamed(() => import('@/pages/record-page'), 'RecordPage');
const TransactionsPage = lazyNamed(() => import('@/pages/transactions-page'), 'TransactionsPage');
const TransactionDetailPage = lazyNamed(() => import('@/pages/transaction-detail-page'), 'TransactionDetailPage');
const PaymentsPage = lazyNamed(() => import('@/pages/payments-page'), 'PaymentsPage');
const AnalyticsPage = lazyNamed(() => import('@/pages/analytics-page'), 'AnalyticsPage');
const SettingsPage = lazyNamed(() => import('@/pages/settings-page'), 'SettingsPage');
const HelpPage = lazyNamed(() => import('@/pages/help-page'), 'HelpPage');
const PublicHelpPage = lazyNamed(() => import('@/pages/help-page'), 'PublicHelpPage');

/** Keeps document.title in step with the route. */
function TitleManager() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = pageTitle(pathname); }, [pathname]);
  return null;
}

function FullPageSpinner() {
  return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-6 animate-spin text-mandi-700" aria-label="Loading" /></div>;
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  useOfflineSync((n) => toast.success(`${n} offline ${n === 1 ? 'sale was' : 'sales were'} saved to your account`));
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return user ? <Navigate to="/app" replace /> : <Outlet />;
}

export function App() {
  return (
    <>
    <TitleManager />
    <Suspense fallback={<FullPageSpinner />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/help" element={<PublicHelpPage />} />
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="record" element={<RecordPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="transactions/:id" element={<TransactionDetailPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  );
}
