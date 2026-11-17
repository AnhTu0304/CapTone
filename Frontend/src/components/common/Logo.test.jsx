import React from 'react';
import { render, screen } from '@testing-library/react';
import Logo from './Logo';

describe('Logo Component', () => {
  it('renders centered logo without text by default', () => {
    render(<Logo />);
    const img = screen.getByAltText('SelfHeal Logo Mark');
    expect(img).toBeInTheDocument();
    expect(screen.queryByText('Self')).not.toBeInTheDocument();
  });

  it('renders with PNG variant when specified', () => {
    render(<Logo variant="png" />);
    const img = screen.getByAltText('SelfHeal Logo Mark');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBeTruthy();
  });

  it('shows text only when showText is true', () => {
    render(<Logo showText={true} />);
    expect(screen.getByAltText('SelfHeal Logo Mark')).toBeInTheDocument();
    expect(screen.getByText('Self')).toBeInTheDocument();
    expect(screen.getByText('Heal')).toBeInTheDocument();
  });

  it('applies custom size to image', () => {
    render(<Logo size={48} />);
    const img = screen.getByAltText('SelfHeal Logo Mark');
    expect(img).toHaveStyle({ width: '48px', height: '48px' });
  });
});
