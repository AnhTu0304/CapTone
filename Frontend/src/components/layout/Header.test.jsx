import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from './Header';

const mockLogout = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    logout: mockLogout,
    getInitials: () => 'SH',
    getPrimaryRole: () => 'USER',
  }),
}));

describe('Header Component (Greptile CAD Alignment with Symmetrical Center Nav)', () => {
  it('renders the brand logo on the left', () => {
    render(<Header />);
    const logoLink = screen.getByLabelText(/SelfHeal Homepage/i);
    expect(logoLink).toBeInTheDocument();
  });

  it('renders centered navigation links in Vietnamese: HƯỚNG DẪN, TÍNH NĂNG, GIỚI THIỆU, TÀI LIỆU', () => {
    const { container } = render(<Header />);
    expect(screen.getByText('HƯỚNG DẪN')).toBeInTheDocument();
    expect(screen.getByText('TÍNH NĂNG')).toBeInTheDocument();
    expect(screen.getByText('GIỚI THIỆU')).toBeInTheDocument();
    expect(screen.getByText('TÀI LIỆU')).toBeInTheDocument();

    const centerWrapper = container.querySelector('.header-center-wrapper');
    expect(centerWrapper).toBeInTheDocument();
  });

  it('renders language switcher with default VI and toggles dropdown', () => {
    render(<Header />);
    const langBtn = screen.getByLabelText(/Chuyển đổi ngôn ngữ/i);
    expect(langBtn).toBeInTheDocument();
    expect(screen.getByText('VI')).toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(langBtn);
    expect(screen.getByText('English')).toBeInTheDocument();

    // Select English
    fireEvent.click(screen.getByText('English'));
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('renders connected dual-hexagon buttons: Đăng nhập & Đăng ký', () => {
    render(<Header />);
    const loginBtn = screen.getByTitle('Đăng nhập tài khoản');
    const signupBtn = screen.getByTitle('Đăng ký tài khoản');

    expect(loginBtn).toBeInTheDocument();
    expect(signupBtn).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('Đăng ký')).toBeInTheDocument();
  });

  it('calls onNavigate when a navigation link is clicked', () => {
    const mockNavigate = jest.fn();
    render(<Header onNavigate={mockNavigate} />);

    const featuresLink = screen.getByText('TÍNH NĂNG');
    fireEvent.click(featuresLink);

    expect(mockNavigate).toHaveBeenCalledWith('/features');
  });

  it('calls onNavigate when Đăng nhập button is clicked', () => {
    const mockNavigate = jest.fn();
    render(<Header onNavigate={mockNavigate} />);

    const loginBtn = screen.getByTitle('Đăng nhập tài khoản');
    fireEvent.click(loginBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
