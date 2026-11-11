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

  test('renders step 1 looped video, step 2 AI predictive inference illustration, and step 3 SVG canvas', () => {
    const { container } = render(<HowItWorksSection />);
    
    // Verify Step 1 video exists with loop and muted attributes
    const videoEl = container.querySelector('video.hiw-screen-video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl).toHaveAttribute('src', expect.stringContaining('videocard1.mp4'));
    expect(videoEl).toHaveAttribute('loop');

    // Cards 2 and 3 render SVG canvases
    const svgList = container.querySelectorAll('svg.hiw-svg-canvas');
    expect(svgList.length).toBe(2);

    // Verify Step 2 AI illustration
    expect(
      screen.getByLabelText(/Mô hình AI dự báo suy thoái với các luồng dữ liệu K8s hội tụ vào đầu não trung tâm/i)
    ).toBeInTheDocument();
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
