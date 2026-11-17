import React from 'react';
import { render, screen } from '@testing-library/react';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import HomePage from './index';

describe('HomePage layout & GSAP Smooth Scroll integrations', () => {
  test('renders HeroSectionSlot, SocialProofSection, and other core sections in order', () => {
    const mockNavigate = jest.fn();
    render(<HomePage onNavigate={mockNavigate} />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('social-proof-section')).toBeInTheDocument();
    expect(screen.getByTestId('sp-overview-card')).toBeInTheDocument();
  });

  test('initializes ScrollTriggers while preserving native mouse wheel scroll speed', () => {
    const prevMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { unmount } = render(<HomePage />);

    const triggers = ScrollTrigger.getAll();
    expect(triggers.length).toBeGreaterThan(0);

    // Verify wheel events are NOT intercepted or prevented, preserving native scrolling speed
    const wheelEvent = new Event('wheel', { bubbles: true, cancelable: true });
    window.dispatchEvent(wheelEvent);
    expect(wheelEvent.defaultPrevented).toBe(false);

    expect(() => unmount()).not.toThrow();
    window.matchMedia = prevMatchMedia;
  });
});
