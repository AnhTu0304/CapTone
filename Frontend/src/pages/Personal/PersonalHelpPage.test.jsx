import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonalHelpPage } from './PersonalHelpPage';

describe('PersonalHelpPage Component', () => {
  it('renders without crashing and displays docs and faq tabs', () => {
    render(<PersonalHelpPage onNavigate={jest.fn()} />);

    expect(screen.getByText('Trung Tâm Trợ Giúp & Hướng Dẫn Kỹ Thuật')).toBeInTheDocument();
    expect(screen.getByText('1. Tài Liệu Hướng Dẫn Kỹ Thuật')).toBeInTheDocument();
    expect(screen.getByText('2. Câu Hỏi Thường Gặp (FAQ)')).toBeInTheDocument();
  });

  it('switches between Docs and FAQ tabs cleanly without errors', () => {
    render(<PersonalHelpPage onNavigate={jest.fn()} />);

    // Switch to FAQ tab
    const faqTab = screen.getByText('2. Câu Hỏi Thường Gặp (FAQ)');
    fireEvent.click(faqTab);

    // Verify FAQ category dropdown exists
    expect(screen.getByText('Tất cả danh mục câu hỏi')).toBeInTheDocument();

    // Switch back to Docs tab
    const docsTab = screen.getByText('1. Tài Liệu Hướng Dẫn Kỹ Thuật');
    fireEvent.click(docsTab);

    expect(screen.getByText('Quy Trình Chuẩn SelfAI')).toBeInTheDocument();
  });
});
