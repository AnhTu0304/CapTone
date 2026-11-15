import React from 'react';
import { render, screen } from '@testing-library/react';
import SecurityPracticesPage from './index';

describe('SecurityPracticesPage (Two-Tier Layout: Top Hero + Canvas Grid Sheet & 8 Security Sections)', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arcTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders separated top hero section with title and subtitle', () => {
    render(<SecurityPracticesPage />);

    const hero = screen.getByTestId('security-top-hero');
    expect(hero).toBeInTheDocument();
    expect(hero).toHaveClass('security-top-hero');

    const title = screen.getByRole('heading', { level: 1, name: /Thực tiễn & Chính sách Bảo mật/i });
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('security-hero-title');

    expect(
      screen.getByText(/Tìm hiểu về kiến trúc an ninh đa tầng, các biện pháp kiểm soát kỹ thuật/i)
    ).toBeInTheDocument();
  });

  it('renders lower sheet section with canvas background', () => {
    render(<SecurityPracticesPage />);

    const sheetSection = screen.getByTestId('security-sheet-section');
    expect(sheetSection).toBeInTheDocument();
    expect(sheetSection).toHaveClass('security-sheet-section');

    const canvas = screen.getByTestId('security-sheet-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass('security-sheet-canvas');
  });

  it('renders last updated metadata and intro paragraph', () => {
    render(<SecurityPracticesPage />);

    expect(screen.getByTestId('security-last-updated')).toHaveTextContent(
      /Cập nhật lần cuối: 14 Tháng 11, 2026 \(Last updated: November 14, 2026\)/i
    );

    expect(
      screen.getByText(/Trang này mô tả các biện pháp kiểm soát kỹ thuật, kiến trúc an toàn và quy trình quản trị/i)
    ).toBeInTheDocument();
  });

  it('renders all 8 verified security sections accurately without fabricated certifications', () => {
    render(<SecurityPracticesPage />);

    expect(screen.queryByText(/SOC 2 Type II/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ISO 27001/i)).not.toBeInTheDocument();

    expect(screen.getByTestId('security-section-overview')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Bảo mật được xây dựng trong mọi lớp của SelfHeal/i })
    ).toBeInTheDocument();

    expect(screen.getByTestId('security-section-app')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Bảo vệ từng tương tác \(Application Security\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Phòng chống SQL Injection & Xác thực Dữ liệu/i)).toBeInTheDocument();
    expect(screen.getByText(/Secure Headers, CORS & Rate Limiting/i)).toBeInTheDocument();

    expect(screen.getByTestId('security-section-auth')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Mọi hành động đều bắt đầu từ truy cập được xác minh/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Xác thực Token & Băm Mật khẩu/i)).toBeInTheDocument();
    expect(screen.getByText(/Phân quyền Dựa trên Vai trò \(RBAC\) & Cô lập Tổ chức/i)).toBeInTheDocument();

    expect(screen.getByTestId('security-section-k8s')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Hạ tầng của bạn luôn nằm dưới sự kiểm soát chặt chẽ/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Đặc quyền Tối thiểu \(Least Privilege RBAC\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Bảo vệ Tiến trình & Chuẩn Pod Security Standards/i)).toBeInTheDocument();
    expect(screen.getByText(/Không mở cổng Inbound & Quản lý Token An toàn/i)).toBeInTheDocument();

    expect(screen.getByTestId('security-section-data')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Dữ liệu vận hành của bạn xứng đáng được bảo vệ/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Mã hóa trên Đường truyền \(Encryption in Transit\)/i)).toBeInTheDocument();

    expect(screen.getByTestId('security-section-ai')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Tự động hóa với sự an toàn tích hợp trong mọi quyết định/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Cơ chế Phê duyệt Con người \(Human-in-the-Loop - HITL\)/i)).toBeInTheDocument();

    expect(screen.getByTestId('security-section-monitoring')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Khả năng quan sát giúp chúng tôi đón đầu rủi ro/i })
    ).toBeInTheDocument();

    expect(screen.getByTestId('security-section-vulnerability')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Bảo mật đòi hỏi sự cải tiến liên tục/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/security@selfheal\.dev/i)).toBeInTheDocument();
  });
});
