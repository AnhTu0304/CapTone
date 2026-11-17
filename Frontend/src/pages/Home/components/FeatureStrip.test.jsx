import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FeatureStrip from './FeatureStrip';

describe('FeatureStrip ([ AGENT ] Bridge Banner)', () => {
  it('renders [ AGENT ] tag, heading, and description', () => {
    render(<FeatureStrip />);

    expect(screen.getByTestId('agent-bridge-section')).toBeInTheDocument();
    expect(screen.getByText(/\[ AGENT \]/i)).toBeInTheDocument();

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Cách Agent kết nối với dự án của bạn');
    expect(heading).toHaveClass('agent-heading');

    expect(
      screen.getByText(/SelfHeal Agent đóng vai trò cầu nối liên kết trực tiếp/i)
    ).toBeInTheDocument();
  });

  it('renders "Tìm hiểu thêm" button and handles navigation', () => {
    const mockNavigate = jest.fn();
    render(<FeatureStrip onNavigate={mockNavigate} />);

    const button = screen.getByRole('link', { name: /Tìm hiểu thêm/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('agent-btn-learn-more');

    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith('/guide');
  });

  it('renders pinstripe scan bar, guidelines, and 4 corner pins', () => {
    const { container } = render(<FeatureStrip />);

    // Pinstripe bar
    expect(container.querySelector('.agent-scan-track')).toBeInTheDocument();

    // Guidelines and horizontal lines
    expect(container.querySelector('.agent-guide-v-left')).toBeInTheDocument();
    expect(container.querySelector('.agent-guide-v-right')).toBeInTheDocument();
    expect(container.querySelector('.agent-line-top')).toBeInTheDocument();
    expect(container.querySelector('.agent-line-bottom')).toBeInTheDocument();

    // 4 Corner hexagon pins
    expect(container.querySelector('.pin-tl')).toBeInTheDocument();
    expect(container.querySelector('.pin-tr')).toBeInTheDocument();
    expect(container.querySelector('.pin-bl')).toBeInTheDocument();
    expect(container.querySelector('.pin-br')).toBeInTheDocument();
  });
});
