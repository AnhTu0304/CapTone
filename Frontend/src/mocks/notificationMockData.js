/**
 * Mock data for Notification Center (Frontend-only)
 * Key: selfheal_mock_notifications_v1
 */

export const STORAGE_NOTIFICATIONS_KEY = 'selfheal_mock_notifications_v1';

export const NOTIFICATION_TYPES = {
  SYSTEM: 'SYSTEM',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  SELF_HEALING: 'SELF_HEALING',
  SECURITY: 'SECURITY',
};

export const NOTIFICATION_SEVERITIES = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO',
};

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'NOTIF-2026-001',
    type: NOTIFICATION_TYPES.INFRASTRUCTURE,
    title: 'Yêu cầu phê duyệt khẩn cấp: Tháo tải máy chủ worker-03 (Drain Node)',
    message: 'Hạ tầng phát hiện tải CPU 88% và rò rỉ nhiệt. Cần sự phê duyệt của SME Owner để di dời an toàn 12 Pods.',
    createdAt: '2026-10-19T18:45:00.000Z',
    timestamp: '14 phút trước',
    read: false,
    severity: NOTIFICATION_SEVERITIES.HIGH,
    metadata: {
      environment: 'production-us-east-1',
      cluster: 'k8s-prod-cluster-01',
      resource: 'node/worker-03',
    },
    actionPath: '/dashboard/self-healing/approvals',
    actionText: 'Tới Cổng Phê Duyệt',
  },
  {
    id: 'NOTIF-2026-002',
    type: NOTIFICATION_TYPES.INFRASTRUCTURE,
    title: 'AI Dự báo sớm: Nguy cơ tràn RAM (Memory Leak) tại payment-service',
    message: 'Mô hình chuỗi thời gian phát hiện độ dốc +2.4MB/phút, dự báo bão hòa bộ nhớ trong 18 phút tới.',
    createdAt: '2026-10-19T18:25:00.000Z',
    timestamp: '32 phút trước',
    read: false,
    severity: NOTIFICATION_SEVERITIES.MEDIUM,
    metadata: {
      environment: 'production-us-east-1',
      cluster: 'k8s-prod-cluster-01',
      resource: 'deployment/payment-service',
    },
    actionPath: '/dashboard/ai/predictions',
    actionText: 'Xem Dự Báo AI',
  },
  {
    id: 'NOTIF-2026-003',
    type: NOTIFICATION_TYPES.SELF_HEALING,
    title: 'Tự phục hồi thành công: Khởi động lại Pod order-processor',
    message: 'Sự cố OOMKilled được MAPE-K giải quyết tự động hoàn tất trong 1.4 giây. Trạng thái Pod trở về Healthy 100%.',
    createdAt: '2026-10-19T16:50:00.000Z',
    timestamp: '2 giờ trước',
    read: true,
    severity: NOTIFICATION_SEVERITIES.LOW,
    metadata: {
      environment: 'production-us-east-1',
      cluster: 'k8s-prod-cluster-01',
      resource: 'pod/order-processor-7fd6b8c9-4j2x',
      mttr: '1.4s',
    },
    actionPath: '/dashboard/self-healing/history',
    actionText: 'Xem Nhật Ký MTTR',
  },
  {
    id: 'NOTIF-2026-004',
    type: NOTIFICATION_TYPES.SECURITY,
    title: 'Cảnh báo bảo mật: Phát hiện đăng nhập từ dải IP quản trị mới',
    message: 'Phiên đăng nhập quản trị viên phát hiện từ 118.69.182.10 (Hà Nội, VN). Kiểm tra bảo mật 2FA đã được kích hoạt thành công.',
    createdAt: '2026-10-19T15:10:00.000Z',
    timestamp: '4 giờ trước',
    read: false,
    severity: NOTIFICATION_SEVERITIES.HIGH,
    metadata: {
      environment: 'global',
      ip: '118.69.182.10',
      action: 'ADMIN_LOGIN_SUCCESS',
    },
    actionPath: '/dashboard/settings',
    actionText: 'Kiểm Tra 2FA',
  },
  {
    id: 'NOTIF-2026-005',
    type: NOTIFICATION_TYPES.SYSTEM,
    title: 'Đồng bộ hóa tác tử eBPF Agent thành công trên cụm',
    message: 'Tác tử selfheal-agent-worker-02 đã tự động nâng cấp cấu hình giám sát kernel v1.4.2 không gây gián đoạn tải.',
    createdAt: '2026-10-19T14:00:00.000Z',
    timestamp: '5 giờ trước',
    read: true,
    severity: NOTIFICATION_SEVERITIES.INFO,
    metadata: {
      environment: 'production-us-east-1',
      cluster: 'k8s-prod-cluster-01',
      agent: 'selfheal-agent-worker-02',
    },
    actionPath: '/dashboard/agents',
    actionText: 'Xem Tác Tử Agent',
  },
  {
    id: 'NOTIF-2026-006',
    type: NOTIFICATION_TYPES.INFRASTRUCTURE,
    title: 'Cảnh báo dung lượng Disk I/O bão hòa trên storage-node-01',
    message: 'Dung lượng ổ đĩa NVMe PVC của cụm cơ sở dữ liệu telemetry chạm ngưỡng cảnh báo 86%.',
    createdAt: '2026-10-19T11:30:00.000Z',
    timestamp: '8 giờ trước',
    read: true,
    severity: NOTIFICATION_SEVERITIES.MEDIUM,
    metadata: {
      environment: 'production-us-east-1',
      cluster: 'k8s-prod-cluster-01',
      resource: 'pvc/telemetry-storage-pvc',
    },
    actionPath: '/dashboard/infrastructure',
    actionText: 'Xem Hạ Tầng',
  },
  {
    id: 'NOTIF-2026-007',
    type: NOTIFICATION_TYPES.SELF_HEALING,
    title: 'Tự động mở rộng quy mô (Auto-scale) cho auth-service',
    message: 'Lưu lượng API đột biến kích hoạt Horizontal Pod Autoscaler, nâng số Pod từ 3 lên 6 bản sao trong 42 giây.',
    createdAt: '2026-10-19T09:15:00.000Z',
    timestamp: '10 giờ trước',
    read: true,
    severity: NOTIFICATION_SEVERITIES.LOW,
    metadata: {
      environment: 'production-us-east-1',
      cluster: 'k8s-prod-cluster-01',
      resource: 'hpa/auth-service-hpa',
    },
    actionPath: '/dashboard/workloads',
    actionText: 'Xem Workloads',
  },
  {
    id: 'NOTIF-2026-008',
    type: NOTIFICATION_TYPES.SECURITY,
    title: 'Thu hồi khóa truy cập API token hết hạn sử dụng',
    message: 'Khóa API Token "CI-Deployer-Key-v1" đã hết hạn 90 ngày và tự động chuyển sang trạng thái REVOKED.',
    createdAt: '2026-10-18T22:00:00.000Z',
    timestamp: '1 ngày trước',
    read: true,
    severity: NOTIFICATION_SEVERITIES.INFO,
    metadata: {
      tokenId: 'TOK-CI-01',
      status: 'REVOKED',
    },
    actionPath: '/dashboard/settings',
    actionText: 'Quản Lý Khóa API',
  },
  {
    id: 'NOTIF-2026-009',
    type: NOTIFICATION_TYPES.SYSTEM,
    title: 'Tạo bản sao lưu Snapshot cấu hình hạ tầng K8s định kỳ',
    message: 'Bản lưu trữ cấu hình etcd và manifest deployments đã được xuất thành công sang kho lưu trữ đám mây an toàn.',
    createdAt: '2026-10-18T18:00:00.000Z',
    timestamp: '1 ngày trước',
    read: true,
    severity: NOTIFICATION_SEVERITIES.INFO,
    metadata: {
      snapshotId: 'SNP-2026-1018-01',
      size: '142 MB',
    },
    actionPath: '/dashboard/audit-logs',
    actionText: 'Xem Nhật Ký Kiểm Toán',
  },
];

export const getStoredNotifications = () => {
  try {
    const raw = localStorage.getItem(STORAGE_NOTIFICATIONS_KEY);
    if (!raw) return INITIAL_NOTIFICATIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return INITIAL_NOTIFICATIONS;
  } catch {
    return INITIAL_NOTIFICATIONS;
  }
};

export const saveStoredNotifications = (notifications) => {
  try {
    localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (err) {
    console.warn('Could not persist notifications to localStorage:', err);
  }
};
