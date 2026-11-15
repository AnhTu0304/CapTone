import React from 'react';
import { render, screen } from '@testing-library/react';
import NotebookNoticeCard from './NotebookNoticeCard';

describe('NotebookNoticeCard Component', () => {
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
      clearRect: jest.fn(),
      strokeRect: jest.fn(),
      setLineDash: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      ellipse: jest.fn(),
      bezierCurveTo: jest.fn(),
      clip: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders card with canvas and content correctly', () => {
    render(
      <NotebookNoticeCard type="tip" title="Kiểm soát truy cập dựa trên vai trò (RBAC)">
        <p>Nội dung kiểm thử phân quyền RBAC</p>
      </NotebookNoticeCard>
    );

    const card = screen.getByTestId('notebook-notice-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('data-card-type', 'tip');
    expect(card).toHaveAttribute('data-important', 'false');

    expect(screen.getByTestId('notebook-notice-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('notebook-notice-title')).toHaveTextContent('Kiểm soát truy cập dựa trên vai trò (RBAC)');
    expect(screen.getByText('Nội dung kiểm thử phân quyền RBAC')).toBeInTheDocument();
  });

  it('marks card as important and renders warning style with pencil flag', () => {
    render(
      <NotebookNoticeCard
        type="warning"
        important={true}
        title="Lưu ý: Không yêu cầu mở cổng Inbound"
      >
        <span>Agent chạy hoàn toàn qua luồng WebSocket TLS chiều ra.</span>
      </NotebookNoticeCard>
    );

    const card = screen.getByTestId('notebook-notice-card');
    expect(card).toHaveAttribute('data-card-type', 'warning');
    expect(card).toHaveAttribute('data-important', 'true');

    expect(screen.getByTestId('notebook-notice-title')).toHaveTextContent('Lưu ý: Không yêu cầu mở cổng Inbound');
    expect(screen.getByText('Agent chạy hoàn toàn qua luồng WebSocket TLS chiều ra.')).toBeInTheDocument();
  });
});
