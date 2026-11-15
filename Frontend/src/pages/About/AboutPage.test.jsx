import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AboutPage from './index';

describe('AboutPage (Two-Tier Layout: Top Hero + Canvas Grid Sheet & 8 Sections)', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arcTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      clip: jest.fn(),
      ellipse: jest.fn(),
      bezierCurveTo: jest.fn(),
      setLineDash: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders separated top hero section with title and subtitle', () => {
    render(<AboutPage />);

    const hero = screen.getByTestId('about-top-hero');
    expect(hero).toBeInTheDocument();
    expect(hero).toHaveClass('about-top-hero');

    const title = screen.getByRole('heading', { level: 1, name: /Về Dự án SelfHeal/i });
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('about-hero-title');

    expect(
      screen.getByText(/Nghiên cứu kiến trúc tự phục hồi hạ tầng Kubernetes chủ động dựa trên trí tuệ nhân tạo/i)
    ).toBeInTheDocument();
  });

  it('renders lower sheet section with canvas background', () => {
    render(<AboutPage />);

    const sheetSection = screen.getByTestId('about-sheet-section');
    expect(sheetSection).toBeInTheDocument();
    expect(sheetSection).toHaveClass('about-sheet-section');

    const canvas = screen.getByTestId('about-sheet-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass('about-sheet-canvas');
  });

  it('renders all 8 sections without eyebrow badges and with prose content', () => {
    render(<AboutPage />);

    expect(screen.queryByText('OUR STORY')).not.toBeInTheDocument();
    expect(screen.queryByText('THE CHALLENGE')).not.toBeInTheDocument();
    expect(screen.queryByText('OUR MISSION')).not.toBeInTheDocument();

    expect(screen.getByTestId('about-section-story')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Vận hành hạ tầng thông minh bắt đầu từ tư duy chủ động/i })
    ).toBeInTheDocument();

    expect(screen.getByTestId('about-section-problem')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Sự cố hạ tầng không nên trở thành nguyên nhân gián đoạn kinh doanh/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Giám sát bị động \(Reactive Monitoring\):/i)).toBeInTheDocument();

    expect(screen.getByTestId('about-section-mission')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Xây dựng hạ tầng thông minh hơn, chủ động hơn và bền bỉ hơn/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Sứ mệnh \(Mission\):/i)).toBeInTheDocument();

    expect(screen.getByTestId('about-section-how-it-works')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Từ tín hiệu hạ tầng đến phục hồi thông minh/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/01\. Quan sát \(Observe\):/i)).toBeInTheDocument();

    expect(screen.getByTestId('about-section-principles')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Tự động hóa cần trí tuệ\. Trí tuệ cần sự kiểm soát/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/1\. Trí tuệ định hướng bởi AI/i)).toBeInTheDocument();

    expect(screen.getByTestId('about-section-technology')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Được xây dựng trên nền tảng các công nghệ hạ tầng hiện đại/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Hạ tầng & Đóng gói/i)).toBeInTheDocument();

    expect(screen.getByTestId('about-section-team')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Được phát triển bởi đội ngũ đam mê hạ tầng thông minh/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Quản lý Dự án & Scrum:/i)).toBeInTheDocument();

    expect(screen.getByTestId('about-section-cta')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Sẵn sàng thay đổi tư duy về độ tin cậy của hạ tầng\?/i })
    ).toBeInTheDocument();
  });

  it('renders notebook canvas and project polygon CTA buttons', () => {
    const mockNavigate = jest.fn();
    render(<AboutPage onNavigate={mockNavigate} />);

    const notebookCard = screen.getByTestId('about-notebook-card');
    expect(notebookCard).toBeInTheDocument();

    const notebookCanvas = screen.getByTestId('about-notebook-canvas');
    expect(notebookCanvas).toBeInTheDocument();

    const exploreBtn = screen.getByTestId('about-cta-explore-btn');
    expect(exploreBtn).toBeInTheDocument();
    expect(exploreBtn).toHaveClass('about-btn-primary');
    fireEvent.click(exploreBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/get-started');

    const contactBtn = screen.getByTestId('about-cta-contact-btn');
    expect(contactBtn).toBeInTheDocument();
    expect(contactBtn).toHaveClass('about-btn-secondary');
    fireEvent.click(contactBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/contact');
  });
});
