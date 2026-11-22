import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { selfHealingService } from '../../../services/selfHealingService';
import { aiService } from '../../../services/aiService';
import { extractActiveK8sServices } from '../../../utils/k8sServiceFilter';
import SelfHealingTrendChart from '../../../components/dashboard/SelfHealingTrendChart';
import ActionDetailModal from './ActionDetailModal';
import {
  History,
  CheckCircle2,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Clock,
  XCircle,
  Activity,
  Eye,
  Calendar,
  ChevronDown,
  RotateCcw,
  Server,
  Zap,
  Filter,
  BarChart2,
  AlertTriangle,
  X,
} from 'lucide-react';

const CANONICAL_ACTION_TYPES = [
  { code: 'RESTART_POD', label: 'Khởi động lại Pod (RESTART_POD)' },
  { code: 'SCALE_REPLICAS', label: 'Mở rộng Replicas (SCALE_REPLICAS)' },
  { code: 'ROLLBACK_DEPLOYMENT', label: 'Hoàn nguyên Deployment (ROLLBACK_DEPLOYMENT)' },
  { code: 'REPLACE_POD', label: 'Thay thế Pod lỗi (REPLACE_POD)' },
  { code: 'CLEANUP_TEMP_FILES', label: 'Dọn dẹp lưu trữ tạm (CLEANUP_STORAGE)' },
  { code: 'RESTART_DEPLOYMENT', label: 'Khởi động lại Deployment (RESTART_DEPLOYMENT)' },
  { code: 'ADJUST_RESOURCE_LIMITS', label: 'Điều chỉnh hạn mức CPU/RAM (ADJUST_LIMITS)' },
  { code: 'DRAIN_NODE', label: 'Di tản Pod khỏi Node (DRAIN_NODE)' },
  { code: 'BLOCK_IP_TEMP', label: 'Chặn IP bất thường (TEMPORARY_IP_BLOCK)' },
  { code: 'NO_ACTION', label: 'Giám sát an toàn (NO_ACTION)' },
];

// Helpers định dạng ngày tháng cục bộ an toàn theo múi giờ client
const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getThisMonthStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getThisYearStr = () => {
  return String(new Date().getFullYear());
};

export const ActionHistoryPage = ({ onNavigate }) => {
  const { currentOrg, currentEnv } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [actions, setActions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter States
  const [timeFilterMode, setTimeFilterMode] = useState('today'); // 'today' | 'date' | 'month' | 'year' | 'all'
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedMonth, setSelectedMonth] = useState(() => getThisMonthStr());
  const [selectedYear, setSelectedYear] = useState(() => getThisYearStr());

  const [selectedService, setSelectedService] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedActionType, setSelectedActionType] = useState('ALL');
  const [dbActionTypes, setDbActionTypes] = useState([]);
  const [liveWorkloads, setLiveWorkloads] = useState([]);
  const [showTrendChart, setShowTrendChart] = useState(false);

  // Trạng thái mở Popover Lịch
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef(null);

  // Đóng Popover Lịch khi bấm ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  // Nhãn hiển thị trực quan trên nút Lịch
  const currentFilterLabel = useMemo(() => {
    if (timeFilterMode === 'today') {
      const parts = getTodayStr().split('-');
      return `Hôm nay (${parts[2]}/${parts[1]}/${parts[0]})`;
    }
    if (timeFilterMode === 'date') {
      if (!selectedDate) return 'Chọn ngày';
      const parts = selectedDate.split('-');
      const isToday = selectedDate === getTodayStr();
      return isToday ? `Hôm nay (${parts[2]}/${parts[1]}/${parts[0]})` : `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'month') {
      if (!selectedMonth) return 'Chọn tháng';
      const parts = selectedMonth.split('-');
      return `Tháng ${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'year') {
      return `Năm ${selectedYear}`;
    }
    const parts = getTodayStr().split('-');
    return `Hôm nay (${parts[2]}/${parts[1]}/${parts[0]})`;
  }, [timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  const activeClusterId = useMemo(() => {
    return currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster || '';
  }, [currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster]);

  const activeOrgId = useMemo(() => {
    return currentOrg?.id || '';
  }, [currentOrg?.id]);

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Vừa xong';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

const translateActionMessageToVi = (rawMsg, targetName = '', actionFriendlyName = 'Tự phục hồi', resolvedNs = 'default') => {
  if (!rawMsg) return `Đã thực thi ${actionFriendlyName} trên dịch vụ "${targetName}"`;

  let text = String(rawMsg).trim();

  // 1. RBAC 403 Forbidden
  const rbacMatch = text.match(
    /User\??\s*"([^"\\]+)\??"\s+cannot\s+(\w+)\s+resource\s+\??"([^"\\]+)\??"(?:\s+in API group\s+\??"([^"\\]*)\??")?(?:\s+in the namespace\s+\??"([^"\\]+)\??")?/i
  ) || text.match(
    /User\s+"([^"]+)"\s+cannot\s+(\w+)\s+resource\s+"([^"]+)"(?:\s+in API group\s+"([^"]*)")?(?:\s+in the namespace\s+"([^"]+)")?/i
  );
  if (rbacMatch || text.includes('(403)') || text.includes('Forbidden')) {
    const saUser = rbacMatch ? rbacMatch[1].replace('system:serviceaccount:', '') : 'selfheal-system:selfheal-agent-sa';
    const verb = rbacMatch ? rbacMatch[2] : 'patch';
    const resource = rbacMatch ? rbacMatch[3] : 'deployments/scale';
    const targetNs = rbacMatch && rbacMatch[5] ? rbacMatch[5] : resolvedNs;
    return `Thực thi ${actionFriendlyName} trên "${targetName}" thất bại [Lỗi 403 Forbidden]: ServiceAccount "${saUser}" thiếu quyền "${verb}" tài nguyên "${resource}" tại namespace "${targetNs}"`;
  }

  // 2. HTTP response headers dump
  if (text.includes('HTTPHeaderDict') || text.includes('HTTP response headers:')) {
    text = text.split('HTTP response headers:')[0].trim();
  }

  // 3. Scaling: "deployment/sme-order-service scaled (scale_up) successfully from 5 to 5 replicas in 'default'"
  const scaleMatch = text.match(
    /(?:[a-z0-9_-]+\/)?([a-z0-9_-]+)\s+scaled\s+\((scale_up|scale_down)\)\s+successfully\s+from\s+(\w+)\s+to\s+(\d+)\s+replicas(?:\s+in\s+'([^']+)')?/i
  );
  if (scaleMatch) {
    const sTarget = scaleMatch[1] || targetName;
    const sDir = scaleMatch[2].toLowerCase() === 'scale_up' ? 'mở rộng' : 'thu hẹp';
    const sFrom = scaleMatch[3];
    const sTo = scaleMatch[4];
    const sNs = scaleMatch[5] || resolvedNs;
    const fromText = sFrom === 'unknown' ? 'số lượng hiện tại' : sFrom;
    return `Đã điều chỉnh quy mô (${sDir}) thành công cho Deployment "${sTarget}" từ ${fromText} lên ${sTo} bản sao trong namespace "${sNs}".`;
  }

  // 4. Scale skipped at minimum
  const scaleMinMatch = text.match(
    /Workload\s+(?:[a-z0-9_-]+\/)?([a-z0-9_-]+)\s+currently at minimum\s+(\d+)\s+replica(?:\s+in\s+'([^']+)')?,\s+scale down skipped safely/i
  );
  if (scaleMinMatch) {
    const sTarget = scaleMinMatch[1] || targetName;
    const sNs = scaleMinMatch[3] || resolvedNs;
    return `Dịch vụ "${sTarget}" hiện đang ở mức tối thiểu 1 bản sao trong namespace "${sNs}", đã bỏ qua thu hẹp để bảo toàn tính sẵn sàng.`;
  }

  // 5. Rolling restart
  const restartMatch = text.match(
    /Zero-downtime rolling restart patched successfully on (?:[a-z0-9_-]+\/)?([a-z0-9_-]+)(?:\s+in namespace\s+'([^']+)')?/i
  );
  if (restartMatch) {
    const rTarget = restartMatch[1] || targetName;
    const rNs = restartMatch[2] || resolvedNs;
    return `Đã khởi động lại Pod (Rolling Restart) không gián đoạn cho dịch vụ "${rTarget}" tại namespace "${rNs}".`;
  }

  // 6. Terminate & replace pod
  const replacePodMatch = text.match(
    /Specific unhealthy pod '([^']+)' terminated and successfully replaced by ReplicaSet(?:\s+in\s+'([^']+)')?/i
  );
  if (replacePodMatch) {
    const pName = replacePodMatch[1];
    const pNs = replacePodMatch[2] || resolvedNs;
    return `Đã chấm điểm, cô lập và xóa Pod lỗi "${pName}"; ReplicaSet tại namespace "${pNs}" đã tự động khởi tạo Pod mới thay thế thành công.`;
  }

  // 7. Replaced pod via rolling restart
  const replaceRollingMatch = text.match(
    /Replaced pod via rolling restart on (?:[a-z0-9_-]+\/)?([a-z0-9_-]+)(?:\s+in\s+'([^']+)')?/i
  );
  if (replaceRollingMatch) {
    const rTarget = replaceRollingMatch[1] || targetName;
    const rNs = replaceRollingMatch[2] || resolvedNs;
    return `Đã thay thế Pod qua cơ chế rolling restart trên dịch vụ "${rTarget}" tại namespace "${rNs}".`;
  }

  // 8. Rollback
  const rollbackMatch = text.match(
    /True Rollback executed:\s*Restored Deployment '([^']+)' from Revision (\d+) back to Revision (\d+)(?:[^\n\r]*)(?:\s+in\s+'([^']+)')?/i
  );
  if (rollbackMatch) {
    const rbTarget = rollbackMatch[1] || targetName;
    const fromRev = rollbackMatch[2];
    const toRev = rollbackMatch[3];
    const rbNs = rollbackMatch[4] || resolvedNs;
    return `Đã hoàn nguyên (Rollback) thành công Deployment "${rbTarget}" từ bản Revision ${fromRev} về bản Revision ${toRev} trong namespace "${rbNs}".`;
  }

  // 9. Storage cleanup
  const storageMatch = text.match(
    /Ephemeral disk cleanup and emptyDir reclamation executed successfully on ([^' ]+)(?:\s+in\s+'([^']+)')?/i
  );
  if (storageMatch) {
    const sTarget = storageMatch[1] || targetName;
    const sNs = storageMatch[2] || resolvedNs;
    return `Đã dọn dẹp bộ nhớ tạm và thu hồi ổ đĩa trống (emptyDir) thành công cho dịch vụ "${sTarget}" tại namespace "${sNs}".`;
  }

  // 10. Limits adjusted
  const limitsMatch = text.match(
    /Adjusted CPU\/RAM resource limits and applied rolling update on (?:[a-z0-9_-]+\/)?([a-z0-9_-]+)(?:\s+in\s+'([^']+)')?/i
  );
  if (limitsMatch) {
    const lTarget = limitsMatch[1] || targetName;
    const lNs = limitsMatch[2] || resolvedNs;
    return `Đã điều chỉnh định mức CPU/RAM và cập nhật rolling update cho dịch vụ "${lTarget}" tại namespace "${lNs}".`;
  }

  // 11. Node cordon
  const cordonMatch = text.match(
    /Cordoned degraded node '([^']+)' and rescheduled pods(?:[^\n\r]*)to healthy node '([^']+)'/i
  );
  if (cordonMatch) {
    const cNode = cordonMatch[1];
    const hNode = cordonMatch[2];
    return `Đã khóa lập lịch Node suy biến "${cNode}" và di tản Pod an toàn sang Node ổn định "${hNode}".`;
  }

  // 12. Single-node guard
  if (text.includes('Single-node cluster guard')) {
    return `Bảo vệ cụm đơn node: Bỏ qua khóa Node và khởi tạo lại Pod an toàn trên dịch vụ "${targetName}".`;
  }

  // 13. NetworkPolicy block IP
  const netBlockMatch = text.match(
    /NetworkPolicy '([^']+)' (?:deployed|updated) successfully:\s*IP '([^']+)' blocked from accessing ([^' ]+)(?:\s+in namespace\s+'([^']+)')?/i
  );
  if (netBlockMatch) {
    const npPolicy = netBlockMatch[1];
    const npIp = netBlockMatch[2];
    const npTarget = netBlockMatch[3] || targetName;
    const npNs = netBlockMatch[4] || resolvedNs;
    return `Đã áp dụng chính sách mạng "${npPolicy}": Chặn IP "${npIp}" truy cập vào dịch vụ "${npTarget}" tại namespace "${npNs}".`;
  }

  // 14. NetworkPolicy unblock
  const netUnblockMatch = text.match(
    /NetworkPolicy '([^']+)' removed:\s*IP '([^']+)' unblocked successfully(?:\s+in namespace\s+'([^']+)')?/i
  );
  if (netUnblockMatch) {
    const npIp = netUnblockMatch[2];
    const npNs = netUnblockMatch[3] || resolvedNs;
    return `Đã gỡ bỏ chính sách NetworkPolicy: Mở chặn IP "${npIp}" truy cập dịch vụ tại namespace "${npNs}".`;
  }

  // 15. NO_ACTION telemetry verified
  if (text.includes('Zero-downtime preserved') || text.includes('NO_ACTION applied')) {
    return `Giám sát an toàn: Viễn trắc ghi nhận dịch vụ "${targetName}" ổn định, giữ nguyên trạng thái an toàn.`;
  }

  // 16. Self-healing mitigate action
  if (text.includes('Self-healing mitigate action')) {
    return `Đã thực thi thành công ${actionFriendlyName} trên dịch vụ "${targetName}".`;
  }

  // Clean English verification tag if present
  text = text.replace(/\s*\(Post-Action Verification Failed\):?/gi, ':');
  text = text.replace(/Post-Action Verification Failed:?\s*/gi, '');

  return text;
};

  const mapBackendActionToUI = useCallback((item) => {
    const shortId = item.id && item.id.length > 8 ? `ACT-${item.id.slice(0, 8).toUpperCase()}` : (item.id || 'N/A');

    let computedDurationMs = 0;
    if (item.started_at && item.completed_at) {
      const s = new Date(item.started_at).getTime();
      const e = new Date(item.completed_at).getTime();
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        computedDurationMs = e - s;
      }
    }
    if (!computedDurationMs) {
      computedDurationMs = item.result?.duration_ms || item.attempts?.[0]?.duration_ms || (item.elapsed_seconds ? Math.round(item.elapsed_seconds * 1000) : 0);
    }
    const mttrSec = computedDurationMs > 0
      ? `${(computedDurationMs / 1000).toFixed(1)}s`
      : (item.execution_status === 'RUNNING' ? 'Đang chạy' : (item.execution_status === 'PENDING' ? 'Đang chờ' : '0.1s'));

    // Strip WORKLOAD/ or any other prefix from target name
    const rawTarget = item.target_name || item.target_id || 'Chưa xác định';
    let targetName = String(rawTarget).replace(/^[A-Za-z0-9_-]+\//i, '').trim();
    const lTarget = targetName.toLowerCase();
    if (lTarget === 'otel-collector-opentelemetry-collector') targetName = 'opentelemetry-collector';
    else if (lTarget === 'prometheus-kube-state-metrics') targetName = 'kube-state-metrics';
    else if (lTarget === 'prometheus-kube-prometheus-operator') targetName = 'kube-prometheus-stack-operator';
    else if (lTarget === 'ecommerce-store') targetName = 'ecommerce-store-app';
    else if (/^mongodb-\d+$/i.test(lTarget)) targetName = 'mongodb';

    const resolvedNs = item.result?.details?.namespace ||
      item.result?.namespace ||
      item.namespace ||
      (item.result?.message?.match(/namespace "([^"]+)"/)?.[1]) ||
      (item.error_message?.match(/namespace "([^"]+)"/)?.[1]) ||
      'default';

    const rawActionCode = item.action_type_code || item.action_type_name || 'Tự phục hồi';
    let actionFriendlyName = rawActionCode;
    const upperCode = String(rawActionCode).toUpperCase();
    if (upperCode.includes('DRAIN')) actionFriendlyName = 'Di tản & Cô lập Node (Drain Node)';
    else if (upperCode.includes('CORDON')) actionFriendlyName = 'Khóa lập lịch Node (Cordon Node)';
    else if (upperCode.includes('SCALE')) actionFriendlyName = 'Điều chỉnh số lượng bản sao Pod';
    else if (upperCode.includes('RESTART')) actionFriendlyName = 'Khởi động lại Pod';
    else if (upperCode.includes('REPLACE')) actionFriendlyName = 'Thay thế Pod';
    else if (upperCode.includes('ROLLBACK')) actionFriendlyName = 'Khôi phục bản phát hành trước';
    else if (upperCode.includes('CLEANUP')) actionFriendlyName = 'Dọn dẹp tài nguyên';
    else if (upperCode.includes('BLOCK')) actionFriendlyName = 'Chặn IP bất thường';
    else if (upperCode.includes('NO_ACTION')) actionFriendlyName = 'Giám sát an toàn';

    const rawMsg = String(item.result?.message || item.error_message || '');
    let title = translateActionMessageToVi(rawMsg, targetName, actionFriendlyName, resolvedNs);
    const policyName = item.policy_name || 'Tự phục hồi trực tiếp (AI Trigger)';

    const isWaitingApproval =
      item.execution_status !== 'COMPLETED' &&
      item.execution_status !== 'FAILED' &&
      item.execution_status !== 'CANCELLED' &&
      (item.approval_status === 'PENDING' ||
       item.execution_status === 'PENDING' ||
       rawMsg.toLowerCase().includes('chờ phê duyệt'));

    let resultText = 'Thành công (100%)';
    let verified = '';
    let effectiveMttr = mttrSec;
    let effectiveStatus = item.execution_status || 'COMPLETED';

    if (isWaitingApproval) {
      resultText = 'Chờ duyệt HITL';
      verified = '';
      effectiveMttr = 'Đang chờ';
      effectiveStatus = 'PENDING';
      if (!title || title.includes('Thực thi')) {
        title = `Hành động ${actionFriendlyName} trên "${targetName}" đang chờ phê duyệt tại Cổng HITL`;
      }
    } else if (item.execution_status === 'RUNNING') {
      resultText = 'Đang thực thi...';
      verified = 'Đang xử lý';
      effectiveMttr = 'Đang chạy';
      effectiveStatus = 'RUNNING';
    } else if (item.execution_status === 'FAILED') {
      resultText = 'Thất bại';
      verified = item.verification?.verification_type ? 'Kiểm tra thất bại' : '';
      effectiveStatus = 'FAILED';
    } else if (item.execution_status === 'CANCELLED') {
      resultText = 'Đã hủy bỏ';
      verified = '';
      effectiveMttr = '-';
      effectiveStatus = 'CANCELLED';
    } else if (item.execution_status === 'COMPLETED') {
      const hasVerificationFailed =
        item.verification?.verification_result === false ||
        String(item.error_message || '').toLowerCase().includes('hậu kiểm thất bại') ||
        String(item.result?.message || '').toLowerCase().includes('hậu kiểm thất bại');

      if (hasVerificationFailed) {
        resultText = 'Hậu kiểm vi phạm';
        verified = item.verification?.verification_type === 'K8S_POST_HEALING_PROBE'
          ? 'Probe K8s phát hiện bất thường'
          : 'Hậu kiểm SLO chưa đạt';
        effectiveStatus = 'VERIFICATION_FAILED';
      } else {
        resultText = 'Thành công (100%)';
        const rawVer = item.verification?.verification_type || '';
        verified = rawVer === 'K8S_POST_HEALING_PROBE' ? 'Đã xác thực K8s Probe' : (rawVer || 'Đã xác thực an toàn');
        effectiveStatus = 'COMPLETED';
        if (title.toLowerCase().includes('chờ phê duyệt')) {
          title = `Đã thực thi thành công ${actionFriendlyName} trên dịch vụ "${targetName}"`;
        }
      }
    }

    // Làm gọn tiêu đề: Bỏ mã kỹ thuật (SCALE_REPLICAS), (Replicas) và bỏ cụm "theo chính sách ..." trong tiêu đề
    title = title.replace(/\s*\((SCALE_REPLICAS|RESTART_POD|ROLLBACK_DEPLOYMENT|NO_ACTION|Replicas)\)/gi, '');
    title = title.replace(/\s*theo chính sách\s+[A-Za-z0-9_-]+/gi, '');
    title = title.replace(/\s{2,}/g, ' ').trim();
    if (!title.endsWith('.')) title += '.';

    const cleanErr = item.error_message
      ? item.error_message.replace(/\s*\(Post-Action Verification Failed\):?/gi, ':').replace(/Post-Action Verification Failed:?\s*/gi, '').replace(/\s{2,}/g, ' ').trim()
      : null;

    return {
      id: shortId,
      rawId: item.id,
      title,
      target: targetName,
      targetName,
      namespace: resolvedNs,
      policy: policyName,
      mttr: effectiveMttr,
      result: resultText,
      timestamp: formatRelativeTime(item.completed_at || item.created_at),
      verifiedBy: verified,
      status: effectiveStatus,
      errorMessage: cleanErr,
      rawItem: item,
    };
  }, []);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    try {
      // Tải lên đến 2000 bản ghi lịch sử để bộ lọc ngày/tháng/năm hoạt động chính xác
      const res = await selfHealingService.getActions({
        limit: 2000,
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
      });

      const analyticsRes = await selfHealingService.getAnalytics({
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
      });

      const items = res?.items || (Array.isArray(res) ? res : []);
      setActions(items.map(mapBackendActionToUI));
      setAnalytics(analyticsRes);
      setIsUsingLiveDb(true);
    } catch (err) {
      console.warn('[ActionHistoryPage] Lỗi tải lịch sử:', err.message);
      setActions([]);
      setIsUsingLiveDb(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeClusterId, activeOrgId, mapBackendActionToUI]);

  // Load danh mục Action Types từ Database
  useEffect(() => {
    let isMounted = true;
    selfHealingService.getActionTypes()
      .then((res) => {
        const list = res?.items || (Array.isArray(res) ? res : []);
        if (isMounted && list.length > 0) setDbActionTypes(list);
      })
      .catch((err) => console.warn('[ActionHistoryPage] Lỗi lấy action types:', err.message));
    return () => { isMounted = false; };
  }, []);

  // Tải danh sách Workloads ĐANG CHẠY THỰC TẾ trên cụm K8s (đã lọc deleted_at IS NULL & bỏ dịch vụ hệ thống/monitoring)
  const fetchLiveWorkloads = useCallback(async () => {
    try {
      const workloads = await aiService.getWorkloads(activeClusterId, activeOrgId);
      if (Array.isArray(workloads)) {
        setLiveWorkloads(workloads);
      }
    } catch (err) {
      setLiveWorkloads([]);
    }
  }, [activeClusterId, activeOrgId]);

  useEffect(() => {
    fetchLiveWorkloads();
  }, [fetchLiveWorkloads]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLiveWorkloads();
    fetchActions();
  };

  // Danh sách Action Types chuẩn hóa
  const allActionTypes = useMemo(() => {
    const map = new Map();
    CANONICAL_ACTION_TYPES.forEach((c) => map.set(c.code, c));
    dbActionTypes.forEach((t) => {
      const code = t.code || t.name;
      if (code) {
        const existing = map.get(code);
        map.set(code, {
          code,
          label: existing?.label || `${t.name || code} (${code})`,
          description: t.description || existing?.description,
        });
      }
    });
    return Array.from(map.values());
  }, [dbActionTypes]);

  // Danh sách Dịch vụ K8s đang hoạt động thực tế (từ GET /api/v1/ai/workloads, tuyệt đối không lấy dịch vụ cũ đã xóa)
  const uniqueServices = useMemo(() => {
    return extractActiveK8sServices(liveWorkloads);
  }, [liveWorkloads]);

  useEffect(() => {
    if (
      selectedService !== 'ALL' &&
      uniqueServices.length > 0 &&
      !uniqueServices.includes(selectedService)
    ) {
      setSelectedService('ALL');
    }
  }, [selectedService, uniqueServices]);

  // Danh sách các năm có hành động
  const availableYears = useMemo(() => {
    const currentY = getThisYearStr();
    const years = new Set([currentY, '2026', '2025']);
    actions.forEach((a) => {
      const rawDate = a.rawItem?.completed_at || a.rawItem?.created_at || a.rawItem?.started_at;
      if (rawDate) {
        const y = new Date(rawDate).getFullYear();
        if (!isNaN(y)) years.add(String(y));
      }
    });
    return Array.from(years).sort().reverse();
  }, [actions]);

  // BỘ LỌC ĐỒNG BỘ: Lọc đồng thời cả Biểu đồ và Bảng Lịch sử
  const filteredHistory = useMemo(() => {
    return actions.filter((item) => {
      // 1. Time range filtering
      const rawDate = item.rawItem?.completed_at || item.rawItem?.created_at || item.rawItem?.started_at;
      if (rawDate) {
        const d = new Date(rawDate);
        const itemDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const itemMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const itemYearStr = String(d.getFullYear());

        if (timeFilterMode === 'today') {
          const isWithin24Hours = (Date.now() - d.getTime()) <= 24 * 60 * 60 * 1000 && (Date.now() - d.getTime()) >= -60000;
          const isSameCalendarDay = itemDateStr === getTodayStr();
          if (!isWithin24Hours && !isSameCalendarDay) return false;
        } else if (timeFilterMode === 'date') {
          if (selectedDate && itemDateStr !== selectedDate) return false;
        } else if (timeFilterMode === 'month') {
          if (selectedMonth && itemMonthStr !== selectedMonth) return false;
        } else if (timeFilterMode === 'year') {
          if (selectedYear && itemYearStr !== selectedYear) return false;
        }
      }

      // 2. Service filter
      if (selectedService !== 'ALL') {
        const targetStr = (item.targetName || item.target || '').toLowerCase();
        if (!targetStr.includes(selectedService.toLowerCase())) return false;
      }

      // 3. Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'PENDING') {
          if (item.status !== 'PENDING' && !item.result?.includes('Chờ duyệt')) return false;
        } else if (item.status !== selectedStatus) {
          return false;
        }
      }

      // 4. Action type filter
      if (selectedActionType !== 'ALL') {
        const code = (item.rawItem?.action_type_code || '').toUpperCase();
        const name = (item.rawItem?.action_type_name || '').toUpperCase();
        const sel = selectedActionType.toUpperCase();
        const isMatch =
          code === sel ||
          name === sel ||
          name.replace(/\s+/g, '_') === sel ||
          (sel === 'CLEANUP_TEMP_FILES' && (code === 'CLEANUP_STORAGE' || name.includes('CLEANUP') || code.includes('CLEANUP'))) ||
          (sel === 'BLOCK_IP_TEMP' && (code === 'TEMPORARY_IP_BLOCK' || name.includes('BLOCK') || code.includes('BLOCK')));
        if (!isMatch) return false;
      }

      // 5. Search text filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          item.id.toLowerCase().includes(term) ||
          item.title.toLowerCase().includes(term) ||
          item.target.toLowerCase().includes(term) ||
          (item.policy && item.policy.toLowerCase().includes(term)) ||
          (item.errorMessage && item.errorMessage.toLowerCase().includes(term));
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.rawItem?.completed_at || a.rawItem?.started_at || a.rawItem?.created_at || 0).getTime();
      const timeB = new Date(b.rawItem?.completed_at || b.rawItem?.started_at || b.rawItem?.created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [
    actions,
    timeFilterMode,
    selectedDate,
    selectedMonth,
    selectedYear,
    selectedService,
    selectedStatus,
    selectedActionType,
    searchTerm,
  ]);

  // Tự động chuyển về trang 1 khi thay đổi bất kỳ bộ lọc nào
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedService, selectedStatus, selectedActionType, searchTerm, timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  // Tính toán lại các chỉ số phân tích động theo bộ lọc
  const dynamicAnalytics = useMemo(() => {
    const total = filteredHistory.length;
    if (total === 0) {
      return {
        totalActions: 0,
        averageRecoveryTime: '0s',
        successRate: '100%',
      };
    }
    let totalSec = 0;
    let succeededCount = 0;
    let finishedCount = 0;
    let pendingCount = 0;
    filteredHistory.forEach((a) => {
      if (a.status === 'PENDING' || a.executionStatus === 'PENDING' || (a.result && a.result.includes('Chờ duyệt'))) {
        pendingCount++;
        return;
      }
      finishedCount++;
      const dur = a.rawItem?.attempts?.[0]?.duration_ms
        ? a.rawItem.attempts[0].duration_ms / 1000
        : (parseFloat(a.mttr) || a.rawItem?.elapsed_seconds || 1.5);
      totalSec += dur;
      if (a.status === 'COMPLETED' || a.executionStatus === 'COMPLETED') succeededCount++;
    });
    return {
      totalActions: total,
      pendingCount,
      finishedCount,
      averageRecoveryTime: finishedCount > 0 ? `${(totalSec / finishedCount).toFixed(1)}s` : '0s',
      successRate: finishedCount > 0 ? `${Math.round((succeededCount / finishedCount) * 100)}%` : '100%',
    };
  }, [filteredHistory]);

  const handleResetFilters = () => {
    setTimeFilterMode('today');
    setSelectedDate(getTodayStr());
    setSelectedMonth(getThisMonthStr());
    setSelectedYear(getThisYearStr());
    setSelectedService('ALL');
    setSelectedStatus('ALL');
    setSelectedActionType('ALL');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const isFiltered =
    timeFilterMode !== 'today' ||
    selectedService !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedActionType !== 'ALL' ||
    Boolean(searchTerm.trim());

  // Pagination Logic
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredHistory.length);

  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice(startIndex, endIndex);
  }, [filteredHistory, startIndex, endIndex]);

  const renderPaginationBar = (currPage, totalItems, onPageChange) => {
    const totalPg = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    if (totalItems <= ITEMS_PER_PAGE) return null;
    const startIdx = (currPage - 1) * ITEMS_PER_PAGE + 1;
    const endIdx = Math.min(currPage * ITEMS_PER_PAGE, totalItems);

    const pages = [];
    for (let i = 1; i <= totalPg; i++) {
      if (i === 1 || i === totalPg || (i >= currPage - 1 && i <= currPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '11px 16px',
          backgroundColor: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ color: '#64748B' }}>
          Hiển thị <strong style={{ color: '#0F172A' }}>{startIdx}–{endIdx}</strong> /{' '}
          <strong style={{ color: '#0F172A' }}>{totalItems}</strong> bản ghi
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            type="button"
            disabled={currPage <= 1}
            onClick={() => onPageChange(Math.max(1, currPage - 1))}
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '0.74rem',
              fontWeight: 600,
              borderRadius: '7px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: currPage <= 1 ? '#94A3B8' : '#334155',
              cursor: currPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currPage <= 1 ? 0.55 : 1,
            }}
          >
            &laquo; Trước
          </button>

          {pages.map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.74rem' }}>
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '28px',
                  height: '28px',
                  padding: '0 7px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  borderRadius: '7px',
                  border: currPage === p ? '1px solid #059669' : '1px solid #CBD5E1',
                  backgroundColor: currPage === p ? '#059669' : '#FFFFFF',
                  color: currPage === p ? '#FFFFFF' : '#334155',
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            disabled={currPage >= totalPg}
            onClick={() => onPageChange(Math.min(totalPg, currPage + 1))}
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '0.74rem',
              fontWeight: 600,
              borderRadius: '7px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: currPage >= totalPg ? '#94A3B8' : '#334155',
              cursor: currPage >= totalPg ? 'not-allowed' : 'pointer',
              opacity: currPage >= totalPg ? 0.55 : 1,
            }}
          >
            Sau &raquo;
          </button>
        </div>
      </div>
    );
  };

  const activeClusterLabel = currentEnv?.cluster || currentEnv?.name || 'Toàn hệ thống';

  const kpiCardStyle = (accent, isSelected = false) => ({
    backgroundColor: '#FFFFFF',
    border: isSelected ? `1px solid ${accent}` : '1px solid rgba(226, 232, 240, 0.95)',
    borderTop: `2.5px solid ${accent}`,
    borderRadius: '12px',
    padding: '11px 14px',
    boxShadow: isSelected ? `0 6px 18px ${accent}22` : '0 4px 16px rgba(15, 23, 42, 0.04)',
    minWidth: 0,
    transition: 'transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease',
  });

  const actionBtnStyle = (active = false, disabled = false) => ({
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    backgroundColor: active ? '#ECFDF5' : '#FFFFFF',
    border: active ? '1px solid #10B981' : '1px solid rgba(203, 213, 225, 0.9)',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
    fontSize: '0.8rem',
    fontWeight: active ? 700 : 600,
    color: active ? '#047857' : disabled ? '#94A3B8' : '#334155',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  });

  const selectControlStyle = {
    height: '32px',
    padding: '0 10px',
    fontSize: '0.75rem',
    fontWeight: 600,
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div className="dashboard-action-history-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        .history-table-row {
          transition: background-color 0.14s ease;
        }
        .history-table-row:hover {
          background-color: #F8FAFC !important;
        }
        .history-table-row--failed:hover {
          background-color: #FEF2F2 !important;
        }
        .history-detail-btn:hover {
          background-color: #ECFDF5 !important;
          border-color: #10B981 !important;
          color: #047857 !important;
        }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
            }}
          >
            <History size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Lịch Sử Tự Phục Hồi &amp; MTTR
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Nhật ký thực thi, thời gian hồi phục trung bình MTTR &amp; đối soát SLA trên cụm{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{activeClusterLabel}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowTrendChart((prev) => !prev)}
            style={actionBtnStyle(showTrendChart, false)}
            title={showTrendChart ? 'Thu gọn biểu đồ MTTR' : 'Mở biểu đồ xu hướng MTTR'}
          >
            <BarChart2 size={14} />
            <span>{showTrendChart ? 'Ẩn biểu đồ MTTR' : 'Biểu đồ MTTR'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={actionBtnStyle(false, isRefreshing || isLoading)}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Đang làm mới...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Hàng 4 Thẻ KPI Tóm Tắt */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div
          onClick={() => setSelectedStatus('ALL')}
          title="Hiển thị tất cả hành động"
          style={{ ...kpiCardStyle('#059669'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>TỔNG HÀNH ĐỘNG</span>
            <Activity size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {(dynamicAnalytics.totalActions || 0).toLocaleString('vi-VN')}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
              {dynamicAnalytics.finishedCount || 0} đã hoàn tất
            </span>
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus((prev) => (prev === 'SUCCEEDED' ? 'ALL' : 'SUCCEEDED'))}
          title="Nhấp để lọc nhanh hành động thành công"
          style={{ ...kpiCardStyle('#10B981', selectedStatus === 'SUCCEEDED'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>TỶ LỆ THÀNH CÔNG</span>
            <CheckCircle2 size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#059669' }}>
              {dynamicAnalytics.successRate}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>theo bộ lọc hiện tại</span>
          </div>
        </div>

        <div style={kpiCardStyle('#3B82F6')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>MTTR TRUNG BÌNH</span>
            <Clock size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {dynamicAnalytics.averageRecoveryTime}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>thời gian khôi phục</span>
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'))}
          title="Nhấp để lọc nhanh hành động chờ duyệt HITL"
          style={{ ...kpiCardStyle('#F59E0B', selectedStatus === 'PENDING'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>CHỜ DUYỆT HITL</span>
            <ShieldCheck size={14} color="#F59E0B" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: dynamicAnalytics.pendingCount > 0 ? '#D97706' : '#0F172A',
              }}
            >
              {dynamicAnalytics.pendingCount || 0}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
              {dynamicAnalytics.pendingCount > 0 ? 'cần kỹ sư ký duyệt' : 'không có yêu cầu chờ'}
            </span>
          </div>
        </div>
      </div>

      {/* Bộ Lọc Gọn 2 Hàng */}
      <div
        className="dash-card"
        style={{
          padding: '12px 16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Hàng 1: Tìm kiếm + Pill Trạng thái + Lịch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '360px' }}>
            <input
              type="text"
              placeholder="Tìm kiếm mã bản ghi, hành động, đối tượng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                height: '34px',
                width: '100%',
                padding: '0 30px 0 32px',
                fontSize: '0.78rem',
                border: '1px solid #CBD5E1',
                borderRadius: '9px',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Xóa từ khóa tìm kiếm"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '9px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Status Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: '#F8FAFC',
              padding: '3px',
              border: '1px solid #E2E8F0',
              borderRadius: '9px',
            }}
          >
            {[
              { id: 'ALL', label: 'Tất cả', color: '#059669', bg: '#ECFDF5' },
              { id: 'SUCCEEDED', label: 'Thành công', color: '#047857', bg: '#ECFDF5' },
              { id: 'PENDING', label: 'Chờ duyệt', color: '#D97706', bg: '#FFFBEB' },
              { id: 'FAILED', label: 'Thất bại', color: '#DC2626', bg: '#FEF2F2' },
              { id: 'CANCELLED', label: 'Đã hủy', color: '#475569', bg: '#F1F5F9' },
            ].map((st) => {
              const active = selectedStatus === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStatus(st.id)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: active ? `1px solid ${st.color}55` : '1px solid transparent',
                    backgroundColor: active ? st.bg : 'transparent',
                    color: active ? st.color : '#64748B',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Nút Lịch mở Popover chọn Ngày, Tháng, Năm */}
          <div style={{ position: 'relative' }} ref={calendarRef}>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              style={{
                height: '34px',
                padding: '0 11px',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '9px',
                border: isCalendarOpen ? '1px solid #10B981' : '1px solid #CBD5E1',
                backgroundColor: isCalendarOpen ? '#ECFDF5' : '#F8FAFC',
                color: isCalendarOpen ? '#047857' : '#0F172A',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Mở bảng lịch chọn ngày, tháng hoặc năm"
            >
              <Calendar size={14} color={isCalendarOpen ? '#059669' : '#64748B'} />
              <span>{currentFilterLabel}</span>
              <ChevronDown size={12} color={isCalendarOpen ? '#059669' : '#64748B'} />
            </button>

            {isCalendarOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: '0',
                  zIndex: 100,
                  width: '326px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 14px 32px -4px rgba(15, 23, 42, 0.14), 0 4px 10px -2px rgba(15, 23, 42, 0.06)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTimeFilterMode('date')}
                    style={{
                      padding: '6px 4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: timeFilterMode === 'date' || timeFilterMode === 'today' ? '#FFFFFF' : 'transparent',
                      color: timeFilterMode === 'date' || timeFilterMode === 'today' ? '#047857' : '#64748B',
                      boxShadow: timeFilterMode === 'date' || timeFilterMode === 'today' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeFilterMode('month')}
                    style={{
                      padding: '6px 4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: timeFilterMode === 'month' ? '#FFFFFF' : 'transparent',
                      color: timeFilterMode === 'month' ? '#047857' : '#64748B',
                      boxShadow: timeFilterMode === 'month' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Tháng
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeFilterMode('year')}
                    style={{
                      padding: '6px 4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: timeFilterMode === 'year' ? '#FFFFFF' : 'transparent',
                      color: timeFilterMode === 'year' ? '#047857' : '#64748B',
                      boxShadow: timeFilterMode === 'year' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Năm
                  </button>
                </div>

                {(timeFilterMode === 'date' || timeFilterMode === 'today' || timeFilterMode === 'all') && (
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                      Chọn ngày cụ thể:
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setTimeFilterMode('date');
                      }}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />

                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                        7 ngày gần nhất:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Array.from({ length: 7 }, (_, i) => {
                          const dt = new Date(Date.now() - i * 86400000);
                          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                        }).map((dStr) => {
                          const dParts = dStr.split('-');
                          const isToday = dStr === getTodayStr();
                          const isSelected = (timeFilterMode === 'today' && isToday) || (timeFilterMode === 'date' && selectedDate === dStr);
                          return (
                            <button
                              key={dStr}
                              type="button"
                              onClick={() => {
                                setTimeFilterMode(isToday ? 'today' : 'date');
                                setSelectedDate(dStr);
                                setIsCalendarOpen(false);
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '6px',
                                border: isSelected ? '1px solid #10B981' : '1px solid #E2E8F0',
                                backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC',
                                color: isSelected ? '#047857' : '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              {isToday ? `Hôm nay (${dParts[2]}/${dParts[1]})` : `${dParts[2]}/${dParts[1]}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {timeFilterMode === 'month' && (
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                      Chọn tháng &amp; năm:
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginBottom: '10px',
                      }}
                    />

                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                      Các tháng trong năm {selectedMonth?.split('-')[0] || '2026'}:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mNum) => {
                        const mStr = `${selectedMonth?.split('-')[0] || '2026'}-${String(mNum).padStart(2, '0')}`;
                        const isSelected = selectedMonth === mStr;
                        return (
                          <button
                            key={mNum}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(mStr);
                              setIsCalendarOpen(false);
                            }}
                            style={{
                              padding: '6px 2px',
                              fontSize: '0.7rem',
                              fontWeight: isSelected ? 700 : 500,
                              borderRadius: '6px',
                              border: isSelected ? '1px solid #10B981' : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC',
                              color: isSelected ? '#047857' : '#334155',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            Tháng {mNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {timeFilterMode === 'year' && (
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      Chọn năm khảo sát:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {availableYears.map((yr) => {
                        const isSelected = selectedYear === yr;
                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => {
                              setSelectedYear(yr);
                              setIsCalendarOpen(false);
                            }}
                            style={{
                              padding: '9px 4px',
                              fontSize: '0.8rem',
                              fontWeight: isSelected ? 700 : 600,
                              borderRadius: '8px',
                              border: isSelected ? '1px solid #10B981' : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC',
                              color: isSelected ? '#047857' : '#334155',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            Năm {yr}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #F1F5F9', marginTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTimeFilterMode('today');
                        setSelectedDate(getTodayStr());
                        setIsCalendarOpen(false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.72rem',
                        color: '#059669',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimeFilterMode('all');
                        setIsCalendarOpen(false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.72rem',
                        color: timeFilterMode === 'all' ? '#047857' : '#64748B',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Tất cả
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      borderRadius: '7px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hàng 2: Dịch vụ, Loại hành động, Đặt lại & Tổng số */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #F1F5F9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={13} color="#64748B" />
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                style={selectControlStyle}
              >
                <option value="ALL">Tất cả dịch vụ ({uniqueServices.length})</option>
                {uniqueServices.map((svc) => (
                  <option key={svc} value={svc}>Dịch vụ: {svc}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={13} color="#64748B" />
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                style={{ ...selectControlStyle, maxWidth: '240px' }}
              >
                <option value="ALL">Tất cả loại hành động</option>
                {allActionTypes.map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '32px',
                padding: '0 10px',
                fontSize: '0.73rem',
                fontWeight: 700,
                color: isFiltered ? '#DC2626' : '#64748B',
                backgroundColor: isFiltered ? '#FEF2F2' : '#FFFFFF',
                border: isFiltered ? '1px solid #FECACA' : '1px solid #E2E8F0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} />
              <span>Đặt lại</span>
            </button>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: '#64748B' }}>
            Tổng <strong style={{ color: '#0F172A' }}>{filteredHistory.length}</strong> bản ghi &bull; Trang{' '}
            <strong style={{ color: '#0F172A' }}>{safePage}</strong>/{totalPages}
          </div>
        </div>
      </div>

      {/* Embedded Self-Healing Trend Chart */}
      {showTrendChart && (
        <SelfHealingTrendChart
          actions={filteredHistory}
          analytics={dynamicAnalytics}
          height={180}
          title={`Xu Hướng Phục Hồi Tự Động & Thời Gian MTTR (${currentFilterLabel})`}
          timeFilterMode={timeFilterMode}
          selectedDate={selectedDate}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      )}

      {/* History Records Table */}
      <div
        className="dash-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>MÃ BẢN GHI</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>HÀNH ĐỘNG &amp; NỘI DUNG</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>ĐỐI TƯỢNG</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>THỜI LƯỢNG</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>KẾT QUẢ</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>THỜI ĐIỂM</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', textAlign: 'center' }}>CHI TIẾT</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '52px 20px', color: '#64748B' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <ShieldCheck size={24} color="#059669" />
                    </div>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}>
                      Không có bản ghi lịch sử nào phù hợp
                    </div>
                    <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#64748B' }}>
                      Không tìm thấy hành động tự phục hồi nào khớp với mốc thời gian hoặc tiêu chí đã lọc.
                    </div>
                    {isFiltered && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        style={{
                          marginTop: '10px',
                          padding: '7px 14px',
                          backgroundColor: '#ECFDF5',
                          color: '#047857',
                          border: '1px solid #A7F3D0',
                          borderRadius: '9px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Đặt lại bộ lọc
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((rec) => {
                  const isSucceeded = rec.status === 'COMPLETED';
                  const isCancelled = rec.status === 'CANCELLED';
                  const isFailed = rec.status === 'FAILED';
                  const isPending = rec.status === 'PENDING' || (rec.result && rec.result.includes('Chờ duyệt'));
                  const isVerificationFailed = rec.status === 'VERIFICATION_FAILED';

                  let statusColor = '#047857';
                  let statusBg = '#ECFDF5';
                  let statusBorder = '#A7F3D0';
                  if (isPending || isCancelled || isVerificationFailed) {
                    statusColor = '#B45309';
                    statusBg = '#FFFBEB';
                    statusBorder = '#FDE68A';
                  }
                  if (isFailed) {
                    statusColor = '#DC2626';
                    statusBg = '#FEF2F2';
                    statusBorder = '#FECACA';
                  }

                  return (
                    <tr
                      key={rec.id}
                      className={`history-table-row${isFailed ? ' history-table-row--failed' : ''}`}
                      onClick={() => setSelectedAction({ id: rec.rawId, item: rec.rawItem })}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isFailed ? 'rgba(254, 242, 242, 0.3)' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: '#334155',
                          whiteSpace: 'nowrap',
                          borderLeft: isFailed ? '3px solid #EF4444' : isPending ? '3px solid #F59E0B' : '3px solid transparent',
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: '#F8FAFC',
                            padding: '3px 8px',
                            borderRadius: '7px',
                            border: '1px solid #E2E8F0',
                            fontSize: '0.74rem',
                          }}
                        >
                          {rec.id}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A', lineHeight: 1.45, fontSize: '0.8rem' }}>{rec.title}</div>
                        {rec.errorMessage && (
                          <div style={{ fontSize: '0.72rem', color: '#DC2626', marginTop: '3px' }}>
                            Lý do: {rec.errorMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: '#047857' }}>
                          {rec.target}
                        </div>
                        <div style={{ marginTop: '3px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: '5px',
                              backgroundColor: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              fontSize: '0.66rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: '#475569',
                            }}
                          >
                            ns: {rec.namespace}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.78rem', color: statusColor, whiteSpace: 'nowrap' }}>
                        {rec.mttr}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 9px',
                              borderRadius: '999px',
                              backgroundColor: statusBg,
                              color: statusColor,
                              border: `1px solid ${statusBorder}`,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              width: 'fit-content',
                            }}
                          >
                            {isPending && <Clock size={12} />}
                            {isVerificationFailed && <AlertTriangle size={12} />}
                            {isSucceeded && <CheckCircle2 size={12} />}
                            {isCancelled && <XCircle size={12} />}
                            {isFailed && <AlertCircle size={12} />}
                            <span>{rec.result}</span>
                          </span>
                          {isPending && onNavigate && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(`/dashboard/self-healing/approvals?target=${encodeURIComponent(rec.target)}`);
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                backgroundColor: '#FEF3C7',
                                color: '#B45309',
                                border: '1px solid #FDE68A',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                width: 'fit-content',
                              }}
                              title="Chuyển ngay tới Cổng Phê Duyệt HITL để kiểm tra và duyệt"
                            >
                              <span>Ký duyệt ngay &rarr;</span>
                            </button>
                          )}
                        </div>
                        {rec.verifiedBy ? (
                          <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '3px' }}>{rec.verifiedBy}</div>
                        ) : null}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {rec.timestamp}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="history-detail-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAction({ id: rec.rawId, item: rec.rawItem });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            height: '28px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#F8FAFC',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: '#334155',
                            cursor: 'pointer',
                            transition: 'all 0.14s ease',
                          }}
                        >
                          <Eye size={12} />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {renderPaginationBar(safePage, filteredHistory.length, setCurrentPage)}
      </div>

      {/* Action Detail Modal */}
      {selectedAction && (
        <ActionDetailModal
          actionId={selectedAction.id}
          initialItem={selectedAction.item}
          onClose={() => setSelectedAction(null)}
        />
      )}
    </div>
  );
};

export default ActionHistoryPage;
