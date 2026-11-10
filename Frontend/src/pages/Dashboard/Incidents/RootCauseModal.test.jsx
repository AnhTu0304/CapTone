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

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const INC_DD0CCA2C_ANALYSIS = {
  service_id: 'sme-order-service',
  prediction: {
    service_id: 'sme-order-service',
    threshold: 0.96,
    thresholds: {
      CPU_OVERLOAD: 0.75,
      OOM: 0.5875,
      DISK_FULL: 0.8475,
      HIGH_LATENCY: 0.5275,
      HTTP_5XX_SPIKE: 0.7375,
      TRAFFIC_OVERLOAD: 0.87,
      SCALE_DOWN_CANDIDATE: 0.96,
    },
    detected_risks: [{ risk_type: 'HIGH_LATENCY', confidence: 0.606558 }],
    risk_outputs: {
      CPU_OVERLOAD: { confidence: 0 },
      OOM: { confidence: 0 },
      DISK_FULL: { confidence: 0 },
      HIGH_LATENCY: { confidence: 0.606558 },
      HTTP_5XX_SPIKE: { confidence: 0.144523 },
      TRAFFIC_OVERLOAD: { confidence: 0.000002 },
      SCALE_DOWN_CANDIDATE: { confidence: 0.000405 },
    },
  },
  root_cause: {
    cause: 'Suy giảm hiệu năng dịch vụ',
    confidence: 0.7213,
    severity: 'MEDIUM',
  },
  evidence: [
    'Độ trễ (Latency) tăng nhanh đột biến (186.9 lên 2509.1)',
    'GRU predicted HIGH_LATENCY (60.7%)',
  ],
  recommendation: {
    action: 'SCALE_REPLICAS',
    reason: 'Bổ sung số lượng Pod replica để phân phối tải và phục hồi năng lực xử lý (hạ độ trễ dịch vụ)',
    priority: 'MEDIUM',
    target_type: 'DEPLOYMENT',
    target_name: 'sme-order-service',
    target_id: 'ba38f627-ad31-4c17-9142-67fa2130ee90',
    target_node: 'minikube',
    action_parameters: {
      faulty_pod_id: null,
      faulty_pod_name: null,
      faulty_node_id: '594c45d3-5ef3-48fd-8112-2db191dc9676',
      faulty_node_name: 'minikube',
      recommended_destination_node: null,
      destination_node_id: null,
      consecutive_failures: 0,
      circuit_breaker_tripped: false,
      manual_playbook: [],
    },
  },
  explanation:
    'Bằng chứng sự cố hiện tại ủng hộ mạnh nhất nguyên nhân: Suy giảm hiệu năng dịch vụ (mức độ MEDIUM, độ tin cậy 72%). Các tín hiệu xác thực ghi nhận trực tiếp: Độ trễ (Latency) tăng nhanh đột biến (186.9 lên 2509.1); GRU predicted HIGH_LATENCY (60.7%).',
  historical_context_used: false,
  similar_incident_ids: [],
  namespace: 'default',
  cluster_id: 'fcb1a025-48f0-40bf-b9ea-c61af3448084',
  engine: 'Deterministic Multi-Agent SRE',
};

const INC_DD0CCA2C_DETAIL = {
  id: 'dd0cca2c-2fcf-4492-9024-24e9557ba784',
  prediction_id: 'pred-dd0cca2c',
  cluster_id: 'fcb1a025-48f0-40bf-b9ea-c61af3448084',
  cluster_name: 'fyuyu',
  service_name: 'sme-order-service',
  workload_type: 'Deployment',
  namespace: 'default',
  node_name: 'minikube',
  actual_pod_name: 'sme-order-service-8cf87684-5m9zq',
  actual_pod_id: 'pod-uuid-5m9zq',
  cluster_node_count: 1,
  severity: 'MEDIUM',
  rca_confidence: 0.7213,
  root_cause_type: 'Service performance degradation',
  recommendation_action: 'SCALE_REPLICAS',
  recommendation_risk_level: 'MEDIUM',
  recommendation_priority: 'MEDIUM',
  prediction_type: 'HIGH_LATENCY',
  prediction_confidence: 0.6066,
  analysis_method: 'Deterministic Multi-Agent SRE',
  analysis_result: JSON.stringify(INC_DD0CCA2C_ANALYSIS),
  detected_at: '2026-11-10T10:15:00.000Z',
};

const SAMPLE_TIMESTEPS = [
  { collected_at: '2026-11-10T10:14:50.000Z', metric_name: 'cpu', metric_value: '0.68' },
  { collected_at: '2026-11-10T10:14:50.000Z', metric_name: 'ram', metric_value: '14.20' },
  { collected_at: '2026-11-10T10:14:50.000Z', metric_name: 'latency', metric_value: '186.9' },
  { collected_at: '2026-11-10T10:14:50.000Z', metric_name: 'pod_restart_count', metric_value: '10' },
  { collected_at: '2026-11-10T10:14:55.000Z', metric_name: 'cpu', metric_value: '0.86' },
  { collected_at: '2026-11-10T10:14:55.000Z', metric_name: 'ram', metric_value: '14.89' },
  { collected_at: '2026-11-10T10:14:55.000Z', metric_name: 'latency', metric_value: '2595.23' },
  { collected_at: '2026-11-10T10:14:55.000Z', metric_name: 'pod_restart_count', metric_value: '10' },
];

describe('RootCauseModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prevents async text-flicker by showing loading state until detail and telemetry resolve', async () => {
    const evDeferred = createDeferred();
    const detailDeferred = createDeferred();
    const inputsDeferred = createDeferred();

    aiService.getIncidentEvidences.mockReturnValue(evDeferred.promise);
    aiService.getIncidentDetail.mockReturnValue(detailDeferred.promise);
    aiService.getPredictionInputs.mockReturnValue(inputsDeferred.promise);

    render(
      <RootCauseModal
        incident={{
          id: 'INC-DD0CCA2C',
          rawId: 'dd0cca2c-2fcf-4492-9024-24e9557ba784',
          predictionId: 'pred-dd0cca2c',
          service: 'sme-order-service',
          predictedRisk: 'HIGH_LATENCY',
          recommendationAction: 'SCALE_REPLICAS',
          severity: 'MEDIUM',
        }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('rca-loading-state')).toBeInTheDocument();
    expect(screen.queryByText(/BÁO CÁO GIẢI TRÌNH SRE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cảnh báo học sâu GRU/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Đang tải...').length).toBeGreaterThanOrEqual(1);

    evDeferred.resolve([]);
    detailDeferred.resolve(INC_DD0CCA2C_DETAIL);
    inputsDeferred.resolve(SAMPLE_TIMESTEPS);

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/CPU đỉnh 0\.86%/)).toBeInTheDocument();
    expect(screen.getAllByText(/Rủi ro: TRUNG BÌNH/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Cảnh báo học sâu GRU/i)).not.toBeInTheDocument();
  });

  it('renders authentic PostgreSQL fields for INC-DD0CCA2C without false defaults or inaccurate labels', async () => {
    aiService.getIncidentEvidences.mockResolvedValue([]);
    aiService.getIncidentDetail.mockResolvedValue(INC_DD0CCA2C_DETAIL);
    aiService.getPredictionInputs.mockResolvedValue(SAMPLE_TIMESTEPS);

    render(
      <RootCauseModal
        incident={{
          id: 'INC-DD0CCA2C',
          rawId: 'dd0cca2c-2fcf-4492-9024-24e9557ba784',
          service: 'sme-order-service',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    // Authentic risk & priority (not fake HIGH / CAO)
    expect(screen.getByText('Rủi ro: TRUNG BÌNH')).toBeInTheDocument();
    expect(screen.queryByText(/Rủi ro:\s*CAO/i)).not.toBeInTheDocument();

    // Real pod name used across Target Pod, Playbook kubectl command, and Explanation
    expect(screen.getAllByText(/sme-order-service-8cf87684-5m9zq/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/kubectl logs -n default sme-order-service-8cf87684-5m9zq --tail=50/)).toBeInTheDocument();
    expect(screen.getByText(/Tự sinh theo ngữ cảnh RCA/)).toBeInTheDocument();

    // Honest node info without fake "(Ready)" or hardcoded "Cụm Minikube 1 Node vật lý"
    expect(screen.getByText('Cụm hiện có 1 Node')).toBeInTheDocument();
    expect(screen.queryByText(/Cụm Minikube 1 Node vật lý/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(Ready\)/i)).not.toBeInTheDocument();

    // Header badge reflects actual confidence & engine
    expect(screen.getByText(/72% Deterministic Multi-Agent SRE/)).toBeInTheDocument();

    // Tab 2 shows exact timestep count from DB instead of hardcoded "12 MỐC"
    fireEvent.click(screen.getByRole('button', { name: /2\. Viễn Trắc & Dự Báo AI/i }));
    expect(screen.getByText('DỮ LIỆU ĐẦU VÀO AI (2 MỐC VIỄN TRẮC TELEMETRY)')).toBeInTheDocument();
    expect(screen.getByText('2 mốc telemetry từ CSDL')).toBeInTheDocument();
    expect(screen.queryByText(/Chu kỳ 5 giây\/mốc/i)).not.toBeInTheDocument();
  });

  it('generates valid deployment kubectl target without missing namespace and adapts SLO verification to OOM', async () => {
    aiService.getIncidentEvidences.mockResolvedValue([]);
    aiService.getIncidentDetail.mockResolvedValue({
      id: 'oom-incident-1',
      service_name: 'order-svc',
      workload_type: 'Deployment',
      namespace: null,
      actual_pod_name: null,
      node_name: 'worker-02',
      cluster_name: 'prod-vn',
      cluster_node_count: 3,
      prediction_type: 'OOM',
      root_cause_type: 'Container memory exhausted',
      recommendation_action: 'RESTART_POD',
      recommendation_risk_level: 'HIGH',
      recommendation_priority: 'CRITICAL',
      severity: 'CRITICAL',
      rca_confidence: 0.91,
      analysis_method: 'AI_DETERMINISTIC_RULES',
      analysis_result: null,
    });
    aiService.getPredictionInputs.mockResolvedValue([]);

    render(
      <RootCauseModal
        incident={{
          id: 'INC-OOM-01',
          rawId: 'oom-incident-1',
          service: 'order-svc',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByText('WORKLOAD MỤC TIÊU')).toBeInTheDocument();
    expect(screen.getByText(/kubectl logs deployment\/order-svc --tail=50/)).toBeInTheDocument();
    expect(screen.queryByText(/test-lab/)).not.toBeInTheDocument();
    expect(screen.getByText(/RAM container, cgroup limits và sự kiện OOMKilled/i)).toBeInTheDocument();
    expect(screen.getByText('Cụm hiện có 3 Node')).toBeInTheDocument();
  });

  it('displays explicit unknown labels instead of hardcoded defaults and safely handles null risk_outputs', async () => {
    aiService.getIncidentEvidences.mockResolvedValue([]);
    aiService.getIncidentDetail.mockResolvedValue({
      id: 'minimal-inc-1',
      service_name: 'orders-api',
      cluster_name: null,
      node_name: null,
      namespace: null,
      actual_pod_name: null,
      cluster_node_count: null,
      severity: null,
      rca_confidence: null,
      recommendation_action: 'RESTART_POD',
      recommendation_risk_level: null,
      recommendation_priority: null,
      analysis_method: null,
      analysis_result: null,
      detected_at: null,
    });
    aiService.getPredictionInputs.mockResolvedValue([]);

    const { container } = render(
      <RootCauseModal
        incident={{
          id: 'INC-MINIMAL',
          rawId: 'minimal-inc-1',
          service: 'orders-api',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    });

    const fullText = container.textContent;
    expect(fullText).not.toContain('fyuyu');
    expect(fullText).not.toContain('test-lab');
    expect(fullText).not.toContain('minikube');
    expect(fullText).not.toContain('99%');
    expect(fullText).not.toContain('342');
    expect(fullText).not.toContain('CRITICAL');
    expect(fullText).not.toContain('KHẨN CẤP');
    expect(fullText).not.toContain('Cụm Minikube 1 Node vật lý');

    expect(screen.getAllByText('Chưa xác định').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Chưa đánh giá').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Ưu tiên: Chưa phân loại/)).toBeInTheDocument();
    expect(screen.getByText(/Rủi ro: Chưa phân loại/)).toBeInTheDocument();
    expect(screen.getByText(/Thời điểm ghi nhận:\s*Chưa ghi nhận/)).toBeInTheDocument();

    // Switch to Tab 2 when riskOutputsAll is null and telemetry is empty -> must not throw
    fireEvent.click(screen.getByRole('button', { name: /2\. Viễn Trắc & Dự Báo AI/i }));
    expect(screen.getByText('Không có dữ liệu dự báo GRU gắn với sự cố này.')).toBeInTheDocument();
    expect(
      screen.getByText('Điểm xác suất chi tiết của 7 Heads GRU chưa được lưu trong payload RCA này.')
    ).toBeInTheDocument();
    expect(screen.getByText('DỮ LIỆU ĐẦU VÀO AI (0 MỐC VIỄN TRẮC TELEMETRY)')).toBeInTheDocument();
    expect(screen.getByText('Không có dữ liệu telemetry')).toBeInTheDocument();
  });
});
