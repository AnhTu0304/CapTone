import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SocialProofSection from './SocialProofSection';

describe('SocialProofSection (Greptile-style Social Proof & Platform Overview)', () => {
  test('renders 4 core tool logos in full-width strip without eyebrow badge or role subtitles', () => {
    const { container } = render(<SocialProofSection />);

    expect(screen.getByTestId('social-proof-section')).toBeInTheDocument();
    
    // Eyebrow badge should be removed
    expect(screen.queryByText(/\[ HỆ SINH THÁI & CÔNG CỤ CỐT LÕI TÍCH HỢP \]/i)).not.toBeInTheDocument();

    // 4 Tools: Kubernetes, Docker, Prometheus, Grafana
    const tools = ['Kubernetes', 'Docker', 'Prometheus', 'Grafana'];
    tools.forEach((toolName) => {
      expect(screen.getByText(toolName)).toBeInTheDocument();
      expect(screen.getByAltText(`${toolName} Logo`)).toBeInTheDocument();
    });

    // Gemini AI should be replaced
    expect(screen.queryByText('Gemini AI')).not.toBeInTheDocument();

    // Role subtitles should be removed
    expect(screen.queryByText(/Hạ tầng & Điều phối Cụm/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Container Runtime Phân lập/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Viễn trắc & Chuỗi thời gian/i)).not.toBeInTheDocument();

    // sp-tools-block should exist as a full-width block
    const toolsBlock = container.querySelector('.sp-tools-block');
    expect(toolsBlock).toBeInTheDocument();
  });

  test('renders overview framed card with quote and technical metadata', () => {
    render(<SocialProofSection />);

    const card = screen.getByTestId('sp-overview-card');
    expect(card).toBeInTheDocument();

    expect(screen.getByText(/SelfHeal là nền tảng AI tự hành giám sát và dự báo sớm nguy cơ hạ tầng/i)).toBeInTheDocument();
    expect(screen.getByText(/99.99% độ sẵn sàng/i)).toBeInTheDocument();

    expect(screen.getByText(/KIẾN TRÚC TỰ PHỤC HỒI \/\/ SRE AUTONOMOUS RUNBOOK/i)).toBeInTheDocument();
    expect(screen.getByText(/SELFHEAL INFRASTRUCTURE CORE \/\/ v1.0/i)).toBeInTheDocument();

    const emblem = screen.getByAltText(/SelfHeal Infrastructure Emblem/i);
    expect(emblem).toBeInTheDocument();
  });

  test('calls onNavigate with /features when clicking CTA button', () => {
    const mockNavigate = jest.fn();
    render(<SocialProofSection onNavigate={mockNavigate} />);

    const ctaButton = screen.getByRole('link', { name: /Khám phá kiến trúc hệ thống/i });
    expect(ctaButton).toBeInTheDocument();

    fireEvent.click(ctaButton);
    expect(mockNavigate).toHaveBeenCalledWith('/features');
  });

  test('handles click without onNavigate gracefully by updating history', () => {
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    render(<SocialProofSection />);

    const ctaButton = screen.getByRole('link', { name: /Khám phá kiến trúc hệ thống/i });
    fireEvent.click(ctaButton);

    expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/features');
    pushStateSpy.mockRestore();
  });
});
