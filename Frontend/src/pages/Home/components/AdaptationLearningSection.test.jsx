import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AdaptationLearningSection from './AdaptationLearningSection';

describe('AdaptationLearningSection', () => {
  test('renders top header badge and headings', () => {
    render(<AdaptationLearningSection />);
    expect(screen.getByText(/\[ Sự thích nghi & Học hỏi \]/i)).toBeInTheDocument();
    expect(screen.getByText(/Hệ thống tự thích ứng & học hỏi sau mỗi sự cố/i)).toBeInTheDocument();
    expect(screen.getByText(/Từ quy tắc tùy chỉnh theo đặc thù hạ tầng/i)).toBeInTheDocument();
  });

  test('renders CAD divider ruler', () => {
    const { container } = render(<AdaptationLearningSection />);
    expect(container.querySelector('.als-divider-ruler')).toBeInTheDocument();
  });

  test('renders Card 1: Custom Rules and Card 2: Learning & Memory', () => {
    render(<AdaptationLearningSection />);

    // Card 1
    expect(screen.getByText(/\[ Quy Tắc Tùy Chỉnh \]/i)).toBeInTheDocument();
    expect(screen.getByText(/Quy tắc của bạn, quyền kiểm soát của bạn/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Thiết lập quy tắc/i).length).toBeGreaterThan(0);

    // Card 2
    expect(screen.getByText(/\[ Học Tập & Ghi Nhớ \]/i)).toBeInTheDocument();
    expect(screen.getByText(/Học hỏi liên tục từ các lỗi xảy ra/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem tiến trình học/i)).toBeInTheDocument();
  });

  test('calls onNavigate when action button is clicked', () => {
    const mockNavigate = jest.fn();
    render(<AdaptationLearningSection onNavigate={mockNavigate} />);

    const buttons = screen.getAllByRole('link', { name: /Thiết lập quy tắc/i });
    fireEvent.click(buttons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/guide');
  });
});
