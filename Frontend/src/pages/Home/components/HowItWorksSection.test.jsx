import React from 'react';
import { render, screen } from '@testing-library/react';
import HowItWorksSection from './HowItWorksSection';

describe('HowItWorksSection (3-step Cybernetic Blueprint)', () => {
  test('renders HOW IT WORKS badge', () => {
    render(<HowItWorksSection />);
    expect(screen.getByText(/HOW IT WORKS/i)).toBeInTheDocument();
  });

  test('renders all 3 steps: Quan sát, Dự đoán, and Khôi phục', () => {
    render(<HowItWorksSection />);
    expect(screen.getByText('STEP 01')).toBeInTheDocument();
    expect(screen.getByText(/Thu thập & Quan sát đa chiều/i)).toBeInTheDocument();

    expect(screen.getByText('STEP 02')).toBeInTheDocument();
    expect(screen.getByText(/Mô hình AI dự báo suy thoái/i)).toBeInTheDocument();

    expect(screen.getByText('STEP 03')).toBeInTheDocument();
    expect(screen.getByText(/Tự động phục hồi có kiểm soát/i)).toBeInTheDocument();
  });

  test('renders SVG canvases and parallel agent tags for step 2', () => {
    const { container } = render(<HowItWorksSection />);
    const svgList = container.querySelectorAll('svg.hiw-svg-canvas');
    expect(svgList.length).toBe(3);

    const parallelAgentTags = screen.getAllByText(/PARALLEL AGENT/i);
    expect(parallelAgentTags.length).toBe(3);
  });
});
