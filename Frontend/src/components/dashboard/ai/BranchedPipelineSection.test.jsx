import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AIPipelineFlowCanvas from './AIPipelineFlowCanvas';
import {
  BRANCHED_ACTIONS,
  BRANCHED_CONTEXT_AGENTS,
  BRANCHED_ROOT_CAUSES,
} from './BranchedPipelineCatalog';

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    constructor(cb) {
      this.cb = cb;
    }
    observe() {
      this.cb([{ contentRect: { width: 1440, height: 860 } }]);
    }
    disconnect() {}
  };
});

describe('Diagram 2 Branched Pipeline Architecture (Full 01->03 + 4 Agents -> 16 Root Causes -> 10 Actions -> 07)', () => {
  test('catalog maintains exact counts: 4 independent context agents, 16 root causes, 10 actions', () => {
    expect(BRANCHED_CONTEXT_AGENTS).toHaveLength(4);
    expect(BRANCHED_ROOT_CAUSES).toHaveLength(16);
    expect(BRANCHED_ACTIONS).toHaveLength(10);

    expect(new Set(BRANCHED_ROOT_CAUSES.map((c) => c.code)).size).toBe(16);
    expect(new Set(BRANCHED_ACTIONS.map((a) => a.code)).size).toBe(10);
  });

  test('renders full Diagram 2 front+branched stages underneath Diagram 1, expands all stages, and simulates end-to-end flow', () => {
    render(
      <AIPipelineFlowCanvas
        selectedService="ecommerce-store-app"
        isAgentConnected={true}
        isFullScreen={true}
        showExtendedPipeline={true}
        defaultViewMode="gru"
        podCount={2}
      />
    );

    // Ban đầu đang ở Sơ đồ 1 -> hiển thị Sơ đồ 1 và chưa hiển thị Sơ đồ 2
    expect(screen.getByText('Multi-Agent RCA')).toBeInTheDocument();
    expect(screen.getByText(/Rule Engine — 6 Luật Ngưỡng Tĩnh & K8s Reactive/i)).toBeInTheDocument();
    expect(screen.queryByTestId('branched-pipeline-section')).not.toBeInTheDocument();

    // Nút chuyển giữa Sơ đồ 1 và Sơ đồ 2 trên toolbar
    const switchDiagram1Btn = screen.getByTestId('switch-diagram-1');
    const switchDiagram2Btn = screen.getByTestId('switch-diagram-2');
    expect(switchDiagram1Btn).toBeInTheDocument();
    expect(switchDiagram2Btn).toBeInTheDocument();

    // Chuyển sang Sơ đồ 2 -> Sơ đồ 2 hiển thị đầy đủ, Sơ đồ 1 ẩn gọn đi
    fireEvent.click(switchDiagram2Btn);
    expect(screen.getByTestId('branched-pipeline-section')).toBeInTheDocument();
    expect(screen.queryByText('Multi-Agent RCA')).not.toBeInTheDocument();

    // Khối 00 Target Service ở đầu luồng + 2 rãnh thu thập Log/K8s Event
    expect(screen.getByTestId('d2-service-node')).toBeInTheDocument();
    expect(screen.getByTestId('d2-service-node').textContent).toMatch(/ecommerce-store-app/i);
    expect(screen.getByTestId('d2-pill-00')).toBeInTheDocument();
    expect(screen.getByTestId('d2-collector-log-rail')).toBeInTheDocument();
    expect(screen.getByTestId('d2-collector-k8s-rail')).toBeInTheDocument();

    // Đoạn đầu đầy đủ của Sơ đồ 2 (01 Viễn trắc, 02 AI Hub, Rule Engine hàng ngang, 03 7 Đầu Rủi Ro)
    expect(screen.getByTestId('d2-telemetry-compact')).toBeInTheDocument();
    expect(screen.getByTestId('d2-rule-compact')).toBeInTheDocument();
    expect(screen.getByTestId('d2-pill-RULE')).toBeInTheDocument();
    expect(screen.getByTestId('d2-risks-compact')).toBeInTheDocument();

    // 4 Agent độc lập tách rời
    expect(screen.getByTestId('d2-agent-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('d2-agent-log')).toBeInTheDocument();
    expect(screen.getByTestId('d2-agent-k8s_event')).toBeInTheDocument();
    expect(screen.getByTestId('d2-agent-history')).toBeInTheDocument();

    // Mở rộng toàn bộ cả 8 Metrics + 6 Luật + 7 Rủi ro + 16 Nguyên nhân + 10 Action bằng 1 nút hoặc từng nút
    fireEvent.click(screen.getByTestId('d2-toggle-all-btn'));
    expect(screen.getByTestId('d2-metric-cpu')).toBeInTheDocument();
    expect(screen.getByTestId('d2-metric-replica_count')).toBeInTheDocument();
    expect(screen.getByTestId('d2-rule-R1')).toBeInTheDocument();
    expect(screen.getByTestId('d2-rule-R6')).toBeInTheDocument();
    expect(screen.getByTestId('d2-risk-cpu_overload')).toBeInTheDocument();
    expect(screen.getByTestId('d2-risk-scale_down')).toBeInTheDocument();

    BRANCHED_ROOT_CAUSES.forEach((c) => {
      expect(screen.getByTestId(`d2-cause-${c.code}`)).toBeInTheDocument();
    });
    BRANCHED_ACTIONS.forEach((a) => {
      expect(screen.getByTestId(`d2-action-${a.code}`)).toBeInTheDocument();
    });

    // Click thử 'deployment_failure' -> Rule R4/R5 sáng, ROLLBACK_DEPLOYMENT & cổng HITL sáng
    fireEvent.click(screen.getByTestId('d2-cause-deployment_failure'));
    expect(screen.getByTestId('d2-mode-badge').textContent).toMatch(/Mô phỏng: .*ROLLBACK_DEPLOYMENT/i);
    expect(screen.getByTestId('d2-cause-deployment_failure').textContent).toMatch(/MÔ PHỎNG/i);
    expect(screen.getByTestId('d2-action-ROLLBACK_DEPLOYMENT').textContent).toMatch(/ĐANG CHỌN/i);
    expect(screen.getByTestId('d2-gate-HITL').textContent).toMatch(/LUỒNG ĐANG CHẠY QUA ĐÂY/i);
    expect(screen.getByTestId('d2-rule-R4').textContent).toMatch(/VI PHẠM/i);

    // Click thử 'cpu_saturation' -> SCALE_REPLICAS & cổng AUTO + Rule R1
    fireEvent.click(screen.getByTestId('d2-cause-cpu_saturation'));
    expect(screen.getByTestId('d2-cause-cpu_saturation').textContent).toMatch(/MÔ PHỎNG/i);
    expect(screen.getByTestId('d2-action-SCALE_REPLICAS').textContent).toMatch(/ĐANG CHỌN/i);
    expect(screen.getByTestId('d2-gate-AUTO').textContent).toMatch(/LUỒNG ĐANG CHẠY QUA ĐÂY/i);
    expect(screen.getByTestId('d2-rule-R1').textContent).toMatch(/VI PHẠM/i);

    // Chuyển Hậu kiểm 60s sang "Chưa phục hồi" -> Re-RCA & Leo thang Cấp 2 sang RESTART_POD
    fireEvent.click(screen.getByTestId('d2-verify-unrecovered-btn'));
    expect(screen.getByTestId('d2-verify-card').textContent).toMatch(/CHƯA HỒI PHỤC/i);
    expect(screen.getByTestId('d2-action-RESTART_POD').textContent).toMatch(/LEO THANG CẤP 2/i);
    expect(screen.getByTestId('d2-action-SCALE_REPLICAS').textContent).toMatch(/CẤP 1 \(CHƯA ĐẠT\)/i);

    // Chuyển lại "Đã phục hồi" -> quay lại SCALE_REPLICAS & Auto-Resolve
    fireEvent.click(screen.getByTestId('d2-verify-recovered-btn'));
    expect(screen.getByTestId('d2-verify-card').textContent).toMatch(/ĐÃ HỒI PHỤC/i);
    expect(screen.getByTestId('d2-action-SCALE_REPLICAS').textContent).toMatch(/ĐANG CHỌN/i);

    // Click 'database_cache_utilization' -> NO_ACTION & cổng AUDIT
    fireEvent.click(screen.getByTestId('d2-cause-database_cache_utilization'));
    expect(screen.getByTestId('d2-action-NO_ACTION').textContent).toMatch(/ĐANG CHỌN/i);
    expect(screen.getByTestId('d2-gate-AUDIT').textContent).toMatch(/LUỒNG ĐANG CHẠY QUA ĐÂY/i);

    // Thoát mô phỏng về Live
    fireEvent.click(screen.getByTestId('d2-back-to-live-btn'));
    expect(screen.getByTestId('d2-mode-badge').textContent).toMatch(/Dữ liệu thực \(Live\)/i);

    // Chuyển ngược về Sơ đồ 1 -> hiển thị lại Sơ đồ 1 nguyên vẹn
    fireEvent.click(switchDiagram1Btn);
    expect(screen.getByText('Multi-Agent RCA')).toBeInTheDocument();
    expect(screen.queryByTestId('branched-pipeline-section')).not.toBeInTheDocument();
  });

  test('Diagram 2 live Circuit Breaker / UNKNOWN / NO_ACTION state stays consistent with Diagram 1', () => {
    const mockPipelineContext = {
      openServiceIncidentsCount: 2,
      totalServiceIncidentsCount: 5,
      activePoliciesCount: 7,
      autoPoliciesCount: 5,
      hitlPoliciesCount: 2,
      pendingServiceApprovalsCount: 0,
      isCircuitBreakerTripped: true,
      policyMeta: { cooldownSec: 60 },
      latestIncident: {
        id: 'inc-unknown-1',
        root_cause: 'UNKNOWN',
        root_cause_category: 'UNKNOWN',
        severity: 'LOW',
        status: 'OPEN',
        description: 'Chưa xác định nguyên nhân trên ecommerce-store-app',
      },
      latestRecommendation: {
        action: 'NO_ACTION',
        reasoning: 'Chỉ số tải ở mức thấp kéo dài, thu hẹp số lượng replica (về 2 replicas) để tối ưu hóa tài nguyên',
      },
      latestAutoAction: {
        id: 'act-prev-scale',
        action: 'SCALE_REPLICAS',
        status: 'SUCCEEDED',
      },
      rcaAgentsSummary: {
        metricsSub: '12 bước thực',
        logSub: '0 lỗi log',
        k8sEventSub: 'Không bất thường',
        historySub: '5 lịch sử DV',
        rcaConfidencePct: 30,
      },
      recoveryStats: {
        totalActions: 15,
        succeededCount: 5,
        failedCount: 10,
        successRate: 33,
      },
      actionTimeline: [],
    };

    const mockSeriesSummaries = [
      { key: 'cpu', latest: '12.5', avg: '12.0', max: '15.0' },
      { key: 'ram', latest: '44.0', avg: '43.5', max: '46.0' },
      { key: 'disk', latest: '30.0', avg: '30.0', max: '30.5' },
      { key: 'latency', latest: '45', avg: '42', max: '60' },
      { key: 'http_5xx_rate', latest: '0.0', avg: '0.0', max: '0.0' },
      { key: 'pod_restart_count', latest: '0', avg: '0', max: '0' },
      { key: 'replica_count', latest: '2', avg: '2', max: '2' },
    ];

    render(
      <AIPipelineFlowCanvas
        selectedService="ecommerce-store-app"
        isAgentConnected={true}
        isFullScreen={true}
        showExtendedPipeline={true}
        defaultViewMode="gru"
        podCount={2}
        seriesSummaries={mockSeriesSummaries}
        pipelineContext={mockPipelineContext}
      />
    );

    // Sơ đồ 1: hiển thị NO_ACTION (Ngắt mạch), 15 đã thử (24h), 33%
    expect(screen.getByText(/Giám sát an toàn \(Ngắt mạch\)/i)).toBeInTheDocument();
    expect(screen.getByText(/15 đã thử \(24h\)/i)).toBeInTheDocument();
    expect(screen.getByText(/33%/i)).toBeInTheDocument();

    // Chuyển sang Sơ đồ 2 và mở rộng tất cả nhánh
    fireEvent.click(screen.getByTestId('switch-diagram-2'));
    fireEvent.click(screen.getByTestId('d2-toggle-all-btn'));

    // Đồng bộ Action & Policy Gate: NO_ACTION + AUDIT sáng, KHÔNG lấy SCALE_REPLICAS / AUTO cũ
    expect(screen.getByTestId('d2-cause-unknown').textContent).toMatch(/ĐANG CHẠY/i);
    expect(screen.getByTestId('d2-action-NO_ACTION').textContent).toMatch(/ĐANG CHỌN/i);
    expect(screen.getByTestId('d2-action-SCALE_REPLICAS').textContent).not.toMatch(/ĐANG CHỌN/i);
    expect(screen.getByTestId('d2-gate-AUDIT').textContent).toMatch(/LUỒNG ĐANG CHẠY QUA ĐÂY/i);
    expect(screen.getByTestId('d2-gate-AUTO').textContent).not.toMatch(/LUỒNG ĐANG CHẠY QUA ĐÂY/i);

    // Không hiển thị nhầm lý do Scale-Down cũ khi đang NO_ACTION
    expect(screen.getByTestId('branched-pipeline-section').textContent).not.toMatch(/thu hẹp số lượng replica/i);

    // Log Agent (0 lỗi log) và K8s Event Agent (Không bất thường) hiển thị 'Đã quét (0 lỗi)', không gắn sai 'Có bằng chứng'
    expect(screen.getByTestId('d2-agent-metrics').textContent).toMatch(/Có bằng chứng/i);
    expect(screen.getByTestId('d2-agent-log').textContent).toMatch(/Đã quét \(0 lỗi\)/i);
    expect(screen.getByTestId('d2-agent-log').textContent).not.toMatch(/Có bằng chứng/i);
    expect(screen.getByTestId('d2-agent-k8s_event').textContent).toMatch(/Đã quét \(0 lỗi\)/i);
    expect(screen.getByTestId('d2-agent-k8s_event').textContent).not.toMatch(/Có bằng chứng/i);

    // 07 Hậu Kiểm 60s đồng bộ stats thực tế 24h & trạng thái ngắt mạch
    expect(screen.getByTestId('d2-verify-status-badge').textContent).toMatch(/15 THỬ • NGẮT MẠCH/i);
    expect(screen.getByTestId('d2-verify-live-stats').textContent).toMatch(/24h \(15 thử\): 5 phục hồi • 10 chưa/i);
    expect(screen.getByTestId('d2-verify-live-stats').textContent).toMatch(/33%/i);
  });

  test('Diagram 2 does NOT light up fake RESTART_POD / AUTO branch when only GRU OOM risk triggers with zero open incidents', () => {
    render(
      <AIPipelineFlowCanvas
        selectedService="ecommerce-store-app"
        isAgentConnected={true}
        isFullScreen={true}
        showExtendedPipeline={true}
        defaultViewMode="gru"
        podCount={2}
        prediction={{
          prediction_type: 'OOM',
          confidence_score: 0.84,
          risk_outputs: {
            CPU_OVERLOAD: { confidence: 0.12 },
            OOM: { confidence: 0.84 },
            HIGH_LATENCY: { confidence: 0.87 },
            DISK_FULL: { confidence: 0.1 },
            HTTP_5XX_SPIKE: { confidence: 0.0 },
            TRAFFIC_OVERLOAD: { confidence: 0.25 },
            SCALE_DOWN_CANDIDATE: { confidence: 0.0 },
          },
        }}
        seriesSummaries={[
          { key: 'cpu', latest: '22.0', avg: '20.0', max: '25.0' },
          { key: 'ram', latest: '72.0', avg: '68.0', max: '74.0' },
          { key: 'disk', latest: '30.0', avg: '30.0', max: '30.0' },
          { key: 'latency', latest: '950', avg: '700', max: '1200' },
          { key: 'http_5xx_rate', latest: '0.0', avg: '0.0', max: '0.0' },
          { key: 'pod_restart_count', latest: '0', avg: '0', max: '0' },
          { key: 'replica_count', latest: '2', avg: '2', max: '2' },
        ]}
        pipelineContext={{
          openServiceIncidentsCount: 0,
          totalServiceIncidentsCount: 0,
          latestIncident: null,
          latestRecommendation: null,
          latestAutoAction: null,
          isCircuitBreakerTripped: false,
          recoveryStats: { totalActions: 0, succeededCount: 0, failedCount: 0, successRate: null },
          actionTimeline: [],
        }}
      />
    );

    // Sơ đồ 1: 0 sự cố đang mở, đang thu thập viễn trắc RCA và không tự can thiệp
    expect(screen.getByText(/Sự cố đang mở:/i)).toBeInTheDocument();
    expect(screen.getByText(/Đang thu thập viễn trắc/i)).toBeInTheDocument();
    expect(screen.getByText(/Duy trì hoạt động bình thường \(Không can thiệp\)/i)).toBeInTheDocument();

    // Chuyển sang Sơ đồ 2 và mở rộng tất cả
    fireEvent.click(screen.getByTestId('switch-diagram-2'));
    fireEvent.click(screen.getByTestId('d2-toggle-all-btn'));

    // Chế độ hiển thị đang gom ngữ cảnh RCA (0 sự cố), KHÔNG tự bật RESTART_POD / AUTO
    expect(screen.getByTestId('d2-mode-badge').textContent).toMatch(/Đang gom RCA \(0 sự cố\)/i);
    expect(screen.getByTestId('d2-risk-oom_risk').textContent).toMatch(/84%/i);
    expect(screen.getByTestId('d2-agent-metrics').textContent).toMatch(/Đang thu thập/i);
    expect(screen.getByTestId('d2-cause-memory_exhaustion').textContent).not.toMatch(/ĐANG CHẠY/i);
    expect(screen.getByTestId('d2-action-RESTART_POD').textContent).not.toMatch(/ĐANG CHỌN/i);
    expect(screen.getByTestId('d2-gate-AUTO').textContent).not.toMatch(/LUỒNG ĐANG CHẠY QUA ĐÂY/i);
    expect(screen.getByTestId('d2-gate-AUTO').textContent).toMatch(/Trạng thái chờ/i);
  });
});
