import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ForbiddenPage from '../ForbiddenPage';
import { RouteRenderer, ROUTES } from '../../../routes';

describe('ForbiddenPage Component (403 Scenic Pixel UI)', () => {
  test('renders 403 Forbidden speech bubble alert with status code, artwork, and zero buttons', () => {
    render(<ForbiddenPage />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('forbidden-page-code')).toHaveTextContent('403');
    expect(screen.getByRole('heading', { name: /Không có quyền truy cập/i })).toBeInTheDocument();
    expect(
      screen.getByText(/không có quyền truy cập trang hoặc tài nguyên này/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('forbidden-page-artwork')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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

  test('RouteRenderer renders ForbiddenPage inside PublicLayout when navigating to /403', () => {
    render(<RouteRenderer currentPath={ROUTES.FORBIDDEN} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/Thanh điều hướng chính của SelfHeal/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Không có quyền truy cập/i })).toBeInTheDocument();
  });
});
