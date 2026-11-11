import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingWorkflowSection from './OnboardingWorkflowSection';

describe('OnboardingWorkflowSection (4-Step CAD Workflow)', () => {
  test('renders header badge, heading and CTA button', () => {
    const mockNavigate = jest.fn();
    render(<OnboardingWorkflowSection onNavigate={mockNavigate} />);

    expect(screen.getByText(/\[ Quy Trình \]/i)).toBeInTheDocument();
    expect(screen.getByText(/Quy trình thiết lập & Khởi chạy trong 4 bước/i)).toBeInTheDocument();

    const ctaBtn = screen.getByRole('link', { name: /Bắt đầu ngay/i });
    expect(ctaBtn).toBeInTheDocument();
    fireEvent.click(ctaBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/get-started');
  });

  test('renders neon lime divider badge', () => {
    render(<OnboardingWorkflowSection />);
    expect(screen.getByText(/CÁC BƯỚC THIẾT LẬP & VẬN HÀNH WORKFLOW/i)).toBeInTheDocument();
  });

  test('renders all 4 steps with numbers and titles', () => {
    render(<OnboardingWorkflowSection />);

    // Step 01
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText(/Tạo tổ chức & môi trường/i)).toBeInTheDocument();

    // Step 02
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText(/Kết nối SelfHeal Agent/i)).toBeInTheDocument();

    // Step 03
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText(/Mời thành viên vào tổ chức/i)).toBeInTheDocument();

    // Step 04
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByText(/Quản lý người dùng & Policy AI/i)).toBeInTheDocument();
  });
});
