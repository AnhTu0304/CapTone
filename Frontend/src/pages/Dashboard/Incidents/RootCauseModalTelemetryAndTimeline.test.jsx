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

const DB_CACHE_ANALYSIS = {
  service_id: 'mongodb',
  prediction: {
    service_id: 'mongodb',
    threshold: 0.96,
    thresholds: { OOM: 0.5875 },
    detected_risks: [{ risk_type: 'OOM', confidence: 0.92 }],
    risk_outputs: { OOM: { confidence: 0.94 } },
  },
  root_cause: {
    cause: 'database_cache_utilization',
    confidence: 0.92,
    severity: 'LOW',
  },
  recommendation: {
    action: 'NO_ACTION',
    reason: 'Mức RAM cao là bộ nhớ đệm WiredTiger chuẩn của MongoDB.',
    action_parameters: {
      consecutive_failures: 1,
    },
  },
  cluster_id: 'test',
  engine: 'Deterministic Multi-Agent SRE',
};

const MONGODB_INPUTS = [
  { collected_at: '2026-11-24T20:14:24.329Z', metric_name: 'cpu', metric_value: '5.29' },
  { collected_at: '2026-11-24T20:14:24.329Z', metric_name: 'ram', metric_value: '91.17' },
  { collected_at: '2026-11-24T20:14:24.329Z', metric_name: 'disk', metric_value: '4.39' },
  { collected_at: '2026-11-24T20:14:24.329Z', metric_name: 'latency', metric_value: '294.28' },
  { collected_at: '2026-11-24T20:14:24.329Z', metric_name: 'request_rate', metric_value: '2' },
  { collected_at: '2026-11-24T20:14:24.329Z', metric_name: 'http_5xx_rate', metric_value: '0' },
  { collected_at: '2026-11-24T20:14:24.329Z', metric_name: 'pod_restart_count', metric_value: '0' },
  { collected_at: '2026-11-24T20:14:24.329Z', metric_name: 'replica_count', metric_value: '5' },
  { collected_at: '2026-11-24T20:14:29.329Z', metric_name: 'cpu', metric_value: '6.10' },
  { collected_at: '2026-11-24T20:14:29.329Z', metric_name: 'ram', metric_value: '92.40' },
  { collected_at: '2026-11-24T20:14:29.329Z', metric_name: 'disk', metric_value: '4.40' },
  { collected_at: '2026-11-24T20:14:29.329Z', metric_name: 'latency', metric_value: '158.62' },
  { collected_at: '2026-11-24T20:14:29.329Z', metric_name: 'request_rate', metric_value: '1' },
  { collected_at: '2026-11-24T20:14:29.329Z', metric_name: 'http_5xx_rate', metric_value: '0' },
  { collected_at: '2026-11-24T20:14:29.329Z', metric_name: 'pod_restart_count', metric_value: '0' },
  { collected_at: '2026-11-24T20:14:29.329Z', metric_name: 'replica_count', metric_value: '5' },
];

describe('RootCauseModal non-blocking UI, telemetry loading, and timeline layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders immediately without blocking loading overlay or CSDL loading copy while detail requests are pending', async () => {
    const evDeferred = createDeferred();
    const detailDeferred = createDeferred();
    const inputsDeferred = createDeferred();

    aiService.getIncidentEvidences.mockReturnValue(evDeferred.promise);
    aiService.getIncidentDetail.mockReturnValue(detailDeferred.promise);
    aiService.getPredictionInputs.mockReturnValue(inputsDeferred.promise);

    render(
      <RootCauseModal
        incident={{
          id: 'INC-EEB3070E',
          rawId: 'eeb3070e-7152-47c9-ac78-d818eb7c1afa',
          predictionId: 'e1fa0e42-9ecf-4325-9a7b-166c8d28d503',
          service: 'mongodb',
          clusterName: 'test',
          analysis_result: DB_CACHE_ANALYSIS,
        }}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByTestId('rca-loading-state')).not.toBeInTheDocument();
    expect(screen.queryByText(/Đang tải dữ liệu phân tích RCA/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/từ cơ sở dữ liệu/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument();
    expect(screen.getAllByText('mongodb').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('test')).toBeInTheDocument();

    evDeferred.resolve([]);
    detailDeferred.resolve({
      id: 'eeb3070e-7152-47c9-ac78-d818eb7c1afa',
      prediction_id: 'e1fa0e42-9ecf-4325-9a7b-166c8d28d503',
      service_name: 'mongodb',
      cluster_name: 'test',
      analysis_result: JSON.stringify(DB_CACHE_ANALYSIS),
    });
    inputsDeferred.resolve(MONGODB_INPUTS);

    await waitFor(() => {
      expect(aiService.getPredictionInputs).toHaveBeenCalledWith('e1fa0e42-9ecf-4325-9a7b-166c8d28d503');
    });
  });

  it('fetches and displays prediction telemetry inputs via detailData.prediction_id fallback when initial prop lacks predictionId', async () => {
    aiService.getIncidentEvidences.mockResolvedValue([]);
    aiService.getIncidentDetail.mockResolvedValue({
      id: 'eeb3070e-7152-47c9-ac78-d818eb7c1afa',
      prediction_id: 'e1fa0e42-9ecf-4325-9a7b-166c8d28d503',
      service_name: 'mongodb',
      cluster_name: 'test',
      analysis_result: JSON.stringify(DB_CACHE_ANALYSIS),
    });
    aiService.getPredictionInputs.mockResolvedValue(MONGODB_INPUTS);

    render(
      <RootCauseModal
        incident={{
          id: 'INC-EEB3070E',
          rawId: 'eeb3070e-7152-47c9-ac78-d818eb7c1afa',
          service: 'mongodb',
        }}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(aiService.getPredictionInputs).toHaveBeenCalledWith('e1fa0e42-9ecf-4325-9a7b-166c8d28d503');
    });

    fireEvent.click(screen.getByRole('button', { name: /2\. Viễn Trắc & Dự Báo AI/i }));
    expect(await screen.findByText('2 mốc telemetry')).toBeInTheDocument();
    expect(screen.getAllByText(/92\.4\s*%/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
  });

  it('uses wrap-safe layout for healing timeline action names and does not mention cơ sở dữ liệu when empty', async () => {
    aiService.getIncidentEvidences.mockResolvedValue([]);
    aiService.getIncidentDetail.mockResolvedValue({
      id: 'eeb3070e-7152-47c9-ac78-d818eb7c1afa',
      service_name: 'mongodb',
      cluster_name: 'test',
      analysis_result: JSON.stringify(DB_CACHE_ANALYSIS),
      healing_history: [
        {
          id: 'ha-1',
          action_code: 'SCALE_REPLICAS',
          action_name: 'Tăng số lượng bản sao Pod (Lên 2 Pods)',
          target_name: 'mongodb',
          execution_status: 'COMPLETED',
          verification_result: false,
          verified_at: '2026-11-25T02:23:05.000Z',
          verification_message: 'RAM cạn kiệt: 99.76%',
          verification_details: { metrics: { replica_count: 2 } },
        },
      ],
    });
    aiService.getPredictionInputs.mockResolvedValue([]);

    render(
      <RootCauseModal
        incident={{
          id: 'INC-EEB3070E',
          rawId: 'eeb3070e-7152-47c9-ac78-d818eb7c1afa',
          service: 'mongodb',
          analysis_result: DB_CACHE_ANALYSIS,
        }}
        onClose={jest.fn()}
      />
    );

    const actionText = await screen.findByText(/Tăng số lượng bản sao Pod \(Lên 2 Pods\)/);
    expect(actionText).toHaveStyle({ whiteSpace: 'normal' });
    expect(actionText.parentElement).toHaveStyle({ flexWrap: 'wrap' });

    fireEvent.click(screen.getByRole('button', { name: /2\. Viễn Trắc & Dự Báo AI/i }));
    expect(screen.getByText('Không có telemetry')).toBeInTheDocument();
    expect(screen.queryByText(/trong cơ sở dữ liệu/i)).not.toBeInTheDocument();
  });
});
