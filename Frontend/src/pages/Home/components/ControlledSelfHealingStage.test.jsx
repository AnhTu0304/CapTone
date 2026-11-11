import React from 'react';
import { render, screen } from '@testing-library/react';
import { ControlledSelfHealingStage } from './ControlledSelfHealingStage';

describe('ControlledSelfHealingStage', () => {
  beforeEach(() => {
    window.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  test('renders characters with robot on left and operator on right, pixel dialog, speech bubble and celebration stars', () => {
    const { container } = render(<ControlledSelfHealingStage />);

    expect(screen.getByText('AI AGENT // HEALBOT')).toBeInTheDocument();
    expect(screen.getByText('HUMAN OPERATOR // SRE')).toBeInTheDocument();

    const cols = container.querySelectorAll('.csh-actor-col');
    expect(cols.length).toBe(2);
    expect(cols[0]).toHaveClass('csh-robot-col');
    expect(cols[1]).toHaveClass('csh-operator-col');

    const robotImages = container.querySelectorAll('.csh-robot-col img.csh-sprite-img');
    expect(robotImages.length).toBe(6);

    const operatorImages = container.querySelectorAll('.csh-operator-col img.csh-sprite-img');
    expect(operatorImages.length).toBe(4);

    expect(screen.getByTestId('csh-pixel-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('csh-speech-bubble')).toBeInTheDocument();
    expect(screen.getByText('CrashLoopBackOff')).toBeInTheDocument();
    expect(screen.getByText('worker-node-02')).toBeInTheDocument();
    expect(screen.getByText('Restart affected Pod')).toBeInTheDocument();
    expect(screen.getByText('Restart Pod?')).toBeInTheDocument();

    const stars = container.querySelectorAll('.csh-diamond-star');
    expect(stars.length).toBe(8);

    expect(screen.queryByText(/Recovery Verified/i)).not.toBeInTheDocument();
  });
});
