import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FAQSection from './FAQSection';

describe('FAQSection (Greptile CAD Accordion with Constellation Grids)', () => {
  test('renders FAQ title and all 6 questions', () => {
    render(<FAQSection />);
    expect(screen.getByText('FAQ')).toBeInTheDocument();

    expect(screen.getByText(/SelfHeal hoạt động với Kubernetes như thế nào/i)).toBeInTheDocument();
    expect(screen.getByText(/SelfHeal có thể tự lưu trữ \(self-hosted\) trên hạ tầng riêng không/i)).toBeInTheDocument();
    expect(screen.getByText(/Cơ chế Human-in-the-Loop \(HITL\) bảo vệ hệ thống ra sao/i)).toBeInTheDocument();
    expect(screen.getByText(/SelfHeal hỗ trợ những phiên bản Kubernetes và nền tảng đám mây nào/i)).toBeInTheDocument();
    expect(screen.getByText(/Có bản dùng thử miễn phí hoặc gói dành cho doanh nghiệp SME không/i)).toBeInTheDocument();
    expect(screen.getByText(/Dữ liệu log và chỉ số của hệ thống có được bảo mật không/i)).toBeInTheDocument();
  });

  test('toggles accordion item on click', () => {
    render(<FAQSection />);
    const firstQuestionBtn = screen.getByText(/SelfHeal hoạt động với Kubernetes như thế nào/i).closest('button');

    // Initially collapsed
    expect(firstQuestionBtn).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    fireEvent.click(firstQuestionBtn);
    expect(firstQuestionBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/SelfHeal triển khai dưới dạng DaemonSet hoặc Helm chart siêu nhẹ/i)).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(firstQuestionBtn);
    expect(firstQuestionBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('renders contact link and triggers navigation', () => {
    const mockNavigate = jest.fn();
    render(<FAQSection onNavigate={mockNavigate} />);

    const contactLink = screen.getByRole('link', { name: /Liên hệ với chúng tôi\./i });
    expect(contactLink).toBeInTheDocument();
    fireEvent.click(contactLink);
    expect(mockNavigate).toHaveBeenCalledWith('/guide');
  });
});
