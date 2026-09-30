import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  getAIOverviewKPIs,
  getAIModels,
  getAIPredictions,
  getAIRCAAnalyses,
  getAIPerformanceMetrics,
} from '../../services/adminAIService';

import AIEmptyState from '../../components/admin/ai/AIEmptyState';
import AINavTabs from '../../components/admin/ai/AINavTabs';
import AIOverviewSection from '../../components/admin/ai/AIOverviewSection';
import AIModelsTable from '../../components/admin/ai/AIModelsTable';
import AIPredictionsTable from '../../components/admin/ai/AIPredictionsTable';
import AIRCASection from '../../components/admin/ai/AIRCASection';
import AIPerformanceView from '../../components/admin/ai/AIPerformanceView';
import AdminAIPage from './AI/AdminAIPage';

describe('Platform Admin AI Module', () => {
  describe('Service Layer Data Contracts (7 Database Concepts)', () => {
    test('getAIOverviewKPIs returns all 5 overview KPI metrics', async () => {
      const kpis = await getAIOverviewKPIs();
      expect(kpis).toHaveProperty('activeModels');
      expect(kpis).toHaveProperty('predictionVolume');
      expect(kpis).toHaveProperty('averageConfidence');
      expect(kpis).toHaveProperty('highRiskPredictions');
      expect(kpis).toHaveProperty('rcaAnalysisVolume');
      expect(typeof kpis.activeModels).toBe('number');
      expect(typeof kpis.predictionVolume).toBe('number');
    });

    test('getAIModels returns ai_models with all 7 requested fields', async () => {
      const models = await getAIModels();
      expect(models.length).toBeGreaterThan(0);
      const model = models[0];

      // 1. model name
      expect(model).toHaveProperty('name');
      // 2. model type
      expect(model).toHaveProperty('modelType');
      // 3. version
      expect(model).toHaveProperty('version');
      // 4. framework
      expect(model).toHaveProperty('framework');
      // 5. status
      expect(model).toHaveProperty('status');
      // 6. dataset
      expect(model).toHaveProperty('dataset');
      // 7. evaluation metrics (ai_model_metrics)
      expect(model).toHaveProperty('evaluationMetrics');
    });

    test('getAIPredictions returns ai_predictions populated with prediction_inputs and ai_recommendations', async () => {
      const predictions = await getAIPredictions();
      expect(predictions.length).toBeGreaterThan(0);
      const predWithInputs = predictions.find((p) => p.inputs && p.inputs.length > 0);
      expect(predWithInputs).toBeDefined();
      expect(predWithInputs.inputs[0]).toHaveProperty('featureName');
      expect(predWithInputs.inputs[0]).toHaveProperty('featureValue');
      expect(predWithInputs.inputs[0]).toHaveProperty('anomalyWeight');

      const predWithRec = predictions.find((p) => p.recommendations && p.recommendations.length > 0);
      expect(predWithRec).toBeDefined();
      expect(predWithRec.recommendations[0]).toHaveProperty('actionType');
      expect(predWithRec.recommendations[0]).toHaveProperty('suggestedParameters');
    });

    test('getAIRCAAnalyses returns rca_analyses populated with rca_evidences and ai_recommendations', async () => {
      const rcaList = await getAIRCAAnalyses();
      expect(rcaList.length).toBeGreaterThan(0);
      const rca = rcaList[0];

      expect(rca).toHaveProperty('rootCauseSummary');
      expect(rca).toHaveProperty('causalGraphNodesCount');
      expect(rca).toHaveProperty('causalGraphEdgesCount');
      expect(rca.evidences.length).toBeGreaterThan(0);
      expect(rca.evidences[0]).toHaveProperty('evidenceType');
      expect(rca.evidences[0]).toHaveProperty('snippet');
      expect(rca.recommendations.length).toBeGreaterThan(0);
      expect(rca.recommendations[0]).toHaveProperty('actionType');
    });

    test('getAIPerformanceMetrics returns all 6 performance metrics without fabricated claims', async () => {
      const metrics = await getAIPerformanceMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      const item = metrics[0];

      // 1. accuracy
      expect(item).toHaveProperty('accuracy');
      // 2. precision
      expect(item).toHaveProperty('precision');
      // 3. recall
      expect(item).toHaveProperty('recall');
      // 4. F1
      expect(item).toHaveProperty('f1');
      // 5. MAE/RMSE where applicable
      expect(item).toHaveProperty('mae');
      expect(item).toHaveProperty('rmse');
      // 6. false positive rate
      expect(item).toHaveProperty('falsePositiveRate');
    });
  });

  describe('UI Component Rendering', () => {
    test('AIEmptyState renders fallback message and triggers callback', () => {
      const mockAction = jest.fn();
      render(
        <AIEmptyState
          title="Không có mô hình nào"
          description="Vui lòng thử lại"
          actionLabel="Tải lại"
          onAction={mockAction}
        />
      );

      expect(screen.getByText('Không có mô hình nào')).toBeInTheDocument();
      expect(screen.getByText('Vui lòng thử lại')).toBeInTheDocument();
      const button = screen.getByText('Tải lại');
      fireEvent.click(button);
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    test('AINavTabs renders all 5 routes tabs and handles selection', () => {
      const mockTabChange = jest.fn();
      render(<AINavTabs activeTab="overview" onTabChange={mockTabChange} />);

      expect(screen.getByText('Tổng Quan AI')).toBeInTheDocument();
      expect(screen.getByText('Mô Hình Học Máy')).toBeInTheDocument();
      expect(screen.getByText('Dự Báo Dị Thường')).toBeInTheDocument();
      expect(screen.getByText('Đồ Thị Nhân Quả RCA')).toBeInTheDocument();
      expect(screen.getByText('Hiệu Năng & Kiểm Chuẩn')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Mô Hình Học Máy'));
      expect(mockTabChange).toHaveBeenCalledWith('models');
    });

    test('AIOverviewSection displays 5 KPI cards correctly', () => {
      const mockKpis = {
        activeModels: 4,
        predictionVolume: 1420,
        averageConfidence: '96.2%',
        highRiskPredictions: 2,
        rcaAnalysisVolume: 34,
      };

      render(<AIOverviewSection kpis={mockKpis} models={[]} />);

      expect(screen.getByText(/MÔ HÌNH HOẠT ĐỘNG/i)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText(/KHỐI LƯỢNG DỰ BÁO/i)).toBeInTheDocument();
      expect(screen.getByText(/1[.,]420/)).toBeInTheDocument();
      expect(screen.getByText(/ĐỘ TIN CẬY TRUNG BÌNH/i)).toBeInTheDocument();
      expect(screen.getByText('96.2%')).toBeInTheDocument();
      expect(screen.getByText(/DỰ BÁO RỦI RO CAO/i)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText(/PHÂN TÍCH NGUYÊN NHÂN/i)).toBeInTheDocument();
      expect(screen.getByText('34')).toBeInTheDocument();
    });

    test('AIModelsTable renders all 7 model fields and supports empty state', () => {
      const mockModels = [
        {
          id: 'mod-01',
          name: 'Kernel Anomaly Detector',
          modelType: 'Anomaly Detection',
          version: 'v2.1.0',
          framework: 'PyTorch / LibTorch C++',
          status: 'ACTIVE',
          dataset: 'Kernel Traces v3.2',
          evaluationMetrics: 'Acc: 98.4% • Precision: 97.6%',
        },
      ];

      const { rerender } = render(<AIModelsTable models={mockModels} />);

      // Headers & content check
      expect(screen.getByText('Tên Mô Hình (Model Name)')).toBeInTheDocument();
      expect(screen.getByText('Phân Loại (Model Type)')).toBeInTheDocument();
      expect(screen.getByText('Phiên Bản (Version)')).toBeInTheDocument();
      expect(screen.getByText('Khung Công Nghệ (Framework)')).toBeInTheDocument();
      expect(screen.getByText('Trạng Thái (Status)')).toBeInTheDocument();
      expect(screen.getByText('Tập Dữ Liệu (Dataset)')).toBeInTheDocument();
      expect(screen.getByText('Chỉ Số Đánh Giá (Evaluation Metrics)')).toBeInTheDocument();

      // Row values
      expect(screen.getByText('Kernel Anomaly Detector')).toBeInTheDocument();
      expect(screen.getByText('v2.1.0')).toBeInTheDocument();
      expect(screen.getByText('PyTorch / LibTorch C++')).toBeInTheDocument();
      expect(screen.getByText('Kernel Traces v3.2')).toBeInTheDocument();
      expect(screen.getByText('Acc: 98.4% • Precision: 97.6%')).toBeInTheDocument();

      // Empty state check
      rerender(<AIModelsTable models={[]} />);
      expect(screen.getByText('Không Tìm Thấy Mô Hình Nào')).toBeInTheDocument();
    });

    test('AIPerformanceView renders 6 performance metrics and integrity disclaimer', () => {
      const mockMetrics = [
        {
          modelId: 'mod-cap-04',
          modelName: 'Cluster Capacity Forecaster',
          modelType: 'Capacity Forecasting',
          dataset: 'Node Resource Series (365 days)',
          accuracy: '95.9%',
          precision: '95.1%',
          recall: '96.0%',
          f1: '0.955',
          mae: '0.042 cores',
          rmse: '0.068 cores',
          falsePositiveRate: '1.9%',
        },
      ];

      render(<AIPerformanceView metrics={mockMetrics} />);

      // Integrity disclaimer
      expect(screen.getByText(/Nguyên tắc minh bạch & Xác thực mô hình/i)).toBeInTheDocument();
      expect(screen.getByText(/Nghiêm cấm việc tự suy đoán hoặc nâng khống chỉ số hiệu năng/i)).toBeInTheDocument();

      // Columns
      expect(screen.getByText('Accuracy')).toBeInTheDocument();
      expect(screen.getByText('Precision')).toBeInTheDocument();
      expect(screen.getByText('Recall')).toBeInTheDocument();
      expect(screen.getByText('F1 Score')).toBeInTheDocument();
      expect(screen.getByText('MAE / RMSE')).toBeInTheDocument();
      expect(screen.getByText('False Positive (FPR)')).toBeInTheDocument();

      // Values
      expect(screen.getByText('Cluster Capacity Forecaster')).toBeInTheDocument();
      expect(screen.getByText('95.9%')).toBeInTheDocument();
      expect(screen.getByText('95.1%')).toBeInTheDocument();
      expect(screen.getByText('96.0%')).toBeInTheDocument();
      expect(screen.getByText('0.955')).toBeInTheDocument();
      expect(screen.getByText('0.042 cores')).toBeInTheDocument();
      expect(screen.getByText('1.9%')).toBeInTheDocument();
    });

    test('AIPredictionsTable displays predictions and expands prediction_inputs drawer', () => {
      const mockPredictions = [
        {
          id: 'PRED-TEST-1',
          modelName: 'OOM Failure Predictor',
          targetResource: 'Deployment/order-service',
          predictionType: 'OOM Risk Spike',
          confidenceScore: 0.985,
          riskLevel: 'HIGH',
          status: 'TRIGGERED',
          predictedTimeHorizon: 'trong 10 phút tới',
          createdAt: '30/09/2026 14:00:00',
          inputs: [
            {
              id: 'inp-1',
              featureName: 'cgroup_memory_rss_growth',
              featureValue: '+90 MB/min',
              baselineValue: '< 5 MB/min',
              anomalyWeight: 0.89,
            },
          ],
          recommendations: [
            {
              id: 'rec-1',
              actionType: 'Resource Limit Patch',
              suggestedParameters: 'limits.memory: 3072Mi',
              impactScore: 94,
              safetyTier: 'Tier 1 Safe',
              status: 'PROPOSED',
            },
          ],
        },
      ];

      render(<AIPredictionsTable predictions={mockPredictions} />);

      expect(screen.getByText('PRED-TEST-1')).toBeInTheDocument();
      expect(screen.getByText('Deployment/order-service')).toBeInTheDocument();

      // Click to open drawer
      const inspectBtn = screen.getByText('Đặc trưng');
      fireEvent.click(inspectBtn);

      // Verify drawer contents
      expect(screen.getByText(/Vector Đặc Trưng Suy Diễn/i)).toBeInTheDocument();
      expect(screen.getByText('cgroup_memory_rss_growth')).toBeInTheDocument();
      expect(screen.getByText('+90 MB/min')).toBeInTheDocument();
      expect(screen.getByText(/Resource Limit Patch/i)).toBeInTheDocument();
    });

    test('AIRCASection renders causal graph complexity, evidences and recommendations', () => {
      const mockAnalyses = [
        {
          id: 'RCA-TEST-1',
          incidentId: 'INC-2026-999',
          rootCauseSummary: 'Tràn bộ đệm JSON Buffer Pool gây OOM Kill.',
          confidence: '98.5%',
          causalGraphNodesCount: 7,
          causalGraphEdgesCount: 11,
          analyzedAt: '30/09/2026 15:00:00',
          evidences: [
            {
              id: 'ev-1',
              evidenceType: 'Kernel SIGKILL',
              evidenceSource: 'eBPF cgroup Watcher',
              confidenceContribution: '40%',
              snippet: 'kernel: Task oom-killer killed process',
            },
          ],
          recommendations: [
            {
              id: 'rec-1',
              actionType: 'In-place Memory Bump',
              suggestedParameters: 'limits.memory: 4096Mi',
              impactScore: 95,
              safetyTier: 'Tier 1 Safe',
              status: 'APPLIED',
            },
          ],
        },
      ];

      render(<AIRCASection analyses={mockAnalyses} />);

      expect(screen.getByText('RCA-TEST-1')).toBeInTheDocument();
      expect(screen.getByText('Gốc sự cố: INC-2026-999')).toBeInTheDocument();
      expect(screen.getByText('Tràn bộ đệm JSON Buffer Pool gây OOM Kill.')).toBeInTheDocument();
      expect(screen.getByText('7 nodes')).toBeInTheDocument();
      expect(screen.getByText('11 edges')).toBeInTheDocument();

      // Expanded evidence & recommendation
      expect(screen.getByText('Kernel SIGKILL')).toBeInTheDocument();
      expect(screen.getByText('kernel: Task oom-killer killed process')).toBeInTheDocument();
      expect(screen.getByText('In-place Memory Bump')).toBeInTheDocument();
    });

    test('AdminAIPage renders overview section and switches sub-routes cleanly', async () => {
      const mockNavigate = jest.fn();
      render(<AdminAIPage currentSection="overview" onNavigate={mockNavigate} />);

      // Awaits data loading
      await waitFor(() => {
        expect(screen.getByText(/MÔ HÌNH HOẠT ĐỘNG/i)).toBeInTheDocument();
      });

      // Switch tab
      const modelsTab = screen.getByText('Mô Hình Học Máy');
      fireEvent.click(modelsTab);
      expect(mockNavigate).toHaveBeenCalledWith('/admin/ai/models');
    });
  });
});
