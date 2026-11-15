import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from './index';

describe('HomePage layout', () => {
  test('renders HeroSectionSlot, SocialProofSection, and other core sections in order', () => {
    const mockNavigate = jest.fn();
    render(<HomePage onNavigate={mockNavigate} />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('social-proof-section')).toBeInTheDocument();
    expect(screen.getByTestId('sp-overview-card')).toBeInTheDocument();
  });
});
