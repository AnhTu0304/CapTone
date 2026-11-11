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
    expect(screen.getByText(/Bước 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Thu thập & Quan sát đa chiều/i)).toBeInTheDocument();

    expect(screen.getByText(/Bước 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Mô hình AI dự báo suy thoái/i)).toBeInTheDocument();

    expect(screen.getByText(/Bước 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Tự động phục hồi có kiểm soát/i)).toBeInTheDocument();
  });

  test('renders step 1 and step 2 looped videos and step 3 SVG canvas', () => {
    const { container } = render(<HowItWorksSection />);
    
    // Verify 2 videos exist (Step 1 and Step 2) with loop and muted attributes
    const videoElements = container.querySelectorAll('video.hiw-screen-video');
    expect(videoElements.length).toBe(2);

    expect(videoElements[0]).toHaveAttribute('src', expect.stringContaining('videocard1.mp4'));
    expect(videoElements[0]).toHaveAttribute('loop');

    expect(videoElements[1]).toHaveAttribute('src', expect.stringContaining('card2.mp4'));
    expect(videoElements[1]).toHaveAttribute('loop');

    // Card 3 renders SVG canvas
    const svgList = container.querySelectorAll('svg.hiw-svg-canvas');
    expect(svgList.length).toBe(1);
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
