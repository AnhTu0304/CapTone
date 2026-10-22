import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LoginPage } from './index';
import AuthContext from '../../context/AuthContext';

describe('LoginPage Admin & User Redirection Suite', () => {
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

  test('1. Renders login form fields, brand heading, and Google login button', () => {
    renderWithAuth(<LoginPage />, { login: jest.fn() });

    expect(screen.getByRole('heading', { name: /Log into your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Enter work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Enter password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Đăng nhập$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng nhập với Google \/ Gmail/i })).toBeInTheDocument();
  });

  test('2. Redirects standard USER to /dashboard after successful login', async () => {
    const handleNavigate = jest.fn();
    const mockLogin = jest.fn().mockResolvedValue({
      id: 'user-uuid-1',
      email: 'user@selfheal.com',
      full_name: 'Regular User',
      system_roles: ['USER'],
    });

    renderWithAuth(<LoginPage onNavigate={handleNavigate} />, { login: mockLogin });

    fireEvent.change(screen.getByLabelText(/Enter work email/i), { target: { value: 'user@selfheal.com' } });
    fireEvent.change(screen.getByLabelText(/Enter password/i), { target: { value: 'UserPassword123@' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));
    });

    expect(await screen.findByText(/Đăng nhập thành công!/i)).toBeInTheDocument();
    expect(screen.getByText(/Đang chuyển hướng vào không gian làm việc của bạn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vào Bảng Điều Khiển Ngay/i })).toBeInTheDocument();

    // Advance timer
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(handleNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('3. Redirects ADMIN account to /admin after successful login', async () => {
    const handleNavigate = jest.fn();
    const mockLogin = jest.fn().mockResolvedValue({
      id: 'admin-uuid-2',
      email: 'admin@selfheal.com',
      full_name: 'Hệ Thống Admin',
      system_roles: ['ADMIN'],
    });

    renderWithAuth(<LoginPage onNavigate={handleNavigate} />, { login: mockLogin });

    fireEvent.change(screen.getByLabelText(/Enter work email/i), { target: { value: 'admin@selfheal.com' } });
    fireEvent.change(screen.getByLabelText(/Enter password/i), { target: { value: 'AdminPassword123@' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));
    });

    expect(await screen.findByText(/Đăng nhập thành công!/i)).toBeInTheDocument();
    expect(screen.getByText(/Đang chuyển hướng vào không gian làm việc của bạn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vào Bảng Điều Khiển Ngay/i })).toBeInTheDocument();

    // Advance timer
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(handleNavigate).toHaveBeenCalledWith('/admin');
  });

  test('4. Redirects SUPER_ADMIN account to /admin and allows instant click', async () => {
    const handleNavigate = jest.fn();
    const mockLogin = jest.fn().mockResolvedValue({
      id: 'superadmin-uuid-3',
      email: 'superadmin@selfheal.com',
      full_name: 'Hệ Thống Super Admin',
      system_roles: ['SUPER_ADMIN'],
    });

    renderWithAuth(<LoginPage onNavigate={handleNavigate} />, { login: mockLogin });

    fireEvent.change(screen.getByLabelText(/Enter work email/i), { target: { value: 'superadmin@selfheal.com' } });
    fireEvent.change(screen.getByLabelText(/Enter password/i), { target: { value: 'AdminPassword123@' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));
    });

    const instantBtn = await screen.findByRole('button', { name: /Vào Bảng Điều Khiển Ngay/i });
    fireEvent.click(instantBtn);

    expect(handleNavigate).toHaveBeenCalledWith('/admin');
  });

  test('5. Displays error alert when credentials are invalid', async () => {
    const mockLogin = jest.fn().mockRejectedValue(new Error('Email hoặc mật khẩu không chính xác'));

    renderWithAuth(<LoginPage />, { login: mockLogin });

    fireEvent.change(screen.getByLabelText(/Enter work email/i), { target: { value: 'invalid@selfheal.com' } });
    fireEvent.change(screen.getByLabelText(/Enter password/i), { target: { value: 'WrongPass' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Email hoặc mật khẩu không chính xác')).toBeInTheDocument();
    });
  });

  test('6. Triggers Google Sign-In and redirects after successful Google login', async () => {
    const handleNavigate = jest.fn();
    const mockLoginWithGoogle = jest.fn().mockResolvedValue({
      id: 'google-user-1',
      email: 'user@gmail.com',
      full_name: 'Google User',
      system_roles: ['USER'],
    });

    let tokenCallback;
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: jest.fn().mockImplementation(({ callback }) => {
            tokenCallback = callback;
            return {
              requestAccessToken: jest.fn().mockImplementation(() => {
                tokenCallback({ access_token: 'mock_google_token' });
              }),
            };
          }),
        },
      },
    };

    renderWithAuth(<LoginPage onNavigate={handleNavigate} />, {
      login: jest.fn(),
      loginWithGoogle: mockLoginWithGoogle,
    });

    const googleBtn = screen.getByRole('button', { name: /Đăng nhập với Google \/ Gmail/i });
    expect(googleBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(googleBtn);
    });

    expect(mockLoginWithGoogle).toHaveBeenCalledWith('mock_google_token');
    expect(await screen.findByText(/Đăng nhập thành công!/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(handleNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
