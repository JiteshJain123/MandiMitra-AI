import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EXAMPLE_QUESTIONS, EXAMPLE_SALES } from '@mandimitra/shared';
import { describe, expect, it } from 'vitest';
import { HelpContent, HelpPage, PublicHelpPage } from './help-page';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('HelpContent', () => {
  it('explains what the app is and lists the five first-sale steps', () => {
    wrap(<HelpContent signedIn />);
    expect(screen.getByRole('heading', { name: 'What is MandiMitra?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Record your first sale in 5 steps' })).toBeInTheDocument();
    const steps = within(document.getElementById('first-sale') as HTMLElement).getAllByRole('listitem');
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveTextContent('microphone');
    expect(steps[4]).toHaveTextContent('Confirm and save');
  });

  it('shows every example sentence together with what the slip will contain', () => {
    wrap(<HelpContent signedIn />);
    for (const e of EXAMPLE_SALES) {
      const box = screen.getByTestId(`example-${e.id}`);
      expect(box).toHaveTextContent(e.text);
      expect(box).toHaveTextContent(e.fills.cropName);
      expect(box).toHaveTextContent(`${e.fills.commissionPercentage}%`);
    }
    // formatted with Indian grouping, not a raw number
    expect(screen.getByTestId('example-hinglish')).toHaveTextContent('₹2,400');
  });

  it('covers microphone trouble, page guide, example questions and the FAQ', () => {
    wrap(<HelpContent signedIn />);
    expect(screen.getByRole('heading', { name: 'Microphone not working?' })).toBeInTheDocument();
    const mic = within(document.getElementById('microphone') as HTMLElement);
    expect(mic.getByText(/Upload audio/)).toBeInTheDocument();
    expect(mic.getByText(/Enter manually/)).toBeInTheDocument();
    expect(mic.getByText(/lock icon/)).toBeInTheDocument();
    for (const q of EXAMPLE_QUESTIONS) expect(screen.getByText(q)).toBeInTheDocument();
    expect(screen.getByText('Is my voice recording saved?')).toBeInTheDocument();
    expect(screen.getByText(/never stored/)).toBeInTheDocument();
  });

  it('points signed-in users at the recorder and visitors at sign-up', () => {
    const { unmount } = wrap(<HelpContent signedIn />);
    expect(screen.getByRole('link', { name: /Record a sale now/ })).toHaveAttribute('href', '/app/record');
    unmount();
    wrap(<HelpContent signedIn={false} />);
    expect(screen.getByRole('link', { name: 'Create free account' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /Try the demo/ })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /Record a sale now/ })).not.toBeInTheDocument();
  });
});

describe('help pages', () => {
  it('the in-app page has a title', () => {
    wrap(<HelpPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'How MandiMitra works' })).toBeInTheDocument();
  });

  it('the public page works without signing in and offers sign-in and registration', () => {
    wrap(<PublicHelpPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'How MandiMitra works' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
  });
});
