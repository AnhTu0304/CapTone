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
    expect(screen.getByText('Bảo Mật & Quyền Riêng Tư')).toBeInTheDocument();
    expect(screen.getByText('Mạng Xã Hội & Cộng Đồng')).toBeInTheDocument();
    expect(screen.getByText('Giới Thiệu SelfHeal')).toBeInTheDocument();

    expect(screen.getByText(/Hướng dẫn cài đặt, cấu hình tác tử/i)).toBeInTheDocument();
    expect(screen.getByText(/Điều khoản sử dụng và chính sách dịch vụ/i)).toBeInTheDocument();
    expect(screen.getByText(/Kết nối trực tiếp với đội ngũ phát triển/i)).toBeInTheDocument();
    expect(screen.getByText(/Bảo vệ dữ liệu hạ tầng/i)).toBeInTheDocument();
    expect(screen.getByText(/Theo dõi SelfHeal và kết nối cộng đồng/i)).toBeInTheDocument();
    expect(screen.getByText(/Tìm hiểu về sứ mệnh, kiến trúc tự phục hồi/i)).toBeInTheDocument();
  });

  it('renders external link for social media community item', () => {
    render(<ResourcesMegaMenu isOpen={true} onClose={jest.fn()} />);

    const socialLink = screen.getByText('Mạng Xã Hội & Cộng Đồng').closest('a');
    expect(socialLink).toHaveAttribute('href', 'https://github.com/phamthaisang1710/captone');
    expect(socialLink).toHaveAttribute('target', '_blank');
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
