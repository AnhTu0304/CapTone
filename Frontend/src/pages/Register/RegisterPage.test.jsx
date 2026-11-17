import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RegisterPage } from './index';
import AuthContext from '../../context/AuthContext';

describe('RegisterPage Suite & OTP Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderWithAuth = (ui, authValue) => {
    return render(
      <AuthContext.Provider value={authValue}>
        {ui}
      </AuthContext.Provider>
    );
  };

  test('1. Renders register form fields, terms checkbox, and Google sign up button in Vietnamese', () => {
    renderWithAuth(<RegisterPage />, { register: jest.fn(), loginWithGoogle: jest.fn() });

    expect(screen.getByRole('heading', { name: /Tạo tài khoản mới/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Họ và tên/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email công việc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mật khẩu$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Xác nhận mật khẩu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bắt đầu miễn phí/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng ký với Google/i })).toBeInTheDocument();
    expect(screen.queryByText(/GitHub/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GitLab/i)).not.toBeInTheDocument();
  });

  test('2. Submits registration form and shows OTP input screen', async () => {
    const handleNavigate = jest.fn();
    const mockRegister = jest.fn().mockResolvedValue({
      id: 'reg-user-1',
      email: 'alex@company.com',
      full_name: 'Alex Developer',
      has_organization: false,
    });

    renderWithAuth(<RegisterPage onNavigate={handleNavigate} />, {
      register: mockRegister,
      loginWithGoogle: jest.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Họ và tên/i), { target: { value: 'Alex Developer' } });
    fireEvent.change(screen.getByLabelText(/Email công việc/i), { target: { value: 'alex@company.com' } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu miễn phí/i }));
    });

    expect(mockRegister).toHaveBeenCalledWith({
      email: 'alex@company.com',
      password: 'SecurePass123!',
      full_name: 'Alex Developer',
    });

    expect(screen.getByRole('heading', { name: /Nhập mã xác thực OTP/i })).toBeInTheDocument();
    expect(screen.getByText('alex@company.com')).toBeInTheDocument();

    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(new RegExp(`Mã OTP số ${i}`, 'i'))).toBeInTheDocument();
    }

    expect(screen.getByRole('button', { name: /Xác nhận mã OTP/i })).toBeInTheDocument();
  });

  test('3. Enters 6-digit OTP, verifies successfully, and navigates to portal', async () => {
    const handleNavigate = jest.fn();
    const mockRegister = jest.fn().mockResolvedValue({
      id: 'reg-user-1',
      email: 'alex@company.com',
      full_name: 'Alex Developer',
      has_organization: false,
    });
    const mockVerifyEmail = jest.fn().mockResolvedValue({ success: true });

    renderWithAuth(<RegisterPage onNavigate={handleNavigate} />, {
      register: mockRegister,
      loginWithGoogle: jest.fn(),
      verifyEmail: mockVerifyEmail,
    });

    fireEvent.change(screen.getByLabelText(/Họ và tên/i), { target: { value: 'Alex Developer' } });
    fireEvent.change(screen.getByLabelText(/Email công việc/i), { target: { value: 'alex@company.com' } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu miễn phí/i }));
    });

    const digits = ['1', '2', '3', '4', '5', '6'];
    for (let i = 0; i < 6; i++) {
      const input = screen.getByLabelText(new RegExp(`Mã OTP số ${i + 1}`, 'i'));
      await act(async () => {
        fireEvent.change(input, { target: { value: digits[i] } });
      });
    }

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(mockVerifyEmail).toHaveBeenCalledWith('123456');
    expect(handleNavigate).toHaveBeenCalledWith('/portal');
  });

  test('4. Displays error message when OTP verification fails', async () => {
    const mockRegister = jest.fn().mockResolvedValue({
      id: 'reg-user-1',
      email: 'alex@company.com',
      full_name: 'Alex Developer',
      has_organization: false,
    });
    const mockVerifyEmail = jest.fn().mockRejectedValue(new Error('Mã xác thực không chính xác'));

    renderWithAuth(<RegisterPage />, {
      register: mockRegister,
      loginWithGoogle: jest.fn(),
      verifyEmail: mockVerifyEmail,
    });

    fireEvent.change(screen.getByLabelText(/Họ và tên/i), { target: { value: 'Alex Developer' } });
    fireEvent.change(screen.getByLabelText(/Email công việc/i), { target: { value: 'alex@company.com' } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu miễn phí/i }));
    });

    const digits = ['9', '9', '9', '9', '9', '9'];
    for (let i = 0; i < 6; i++) {
      const input = screen.getByLabelText(new RegExp(`Mã OTP số ${i + 1}`, 'i'));
      await act(async () => {
        fireEvent.change(input, { target: { value: digits[i] } });
      });
    }

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.getByText(/Mã xác thực không chính xác/i)).toBeInTheDocument();
  });

  test('5. Triggers Google OAuth sign up and navigates directly', async () => {
    const handleNavigate = jest.fn();
    const mockLoginWithGoogle = jest.fn().mockResolvedValue({
      id: 'google-reg-1',
      email: 'alex.google@gmail.com',
      full_name: 'Alex Google',
      system_roles: ['USER'],
      has_organization: false,
      organization_roles: [],
    });

    let tokenCallback;
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: jest.fn().mockImplementation(({ callback }) => {
            tokenCallback = callback;
            return {
              requestAccessToken: jest.fn().mockImplementation(() => {
                tokenCallback({ access_token: 'mock_google_reg_token' });
              }),
            };
          }),
        },
      },
    };

    renderWithAuth(<RegisterPage onNavigate={handleNavigate} />, {
      register: jest.fn(),
      loginWithGoogle: mockLoginWithGoogle,
    });

    const googleBtn = screen.getByRole('button', { name: /Đăng ký với Google/i });
    expect(googleBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(googleBtn);
    });

    expect(mockLoginWithGoogle).toHaveBeenCalledWith('mock_google_reg_token');
    expect(handleNavigate).toHaveBeenCalledWith('/portal');
  });

  test('6. Handles OTP resend countdown and action', async () => {
    const mockRegister = jest.fn().mockResolvedValue({
      id: 'reg-user-2',
      email: 'resend@company.com',
      full_name: 'Resend User',
      has_organization: false,
    });
    const mockResend = jest.fn().mockResolvedValue({ success: true });

    renderWithAuth(<RegisterPage />, {
      register: mockRegister,
      loginWithGoogle: jest.fn(),
      resendVerification: mockResend,
    });

    fireEvent.change(screen.getByLabelText(/Họ và tên/i), { target: { value: 'Resend User' } });
    fireEvent.change(screen.getByLabelText(/Email công việc/i), { target: { value: 'resend@company.com' } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu miễn phí/i }));
    });

    expect(screen.getByText(/Gửi lại sau/i)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    const resendBtn = screen.getByRole('button', { name: /Gửi lại mã OTP/i });
    expect(resendBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(resendBtn);
    });

    expect(mockResend).toHaveBeenCalled();
    expect(screen.getByText(/Đã gửi lại mã OTP mới thành công/i)).toBeInTheDocument();
  });
});
