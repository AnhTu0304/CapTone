import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HeroSection from './HeroSection';

describe('HeroSection CTA Buttons', () => {
  it('renders primary button "Bắt đầu ngay" and secondary button "Xem hướng dẫn"', () => {
    render(<HeroSection />);
    const primaryBtn = screen.getByRole('link', { name: /Bắt đầu ngay/i });
    const secondaryBtn = screen.getByRole('link', { name: /Xem hướng dẫn/i });

    expect(primaryBtn).toBeInTheDocument();
    expect(secondaryBtn).toBeInTheDocument();
    expect(primaryBtn).toHaveClass('hero-btn-primary');
    expect(secondaryBtn).toHaveClass('hero-btn-secondary');
  });

  it('triggers onNavigate with /get-started when "Bắt đầu ngay" is clicked', () => {
    const mockNavigate = jest.fn();
    render(<HeroSection onNavigate={mockNavigate} />);

    const primaryBtn = screen.getByRole('link', { name: /Bắt đầu ngay/i });
    fireEvent.click(primaryBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/get-started');
  });

  it('triggers onNavigate with /guide when "Xem hướng dẫn" is clicked', () => {
    const mockNavigate = jest.fn();
    render(<HeroSection onNavigate={mockNavigate} />);

    const secondaryBtn = screen.getByRole('link', { name: /Xem hướng dẫn/i });
    fireEvent.click(secondaryBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/guide');
  });
});
