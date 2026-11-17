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

    fireEvent.click(langBtn);
    expect(screen.getByText('English')).toBeInTheDocument();

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

  it('calls onNavigate when a standard navigation link is clicked', () => {
    const mockNavigate = jest.fn();
    render(<Header onNavigate={mockNavigate} />);

    const featuresLink = screen.getByText('TÍNH NĂNG');
    fireEvent.click(featuresLink);

    expect(mockNavigate).toHaveBeenCalledWith('/features');
  });

  it('toggles ResourcesMegaMenu when TÀI LIỆU is clicked', () => {
    render(<Header />);

    const docsBtn = screen.getByRole('button', { name: /TÀI LIỆU/i });
    expect(docsBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /Menu Tài nguyên SelfHeal/i })).not.toBeInTheDocument();

    fireEvent.click(docsBtn);
    expect(docsBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /Menu Tài nguyên SelfHeal/i })).toBeInTheDocument();
    expect(screen.getByText('Tài Liệu Hướng Dẫn')).toBeInTheDocument();

    fireEvent.click(docsBtn);
    expect(docsBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /Menu Tài nguyên SelfHeal/i })).not.toBeInTheDocument();
  });

  it('closes ResourcesMegaMenu when Escape key is pressed', () => {
    render(<Header />);

    const docsBtn = screen.getByRole('button', { name: /TÀI LIỆU/i });
    fireEvent.click(docsBtn);
    expect(screen.getByRole('region', { name: /Menu Tài nguyên SelfHeal/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: /Menu Tài nguyên SelfHeal/i })).not.toBeInTheDocument();
  });

  it('calls onNavigate when Đăng nhập button is clicked', () => {
    const mockNavigate = jest.fn();
    render(<Header onNavigate={mockNavigate} />);

    const loginBtn = screen.getByTitle('Đăng nhập tài khoản');
    fireEvent.click(loginBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('navigates to /contact when clicking Liên Hệ Tư Vấn in ResourcesMegaMenu without premature mousedown dismissal', () => {
    const mockNavigate = jest.fn();
    render(<Header onNavigate={mockNavigate} />);

    const docsBtn = screen.getByRole('button', { name: /TÀI LIỆU/i });
    fireEvent.click(docsBtn);
    expect(screen.getByRole('region', { name: /Menu Tài nguyên SelfHeal/i })).toBeInTheDocument();

    const contactLink = screen.getByText('Liên Hệ Tư Vấn');
    fireEvent.mouseDown(contactLink);
    expect(screen.getByRole('region', { name: /Menu Tài nguyên SelfHeal/i })).toBeInTheDocument();

    fireEvent.click(contactLink);
    expect(mockNavigate).toHaveBeenCalledWith('/contact');
  });
});
