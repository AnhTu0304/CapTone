/**
 * Admin Overview Service Layer
 * Decoupled data service for Platform Health Dashboard (/admin/overview)
 * Provides snapshot-based data models with zero fake animations or inline mock data in JSX.
 */

export const SCOPE_OPTIONS = {
  organizations: [
    { id: 'acme-corp', name: 'Acme Infrastructure Corp (Chính)' },
    { id: 'global-retail', name: 'Global Retail SME Ltd' },
    { id: 'fintech-node', name: 'Fintech Payments Group' },
  ],
  environments: [
    { id: 'all', name: 'Mọi Môi Trường (All Envs)' },
    { id: 'production', name: 'Production (Sản Xuất)' },
    { id: 'staging', name: 'Staging (Kiểm Thử)' },
    { id: 'dev', name: 'Development (Phát Triển)' },
  ],
  clusters: [
    { id: 'all', name: 'Tất Cả Cụm Máy Chủ (3 Cụm)' },
    { id: 'k8s-prod-01', name: 'k8s-prod-cluster-01 (Mỹ - US East)' },
    { id: 'k8s-staging-01', name: 'k8s-staging-cluster-01 (Mỹ - US East)' },
    { id: 'k8s-dev-01', name: 'k8s-dev-cluster-01 (Singapore - AP SE)' },
    // Test state clusters for verification
    { id: 'cluster-disconnected', name: '[Mô Phỏng] Cụm Mất Kết Nối (Disconnected)' },
    { id: 'cluster-no-data', name: '[Mô Phỏng] Cụm Chưa Có Viễn Trắc (No-Data)' },
    { id: 'cluster-error', name: '[Mô Phỏng] Cụm Gặp Lỗi Máy Chủ (Error)' },
  ],
  timeRanges: [
    { id: '1h', name: '1 Giờ Qua' },
    { id: '6h', name: '6 Giờ Qua' },
    { id: '24h', name: '24 Giờ Qua' },
    { id: '7d', name: '7 Ngày Qua' },
    { id: '30d', name: '30 Ngày Qua' },
    { id: 'empty-range', name: '[Mô Phỏng] Khoảng Trống (Empty Data)' },
  ],
};

const BASE_OVERVIEW_DATA = {
  kpi: {
    uptime: { value: '99.98%', diff: '+0.08%', status: 'positive', label: 'Cam kết SLA 99.90%' },
    selfHealingRate: { value: '94.2%', diff: '+2.4%', status: 'positive', label: 'MTTR trung bình 1.4s' },
    activeIncidents: { value: '1 Khẩn Cấp', diff: '-2 so với 24h trước', status: 'critical', label: '1 Critical • 2 Major' },
    managedResources: { value: '12 Nodes / 186 Pods', diff: '100% Sẵn sàng', status: 'neutral', label: '96 CPU Cores • 384 GB RAM' },
  },
  platformHealth: [
    { id: 'control-plane', name: 'K8s Control Plane API', status: 'healthy', latency: '2.4ms', detail: '3/3 Master Nodes Quorum đạt 100%' },
    { id: 'ebpf-pipeline', name: 'Đường Truyền Viễn Trắc eBPF', status: 'healthy', latency: '1.1ms', detail: 'Ring Buffer không nghẽn, mất mát 0%' },
    { id: 'mape-k-engine', name: 'Động Cơ Tự Trị AI MAPE-K', status: 'healthy', latency: '12.8ms', detail: 'Vòng lặp Monitor-Analyze-Plan-Execute ổn định' },
    { id: 'audit-ledger', name: 'Sổ Cái Kiểm Toán Bất Biến', status: 'healthy', latency: '0.8ms', detail: 'Chữ ký băm SHA-256 đối chiếu 100% khớp' },
    { id: 'webhook-dispatcher', name: 'Bộ Điều Phối Cảnh Báo Webhook', status: 'healthy', latency: '45ms', detail: 'Slack, Teams & PagerDuty hoạt động tốt' },
  ],
  infrastructure: {
    cpuUsage: 44,
    ramUsage: 68,
    diskUsage: 52,
    networkRx: '1.2 GB/s',
    networkTx: '890 MB/s',
    nodesDistribution: {
      ready: 10,
      cordoned: 1,
      draining: 1,
      total: 12,
    },
    topNodes: [
      { name: 'worker-01 (Prod)', cpu: 58, ram: 74, pods: 28, status: 'Ready' },
      { name: 'worker-02 (Prod)', cpu: 62, ram: 82, pods: 31, status: 'Ready' },
      { name: 'worker-03 (Prod)', cpu: 88, ram: 91, pods: 12, status: 'Cordoned' },
      { name: 'staging-01', cpu: 32, ram: 48, pods: 18, status: 'Ready' },
    ],
  },
  organizationGrowth: {
    totalOrganizations: 18,
    totalClusters: 24,
    activePolicies: 142,
    activeEngineers: 64,
    monthlyTenantsGrowth: '+3 Tổ Chức Mới Trong Tháng',
    adoptionRate: '88% Cụm Đã Bật Chế Độ Tự Lành Tự Động',
  },
  incidentAnalytics: {
    bySeverity: [
      { severity: 'CRITICAL', count: 4, percentage: 8, color: '#DC2626' },
      { severity: 'MAJOR', count: 12, percentage: 24, color: '#D97706' },
      { severity: 'MINOR', count: 26, percentage: 52, color: '#0284C7' },
      { severity: 'INFO', count: 8, percentage: 16, color: '#64748B' },
    ],
    topCauses: [
      { cause: 'Cạn Kiệt RAM (Linux OOM-Killer)', count: 18, percentage: 36 },
      { cause: 'Nghẽn Bộ Đệm Kafka Consumer Buffer', count: 14, percentage: 28 },
      { cause: 'CPU Throttling Giới Hạn Container', count: 11, percentage: 22 },
      { cause: 'Trễ Phản Hồi Database Connection Pool', count: 7, percentage: 14 },
    ],
    averageMttrSec: 1.4,
  },
  selfHealingAnalytics: {
    totalExecutedActions: 270,
    breakdown: [
      { action: 'Rolling Patch (Bộ Nhớ / Giới Hạn CPU)', count: 84, color: '#059669' },
      { action: 'Khởi Động Lại Pod Liveness Thất Bại', count: 142, color: '#10B981' },
      { action: 'Mở Rộng Horizontal Pod Autoscaling (HPA)', count: 38, color: '#0284C7' },
      { action: 'Cordon & Drain Node Có Nguy Cơ', count: 6, color: '#D97706' },
    ],
    autonomousPercentage: 94.2,
    hitlApprovalPercentage: 5.8,
    falsePositiveRate: '0.4%',
  },
  aiOverview: {
    engineVersion: 'MAPE-K Autonomous Engine v2.4-LTS',
    predictionAccuracy: '99.2%',
    earlyCatchRate: '92.6% Dị thường được đón đầu trước khi vi phạm SLO',
    activeCausalGraphs: 3,
    pendingRecommendations: 2,
    recommendations: [
      {
        id: 'REC-01',
        title: 'Tăng Hạn Mức RAM 2048MiB -> 4096MiB cho payment-service',
        confidence: '98.5%',
        rationale: 'Ngăn ngừa tái diễn biến cố OOM-Killer vào các đợt flash sale',
      },
      {
        id: 'REC-02',
        title: 'Cập nhật HPA Min Replicas từ 2 lên 3 cho auth-service',
        confidence: '95.2%',
        rationale: 'Hạ tải CPU peak lúc 09:00 - 10:00 sáng các ngày làm việc',
      },
    ],
  },
  agentHealth: {
    daemonSetStatus: '12 / 12 Máy Chủ Đang Chạy Tác Tử',
    compatibility: '100% Kernel Linux 5.4+ CO-RE',
    averageLatency: '1.1ms',
    probes: [
      { node: 'worker-01', version: 'v1.4.2', kernel: '5.15.0-89-generic', status: 'Online', latency: '1.0ms' },
      { node: 'worker-02', version: 'v1.4.2', kernel: '5.15.0-89-generic', status: 'Online', latency: '1.2ms' },
      { node: 'worker-03', version: 'v1.4.2', kernel: '5.15.0-89-generic', status: 'Online', latency: '1.4ms' },
      { node: 'staging-01', version: 'v1.4.2', kernel: '5.15.0-88-generic', status: 'Online', latency: '0.9ms' },
    ],
  },
  criticalIncidents: [
    {
      id: 'INC-2026-081',
      service: 'payment-service',
      cluster: 'k8s-prod-cluster-01',
      severity: 'CRITICAL',
      title: 'OOMKilled do rò rỉ bộ nhớ hàng đợi giao dịch batch queue',
      duration: '4 phút',
      status: 'ĐANG ĐIỀU TRA & VÁ LỖI',
      statusColor: '#EF4444',
    },
    {
      id: 'INC-2026-079',
      service: 'worker-03',
      cluster: 'k8s-prod-cluster-01',
      severity: 'MAJOR',
      title: 'CPU vượt ngưỡng 88% và phát sinh độ trễ eBPF probe',
      duration: '18 phút',
      status: 'CHỜ DUYỆT HITL CORDON',
      statusColor: '#D97706',
    },
    {
      id: 'INC-2026-077',
      service: 'api-gateway',
      cluster: 'k8s-prod-cluster-01',
      severity: 'MAJOR',
      title: 'Đột biến lưu lượng 14,200 req/s gây tăng thời gian chờ P99',
      duration: '42 phút',
      status: 'ĐÃ TỰ PHỤC HỒI THÀNH CÔNG',
      statusColor: '#059669',
    },
  ],
  recentActivity: [
    {
      id: 'ACT-901',
      actor: 'MAPE-K Autonomous Engine',
      action: 'Vá cấu hình tự động (Rolling Patch Memory)',
      target: 'payment-service-pod-7f8d',
      time: '2 phút trước',
      hash: 'sha256:8f4b1...e901',
      status: 'SUCCESS',
    },
    {
      id: 'ACT-900',
      actor: 'Quản Trị Viên (SME Owner)',
      action: 'Ký duyệt Cordon & Drain máy chủ',
      target: 'Node/worker-03',
      time: '14 phút trước',
      hash: 'sha256:3a1b9...c482',
      status: 'APPROVED',
    },
    {
      id: 'ACT-899',
      actor: 'eBPF DaemonSet Agent',
      action: 'Phát hiện dị thường tiêu thụ RSS Memory',
      target: 'container/payment-service',
      time: '22 phút trước',
      hash: 'sha256:7c9e2...d110',
      status: 'DETECTED',
    },
    {
      id: 'ACT-898',
      actor: 'Hệ Thống K8s Control Plane',
      action: 'Khởi tạo Pod thay thế trên worker-02',
      target: 'pod/order-service-99x',
      time: '38 phút trước',
      hash: 'sha256:1b4d0...f552',
      status: 'SUCCESS',
    },
  ],
};

/**
 * Fetch Admin Overview Snapshot
 * @param {Object} scope - { orgId, env, clusterId, timeRange }
 * @returns {Promise<Object>}
 */
export const fetchAdminOverview = (scope = {}) => {
  return new Promise((resolve, reject) => {
    // Simulate brief network latency without fake live ticking
    setTimeout(() => {
      // 1. Error state simulation
      if (scope.clusterId === 'cluster-error') {
        return reject(new Error('Lỗi kết nối máy chủ dữ liệu quản trị (HTTP 503 Service Unavailable). Vui lòng thử lại.'));
      }

      // 2. Disconnected state simulation
      if (scope.clusterId === 'cluster-disconnected') {
        return resolve({
          status: 'disconnected',
          timestamp: new Date().toLocaleString('vi-VN', { hour12: false }),
          message: 'Mất kết nối với cụm máy chủ hoặc tác tử eBPF. Vui lòng kiểm tra trạng thái mạng của Kubelet.',
          data: null,
        });
      }

      // 3. No-data state simulation
      if (scope.clusterId === 'cluster-no-data') {
        return resolve({
          status: 'no-data',
          timestamp: new Date().toLocaleString('vi-VN', { hour12: false }),
          message: 'Cụm máy chủ chưa kích hoạt luồng viễn trắc eBPF hoặc chưa triển khai DaemonSet.',
          data: null,
        });
      }

      // 4. Empty state simulation
      if (scope.timeRange === 'empty-range') {
        return resolve({
          status: 'empty',
          timestamp: new Date().toLocaleString('vi-VN', { hour12: false }),
          message: 'Không có ghi nhận viễn trắc hoặc sự cố nào trong khoảng thời gian đã chọn.',
          data: {
            ...BASE_OVERVIEW_DATA,
            criticalIncidents: [],
            recentActivity: [],
            incidentAnalytics: {
              ...BASE_OVERVIEW_DATA.incidentAnalytics,
              bySeverity: [],
              topCauses: [],
            },
          },
        });
      }

      // 5. Normal ready state with real snapshot timestamp
      const snapshotTimestamp = new Date().toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      resolve({
        status: 'ready',
        timestamp: snapshotTimestamp,
        data: BASE_OVERVIEW_DATA,
      });
    }, 120);
  });
};

const adminOverviewService = {
  SCOPE_OPTIONS,
  fetchAdminOverview,
};

export default adminOverviewService;
