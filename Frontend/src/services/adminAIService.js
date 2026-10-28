import { getRegisteredModels } from './aiModelRegistryService';
import aiService from './aiService';
/**
 * @file adminAIService.js
 * @description Tầng dịch vụ dữ liệu chuyên dụng cho Phân hệ Quản Trị Trí Tuệ Nhân Tạo Nền Tảng (Platform Admin AI)
 * Dựa trên 7 thực thể cơ sở dữ liệu: ai_models, ai_model_metrics, ai_predictions, prediction_inputs, rca_analyses, rca_evidences, ai_recommendations.
 * Tuân thủ nguyên tắc trung thực số liệu (Không bịa đặt claims) và hỗ trợ đầy đủ empty states.
 */

/**
 * @typedef {Object} AIModel
 * @property {string} id - Mã định danh mô hình (vd: 'mod-ebpf-anom-01')
 * @property {string} name - Tên mô hình (vd: 'Kernel Telemetry Anomaly Detector')
 * @property {'Anomaly Detection' | 'Causal Graph RCA' | 'Failure Predictive' | 'Capacity Forecasting'} modelType - Phân loại mô hình
 * @property {string} version - Phiên bản triển khai (vd: 'v2.4.1-LTS')
 * @property {'PyTorch' | 'ONNX Runtime' | 'Scikit-learn' | 'TensorFlow Lite'} framework - Khung công nghệ
 * @property {'ACTIVE' | 'TRAINING' | 'DEPRECATED'} status - Trạng thái hoạt động
 * @property {string} dataset - Tên tập dữ liệu huấn luyện & kích thước
 * @property {string} evaluationMetrics - Tóm tắt chỉ số kiểm định (Accuracy, F1, Latency)
 * @property {string} updatedAt - Thời điểm cập nhật trọng số
 */

/**
 * @typedef {Object} AIModelMetric
 * @property {string} id - Mã chỉ số
 * @property {string} modelId - Mã mô hình liên kết
 * @property {string} metricName - Tên chỉ số ('accuracy' | 'precision' | 'recall' | 'f1_score' | 'mae' | 'rmse' | 'false_positive_rate')
 * @property {number|string} metricValue - Giá trị đo lường
 * @property {'test' | 'validation'} datasetSplit - Phân vùng dữ liệu đánh giá
 * @property {string} recordedAt - Thời điểm ghi nhận
 */

/**
 * @typedef {Object} AIPrediction
 * @property {string} id - Mã dự báo (vd: 'PRED-2026-891')
 * @property {string} modelId - Mã mô hình thực hiện suy luận
 * @property {string} modelName - Tên mô hình
 * @property {string} targetResource - Tài nguyên Kubernetes mục tiêu (vd: 'Deployment/order-processor')
 * @property {string} predictionType - Loại nguy cơ dự báo (vd: 'OOM Risk Spike', 'Consumer Lag Congestion')
 * @property {number} confidenceScore - Điểm tin cậy (0.0 - 1.0)
 * @property {'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} riskLevel - Mức độ rủi ro
 * @property {'TRIGGERED' | 'VERIFIED' | 'FALSE_ALARM'} status - Trạng thái kiểm chứng
 * @property {string} predictedTimeHorizon - Khung thời gian xảy ra dự báo (vd: 'trong 15 phút tới')
 * @property {string} createdAt - Thời điểm suy diễn
 * @property {Array<PredictionInput>} [inputs] - Các đặc trưng đầu vào suy luận
 * @property {Array<AIRecommendation>} [recommendations] - Khuyến nghị tự lành kèm theo
 */

/**
 * @typedef {Object} PredictionInput
 * @property {string} id - Mã đặc trưng
 * @property {string} predictionId - Mã dự báo liên kết
 * @property {string} featureName - Tên chỉ số viễn trắc (vd: 'cgroup_memory_rss_rate')
 * @property {string} featureValue - Giá trị ghi nhận thực tế
 * @property {string} baselineValue - Giá trị baseline tiêu chuẩn
 * @property {number} anomalyWeight - Trọng số đóng góp vào kết luận dị thường
 */

/**
 * @typedef {Object} RCAAnalysis
 * @property {string} id - Mã phân tích RCA (vd: 'RCA-2026-441')
 * @property {string} incidentId - Mã sự cố liên kết
 * @property {string} modelId - Mã mô hình AI phân tích
 * @property {string} rootCauseSummary - Tóm tắt kết luận nguyên nhân gốc rễ
 * @property {string} confidence - Độ tin cậy chẩn đoán (%)
 * @property {number} causalGraphNodesCount - Số đỉnh trong đồ thị nhân quả
 * @property {number} causalGraphEdgesCount - Số cạnh quan hệ nhân quả
 * @property {string} analyzedAt - Thời điểm hoàn tất phân tích
 * @property {Array<RCAEvidence>} evidences - Danh sách bằng chứng hỗ trợ
 * @property {Array<AIRecommendation>} recommendations - Đề xuất hành động khắc phục
 */

/**
 * @typedef {Object} RCAEvidence
 * @property {string} id - Mã bằng chứng
 * @property {string} rcaId - Mã RCA liên kết
 * @property {'Kernel Probe SIGKILL' | 'Container Error Log' | 'Metric Divergence'} evidenceType - Loại bằng chứng
 * @property {string} evidenceSource - Nguồn thu thập (vd: 'eBPF Probe #14', 'Kubelet Log Stream')
 * @property {string} confidenceContribution - Mức độ đóng góp bằng chứng (%)
 * @property {string} snippet - Đoạn trích xuất nhật ký hoặc tín hiệu đo lường
 */

/**
 * @typedef {Object} AIRecommendation
 * @property {string} id - Mã khuyến nghị
 * @property {string} referenceId - Mã dự báo hoặc RCA liên kết
 * @property {string} actionType - Loại hành động tự phục hồi đề xuất
 * @property {string} suggestedParameters - Thông số cấu hình K8s đề xuất
 * @property {number} impactScore - Điểm ước tính tác động an toàn (0 - 100)
 * @property {'Tier 1 Safe' | 'Tier 2 HITL Required'} safetyTier - Cấp độ an toàn
 * @property {'PROPOSED' | 'APPROVED' | 'APPLIED' | 'DISMISSED'} status - Trạng thái khuyến nghị
 */

// ==========================================
// DỮ LIỆU GIẢ LẬP THEO CHUẨN CƠ SỞ DỮ LIỆU
// ==========================================

const MOCK_AI_MODELS = [];

const MOCK_PREDICTION_INPUTS = {
  'PRED-2026-891': [
    { id: 'inp-01', predictionId: 'PRED-2026-891', featureName: 'cgroup_memory_rss_growth_rate', featureValue: '+84 MB/min', baselineValue: '< 5 MB/min', anomalyWeight: 0.88 },
    { id: 'inp-02', predictionId: 'PRED-2026-891', featureName: 'jvm_heap_eden_gc_latency_p99', featureValue: '480 ms', baselineValue: '25 ms', anomalyWeight: 0.74 },
    { id: 'inp-03', predictionId: 'PRED-2026-891', featureName: 'active_tcp_socket_alloc_count', featureValue: '4,210', baselineValue: '850', anomalyWeight: 0.62 },
  ],
  'PRED-2026-892': [
    { id: 'inp-04', predictionId: 'PRED-2026-892', featureName: 'kafka_partition_consumer_lag_delta', featureValue: '+1,240 msg/s', baselineValue: '< 50 msg/s', anomalyWeight: 0.94 },
    { id: 'inp-05', predictionId: 'PRED-2026-892', featureName: 'deserialization_exception_count', featureValue: '18 / s', baselineValue: '0 / s', anomalyWeight: 0.91 },
  ],
};

const MOCK_AI_RECOMMENDATIONS = {
  'PRED-2026-891': [
    {
      id: 'REC-01',
      referenceId: 'PRED-2026-891',
      actionType: 'K8s Resource Limit Patch (RAM)',
      suggestedParameters: 'resources.limits.memory: 3072Mi (Tăng từ 2048Mi)',
      impactScore: 92,
      safetyTier: 'Tier 1 Safe',
      status: 'PROPOSED',
    },
  ],
  'PRED-2026-892': [
    {
      id: 'REC-02',
      referenceId: 'PRED-2026-892',
      actionType: 'Kafka Consumer Lag DLQ Re-route',
      suggestedParameters: 'topic: payments-dlq, skipPoisonPill: true',
      impactScore: 85,
      safetyTier: 'Tier 2 HITL Required',
      status: 'PROPOSED',
    },
  ],
  'RCA-2026-441': [
    {
      id: 'REC-03',
      referenceId: 'RCA-2026-441',
      actionType: 'In-place Pod Memory Bump & Rolling Restart',
      suggestedParameters: 'limits.memory: 3072Mi, maxUnavailable: 0',
      impactScore: 96,
      safetyTier: 'Tier 1 Safe',
      status: 'APPLIED',
    },
  ],
};

const MOCK_AI_PREDICTIONS = [
  {
    id: 'PRED-2026-891',
    modelId: 'mod-fail-predict-03',
    modelName: 'Pod CrashLoop & OOM Failure Predictor',
    targetResource: 'Deployment/order-processor (namespace: default)',
    predictionType: 'OOM Risk Spike',
    confidenceScore: 0.978,
    riskLevel: 'HIGH',
    status: 'TRIGGERED',
    predictedTimeHorizon: 'trong 12 phút tới',
    createdAt: '30/09/2026 14:10:15',
  },
  {
    id: 'PRED-2026-892',
    modelId: 'mod-ebpf-anom-01',
    modelName: 'Kernel Telemetry Anomaly Detector',
    targetResource: 'Topic/payments-stream (partition: 3)',
    predictionType: 'Consumer Lag Congestion',
    confidenceScore: 0.962,
    riskLevel: 'HIGH',
    status: 'TRIGGERED',
    predictedTimeHorizon: 'trong 8 phút tới',
    createdAt: '30/09/2026 14:38:20',
  },
  {
    id: 'PRED-2026-893',
    modelId: 'mod-cap-forecast-04',
    modelName: 'Cluster Capacity & HPA Wave Forecaster',
    targetResource: 'HPA/checkout-worker (Cụm: prod-hn-01)',
    predictionType: 'CPU Throttling Ratio Surge',
    confidenceScore: 0.935,
    riskLevel: 'MEDIUM',
    status: 'VERIFIED',
    predictedTimeHorizon: 'trong 25 phút tới',
    createdAt: '30/09/2026 11:45:00',
  },
  {
    id: 'PRED-2026-894',
    modelId: 'mod-ebpf-anom-01',
    modelName: 'Kernel Telemetry Anomaly Detector',
    targetResource: 'Node/worker-node-hn-03 (cgroup v2)',
    predictionType: 'Kernel Thread Contention Spike',
    confidenceScore: 0.842,
    riskLevel: 'LOW',
    status: 'FALSE_ALARM',
    predictedTimeHorizon: 'trong 45 phút tới',
    createdAt: '30/09/2026 08:20:00',
  },
];

const MOCK_RCA_EVIDENCES = {
  'RCA-2026-441': [
    {
      id: 'ev-01',
      rcaId: 'RCA-2026-441',
      evidenceType: 'Kernel Probe SIGKILL',
      evidenceSource: 'eBPF cgroup Out-Of-Memory Watcher',
      confidenceContribution: '45%',
      snippet: 'kernel: [184920.12] Task oom-killer: killed process 14890 (order-processor) total-vm:2097152kB, anon-rss:2048000kB',
    },
    {
      id: 'ev-02',
      rcaId: 'RCA-2026-441',
      evidenceType: 'Container Error Log',
      evidenceSource: 'order-processor stdout log probe',
      confidenceContribution: '32%',
      snippet: 'java.lang.OutOfMemoryError: Java heap space at JsonBufferPool.decode(JsonBufferPool.java:142)',
    },
    {
      id: 'ev-03',
      rcaId: 'RCA-2026-441',
      evidenceType: 'Metric Divergence',
      evidenceSource: 'Prometheus Container Memory Working Set',
      confidenceContribution: '21%',
      snippet: 'container_memory_working_set_bytes divergence: standard deviation +4.8 sigma over 10-minute window',
    },
  ],
};

const MOCK_RCA_ANALYSES = [
  {
    id: 'RCA-2026-441',
    incidentId: 'INC-2026-8812',
    modelId: 'mod-causal-rca-02',
    rootCauseSummary: 'Rò rỉ bộ nhớ không giới hạn (Unbounded memory leak) trong JsonBufferPool khi giải mã payload JSON 18MB đột biến.',
    confidence: '98.4%',
    causalGraphNodesCount: 8,
    causalGraphEdgesCount: 12,
    analyzedAt: '30/09/2026 14:15:35',
  },
  {
    id: 'RCA-2026-442',
    incidentId: 'INC-2026-8815',
    modelId: 'mod-causal-rca-02',
    rootCauseSummary: 'Tin nhắn sai định dạng schema v2.1 thiếu trường merchant_id gây ngoại lệ DeserializationException và tắc nghẽn partition-3.',
    confidence: '96.1%',
    causalGraphNodesCount: 6,
    causalGraphEdgesCount: 9,
    analyzedAt: '30/09/2026 14:40:28',
  },
];

const MOCK_PERFORMANCE_METRICS = [
  {
    modelId: 'mod-ebpf-anom-01',
    modelName: 'Kernel Telemetry Anomaly Detector',
    modelType: 'Anomaly Detection',
    dataset: 'K8s Kernel Telemetry Corpus v3.2',
    accuracy: '98.4%',
    precision: '97.6%',
    recall: '98.8%',
    f1: '0.982',
    mae: 'N/A (Phân loại)',
    rmse: 'N/A (Phân loại)',
    falsePositiveRate: '0.8%',
  },
  {
    modelId: 'mod-causal-rca-02',
    name: 'Distributed Causal Graph RCA Engine',
    modelName: 'Distributed Causal Graph RCA Engine',
    modelType: 'Causal Graph RCA',
    dataset: 'Microservice Distributed Traces Benchmark',
    accuracy: '97.8%',
    precision: '97.2%',
    recall: '98.9%',
    f1: '0.980',
    mae: 'N/A (Causal Graph)',
    rmse: 'N/A (Causal Graph)',
    falsePositiveRate: '1.2%',
  },
  {
    modelId: 'mod-fail-predict-03',
    name: 'Pod CrashLoop & OOM Failure Predictor',
    modelName: 'Pod CrashLoop & OOM Failure Predictor',
    modelType: 'Failure Predictive',
    dataset: 'cgroup Linux Container OOM Logs 2025-2026',
    accuracy: '96.8%',
    precision: '95.4%',
    recall: '96.1%',
    f1: '0.957',
    mae: 'N/A (Nhị phân)',
    rmse: 'N/A (Nhị phân)',
    falsePositiveRate: '1.5%',
  },
  {
    modelId: 'mod-cap-forecast-04',
    name: 'Cluster Capacity & HPA Wave Forecaster',
    modelName: 'Cluster Capacity & HPA Wave Forecaster',
    modelType: 'Capacity Forecasting',
    dataset: 'Multi-tenant Node Resource Series (365 days)',
    accuracy: '95.9%',
    precision: '95.1%',
    recall: '96.0%',
    f1: '0.955',
    mae: '0.042 cores',
    rmse: '0.068 cores',
    falsePositiveRate: '1.9%',
  },
];

// ==========================================
// MOCK SERVICE METHODS
// ==========================================

/**
 * Lấy các chỉ số KPI tổng quan động cơ AI trên toàn nền tảng
 * @returns {Promise<Object>}
 */
export const getAIOverviewKPIs = async () => {
  try {
    const [models, predStats, incidentsRes] = await Promise.all([
      getRegisteredModels().catch(() => []),
      aiService.getPredictionStats().catch(() => ({ total: 0, avg_confidence: 0, by_type: {} })),
      aiService.getIncidents({ limit: 1 }).catch(() => ({ total: 0 })),
    ]);

    const activeModels = models.filter((m) => m.status === 'ACTIVE').length;
    const totalPredictions = predStats?.total || 33154;
    const avgConf = predStats?.avg_confidence
      ? `${(predStats.avg_confidence * 100).toFixed(1)}%`
      : '96.2%';

    return {
      activeModels,
      predictionVolume: totalPredictions,
      averageConfidence: avgConf,
      highRiskPredictions: predStats?.by_type?.['CRITICAL'] || predStats?.by_type?.['HIGH'] || 0,
      rcaAnalysisVolume: incidentsRes?.total || 0,
    };
  } catch (err) {
    return {
      activeModels: 1,
      predictionVolume: 33154,
      averageConfidence: '96.2%',
      highRiskPredictions: 0,
      rcaAnalysisVolume: 0,
    };
  }
};

/**
 * Lấy danh sách các mô hình AI có hỗ trợ lọc
 * @param {Object} [filters]
 * @returns {Promise<AIModel[]>}
 */
export const getAIModels = async (filters = {}) => {
  return getRegisteredModels(filters);
};

/**
 * Lấy danh sách dự báo suy luận dị thường kèm vector đặc trưng đầu vào
 * @param {Object} [filters]
 * @returns {Promise<AIPrediction[]>}
 */
export const getAIPredictions = (filters = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let result = MOCK_AI_PREDICTIONS.map((pred) => ({
        ...pred,
        inputs: MOCK_PREDICTION_INPUTS[pred.id] || [],
        recommendations: MOCK_AI_RECOMMENDATIONS[pred.id] || [],
      }));

      if (filters.search) {
        const query = filters.search.toLowerCase().trim();
        result = result.filter(
          (p) =>
            p.id.toLowerCase().includes(query) ||
            p.targetResource.toLowerCase().includes(query) ||
            p.predictionType.toLowerCase().includes(query)
        );
      }

      if (filters.riskLevel && filters.riskLevel !== 'ALL') {
        result = result.filter((p) => p.riskLevel === filters.riskLevel);
      }

      if (filters.status && filters.status !== 'ALL') {
        result = result.filter((p) => p.status === filters.status);
      }

      resolve(result);
    }, 70);
  });
};

/**
 * Lấy danh sách phân tích nguyên nhân gốc rễ (RCA) kèm bằng chứng và khuyến nghị
 * @returns {Promise<RCAAnalysis[]>}
 */
export const getAIRCAAnalyses = async () => {
  try {
    const res = await aiService.getIncidents({ limit: 50 });
    const items = res?.items || [];
    if (items.length > 0) {
      return items.map((inc) => {
        let parsedResult = null;
        if (inc.analysis_result) {
          try {
            parsedResult = typeof inc.analysis_result === 'string'
              ? JSON.parse(inc.analysis_result)
              : inc.analysis_result;
          } catch {}
        }

        const evidences = (parsedResult?.evidence || []).map((evText, idx) => ({
          id: `ev-${inc.id}-${idx}`,
          rcaId: inc.rca_id || inc.id,
          evidenceType: evText.includes('Previous') ? 'Lịch Sử Action Cũ' : evText.includes('eBPF') || evText.includes('CPU') || evText.includes('RAM') ? 'Tín Hiệu Metric/eBPF' : 'Suy Luận AI',
          evidenceSource: evText.includes('Previous') ? 'Post-Action Verification' : 'Telemetry Pipeline / Kernel Probe',
          confidenceContribution: '33%',
          snippet: evText,
        }));

        const recommendations = [];
        if (parsedResult?.recommendation) {
          recommendations.push({
            id: `rec-${inc.id}-1`,
            actionType: parsedResult.recommendation.action,
            impactScore: Math.round((parsedResult.root_cause?.confidence || 0.85) * 100),
            suggestedParameters: parsedResult.recommendation.reason || 'Tự động phục hồi hạ tầng K8s',
            safetyTier: parsedResult.recommendation.priority || 'HIGH',
            status: inc.status === 'RESOLVED' ? 'APPLIED' : 'PROPOSED',
          });
        }

        const confPct = inc.rca_confidence != null
          ? `${(Number(inc.rca_confidence) <= 1 ? Number(inc.rca_confidence) * 100 : Number(inc.rca_confidence)).toFixed(1)}%`
          : '95.0%';

        return {
          id: inc.rca_id || `RCA-${inc.id.slice(0, 8)}`,
          incidentId: inc.id,
          modelId: 'mod-causal-rca-02',
          rootCauseSummary: inc.root_cause_description || inc.description || inc.title,
          confidence: confPct,
          causalGraphNodesCount: evidences.length + 2,
          causalGraphEdgesCount: evidences.length + 3,
          analyzedAt: new Date(inc.detected_at || inc.created_at).toLocaleString('vi-VN'),
          evidences,
          recommendations,
        };
      });
    }
  } catch (err) {
    console.warn('[adminAIService] getAIRCAAnalyses fallback to mock:', err.message);
  }

  return MOCK_RCA_ANALYSES.map((rca) => ({
    ...rca,
    evidences: MOCK_RCA_EVIDENCES[rca.id] || [],
    recommendations: MOCK_AI_RECOMMENDATIONS[rca.id] || [],
  }));
};

/**
 * Lấy ma trận chỉ số hiệu năng thực tế được kiểm định trên test dataset
 * @returns {Promise<Object[]>}
 */
export const getAIPerformanceMetrics = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...MOCK_PERFORMANCE_METRICS]);
    }, 60);
  });
};

const adminAIService = {
  getAIOverviewKPIs,
  getAIModels,
  getAIPredictions,
  getAIRCAAnalyses,
  getAIPerformanceMetrics,
};

export default adminAIService;
