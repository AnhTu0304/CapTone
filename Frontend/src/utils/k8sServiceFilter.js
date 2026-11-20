/**
 * Chuẩn hóa tên dịch vụ Kubernetes đang chạy thực tế trên cụm.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const normalizeK8sServiceName = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  s = s
    .replace(/^(Deployment|StatefulSet|DaemonSet|Pod|Service|Workload)\s*[:/]\s*/i, '')
    .replace(/^dịch vụ\s+/i, '')
    .replace(/^service\s+/i, '')
    .replace(/^pod[/:]\s*/i, '');
  s = s.replace(/['".,;:)]+$/, '').replace(/^['"(]+/, '').trim();
  if (!s || s === '-' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return null;

  const lower = s.toLowerCase();
  if (lower === 'ecommerce-store') return 'ecommerce-store-app';
  if (/^mongodb-\d+$/i.test(lower)) return 'mongodb';
  if (lower === 'otel-collector-opentelemetry-collector') return 'opentelemetry-collector';
  if (lower === 'prometheus-kube-state-metrics') return 'kube-state-metrics';
  if (lower === 'prometheus-kube-prometheus-operator') return 'kube-prometheus-stack-operator';
  if (lower === 'prometheus-prometheus-node-exporter') return 'prometheus-node-exporter';

  if (UUID_REGEX.test(s) || s.includes('-0000-')) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,80}$/.test(s)) return null;
  return s;
};

export const isExcludedSystemService = (rawName) => {
  // Option 3: Không loại trừ bất kỳ service nào
  return false;
};

/**
 * Chuẩn hóa danh sách workloads sống trả về từ GET /api/v1/ai/workloads (đã lọc deleted_at IS NULL)
 * Phương án 3: Giữ nguyên 100% tất cả workloads thật đang chạy trên toàn bộ cụm Kubernetes.
 */
export const extractActiveK8sServices = (workloads = []) => {
  if (!Array.isArray(workloads)) return [];
  const set = new Set();
  workloads.forEach((w) => {
    const rawName = typeof w === 'string' ? w : (w?.name || w?.service_name || w?.service_id || '');
    const normalized = normalizeK8sServiceName(rawName);
    if (normalized) {
      set.add(normalized);
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};
