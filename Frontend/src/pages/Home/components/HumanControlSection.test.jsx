import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HumanControlSection from './HumanControlSection';

describe('HumanControlSection (Controlled Self-Healing & Policy)', () => {
  test('renders header badge, heading, subtitle and CTA button', () => {
    const mockNavigate = jest.fn();
    render(<HumanControlSection onNavigate={mockNavigate} />);

    expect(screen.getByText(/(\[ HITL_POLICY:= @VERIFIED \]|\[ Chính Sách & Xác Minh \])/i)).toBeInTheDocument();
    expect(screen.getByText(/Tự hành thông minh, Con người kiểm soát/i)).toBeInTheDocument();
    expect(screen.getByText(/SelfHeal vận hành tự động trong ranh giới an toàn tuyệt đối/i)).toBeInTheDocument();

    const ctaBtn = screen.getByRole('link', { name: /Khám phá Human-in-the-Loop/i });
    expect(ctaBtn).toBeInTheDocument();
    fireEvent.click(ctaBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/guide');
  });

  test('renders controlled self-healing stage with characters and labels', () => {
    const { container } = render(<HumanControlSection />);
    expect(container.querySelector('.hcs-canvas-stage')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="controlled-self-healing-stage"]')).toBeInTheDocument();

    expect(screen.getByText('AI AGENT // HEALBOT')).toBeInTheDocument();
    expect(screen.getByText('HUMAN OPERATOR // SRE')).toBeInTheDocument();

    expect(screen.getByText(/OBSERVE • PREDICT • EVALUATE • APPROVE • RECOVER/i)).toBeInTheDocument();
    expect(screen.queryByText(/Recovery Verified/i)).not.toBeInTheDocument();
  });
});
