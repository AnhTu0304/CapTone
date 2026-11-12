import React from 'react';
import { render, screen } from '@testing-library/react';
import HealBotAnimation from './HealBotAnimation';

describe('HealBotAnimation (Pixel Art Chicken Mascot Evolution)', () => {
  it('renders the initial egg state and header badge', () => {
    render(<HealBotAnimation />);
    expect(screen.getByTestId('healbot-animation-stage')).toBeInTheDocument();
    expect(screen.getByText('SELFHEAL // KUBERNETES GUARDIAN')).toBeInTheDocument();
    expect(screen.getByText('AGENT INITIALIZING')).toBeInTheDocument();

    const img = screen.getByTestId('healbot-sprite-image');
    expect(img).toBeInTheDocument();
  });

  it('renders static guardian when reducedMotion is true', () => {
    render(<HealBotAnimation reducedMotion={true} />);
    expect(screen.getByText(/AGENT ONLINE/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello, I'm HealBot!/i)).toBeInTheDocument();
  });

  it('renders bottom system metrics footer', () => {
    render(<HealBotAnimation />);
    expect(screen.getByText('PODS: 100% HEALTHY')).toBeInTheDocument();
    expect(screen.getByText('DOWNTIME: 0s')).toBeInTheDocument();
    expect(screen.getByText('AUTONOMOUS GUARD')).toBeInTheDocument();
  });
});
