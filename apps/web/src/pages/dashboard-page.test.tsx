import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Analytics } from '@/lib/queries';
import { DashboardPage } from './dashboard-page';

const analytics = vi.fn();
vi.mock('@/lib/queries', () => ({ useAnalytics: () => analytics() }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { name: 'Asha Devi', email: 'a@example.test', isDemo: false }, signOut: vi.fn() }) }));
vi.mock('@/components/voice-ask', () => ({ VoiceAsk: () => <div>voice ask</div> }));

const totals = (transactions: number): Analytics['totals'] => ({
  transactions, grossSalesPaise: 0, netPayablePaise: 0, receivedPaise: 0, pendingPaise: 0, partiallyPaidCount: 0, overdueCount: 0, overduePaise: 0,
});
const ready = (transactions: number) => ({ data: { totals: totals(transactions), recent: [], monthly: [], cropWise: [], statusDistribution: [] }, isPending: false, error: null, refetch: vi.fn() });
const show = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

describe('first-time hint on the dashboard', () => {
  beforeEach(() => analytics.mockReset());

  it('appears for a user with no sales and links to the recorder and the guide', () => {
    analytics.mockReturnValue(ready(0));
    show();
    const hint = screen.getByTestId('getting-started');
    expect(hint).toHaveTextContent('Record your first sale in 3 steps');
    expect(screen.getByRole('link', { name: /Record my first sale/ })).toHaveAttribute('href', '/app/record');
    expect(screen.getByRole('link', { name: /How it works/ })).toHaveAttribute('href', '/app/help');
    expect(hint).toHaveTextContent('Bhaiya, 25 quintal gehu becha hai');
  });

  it('is gone once there is at least one sale', () => {
    analytics.mockReturnValue(ready(1));
    show();
    expect(screen.queryByTestId('getting-started')).not.toBeInTheDocument();
    expect(screen.getByText('Namaste, Asha')).toBeInTheDocument();
  });

  it('does not flash while the numbers are still loading', () => {
    analytics.mockReturnValue({ data: undefined, isPending: true, error: null, refetch: vi.fn() });
    show();
    expect(screen.queryByTestId('getting-started')).not.toBeInTheDocument();
  });

  it('does not appear when loading failed', () => {
    analytics.mockReturnValue({ data: undefined, isPending: false, error: new Error('boom'), refetch: vi.fn() });
    show();
    expect(screen.queryByTestId('getting-started')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });
});
