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
  // Option 3: Mở toàn bộ, không loại trừ bất kỳ dịch vụ/workload nào trên cụm K8s
  return false;
}
