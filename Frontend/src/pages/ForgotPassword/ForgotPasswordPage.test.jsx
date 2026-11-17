import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ForgotPasswordPage } from './index';

describe('ForgotPasswordPage Component (Vietnamese Minimalist Design)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders Vietnamese forgot password form and legal footer', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByRole('heading', { name: /Quên mật khẩu\?/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email công việc/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi liên kết khôi phục/i })).toBeInTheDocument();
    expect(screen.getByText(/Điều khoản dịch vụ/i)).toBeInTheDocument();
    expect(screen.getByText(/Chính sách bảo mật/i)).toBeInTheDocument();
  });

  test('submits valid email and displays Vietnamese inbox confirmation', () => {
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/Email công việc/i), { target: { value: 'sre@congty.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi liên kết khôi phục/i }));

    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(screen.getByRole('heading', { name: /Kiểm tra hộp thư của bạn/i })).toBeInTheDocument();
    expect(screen.getByText('sre@congty.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mở liên kết đặt lại mật khẩu/i })).toBeInTheDocument();
  });
});
