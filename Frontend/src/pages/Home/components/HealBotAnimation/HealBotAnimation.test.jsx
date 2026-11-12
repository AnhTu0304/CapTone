import React from 'react';
import { render, screen } from '@testing-library/react';
import HealBotAnimation from './HealBotAnimation';

describe('HealBotAnimation (Pixel Art Chicken Mascot Evolution)', () => {
  it('renders the initial egg sprite frame on clean section background', () => {
    render(<HealBotAnimation />);
    expect(screen.getByTestId('healbot-animation-stage')).toBeInTheDocument();

    const img = screen.getByTestId('healbot-sprite-image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('healbot_egg_idle'));
  });

  it('renders static guardian sprite frame when reducedMotion is true', () => {
    render(<HealBotAnimation reducedMotion={true} />);
    const img = screen.getByTestId('healbot-sprite-image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('healbot_guardian'));
  });
});
