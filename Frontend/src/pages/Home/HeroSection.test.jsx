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
  it('renders headline with Anybody font, slate text, and hero-fade-up animation classes', () => {
    render(<HeroSection />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass(
      'hero-heading',
      'font-anybody',
      'text-slate',
      'text-6xl',
      'font-bold',
      'tracking-tight',
      'leading-[0.9]',
      'animate-hero-fade-up'
    );
    expect(heading).toHaveTextContent(/Quan sát\. Dự đoán\.\s*Khôi phục\./i);
  });
});
