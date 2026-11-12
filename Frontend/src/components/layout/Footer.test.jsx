import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Footer from './Footer';

describe('Footer (Greptile CAD Blueprint Alignment - 4 Columns)', () => {
  it('renders the blueprint drafting logo and wordmark in Column 1', () => {
    const { container } = render(<Footer />);
    const logo = screen.getByLabelText(/SelfHeal Blueprint Logo/i);
    expect(logo).toBeInTheDocument();
    expect(screen.getByText('selfheal')).toBeInTheDocument();

    const brandCol = screen.getByTestId('footer-col-brand');
    expect(brandCol).toBeInTheDocument();
  });

  it('renders exactly 4 main columns and 3 double-solid vertical dividers', () => {
    const { container } = render(<Footer />);
    const dividers = container.querySelectorAll('.footer-divider-double-v');
    expect(dividers.length).toBe(3);

    expect(screen.getByText('NỀN TẢNG')).toBeInTheDocument();
    expect(screen.getByText('TÀI NGUYÊN')).toBeInTheDocument();
    expect(screen.getByText('HỖ TRỢ')).toBeInTheDocument();
    expect(screen.getByText('MẠNG XÃ HỘI')).toBeInTheDocument();
  });

  it('renders all key navigation links in Vietnamese', () => {
    render(<Footer />);

    // Platform links
    expect(screen.getByText('TỔNG QUAN')).toBeInTheDocument();
    expect(screen.getByText('GIÁM SÁT HẠ TẦNG')).toBeInTheDocument();
    expect(screen.getByText('DỰ ĐOÁN BẰNG AI')).toBeInTheDocument();
    expect(screen.getByText('PHÂN TÍCH NGUYÊN NHÂN GỐC')).toBeInTheDocument();
    expect(screen.getByText('CƠ CHẾ TỰ PHỤC HỒI')).toBeInTheDocument();
    expect(screen.getByText('PHÊ DUYỆT CỦA CON NGƯỜI')).toBeInTheDocument();

    // Resources links
    expect(screen.getByText('TÀI LIỆU HƯỚNG DẪN')).toBeInTheDocument();
    expect(screen.getByText('BẮT ĐẦU NGAY')).toBeInTheDocument();
    expect(screen.getByText('CÀI ĐẶT TÁC TỬ')).toBeInTheDocument();
    expect(screen.getByText('GIỚI THIỆU DỰ ÁN')).toBeInTheDocument();

    // Support links
    expect(screen.getByText('LIÊN HỆ')).toBeInTheDocument();
    expect(screen.getByText('CÂU HỎI THƯỜNG GẶP')).toBeInTheDocument();
    expect(screen.getByText('GỬI PHẢN HỒI')).toBeInTheDocument();
    expect(screen.getByText('CHÍNH SÁCH BẢO MẬT')).toBeInTheDocument();
    expect(screen.getByText('ĐIỀU KHOẢN DỊCH VỤ')).toBeInTheDocument();
    expect(screen.getByText('BÁO CÁO SỰ CỐ')).toBeInTheDocument();
  });

  it('renders copyright and system compliance metadata in Vietnamese', () => {
    render(<Footer />);
    expect(screen.getByText('KIẾN TRÚC HỆ THỐNG SELFHEAL')).toBeInTheDocument();
    expect(screen.getByText('TỰ CHỦ HẠ TẦNG KUBERNETES')).toBeInTheDocument();
    expect(screen.getByText('CHUẨN K8S 1.28+')).toBeInTheDocument();
    expect(screen.getByText(/SELFHEAL\. BẢO LƯU MỌI QUYỀN\./i)).toBeInTheDocument();
  });

  it('calls onNavigate when internal link is clicked', () => {
    const mockNavigate = jest.fn();
    render(<Footer onNavigate={mockNavigate} />);

    const docsLink = screen.getByText('TÀI LIỆU HƯỚNG DẪN');
    fireEvent.click(docsLink);

    expect(mockNavigate).toHaveBeenCalledWith('/docs');
  });

  it('renders official social media buttons with correct labels and links', () => {
    render(<Footer />);
    const githubLink = screen.getByLabelText('GitHub');
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/phamthaisang1710/captone');

    const linkedinLink = screen.getByLabelText('LinkedIn');
    expect(linkedinLink).toBeInTheDocument();
    expect(linkedinLink).toHaveAttribute('href', 'https://linkedin.com');
  });
});
