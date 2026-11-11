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
    expect(screen.getByText('Bước 1')).toBeInTheDocument();
    expect(screen.getByText(/Thu thập & Quan sát đa chiều/i)).toBeInTheDocument();

    expect(screen.getByText('Bước 2')).toBeInTheDocument();
    expect(screen.getByText(/Mô hình AI dự báo suy thoái/i)).toBeInTheDocument();

    expect(screen.getByText('Bước 3')).toBeInTheDocument();
    expect(screen.getByText(/Tự động phục hồi có kiểm soát/i)).toBeInTheDocument();
  });

  test('renders SVG canvases and parallel agent tags for step 2', () => {
    const { container } = render(<HowItWorksSection />);
    const svgList = container.querySelectorAll('svg.hiw-svg-canvas');
    expect(svgList.length).toBe(3);

    const parallelAgentTags = screen.getAllByText(/PARALLEL AGENT/i);
    expect(parallelAgentTags.length).toBe(3);
  });

  test('renders continuous vertical guidelines', () => {
    const { container } = render(<HowItWorksSection />);
    expect(container.querySelector('.hiw-guide-v-left')).toBeInTheDocument();
    expect(container.querySelector('.hiw-guide-v-right')).toBeInTheDocument();
  });

  test('renders prediction summary framed block and bottom multi-line scan track below the 3 steps', () => {
    const { getByTestId } = render(<HowItWorksSection />);
    expect(screen.getByRole('heading', { name: /Dự đoán các sự cố/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Từ khả năng quan sát theo thời gian thực đến dự báo dựa trên AI và tự động phục hồi/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/BA GIAI ĐOẠN BẢO VỆ HẠ TẦNG PRODUCTION\./i)).toBeInTheDocument();
    expect(getByTestId('hiw-bottom-scan-track')).toBeInTheDocument();
  });
});
