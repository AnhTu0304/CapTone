import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIPipelineFlowCanvas from './AIPipelineFlowCanvas';

let mockObservedWidth = 390;
let mockObservedHeight = 844;

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    constructor(cb) {
      this.cb = cb;
    }
    observe() {
      this.cb([{ contentRect: { width: mockObservedWidth, height: mockObservedHeight } }]);
    }
    disconnect() {}
  };
});

beforeEach(() => {
  mockObservedWidth = 390;
  mockObservedHeight = 844;
});

describe('AIPipelineFlowCanvas Mobile Vertical Flow Mode', () => {
  test('renders vertical mobile flow on <= 860px viewport with Diagram 1 stages, Rule Engine, and expanders', () => {
    render(
      <AIPipelineFlowCanvas
        selectedService="ecommerce-api"
        isAgentConnected={true}
        isFullScreen={true}
        showExtendedPipeline={true}
        defaultViewMode="gru"
        podCount={2}
      />
    );

    const mobileContainer = screen.getByTestId('ai-pipeline-mobile-vertical');
    expect(mobileContainer).toBeInTheDocument();

    expect(screen.getByText(/01\s*•\s*VIỄN TRẮC/i)).toBeInTheDocument();
    expect(screen.getByText(/02\s*•\s*DỰ BÁO CHUỖI THỜI GIAN/i)).toBeInTheDocument();
    expect(screen.getByText(/04\s*•\s*ĐA TÁC TỬ RCA/i)).toBeInTheDocument();
    expect(screen.getByText(/05\s*•\s*POLICY ENGINE/i)).toBeInTheDocument();
    expect(screen.getByText(/07\s*•\s*HẬU KIỂM/i)).toBeInTheDocument();
    expect(screen.getByText(/Rule Engine — 6 Luật Ngưỡng Tĩnh/i)).toBeInTheDocument();

    // Expand 8 telemetry metrics accordion
    const telemetryToggle = screen.getByTestId('mobile-toggle-telemetry');
    fireEvent.click(telemetryToggle);
    expect(screen.getByText('CPU (%)')).toBeInTheDocument();
  });

  test('supports Diagram 2 vertical stages and switching to horizontal canvas on mobile', () => {
    render(
      <AIPipelineFlowCanvas
        selectedService="ecommerce-api"
        isAgentConnected={true}
        isFullScreen={true}
        showExtendedPipeline={true}
        defaultViewMode="gru"
        podCount={2}
      />
    );

    expect(screen.getByTestId('ai-pipeline-mobile-vertical')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-switch-diagram-2'));
    expect(screen.getByText(/00\s*•\s*DỊCH VỤ MỤC TIÊU/i)).toBeInTheDocument();
    expect(screen.getByText(/04A\s*•\s*4 TÁC TỬ NGỮ CẢNH/i)).toBeInTheDocument();
    expect(screen.getByText(/04B\s*•\s*16 NGUYÊN NHÂN GỐC/i)).toBeInTheDocument();
    expect(screen.getByText(/06A\s*•\s*10 HÀNH ĐỘNG KHẮC PHỤC/i)).toBeInTheDocument();

    // Toggle back to horizontal canvas view
    fireEvent.click(screen.getByTestId('toggle-mobile-layout-mode'));
    expect(screen.queryByTestId('ai-pipeline-mobile-vertical')).not.toBeInTheDocument();
    expect(screen.getByTestId('branched-pipeline-section')).toBeInTheDocument();

    // Toggle back to mobile vertical flow
    fireEvent.click(screen.getByTestId('toggle-mobile-layout-mode'));
    expect(screen.getByTestId('ai-pipeline-mobile-vertical')).toBeInTheDocument();
  });
});
