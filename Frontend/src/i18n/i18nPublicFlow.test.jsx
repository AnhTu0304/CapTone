import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import i18n, { LANG_STORAGE_KEY, getSavedLanguage } from './index';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { HomePage } from '../pages/Home';
import SecurityPracticesPage from '../pages/SecurityPractices';
import { LoginPage } from '../pages/Login';
import { RegisterPage } from '../pages/Register';
import { UnauthorizedPage } from '../pages/Error/StatusPages';
import AuthContext from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

const mockAuthValue = {
  user: null,
  isAuthenticated: false,
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  getInitials: () => 'SH',
  getPrimaryRole: () => 'USER',
};

describe('Public & Auth i18n Flow (VI <-> EN via .header-lang-btn)', () => {
  beforeEach(() => {
    window.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arcTo: jest.fn(),
      arc: jest.fn(),
      ellipse: jest.fn(),
      bezierCurveTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      clip: jest.fn(),
      setLineDash: jest.fn(),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
    }));
  });

  it('switches Header, Footer, HomePage, SecurityPracticesPage, and 401 page from VI to EN via .header-lang-btn and persists to localStorage', () => {
    const { container } = render(
      <ToastProvider>
        <AuthContext.Provider value={mockAuthValue}>
          <Header />
          <HomePage reducedMotion={true} />
          <SecurityPracticesPage />
          <UnauthorizedPage />
          <Footer />
        </AuthContext.Provider>
      </ToastProvider>
    );

    // Default VI
    expect(screen.getByText('VI')).toBeInTheDocument();
    expect(screen.getByText('HƯỚNG DẪN')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Thực tiễn & Chính sách Bảo mật/i })).toBeInTheDocument();
    expect(screen.getByText(/Phiên đăng nhập đã hết hạn\./i)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('vi');

    // Click .header-lang-btn and select English
    const langBtn = container.querySelector('.header-lang-btn');
    expect(langBtn).toBeInTheDocument();
    fireEvent.click(langBtn);
    fireEvent.click(screen.getByText('English'));

    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('GUIDE')).toBeInTheDocument();
    expect(screen.getByText('PLATFORM')).toBeInTheDocument();
    expect(screen.getByText(/AI predicts emerging incidents/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Security Practices & Policy/i })).toBeInTheDocument();
    expect(screen.getByText(/Your session has expired\./i)).toBeInTheDocument();
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    // Switch back to VI
    fireEvent.click(langBtn);
    fireEvent.click(screen.getByText('Tiếng Việt'));
    expect(screen.getByText('VI')).toBeInTheDocument();
    expect(screen.getByText('HƯỚNG DẪN')).toBeInTheDocument();
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('vi');
  });

  it('automatically renders LoginPage and RegisterPage in the previously chosen language', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'en');
    expect(getSavedLanguage()).toBe('en');
    i18n.changeLanguage('en');

    const { rerender } = render(
      <AuthContext.Provider value={mockAuthValue}>
        <LoginPage />
      </AuthContext.Provider>
    );

    expect(screen.getByRole('heading', { name: /Sign in to your account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();

    rerender(
      <AuthContext.Provider value={mockAuthValue}>
        <RegisterPage />
      </AuthContext.Provider>
    );

    expect(screen.getByRole('heading', { name: /Create a new account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Get started free/i })).toBeInTheDocument();
  });
});
