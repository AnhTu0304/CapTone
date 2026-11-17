import React from 'react';
import { render, screen } from '@testing-library/react';
import { AiPredictiveInferenceIllustration } from './AiPredictiveInferenceIllustration';

describe('AiPredictiveInferenceIllustration', () => {
  test('renders animated predictive inference SVG with accessible label and stream packets', () => {
    const { container } = render(<AiPredictiveInferenceIllustration className="custom-test-class" />);

    const svgEl = screen.getByRole('img');
    expect(svgEl).toBeInTheDocument();
    expect(svgEl).toHaveAttribute('aria-label', expect.stringContaining('Mô hình AI dự báo suy thoái'));
    expect(svgEl).toHaveClass('ai-predictive-inference-svg', 'custom-test-class');

    // Verify continuous streaming data packets with animateMotion exist along 6 rays
    const animateMotionTags = container.querySelectorAll('animateMotion');
    expect(animateMotionTags.length).toBeGreaterThanOrEqual(12);

    // Verify central blue AI neural core cube exists
    const blueCube = container.querySelector('rect[fill="#3B67F6"]');
    expect(blueCube).toBeInTheDocument();

    // Verify 4 yellow corner pins exist
    const yellowPins = container.querySelectorAll('rect[fill="#ECFFA3"]');
    expect(yellowPins.length).toBe(4);

    // Verify lateral glowing beacon beacons exist
    const beaconGlows = container.querySelectorAll('.apii-beacon-glow-anim');
    expect(beaconGlows.length).toBe(2);
  });
});
