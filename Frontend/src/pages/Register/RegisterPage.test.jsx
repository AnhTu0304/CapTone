import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RegisterPage } from './index';
import AuthContext from '../../context/AuthContext';

describe('RegisterPage Suite & Google Registration', () => {
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

  test('2. Submits registration form and redirects to /onboarding/organization', async () => {
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

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(handleNavigate).toHaveBeenCalledWith('/onboarding/organization');
  });

  test('3. Triggers Google OAuth sign up and redirects to /onboarding/organization', async () => {
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

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(handleNavigate).toHaveBeenCalledWith('/onboarding/organization');
  });
});
