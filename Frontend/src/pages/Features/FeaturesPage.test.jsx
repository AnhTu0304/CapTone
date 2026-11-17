import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FeaturesPage from './index';

describe('FeaturesPage Component (MAPE-K Lifecycle & Two-Tier Canvas Architecture)', () => {
  beforeAll(() => {
    window.matchMedia = window.matchMedia || function () {
      return {
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      };
    };
  });

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
      arc: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      clearRect: jest.fn(),
      strokeRect: jest.fn(),
      setLineDash: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      setTransform: jest.fn(),
      createRadialGradient: jest.fn(() => ({
        addColorStop: jest.fn(),
      })),
      fillText: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders top hero section with title and subtitle', () => {
    render(<FeaturesPage />);

    expect(screen.getByTestId('features-top-hero')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Năng Lực Tính Năng & Vòng Lặp Tự Phục Hồi/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hạ tầng Kubernetes của bạn được bảo vệ 24\/7 qua quy trình 6 chặng tự động hóa/i)
    ).toBeInTheDocument();
  });

  it('renders lower sheet section with canvas background', () => {
    render(<FeaturesPage />);

    expect(screen.getByTestId('features-sheet-section')).toBeInTheDocument();
    expect(screen.getByTestId('features-sheet-canvas')).toBeInTheDocument();
  });

  it('renders all 6 MAPE-K lifecycle sections with titles and badges', () => {
    render(<FeaturesPage />);

    expect(screen.getByTestId('features-section-detect')).toBeInTheDocument();
    expect(screen.getByText(/CHẶNG 01 \/\/ Phát Hiện/i)).toBeInTheDocument();
    expect(screen.getByText(/Quét Radar Hạ Tầng & Thu Thập Telemetry Tức Thì/i)).toBeInTheDocument();

    expect(screen.getByTestId('features-section-predict')).toBeInTheDocument();
    expect(screen.getByText(/CHẶNG 02 \/\/ Dự Đoán/i)).toBeInTheDocument();
    expect(screen.getByText(/Dự Báo Suy Thoái Sớm 15–30 Phút Bằng Mạng Nơ-ron GRU/i)).toBeInTheDocument();

    expect(screen.getByTestId('features-section-diagnose')).toBeInTheDocument();
    expect(screen.getByText(/CHẶNG 03 \/\/ Chuẩn Đoán/i)).toBeInTheDocument();
    expect(screen.getByText(/Tự Động Phân Tích Nguyên Nhân Gốc Rễ Đa Chiều \(RCA\)/i)).toBeInTheDocument();

    expect(screen.getByTestId('features-section-verify')).toBeInTheDocument();
    expect(screen.getByText(/CHẶNG 04 \/\/ Xác Minh/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem Trước Kubernetes YAML Diff & Phê Duyệt An Toàn \(HITL\)/i)).toBeInTheDocument();

    expect(screen.getByTestId('features-section-recover')).toBeInTheDocument();
    expect(screen.getByText(/CHẶNG 05 \/\/ Hồi Phục/i)).toBeInTheDocument();
    expect(screen.getByText(/Khôi Phục Tự Hành Dưới 2 Giây Không Gián Đoạn Dịch Vụ/i)).toBeInTheDocument();

    expect(screen.getByTestId('features-section-audit')).toBeInTheDocument();
    expect(screen.getByText(/CHẶNG 06 \/\/ Bảo Vệ & Kiểm Toán/i)).toBeInTheDocument();
    expect(screen.getByText(/Bảo Mật Cụm Đạt Chuẩn & Nhật Ký Kiểm Toán Bất Biến/i)).toBeInTheDocument();
  });

  it('renders all 6 blueprint wireframe cards with avatars and messages', () => {
    render(<FeaturesPage />);

    expect(screen.getByTestId('telemetry-pulse-card')).toBeInTheDocument();
    expect(screen.queryByTestId('telemetry-pulse-card-floating-card')).not.toBeInTheDocument();

    expect(screen.getByTestId('ai-prediction-card')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-prediction-card-floating-card')).not.toBeInTheDocument();

    expect(screen.getByTestId('root-cause-card')).toBeInTheDocument();
    expect(screen.queryByTestId('root-cause-card-floating-card')).not.toBeInTheDocument();

    expect(screen.getByTestId('hitl-yaml-diff-card')).toBeInTheDocument();
    expect(screen.queryByTestId('hitl-yaml-diff-card-floating-card')).not.toBeInTheDocument();

    expect(screen.getByTestId('self-healing-timeline-card')).toBeInTheDocument();
    expect(screen.queryByTestId('self-healing-timeline-card-floating-card')).not.toBeInTheDocument();

    expect(screen.getByTestId('security-audit-chain-card')).toBeInTheDocument();
    expect(screen.queryByTestId('security-audit-chain-card-floating-card')).not.toBeInTheDocument();
  });

  it('renders final notebook CTA card with canvas and buttons', () => {
    const mockNavigate = jest.fn();
    render(<FeaturesPage onNavigate={mockNavigate} />);

    expect(screen.getByTestId('features-section-cta')).toBeInTheDocument();
    expect(screen.getByTestId('features-notebook-card')).toBeInTheDocument();
    expect(screen.getByTestId('features-notebook-canvas')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Sẵn sàng thay đổi tư duy về độ tin cậy của hạ tầng\?/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Khám phá cách SelfHeal hỗ trợ doanh nghiệp giám sát, dự đoán rủi ro và phục hồi cụm Kubernetes chủ động hơn\./i)
    ).toBeInTheDocument();

    const exploreBtn = screen.getByTestId('features-cta-explore-btn');
    fireEvent.click(exploreBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/login');

    const contactBtn = screen.getByTestId('features-cta-contact-btn');
    fireEvent.click(contactBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/contact');
  });
});
