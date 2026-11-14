import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FIRST_EXAMPLE } from '@mandimitra/shared';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LandingPage } from './landing-page';

beforeAll(() => {
  // jsdom has no matchMedia; the slip animation asks for reduced motion
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
});

const show = () => render(<MemoryRouter><LandingPage /></MemoryRouter>);

describe('landing page guidance', () => {
  it('has a labelled "How it works" section with the four steps, reachable by an anchor link', () => {
    show();
    const section = document.getElementById('how-it-works') as HTMLElement;
    expect(section).toBeInTheDocument();
    expect(within(section).getByText('How it works')).toBeInTheDocument();
    expect(within(section).getAllByRole('listitem')).toHaveLength(4);
    const anchors = screen.getAllByRole('link', { name: /how it works/i }).map((a) => a.getAttribute('href'));
    expect(anchors).toContain('#how-it-works');
  });

  it('tells a new visitor exactly how to try it and what to say', () => {
    show();
    const box = screen.getByTestId('try-it');
    expect(box).toHaveTextContent('Try it in 30 seconds');
    expect(box).toHaveTextContent('Try the demo account');
    expect(box).toHaveTextContent(FIRST_EXAMPLE.text);
    expect(within(box).getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/login');
    expect(within(box).getByRole('link', { name: 'Read the full guide' })).toHaveAttribute('href', '/help');
  });

  it('links to the public help page from the header and the footer', () => {
    show();
    const helpLinks = screen.getAllByRole('link', { name: 'Help' });
    expect(helpLinks.length).toBeGreaterThanOrEqual(2);
    for (const l of helpLinks) expect(l).toHaveAttribute('href', '/help');
  });

  it('keeps the existing calls to action', () => {
    show();
    expect(screen.getByRole('link', { name: 'Create free account' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
  });
});
