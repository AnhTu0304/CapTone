import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResetPasswordPage } from './index';
import authService from '../../services/authService';

jest.mock('../../services/authService', () => ({
  __esModule: true,
  default: {
    resetPassword: jest.fn(),
  },
}));

describe('ResetPasswordPage Component (SD-05 Real API Wiring)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/reset-password');
  });

  test('shows expired/invalid view immediately when reset token is missing from URL', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByRole('heading', { name: /Reset Link Expired or Invalid/i })).toBeInTheDocument();
    expect(screen.queryByText(/Demo/i)).not.toBeInTheDocument();
  });

  test('extracts token from URL query string, submits authService.resetPassword, and shows success state', async () => {
    const token = 'a'.repeat(64);
    window.history.replaceState({}, '', `/reset-password?token=${token}`);
    authService.resetPassword.mockResolvedValue({ success: true });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^New password$/i), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm new password/i), { target: { value: 'StrongPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      expect(authService.resetPassword).toHaveBeenCalledWith(token, 'StrongPass123!');
      expect(screen.getByRole('heading', { name: /Password Reset Successfully/i })).toBeInTheDocument();
    });
  });

  test('switches to expired view if API rejects token as expired/invalid', async () => {
    const token = 'b'.repeat(64);
    authService.resetPassword.mockRejectedValue(new Error('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'));

    render(<ResetPasswordPage resetToken={token} />);

    fireEvent.change(screen.getByLabelText(/^New password$/i), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm new password/i), { target: { value: 'StrongPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Reset Link Expired or Invalid/i })).toBeInTheDocument();
    });
  });
});
