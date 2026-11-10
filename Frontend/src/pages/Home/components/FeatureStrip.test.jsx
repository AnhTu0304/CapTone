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

  it('renders technical guidelines and pin nodes', () => {
    const { container } = render(<FeatureStrip />);
    expect(container.querySelector('.agent-guide-v-left')).toBeInTheDocument();
    expect(container.querySelector('.agent-guide-v-right')).toBeInTheDocument();
    expect(container.querySelector('.agent-node-pin-left')).toBeInTheDocument();
    expect(container.querySelector('.agent-node-pin-right')).toBeInTheDocument();
  });
});
