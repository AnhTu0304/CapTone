import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConnectClusterSection from './ConnectClusterSection';

describe('ConnectClusterSection (Greptile Dark Navy Final CTA with HealBot Mascot)', () => {
  test('renders title and dual-hexagon button group', () => {
    const mockNavigate = jest.fn();
    render(<ConnectClusterSection onNavigate={mockNavigate} />);

    expect(screen.getByText(/SelfHeal xây dựng lớp tự phục hồi hạ tầng/i)).toBeInTheDocument();

    const guideBtn = screen.getByRole('link', { name: /Xem hướng dẫn/i });
    expect(guideBtn).toBeInTheDocument();
    fireEvent.click(guideBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/guide');

    const startBtn = screen.getByRole('link', { name: /Bắt đầu ngay/i });
    expect(startBtn).toBeInTheDocument();
    fireEvent.click(startBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/get-started');
  });

  test('renders HealBot pixel mascot animation stage inside wrapper', () => {
    render(<ConnectClusterSection />);

    const mascotWrapper = screen.getByTestId('ccs-mascot-wrapper');
    expect(mascotWrapper).toBeInTheDocument();

    const mascotStage = screen.getByTestId('healbot-animation-stage');
    expect(mascotStage).toBeInTheDocument();

    expect(screen.getByText('SELFHEAL // KUBERNETES GUARDIAN')).toBeInTheDocument();
  });

  test('renders Greptile-inspired vertical architectural background grid with markers', () => {
    render(<ConnectClusterSection />);
    const bgGrid = screen.getByTestId('ccs-bg-grid');
    expect(bgGrid).toBeInTheDocument();
    expect(bgGrid).toHaveAttribute('aria-hidden', 'true');
  });
});
