import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ForbiddenPage from '../ForbiddenPage';
import { RouteRenderer, ROUTES } from '../../../routes';

describe('ForbiddenPage Component (403 UI)', () => {
  test('renders 403 Forbidden alert container with title and description', () => {
    render(<ForbiddenPage />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/403 — Không Có Quyền Truy Cập/i)).toBeInTheDocument();
    expect(
      screen.getByText(/không có quyền truy cập trang hoặc tài nguyên này/i)
    ).toBeInTheDocument();
  });

  test('calls onNavigate with /dashboard when clicking Về Bàn Điều Khiển button', () => {
    const handleNavigate = jest.fn();
    render(<ForbiddenPage onNavigate={handleNavigate} />);

    const dashboardBtn = screen.getByRole('button', { name: /Về Bàn Điều Khiển/i });
    expect(dashboardBtn).toBeInTheDocument();
    fireEvent.click(dashboardBtn);

    expect(handleNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('calls window.history.back when history length > 1', () => {
    const handleNavigate = jest.fn();
    const originalLength = window.history.length;
    Object.defineProperty(window.history, 'length', { value: 2, configurable: true });
    const backSpy = jest.spyOn(window.history, 'back').mockImplementation(() => {});

    render(<ForbiddenPage onNavigate={handleNavigate} />);

    const backBtn = screen.getByRole('button', { name: /Quay Lại Trang Trước/i });
    fireEvent.click(backBtn);

    expect(backSpy).toHaveBeenCalled();

    backSpy.mockRestore();
    Object.defineProperty(window.history, 'length', { value: originalLength, configurable: true });
  });

  test('calls onNavigate with redirectPath when history length <= 1 (prevents loop/dead end)', () => {
    const handleNavigate = jest.fn();
    const originalLength = window.history.length;
    Object.defineProperty(window.history, 'length', { value: 1, configurable: true });

    render(<ForbiddenPage onNavigate={handleNavigate} redirectPath="/dashboard" />);

    const backBtn = screen.getByRole('button', { name: /Quay Lại Trang Trước/i });
    fireEvent.click(backBtn);

    expect(handleNavigate).toHaveBeenCalledWith('/dashboard');

    Object.defineProperty(window.history, 'length', { value: originalLength, configurable: true });
  });

  test('renders custom title and custom message when provided via props', () => {
    render(
      <ForbiddenPage
        title="Custom 403 Forbidden"
        message="Custom restricted tenant error message"
      />
    );

    expect(screen.getByText('Custom 403 Forbidden')).toBeInTheDocument();
    expect(screen.getByText('Custom restricted tenant error message')).toBeInTheDocument();
  });

  test('RouteRenderer renders ForbiddenPage when navigating to /403', () => {
    render(<RouteRenderer currentPath={ROUTES.FORBIDDEN} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/403 — Không Có Quyền Truy Cập/i)).toBeInTheDocument();
  });
});
