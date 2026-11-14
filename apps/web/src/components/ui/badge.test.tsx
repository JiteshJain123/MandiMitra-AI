import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './badge';

describe('StatusBadge', () => {
  it('renders the human label and an overdue marker', () => {
    render(<StatusBadge status="partially_paid" overdue />);
    expect(screen.getByText('Partially paid')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});
