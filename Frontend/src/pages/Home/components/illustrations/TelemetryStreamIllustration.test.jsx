import React from 'react';
import { render, screen } from '@testing-library/react';
import { TelemetryStreamIllustration } from './TelemetryStreamIllustration';

describe('TelemetryStreamIllustration', () => {
  test('renders animated telemetry stream SVG with accessible label', () => {
    const { container } = render(<TelemetryStreamIllustration className="custom-test-class" />);
    
    const svgEl = screen.getByRole('img');
    expect(svgEl).toBeInTheDocument();
    expect(svgEl).toHaveAttribute('aria-label', expect.stringContaining('Thu thập dữ liệu'));
    expect(svgEl).toHaveClass('telemetry-stream-svg', 'custom-test-class');

    // Verify animated data packets with animateMotion exist
    const animateMotionTags = container.querySelectorAll('animateMotion');
    expect(animateMotionTags.length).toBeGreaterThan(10);

    // Verify central blue core machine box exists
    const blueMachine = container.querySelector('rect[fill="#2E5BF2"]');
    expect(blueMachine).toBeInTheDocument();
  });
});
