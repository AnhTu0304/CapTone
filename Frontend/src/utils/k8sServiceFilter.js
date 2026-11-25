/**
 * Chuẩn hóa tên dịch vụ Kubernetes đang chạy thực tế trên cụm.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const K8S_POD_SUFFIX_PATTERNS = [
  /^\d+$/, // StatefulSet ordinal (e.g. mongodb-0)
  /^(?=[a-z0-9-]*\d)[a-z0-9]{4,12}-[a-z0-9]{2,5}$/, // Deployment ReplicaSet+Pod hash (e.g. 87b9fff69-2d9hc)
  /^(?=[a-z0-9]*\d)[a-z0-9]{4,6}$/, // ReplicaSet/DaemonSet/Job single hash containing digit (e.g. dmgz5)
];

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
  if (/^prometheus-prometheus-kube-prometheus-prometheus(?:-\d+)?$/i.test(lower)) return 'prometheus';

  if (UUID_REGEX.test(s) || s.includes('-0000-')) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,80}$/.test(s)) return null;
  return s;
};

/**
 * Trích xuất tên đối tượng mục tiêu từ chuỗi thô hoặc tiêu đề sự cố (vd: "UNKNOWN on mongodb-init" -> "mongodb-init").
 */
const extractTargetCandidate = (rawValue) => {
  if (!rawValue || typeof rawValue !== 'string') return '';
  let candidate = rawValue.trim();
  if (!candidate) return '';

  const titleMatch = candidate.match(/^.+\s+(?:on|trên)\s+([^\s()]+(?:\s*[^\s()]+)?)$/i);
  if (titleMatch && titleMatch[1]) {
    candidate = titleMatch[1].trim();
  }

  return candidate
    .replace(/^(Deployment|StatefulSet|DaemonSet|Pod|Service|Workload)\s*[:/]?\s*/i, '')
    .replace(/^pod[/:]\s*/i, '')
    .replace(/['".,;:)]+$/, '')
    .replace(/^['"(]+/, '')
    .trim();
};

const toCanonicalServiceLower = (raw) => {
  const extracted = extractTargetCandidate(raw);
  if (!extracted || UUID_REGEX.test(extracted) || extracted.includes('-0000-')) return '';
  const canon = normalizeK8sServiceName(extracted) || extracted;
  return canon.trim().toLowerCase();
};

const isKubernetesPodSuffix = (suffix) =>
  Boolean(suffix) && K8S_POD_SUFFIX_PATTERNS.some((pattern) => pattern.test(suffix));

/**
 * Kiểm tra chuỗi mục tiêu có khớp đúng dịch vụ đang chọn hay không (không gộp nhầm dịch vụ khác như mongodb-init vào mongodb).
 */
export const doesEntityMatchServiceTarget = (
  rawValue,
  selectedService,
  knownServices = [],
  options = {}
) => {
  const { allowPodSuffix = true } = options;
  const targetLower = toCanonicalServiceLower(selectedService);
  const candidateLower = toCanonicalServiceLower(rawValue);
  if (!targetLower || !candidateLower) return false;
  if (candidateLower === targetLower) return true;

  const knownSet = new Set(
    (Array.isArray(knownServices) ? knownServices : [])
      .map((s) => toCanonicalServiceLower(s))
      .filter(Boolean)
  );
  if (knownSet.has(candidateLower) && candidateLower !== targetLower) {
    return false;
  }

  if (allowPodSuffix && candidateLower.startsWith(`${targetLower}-`)) {
    const suffix = candidateLower.slice(targetLower.length + 1);
    return isKubernetesPodSuffix(suffix);
  }

  return false;
};

/**
 * Kiểm tra một bản ghi (incident, action, recommendation, approval) có thuộc đúng dịch vụ đang chọn hay không.
 * Ưu tiên kiểm tra các trường định danh chính trước để không bị title/fallback match nhầm sang dịch vụ có tiền tố giống nhau.
 */
export const doesRecordMatchServiceTarget = (
  record,
  selectedService,
  knownServices = [],
  primaryFields = ['service_id', 'workload_name', 'target_name'],
  secondaryFields = ['title', 'incident_title']
) => {
  if (!record || !selectedService) return false;
  const targetLower = toCanonicalServiceLower(selectedService);
  if (!targetLower) return false;

  const readField = (obj, path) => {
    if (!obj) return undefined;
    if (!path.includes('.')) return obj[path];
    return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
  };

  for (const field of primaryFields) {
    const val = readField(record, field);
    if (typeof val !== 'string' || !val.trim()) continue;
    const candidateLower = toCanonicalServiceLower(val);
    if (!candidateLower) continue;
    if (doesEntityMatchServiceTarget(val, targetLower, knownServices, { allowPodSuffix: true })) {
      return true;
    }
    // Nếu trường định danh chính đã nêu rõ tên một dịch vụ khác (không phải Pod của dịch vụ đang chọn) -> loại ngay
    if (candidateLower !== targetLower) {
      return false;
    }
  }

  for (const field of secondaryFields) {
    const val = readField(record, field);
    if (typeof val === 'string' && doesEntityMatchServiceTarget(val, targetLower, knownServices)) {
      return true;
    }
  }

  return false;
};

/**
 * Khớp Pod thực tế trong clusterInfo.pods về đúng dịch vụ đang chọn.
 */
export const doesPodMatchServiceTarget = (pod, selectedService, knownServices = []) => {
  if (!pod || !pod.name || !selectedService) return false;
  const targetLower = toCanonicalServiceLower(selectedService);
  if (!targetLower) return false;

  const podName = String(pod.name).trim().toLowerCase();
  const explicitIds = [
    pod.service_id,
    pod.labels?.app,
    pod.labels?.['app.kubernetes.io/name'],
    pod.labels?.['app.kubernetes.io/instance'],
    pod.labels?.['k8s-app'],
  ]
    .map((v) => toCanonicalServiceLower(v))
    .filter(Boolean);

  if (explicitIds.includes(targetLower)) return true;
  if (explicitIds.length > 0 && explicitIds.some((id) => id !== targetLower && id !== 'kube-dns')) {
    return false;
  }

  if (targetLower === 'coredns' && (podName.startsWith('coredns-') || explicitIds.includes('kube-dns'))) {
    return true;
  }
  if (targetLower === 'opentelemetry-collector' && podName.startsWith('otel-collector-')) {
    return true;
  }

  return doesEntityMatchServiceTarget(pod.name, targetLower, knownServices, { allowPodSuffix: true });
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
