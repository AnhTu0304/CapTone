/**
 * Bộ lọc tập trung các dịch vụ lõi Kubernetes và tầng giám sát (monitoring stack)
 * đồng bộ 100% với bộ lọc của GET /api/v1/ai/workloads để không chạy AI / tạo sự cố / gửi email cảnh báo rác.
 */
const EXCLUDED_SYSTEM_EXACT = new Set([
  'coredns',
  'etcd-minikube',
  'kindnet',
  'kube',
  'kube-controller',
  'kube-proxy',
  'storage-provisioner',
  'kube-apiserver-minikube',
  'kube-controller-manager-minikube',
  'kube-scheduler-minikube',
  'selfheal-agent',
  'metrics-server',
  'otel-collector-opentelemetry-collector',
  'opentelemetry-collector',
  'prometheus-kube-prometheus-operator',
  'kube-prometheus-stack-operator',
  'prometheus-kube-state-metrics',
  'kube-state-metrics',
  'prometheus-node-exporter',
  'prometheus-prometheus-node-exporter',
  'prometheus',
  'prometheus-operated',
  'prometheus-kube-prometheus-prometheus',
  'prometheus-kube-prometheus-coredns',
  'prometheus-kube-prometheus-kubelet',
  'alertmanager',
  'grafana',
]);

const EXCLUDED_SYSTEM_PREFIXES = [
  'kube-',
  'prometheus-',
  'otel-collector',
  'opentelemetry-',
  'selfheal-agent',
  'coredns',
  'etcd-',
  'kindnet',
  'metrics-server',
  'alertmanager-',
];

export function isExcludedSystemService(rawName?: string | null): boolean {
  // Option 3: Mở toàn bộ, không loại trừ bất kỳ dịch vụ/workload nào trên cụm K8s khỏi màn hình giám sát
  return false;
}

const PROTECTED_SYSTEM_NAMESPACES = new Set([
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'local-path-storage',
  'selfheal-system',
]);

/**
 * Nhận diện thành phần hạ tầng lõi Kubernetes / Monitoring Stack / Job khởi tạo 1 lần (-init).
 * Vẫn cho phép thu thập telemetry để hiển thị Overview, nhưng chặn chạy AI/RCA/tạo Incident & Auto-Healing
 * để không tạo cảnh báo giả (vd REPLACE_POD trên selfheal-agent hay RESTART_POD trên kube-apiserver).
 */
export function isInfrastructureControlPlaneWorkload(
  rawName?: string | null,
  namespace?: string | null
): boolean {
  const ns = String(namespace || '').trim().toLowerCase();
  if (ns && PROTECTED_SYSTEM_NAMESPACES.has(ns)) return true;

  if (!rawName || typeof rawName !== 'string') return false;
  const normalized = rawName.trim().toLowerCase();
  if (!normalized) return false;

  if (EXCLUDED_SYSTEM_EXACT.has(normalized)) return true;
  if (EXCLUDED_SYSTEM_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  if (/(?:-rs)?-init(?:\b|-[a-z0-9]+$)/i.test(normalized)) return true;

  return false;
}

const DATABASE_WORKLOAD_PATTERN =
  /^(?:mongo|redis|postgres|mysql|mariadb|elasticsearch|etcd|cassandra|clickhouse|neo4j|couchdb|scylladb|database|db$|.*[-_]db)/i;

/**
 * Nhận diện workload cơ sở dữ liệu có cơ chế cấp phát RAM làm bộ nhớ đệm (WiredTiger / Buffer Pool).
 * Loại trừ các Job khởi tạo một lần như mongodb-init.
 */
export function isDatabaseCacheWorkload(serviceName?: string | null): boolean {
  if (!serviceName || typeof serviceName !== 'string') return false;
  const trimmed = serviceName.trim();
  if (!trimmed || /-init\b/i.test(trimmed)) return false;
  return DATABASE_WORKLOAD_PATTERN.test(trimmed);
}
