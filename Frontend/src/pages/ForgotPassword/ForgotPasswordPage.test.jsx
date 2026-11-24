import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ForgotPasswordPage } from './index';
import authService from '../../services/authService';

jest.mock('../../services/authService', () => ({
  __esModule: true,
  default: {
    forgotPassword: jest.fn(),
  },
}));

describe('ForgotPasswordPage Component (SD-05 Real API Wiring)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders Vietnamese forgot password form and legal footer', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByRole('heading', { name: /Quên mật khẩu\?/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email công việc/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi liên kết khôi phục/i })).toBeInTheDocument();
    expect(screen.getByText(/Điều khoản dịch vụ/i)).toBeInTheDocument();
    expect(screen.getByText(/Chính sách bảo mật/i)).toBeInTheDocument();
  });

  test('calls authService.forgotPassword and shows inbox confirmation without demo shortcut links', async () => {
    authService.forgotPassword.mockResolvedValue({ success: true });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/Email công việc/i), { target: { value: 'sre@congty.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi liên kết khôi phục/i }));

    await waitFor(() => {
      expect(authService.forgotPassword).toHaveBeenCalledWith('sre@congty.com');
      expect(screen.getByRole('heading', { name: /Kiểm tra hộp thư của bạn/i })).toBeInTheDocument();
    });

    expect(screen.getByText('sre@congty.com')).toBeInTheDocument();
    expect(screen.queryByText(/MÔ PHỎNG DEMO/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mở liên kết đặt lại mật khẩu/i })).not.toBeInTheDocument();
  });
});
