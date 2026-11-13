import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RootCauseModal from './RootCauseModal';
import { aiService } from '../../../services/aiService';

jest.mock('../../../services/aiService', () => ({
  aiService: {
    getIncidentEvidences: jest.fn(),
    getIncidentDetail: jest.fn(),
    getPredictionInputs: jest.fn(),
  },
}));

const SRE_UX_ANALYSIS = {
  service_id: 'selfheal-test-app',
  prediction: {
    service_id: 'selfheal-test-app',
    threshold: 0.96,
    thresholds: {
      CPU_OVERLOAD: 0.75,
      OOM: 0.5875,
      SCALE_DOWN_CANDIDATE: 0.96,
    },
    detected_risks: [{ risk_type: 'SCALE_DOWN_CANDIDATE', confidence: 0.965 }],
    risk_outputs: {
      SCALE_DOWN_CANDIDATE: { confidence: 0.965 },
    },
  },
  root_cause: {
    cause: 'UNKNOWN',
    confidence: 0.3,
    severity: 'MEDIUM',
    evidence_status: 'INSUFFICIENT_EVIDENCE',
    symptoms: [
      "Kiểm tra tính sống còn (Liveness probe) thất bại: '[2026-11-12T02:08:18.000Z] [Warning] Pod: selfheal-test-app-67fbfd48ff-mqlhp - Reason: Unhealthy - Liveness probe failed: Get \"http://10.244.0.227:8080/health\": dial tcp 10.244.0.227:8080: connect: connection refused (count: 1)'",
      "Kiểm tra tính sẵn sàng (Readiness probe) thất bại: '[2026-11-12T02:08:17.000Z] [Warning] Pod: selfheal-test-app-67fbfd48ff-mqlhp - Reason: Unhealthy - Readiness probe failed: Get \"http://10.244.0.227:8080/health\": dial tcp 10.244.0.227:8080: connect: connection refused (count: 6)'",
      "Kiểm tra tính sống còn (Liveness probe) thất bại: '[2026-11-12T02:08:01.000Z] [Warning] Pod: selfheal-test-app-67fbfd48ff-95flk - Reason: Unhealthy - Liveness probe failed: Get \"http://10.244.0.228:8080/health\": context deadline exceeded (Client.Timeout exceeded while awaiting headers) (count: 8)'",
    ],
    evidence_for: [
      "Kiểm tra tính sống còn (Liveness probe) thất bại: '[2026-11-12T02:08:18.000Z] [Warning] Pod: selfheal-test-app-67fbfd48ff-mqlhp - Reason: Unhealthy - Liveness probe failed: Get \"http://10.244.0.227:8080/health\": dial tcp 10.244.0.227:8080: connect: connection refused (count: 1)'",
      "Kiểm tra tính sẵn sàng (Readiness probe) thất bại: '[2026-11-12T02:08:17.000Z] [Warning] Pod: selfheal-test-app-67fbfd48ff-mqlhp - Reason: Unhealthy - Readiness probe failed: Get \"http://10.244.0.227:8080/health\": dial tcp 10.244.0.227:8080: connect: connection refused (count: 6)'",
      "Kiểm tra tính sống còn (Liveness probe) thất bại: '[2026-11-12T02:08:01.000Z] [Warning] Pod: selfheal-test-app-67fbfd48ff-95flk - Reason: Unhealthy - Liveness probe failed: Get \"http://10.244.0.228:8080/health\": context deadline exceeded (Client.Timeout exceeded while awaiting headers) (count: 8)'",
    ],
    missing_evidence: [
      'Application health endpoint response',
      'Probe configuration',
      'Application logs',
      'CPU throttling metrics',
      'Historical latency',
    ],
    related_risks: [
      {
        risk_type: 'SCALE_DOWN_CANDIDATE',
        confidence: 0.965,
        description: 'Mô hình học sâu GRU cảnh báo nguy cơ SCALE_DOWN_CANDIDATE (96.5%)',
      },
    ],
  },
  recommendation: {
    action: 'NO_ACTION',
    reason: 'Không đủ bằng chứng để xác định nguyên nhân hoặc hạ tầng không có lỗi',
    priority: 'CRITICAL',
    target_type: 'WORKLOAD',
    target_name: 'selfheal-test-app',
  },
  explanation: 'Chưa đủ bằng chứng để kết luận nguyên nhân.',
  namespace: 'test-lab',
  cluster_id: 'fyuyu',
  engine: 'Deterministic Multi-Agent SRE',
};

const SRE_UX_DETAIL = {
  id: 'inc-c9a29629',
  prediction_id: 'pred-c9a29629',
  cluster_id: 'fyuyu',
  cluster_name: 'fyuyu',
  service_name: 'selfheal-test-app',
  workload_type: 'Deployment',
  namespace: 'test-lab',
  node_name: 'minikube',
  actual_pod_name: 'selfheal-test-app-67fbfd48ff-mqlhp',
  severity: 'MEDIUM',
  rca_confidence: 0.3,
  root_cause_type: 'UNKNOWN',
  recommendation_action: 'NO_ACTION',
  recommendation_risk_level: 'LOW',
  recommendation_priority: 'CRITICAL',
  prediction_type: 'SCALE_DOWN_CANDIDATE',
  prediction_confidence: 0.965,
  analysis_method: 'Deterministic Multi-Agent SRE',
  analysis_result: JSON.stringify(SRE_UX_ANALYSIS),
  detected_at: '2026-11-12T02:08:20.000Z',
};

describe('RootCauseModal UX Information Density Optimization', () => {
  beforeEach(() => {
    jest.setTimeout(15000);
    jest.clearAllMocks();
    aiService.getIncidentEvidences.mockResolvedValue([]);
    aiService.getIncidentDetail.mockResolvedValue(SRE_UX_DETAIL);
    aiService.getPredictionInputs.mockResolvedValue([]);
  });

  it('renders grouped symptoms with short Vietnamese explanations and expandable raw K8s logs', async () => {
    render(
      <RootCauseModal
        incident={{
          id: 'INC-C9A29629',
          rawId: 'inc-c9a29629',
          service: 'selfheal-test-app',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    // 1. Grouped symptoms: Pod name + recurrence counts
    expect(
      screen.getAllByText((content, node) => node?.textContent?.trim() === 'Pod: selfheal-test-app-67fbfd48ff-mqlhp · 1 lần').length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText((content, node) => node?.textContent?.trim() === 'Pod: selfheal-test-app-67fbfd48ff-mqlhp · 6 lần').length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText((content, node) => node?.textContent?.trim() === 'Pod: selfheal-test-app-67fbfd48ff-95flk · 8 lần').length
    ).toBeGreaterThanOrEqual(1);

    // 2. Short Vietnamese explanation
    expect(screen.getAllByText('Không thể kết nối tới cổng 8080 của ứng dụng.').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ứng dụng không phản hồi kịp trong thời gian Kubernetes cho phép.')).toBeInTheDocument();

    // 3. Details snippet
    expect(screen.getAllByText('connection refused').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('context deadline exceeded (timeout)')).toBeInTheDocument();

    // 4. Raw log hidden by default, expandable on click
    expect(screen.queryByText(/Reason: Unhealthy - Liveness probe failed/i)).not.toBeInTheDocument();

    const expandButtons = screen.getAllByRole('button', { name: /Xem chi tiết K8s/i });
    expect(expandButtons.length).toBeGreaterThanOrEqual(1);

    // Click first button to expand
    fireEvent.click(expandButtons[0]);
    expect(screen.getByText(/Reason: Unhealthy - Liveness probe failed/i)).toBeInTheDocument();
  });

  it('renders concise Evidence For group summary and expandable raw audit trail', async () => {
    render(
      <RootCauseModal
        incident={{
          id: 'INC-C9A29629',
          rawId: 'inc-c9a29629',
          service: 'selfheal-test-app',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    // Evidence count
    expect(screen.getByText('3 ghi nhận')).toBeInTheDocument();

    // Group summary by Pod without duplicated full symptom text
    expect(screen.getByText(/2 sự kiện/)).toBeInTheDocument();
    expect(screen.getByText(/1 sự kiện/)).toBeInTheDocument();

    // Expand full raw evidence list
    const expandAllBtn = screen.getByRole('button', { name: /Xem toàn bộ 3 bản ghi Kubernetes Event gốc/i });
    expect(expandAllBtn).toBeInTheDocument();

    fireEvent.click(expandAllBtn);
    expect(screen.getByText('Bản ghi #1 • Pod: selfheal-test-app-67fbfd48ff-mqlhp')).toBeInTheDocument();
    expect(screen.getByText('Bản ghi #2 • Pod: selfheal-test-app-67fbfd48ff-mqlhp')).toBeInTheDocument();
    expect(screen.getByText('Bản ghi #3 • Pod: selfheal-test-app-67fbfd48ff-95flk')).toBeInTheDocument();
  });

  it('renders clean SRE Checklist questions without noisy English brackets in the text', async () => {
    render(
      <RootCauseModal
        incident={{
          id: 'INC-C9A29629',
          rawId: 'inc-c9a29629',
          service: 'selfheal-test-app',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    // Actionable short questions
    expect(screen.getByText('Ứng dụng có mở cổng kiểm tra sức khỏe không?')).toBeInTheDocument();
    expect(screen.getByText('Cấu hình Probe có chính xác không?')).toBeInTheDocument();
    expect(screen.getByText('Log ứng dụng có ghi nhận lỗi khởi động không?')).toBeInTheDocument();
    expect(screen.getByText('CPU có bị giới hạn quá mức không?')).toBeInTheDocument();
    expect(screen.getByText('Latency trước sự cố có tăng không?')).toBeInTheDocument();

    // No noisy bracketed English in the rendered text
    expect(screen.queryByText(/\[Application health endpoint response\]/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[Probe configuration\]/i)).not.toBeInTheDocument();
  });

  it('renders GRU Risks with Vietnamese title, advisory note, and header disclaimer', async () => {
    render(
      <RootCauseModal
        incident={{
          id: 'INC-C9A29629',
          rawId: 'inc-c9a29629',
          service: 'selfheal-test-app',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    // Header label disclaimer
    expect(
      screen.getByText('Dự báo từ mô hình GRU — Không phải bằng chứng RCA hoặc lệnh thực thi')
    ).toBeInTheDocument();

    // Vietnamese name and technical sub-badge
    expect(screen.getByText('Dự báo khả năng giảm replica')).toBeInTheDocument();
    expect(screen.getAllByText('SCALE_DOWN_CANDIDATE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('97%').length).toBeGreaterThanOrEqual(1);

    // SRE Safety Note
    expect(screen.getByText(/Chưa cho phép giảm replica khi workload đang bất ổn/)).toBeInTheDocument();
  });

  it('renders authentic SRE Incident Report bullet points without misleading claims', async () => {
    render(
      <RootCauseModal
        incident={{
          id: 'INC-C9A29629',
          rawId: 'inc-c9a29629',
          service: 'selfheal-test-app',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    // 1. Report Header
    expect(screen.getByText('BÁO CÁO GIẢI TRÌNH SRE (SRE INCIDENT REPORT)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sao chép giải trình/i })).toBeInTheDocument();

    // 2. Bullet 1: Incident detected - never falsely claims APPLICATION_OVERLOAD
    expect(screen.getByText(/• Sự cố phát hiện: Dịch vụ "selfheal-test-app"/)).toBeInTheDocument();
    expect(screen.queryByText(/QUÁ TẢI ỨNG DỤNG/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/APPLICATION_OVERLOAD/i)).not.toBeInTheDocument();

    // 3. Bullet 2: AI prediction - uses "Xu hướng có thể giảm replica", never "DƯ THỪA TÀI NGUYÊN"
    expect(screen.getByText(/• Cảnh báo học sâu GRU: Nguy cơ "Xu hướng có thể giảm replica"/)).toBeInTheDocument();
    expect(screen.queryByText('DƯ THỪA TÀI NGUYÊN')).not.toBeInTheDocument();

    // 4. Bullet 3: Validated Evidence
    expect(screen.getByText(/• Bằng chứng xác thực:/)).toBeInTheDocument();

    // 5. Bullet 4: Action proposal - states safely without claiming circuit breaker tripped and without raw NO_ACTION jargon
    expect(screen.getByText(/• Phương án xử lý & Đề xuất hiện tại: Chưa thực hiện hành động tự động/)).toBeInTheDocument();
    expect(screen.queryByText(/Chưa thực hiện hành động tự động \(NO_ACTION\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kích hoạt "NGẮT MẠCH AN TOÀN/i)).not.toBeInTheDocument();
  });

  it('renders incident title banner when title is provided', async () => {
    render(
      <RootCauseModal
        incident={{
          id: 'INC-00F41AF9',
          rawId: 'inc-00f41af9',
          service: 'opentelemetry-collector',
          title: 'Tràn bộ nhớ RAM (RAM 64%) on opentelemetry-collector',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    const banner = screen.getByTestId('incident-title-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Tiêu đề sự cố:/i);
    expect(banner).toHaveTextContent(/Tràn bộ nhớ RAM \(RAM 64%\) trên opentelemetry-collector/i);
  });
});
