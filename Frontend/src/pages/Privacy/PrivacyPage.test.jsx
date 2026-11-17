import React from 'react';
import { render, screen } from '@testing-library/react';
import PrivacyPage from './index';

describe('PrivacyPage (Two-Tier Layout: Top Hero + Canvas Grid Sheet & 8 Privacy Sections)', () => {
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
    render(<PrivacyPage />);

    const hero = screen.getByTestId('privacy-top-hero');
    expect(hero).toBeInTheDocument();
    expect(hero).toHaveClass('privacy-top-hero');

    const title = screen.getByRole('heading', { level: 1, name: /Chính sách Bảo mật & Quyền riêng tư/i });
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('privacy-hero-title');

    expect(
      screen.getByText(/Cam kết minh bạch của SelfHeal về nguyên tắc thu thập, xử lý và bảo vệ dữ liệu cá nhân/i)
    ).toBeInTheDocument();
  });

  it('renders lower sheet section with canvas background', () => {
    render(<PrivacyPage />);

    const sheetSection = screen.getByTestId('privacy-sheet-section');
    expect(sheetSection).toBeInTheDocument();
    expect(sheetSection).toHaveClass('privacy-sheet-section');

    const canvas = screen.getByTestId('privacy-sheet-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass('privacy-sheet-canvas');
  });

  it('renders last updated metadata and intro paragraph', () => {
    render(<PrivacyPage />);

    expect(screen.getByTestId('privacy-last-updated')).toHaveTextContent(
      /Cập nhật lần cuối: 14 Tháng 11, 2026 \(Last updated: November 14, 2026\)/i
    );

    expect(
      screen.getByText(/SelfHeal \("chúng tôi", "nền tảng"\) tôn trọng quyền riêng tư của người dùng/i)
    ).toBeInTheDocument();
  });

  it('renders all 8 privacy sections accurately', () => {
    render(<PrivacyPage />);

    expect(screen.getByTestId('privacy-section-scope')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /1\. Giới thiệu & Phạm vi Áp dụng/i })).toBeInTheDocument();

    expect(screen.getByTestId('privacy-section-data-collected')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /2\. Dữ liệu Chúng tôi Thu thập/i })).toBeInTheDocument();
    expect(screen.getByText(/Thông tin Tài khoản & Định danh Tổ chức/i)).toBeInTheDocument();
    expect(screen.getByText(/Số liệu Đo lường Hạ tầng \(Telemetry Data\)/i)).toBeInTheDocument();

    expect(screen.getByTestId('privacy-section-usage')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /3\. Mục đích Sử dụng Thông tin/i })).toBeInTheDocument();

    expect(screen.getByTestId('privacy-section-security')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /4\. Cơ chế Lưu trữ & Bảo vệ Dữ liệu/i })).toBeInTheDocument();

    expect(screen.getByTestId('privacy-section-sharing')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /5\. Chia sẻ & Chuyển giao Thông tin/i })).toBeInTheDocument();

    expect(screen.getByTestId('privacy-section-rights')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /6\. Quyền của Doanh nghiệp & Người dùng/i })).toBeInTheDocument();

    expect(screen.getByTestId('privacy-section-cookies')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /7\. Cookie & Quản lý Phiên làm việc/i })).toBeInTheDocument();

    expect(screen.getByTestId('privacy-section-contact')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /8\. Liên hệ & Tiếp nhận Thắc mắc/i })).toBeInTheDocument();
    expect(screen.getByText(/privacy@selfheal\.dev/i)).toBeInTheDocument();
  });
});
