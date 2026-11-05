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

  test('1. Renders register form fields, terms checkbox, and Google sign up button', () => {
    renderWithAuth(<RegisterPage />, { register: jest.fn(), loginWithGoogle: jest.fn() });

    expect(screen.getByRole('heading', { name: /Create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();
  });

  test('2. Submits registration form and shows OTP input screen without old Gmail buttons', async () => {
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

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Alex Developer' } });
    fireEvent.change(screen.getByLabelText(/Work email/i), { target: { value: 'alex@company.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    });

    expect(mockRegister).toHaveBeenCalledWith({
      email: 'alex@company.com',
      password: 'SecurePass123!',
      full_name: 'Alex Developer',
    });

    // Màn hình OTP xuất hiện
    expect(screen.getByRole('heading', { name: /Nhập mã xác thực OTP/i })).toBeInTheDocument();
    expect(screen.getByText('alex@company.com')).toBeInTheDocument();

    // 6 ô nhập ký tự OTP
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(new RegExp(`Mã OTP số ${i}`, 'i'))).toBeInTheDocument();
    }

    // Không còn 2 nút cũ "Mở Gmail ngay" và "Tiếp tục thiết lập Onboarding"
    expect(screen.queryByText(/Mở Gmail ngay/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tiếp tục thiết lập Onboarding/i)).not.toBeInTheDocument();

    // Nút xác nhận OTP hiển thị
    expect(screen.getByRole('button', { name: /Xác nhận mã OTP/i })).toBeInTheDocument();
  });

  test('3. Enters 6-digit OTP, verifies successfully, and navigates to onboarding', async () => {
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

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Alex Developer' } });
    fireEvent.change(screen.getByLabelText(/Work email/i), { target: { value: 'alex@company.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    });

    // Nhập 6 chữ số OTP
    const digits = ['1', '2', '3', '4', '5', '6'];
    for (let i = 0; i < 6; i++) {
      const input = screen.getByLabelText(new RegExp(`Mã OTP số ${i + 1}`, 'i'));
      await act(async () => {
        fireEvent.change(input, { target: { value: digits[i] } });
      });
    }

    // Auto submit hoặc nhấn xác nhận
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

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Alex Developer' } });
    fireEvent.change(screen.getByLabelText(/Work email/i), { target: { value: 'alex@company.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    });

    // Nhập OTP sai
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

    const googleBtn = screen.getByRole('button', { name: /Continue with Google/i });
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

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Resend User' } });
    fireEvent.change(screen.getByLabelText(/Work email/i), { target: { value: 'resend@company.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'SecurePass123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    });

    // Ban đầu có đếm ngược 60s
    expect(screen.getByText(/Gửi lại sau/i)).toBeInTheDocument();

    // Hết 60s
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    // Nút gửi lại mã OTP xuất hiện
    const resendBtn = screen.getByRole('button', { name: /Gửi lại mã OTP/i });
    expect(resendBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(resendBtn);
    });

    expect(mockResend).toHaveBeenCalled();
    expect(screen.getByText(/Đã gửi lại mã OTP mới thành công/i)).toBeInTheDocument();
  });
});
