import React from 'react';
import { render, screen } from '@testing-library/react';
import TermsPage from './index';

describe('TermsPage (Two-Tier Layout: Top Hero + Canvas Grid Sheet & 8 Terms Sections)', () => {
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
    render(<TermsPage />);

    const hero = screen.getByTestId('terms-top-hero');
    expect(hero).toBeInTheDocument();
    expect(hero).toHaveClass('terms-top-hero');

    const title = screen.getByRole('heading', { level: 1, name: /Điều Khoản Dịch Vụ & Sử Dụng Hệ Thống/i });
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('terms-hero-title');

    expect(
      screen.getByText(/Quy chuẩn vận hành, giới hạn trách nhiệm và cam kết an toàn khi ứng dụng nền tảng/i)
    ).toBeInTheDocument();
  });

  it('renders lower sheet section with canvas background', () => {
    render(<TermsPage />);

    const sheetSection = screen.getByTestId('terms-sheet-section');
    expect(sheetSection).toBeInTheDocument();
    expect(sheetSection).toHaveClass('terms-sheet-section');

    const canvas = screen.getByTestId('terms-sheet-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass('terms-sheet-canvas');
  });

  it('renders last updated metadata and intro paragraph', () => {
    render(<TermsPage />);

    expect(screen.getByTestId('terms-last-updated')).toHaveTextContent(
      /Cập nhật lần cuối: 14 Tháng 11, 2026 \(Last updated: November 14, 2026\)/i
    );

    expect(
      screen.getByText(/Chào mừng bạn đến với SelfHeal \("chúng tôi", "nền tảng"\)/i)
    ).toBeInTheDocument();
  });

  it('renders all 8 terms sections accurately', () => {
    render(<TermsPage />);

    expect(screen.getByTestId('terms-section-acceptance')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /1\. Giới thiệu & Chấp thuận Điều khoản/i })).toBeInTheDocument();

    expect(screen.getByTestId('terms-section-license')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /2\. Quyền & Phạm vi Cấp phép Sử dụng/i })).toBeInTheDocument();
    expect(screen.getByText(/Hành vi bị nghiêm cấm/i)).toBeInTheDocument();

    expect(screen.getByTestId('terms-section-intellectual-property')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /3\. Quyền Sở hữu Trí tuệ & Dữ liệu Khách hàng/i })).toBeInTheDocument();

    expect(screen.getByTestId('terms-section-agent-infrastructure')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /4\. Triển khai Tác tử K8s & Trách nhiệm Hạ tầng/i })).toBeInTheDocument();

    expect(screen.getByTestId('terms-section-ai-hitl')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /5\. Tính năng AI & Phê duyệt Human-in-the-Loop \(HITL\)/i })).toBeInTheDocument();

    expect(screen.getByTestId('terms-section-liability-disclaimer')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /6\. Giới hạn Trách nhiệm & Khước từ Bảo đảm/i })).toBeInTheDocument();

    expect(screen.getByTestId('terms-section-termination')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /7\. Tạm ngừng & Chấm dứt Dịch vụ/i })).toBeInTheDocument();

    expect(screen.getByTestId('terms-section-governing-law')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /8\. Luật Điều chỉnh & Kênh Tiếp nhận Khiếu nại/i })).toBeInTheDocument();
    expect(screen.getByText(/legal@selfheal\.dev/i)).toBeInTheDocument();
  });
});
