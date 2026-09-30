import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingSequence3D from './OnboardingSequence3D';

describe('OnboardingSequence3D Interactive Features', () => {
  it('renders all 7 hexagon steps with their titles', () => {
    render(<OnboardingSequence3D />);
    
    expect(screen.getByText('Tạo tài khoản')).toBeInTheDocument();
    expect(screen.getByText('Tạo tổ chức')).toBeInTheDocument();
    expect(screen.getByText('Tạo môi trường')).toBeInTheDocument();
    expect(screen.getByText('Đăng ký K8s')).toBeInTheDocument();
    expect(screen.getByText('Tạo Token Agent')).toBeInTheDocument();
    expect(screen.getByText('Cài đặt Agent')).toBeInTheDocument();
    expect(screen.getByText('Bắt đầu giám sát')).toBeInTheDocument();
  });

  it('opens StepDetailCard when clicking on a step node', () => {
    render(<OnboardingSequence3D />);

    // Click on Step 3: Tạo môi trường
    const step3Button = screen.getByRole('button', { name: /Bước 3: Tạo môi trường/i });
    fireEvent.click(step3Button);

    // Should display the detail modal with heading, category and operating mechanics
    expect(screen.getByRole('heading', { name: 'Tạo môi trường', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/SCOPING & SLA/i)).toBeInTheDocument();
    expect(screen.getByText('CƠ CHẾ HOẠT ĐỘNG')).toBeInTheDocument();
    expect(screen.getByText('THÔNG SỐ KỸ THUẬT & GIAO THỨC')).toBeInTheDocument();
    expect(screen.getByText('K8s Namespaces')).toBeInTheDocument();
  });

  it('navigates to next and previous steps inside the detail card', () => {
    render(<OnboardingSequence3D />);

    // Open Step 1
    const step1Button = screen.getByRole('button', { name: /Bước 1: Tạo tài khoản/i });
    fireEvent.click(step1Button);

    expect(screen.getByRole('heading', { name: 'Tạo tài khoản', level: 3 })).toBeInTheDocument();

    // Click "Tiếp" button
    const nextBtn = screen.getByRole('button', { name: /Tiếp/i });
    fireEvent.click(nextBtn);

    // Now Step 2 should be shown
    expect(screen.getByRole('heading', { name: 'Tạo tổ chức', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/MULTI-TENANCY/i)).toBeInTheDocument();

    // Click "Trước" button
    const prevBtn = screen.getByRole('button', { name: /Trước/i });
    fireEvent.click(prevBtn);

    // Back to Step 1
    expect(screen.getByRole('heading', { name: 'Tạo tài khoản', level: 3 })).toBeInTheDocument();
  });

  it('closes the detail card when clicking the close button', () => {
    render(<OnboardingSequence3D />);

    const step4Button = screen.getByRole('button', { name: /Bước 4: Đăng ký K8s/i });
    fireEvent.click(step4Button);

    expect(screen.getByRole('heading', { name: 'Đăng ký K8s', level: 3 })).toBeInTheDocument();

    // Click Close button
    const closeBtn = screen.getByLabelText(/Đóng chi tiết/i);
    fireEvent.click(closeBtn);

    // Detail modal should be closed
    expect(screen.queryByRole('heading', { name: 'Đăng ký K8s', level: 3 })).not.toBeInTheDocument();
  });

  it('toggles pause and auto-play mode via top status bar button', () => {
    render(<OnboardingSequence3D />);

    const toggleBtn = screen.getByTitle(/Tạm dừng tự động/i);
    expect(toggleBtn).toHaveTextContent('TỰ ĐỘNG');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('TẠM DỪNG');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('TỰ ĐỘNG');
  });
});
