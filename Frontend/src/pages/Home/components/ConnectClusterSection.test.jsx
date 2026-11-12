import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConnectClusterSection from './ConnectClusterSection';

describe('ConnectClusterSection (Greptile Dark Navy Final CTA with Satellite Mesh)', () => {
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

  test('renders central diff card and satellite nodes', () => {
    const { container } = render(<ConnectClusterSection />);

    // Central card
    expect(screen.getByText(/deployment\/order-processor\.yaml/i)).toBeInTheDocument();
    expect(screen.getByText(/replicas: 3 # high availability cluster/i)).toBeInTheDocument();

    // 6 Satellite nodes
    const diffBadges = screen.getAllByText('DIFF');
    expect(diffBadges.length).toBe(6);

    // SVG mesh
    expect(container.querySelector('.ccs-mesh-svg')).toBeInTheDocument();
  });

  test('renders Greptile-inspired vertical architectural background grid with markers', () => {
    render(<ConnectClusterSection />);
    const bgGrid = screen.getByTestId('ccs-bg-grid');
    expect(bgGrid).toBeInTheDocument();
    expect(bgGrid).toHaveAttribute('aria-hidden', 'true');
  });
});
