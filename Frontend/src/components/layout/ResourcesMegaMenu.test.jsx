import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResourcesMegaMenu from './ResourcesMegaMenu';

describe('ResourcesMegaMenu Component (Greptile 3x2 Mega Menu Alignment)', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ResourcesMegaMenu isOpen={false} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all six resource items when isOpen is true', () => {
    render(<ResourcesMegaMenu isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByText('Tài Liệu Hướng Dẫn')).toBeInTheDocument();
    expect(screen.getByText('Điều Khoản & Điều Kiện')).toBeInTheDocument();
    expect(screen.getByText('Liên Hệ Tư Vấn')).toBeInTheDocument();
    expect(screen.getByText('Bảo Mật Hệ Thống')).toBeInTheDocument();
    expect(screen.getByText('Chính Sách Bảo Mật')).toBeInTheDocument();
    expect(screen.getByText('Giới Thiệu SelfHeal')).toBeInTheDocument();

    expect(screen.getByText(/Hướng dẫn cài đặt, cấu hình tác tử/i)).toBeInTheDocument();
    expect(screen.getByText(/Điều khoản sử dụng và chính sách dịch vụ/i)).toBeInTheDocument();
    expect(screen.getByText(/Kết nối trực tiếp với đội ngũ phát triển/i)).toBeInTheDocument();
    expect(screen.getByText(/Kiến trúc an ninh đa tầng/i)).toBeInTheDocument();
    expect(screen.getByText(/Quy định thu thập, xử lý và bảo vệ dữ liệu cá nhân/i)).toBeInTheDocument();
    expect(screen.getByText(/Tìm hiểu về sứ mệnh, kiến trúc tự phục hồi/i)).toBeInTheDocument();
  });

  it('navigates to /privacy when clicking Chính Sách Bảo Mật in ResourcesMegaMenu', () => {
    const mockNavigate = jest.fn();
    const mockClose = jest.fn();

    render(
      <ResourcesMegaMenu
        isOpen={true}
        onClose={mockClose}
        onNavigate={mockNavigate}
      />
    );

    const privacyLink = screen.getByText('Chính Sách Bảo Mật');
    fireEvent.click(privacyLink);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/privacy');
  });

  it('triggers onNavigate and onClose when an internal link is clicked', () => {
    const mockNavigate = jest.fn();
    const mockClose = jest.fn();

    render(
      <ResourcesMegaMenu
        isOpen={true}
        onClose={mockClose}
        onNavigate={mockNavigate}
      />
    );

    const contactLink = screen.getByText('Liên Hệ Tư Vấn');
    fireEvent.click(contactLink);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/contact');
  });

  it('has accessible region semantics', () => {
    render(<ResourcesMegaMenu isOpen={true} onClose={jest.fn()} />);
    const region = screen.getByRole('region', { name: /Menu Tài nguyên SelfHeal/i });
    expect(region).toBeInTheDocument();
  });
});
