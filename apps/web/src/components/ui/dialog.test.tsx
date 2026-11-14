import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FieldError } from './input';
import { Dialog } from './dialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Dialog open={open} onOpenChange={setOpen} title="Record a payment"><input aria-label="Amount" /></Dialog>
    </>
  );
}

describe('Dialog focus management', () => {
  it('has a name, moves focus inside, and gives focus back to the opening button on Escape', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Record a payment' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('also returns focus when closed with the Close button', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(opener).toHaveFocus());
  });
});

describe('FieldError', () => {
  it('renders nothing without a message and an announced, linkable alert with one', () => {
    const { rerender } = render(<FieldError id="email-error" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<FieldError id="email-error" message="Enter a valid email" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('id', 'email-error');
    expect(alert).toHaveTextContent('Enter a valid email');
  });
});
