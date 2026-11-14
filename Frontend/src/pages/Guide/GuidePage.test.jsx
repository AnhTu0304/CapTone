import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import GuidePage from './index';

// Mock matchMedia and ResizeObserver for testing environment
beforeAll(() => {
  window.matchMedia = window.matchMedia || function () {
    return {
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    };
  };

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('GuidePage Component (SRE Open Notebook Spread & Page Security Layout)', () => {
  it('renders top hero banner matching page security styling', () => {
    render(<GuidePage />);

    expect(screen.getByTestId('guide-top-hero')).toBeInTheDocument();
    expect(screen.getByText('Sổ Tay Vận Hành Hạ Tầng SelfHeal')).toBeInTheDocument();
    expect(
      screen.getByText(/Tài liệu thực địa dành cho kỹ sư SRE và DevOps/i)
    ).toBeInTheDocument();
  });

  it('renders lower sheet section with sprocket canvas and open notebook spread', () => {
    render(<GuidePage />);

    expect(screen.getByTestId('guide-sheet-section')).toBeInTheDocument();
    expect(screen.getByTestId('guide-sheet-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('open-notebook-container')).toBeInTheDocument();
  });

  it('renders all 11 notebook guide chapters in order', () => {
    render(<GuidePage />);

    expect(screen.getByText('01 Bắt đầu nhanh')).toBeInTheDocument();
    expect(screen.getByText('02 Tạo tổ chức của bạn')).toBeInTheDocument();
    expect(screen.getByText('03 Thiết lập môi trường')).toBeInTheDocument();
    expect(screen.getByText('04 Kết nối Kubernetes Cluster')).toBeInTheDocument();
    expect(screen.getByText('05 Cài đặt SelfHeal Agent')).toBeInTheDocument();
    expect(screen.getByText('06 Giám sát hạ tầng')).toBeInTheDocument();
    expect(screen.getByText('07 Hiểu về dự báo AI')).toBeInTheDocument();
    expect(screen.getByText('08 Xử lý sự cố hạ tầng')).toBeInTheDocument();
    expect(screen.getByText('09 Tự phục hồi và khôi phục')).toBeInTheDocument();
    expect(screen.getByText('10 Phê duyệt và kiểm soát')).toBeInTheDocument();
    expect(screen.getByText('11 Kiểm tra kết quả khôi phục')).toBeInTheDocument();
  });

  it('renders sticky notebook bookmark index tabs on left page', () => {
    render(<GuidePage />);

    const nav = screen.getByLabelText(/Mục lục sổ tay hướng dẫn/i);
    expect(nav).toBeInTheDocument();
    expect(screen.getByText('Mục Lục Vận Hành')).toBeInTheDocument();
    expect(screen.getByText('SRE NOTEBOOK // VOL.01')).toBeInTheDocument();

    const tabs = within(nav).getAllByRole('button');
    expect(tabs.length).toBe(11);
  });

  it('scrolls to chapter when an index tab is clicked', () => {
    const scrollToMock = jest.fn();
    window.scrollTo = scrollToMock;

    render(<GuidePage />);

    const nav = screen.getByLabelText(/Mục lục sổ tay hướng dẫn/i);
    const quickstartTab = within(nav).getByRole('button', { name: /01 Bắt đầu nhanh/i });
    fireEvent.click(quickstartTab);

    expect(scrollToMock).toHaveBeenCalled();
  });

  it('toggles mobile collapsible table of contents', () => {
    render(<GuidePage />);

    const mobileToggleBtn = screen.getByText(/Mục lục sổ tay \(11 chương\)/i);
    expect(mobileToggleBtn).toBeInTheDocument();

    fireEvent.click(mobileToggleBtn);
    expect(screen.getByText('▲')).toBeInTheDocument();

    fireEvent.click(mobileToggleBtn);
    expect(screen.getByText('▼')).toBeInTheDocument();
  });
});
