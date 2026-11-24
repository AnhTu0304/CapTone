import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { selfHealingService } from '../../../services/selfHealingService';
import { usePermissions, PERMISSIONS } from '../../../hooks/usePermissions';
import {
  Zap,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  ChevronRight,
  Clock,
  Shield,
  X
} from 'lucide-react';

const ACTION_LABELS_VI = {
  RESTART_POD: 'Khởi động lại Pod',
  REPLACE_POD: 'Thay thế Pod',
  SCALE_REPLICAS: 'Điều chỉnh số lượng bản sao Pod',
  SCALE_UP: 'Mở rộng bản sao Pod',
  SCALE_DOWN: 'Thu hẹp bản sao Pod',
  ROLLBACK_DEPLOYMENT: 'Khôi phục bản phát hành trước',
  CLEANUP_STORAGE: 'Dọn dẹp lưu trữ',
  CLEANUP_TEMP_FILES: 'Dọn dẹp tệp tạm',
  TEMPORARY_IP_BLOCK: 'Chặn tạm thời IP tấn công',
  BLOCK_IP_TEMP: 'Chặn tạm thời IP tấn công',
  NO_ACTION: 'Giám sát an toàn',
};

const formatHealingActionDetails = (item, actionCode, targetName) => {
  const ns = item.result?.details?.namespace ||
    item.result?.namespace ||
    item.namespace ||
    (item.result?.message?.match(/namespace "([^"]+)"/)?.[1]) ||
    (item.error_message?.match(/namespace "([^"]+)"/)?.[1]) ||
    'default';
  const rawMsg = String(item.result?.message || item.error_message || '');
  const actionVi = ACTION_LABELS_VI[actionCode] || actionCode || 'Tự phục hồi';

  // 1. Parse Kubernetes RBAC 403 Forbidden error
  const rbacMatch = rawMsg.match(
    /User\?\s*"([^"\\]+)\?\s+cannot\s+(\w+)\s+resource\s+\?"([^"\\]+)\?"(?:\s+in API group\s+\?"([^"\\]*)\?")?(?:\s+in the namespace\s+\?"([^"\\]+)\?")?/i
  );
  if (rbacMatch || rawMsg.includes('(403)') || rawMsg.includes('Forbidden')) {
    const saUser = rbacMatch ? rbacMatch[1].replace('system:serviceaccount:', '') : 'selfheal-system:selfheal-agent-sa';
    const verb = rbacMatch ? rbacMatch[2] : 'patch';
    const resource = rbacMatch ? rbacMatch[3] : 'deployments/scale';
    const targetNs = rbacMatch && rbacMatch[5] ? rbacMatch[5] : ns;
    return {
      title: `Thực thi ${actionVi} trên dịch vụ "${targetName}" thất bại (Lỗi phân quyền Kubernetes 403 Forbidden)`,
      detail: `Nguyên nhân cụ thể: ServiceAccount "${saUser}" thiếu quyền RBAC ("${verb}") đối với tài nguyên "${resource}" tại namespace "${targetNs}".`,
    };
  }

  // 2. Parse Kubernetes 404 NotFound error
  if (rawMsg.includes('(404)') || /not found/i.test(rawMsg)) {
    return {
      title: `Thực thi ${actionVi} trên dịch vụ "${targetName}" thất bại (404 Not Found)`,
      detail: `Nguyên nhân cụ thể: Không tìm thấy đối tượng Deployment/Pod "${targetName}" tại namespace "${ns}" trên cụm Kubernetes.`,
    };
  }

  // 3. Parse generic English success message
  const successMatch = rawMsg.match(/Self-healing mitigate action '([^']+)' executed successfully on ([^.]+)\.?/i);
  if (successMatch || item.execution_status === 'SUCCEEDED') {
    const code = (successMatch ? successMatch[1] : actionCode || '').toUpperCase();
    if (code === 'NO_ACTION') {
      return {
        title: `Giám sát an toàn (NO_ACTION) trên dịch vụ "${targetName}"`,
        detail: `Hệ thống ghi nhận dịch vụ "${targetName}" (namespace "${ns}") đang trong ngưỡng an toàn hoặc giữ trạng thái bảo vệ, không cần can thiệp trực tiếp lên Pod.`,
      };
    }
    if (code === 'SCALE_REPLICAS' || code === 'SCALE_UP') {
      return {
        title: `Đã mở rộng số lượng bản sao (${code}) cho dịch vụ "${targetName}" thành công`,
        detail: `K8s Agent đã cập nhật cấu hình replicas cho Deployment "${targetName}" tại namespace "${ns}" để phân tải lưu lượng.`,
      };
    }
    if (code === 'REPLACE_POD') {
      return {
        title: `Đã thay thế và khởi tạo lại Pod mới (REPLACE_POD) cho dịch vụ "${targetName}" thành công`,
        detail: `K8s Agent đã điều phối thay thế Pod lỗi của dịch vụ "${targetName}" tại namespace "${ns}" và xác nhận Pod mới đạt trạng thái Ready.`,
      };
    }
    if (code === 'RESTART_POD') {
      return {
        title: `Đã khởi động lại Pod (RESTART_POD) cho dịch vụ "${targetName}" thành công`,
        detail: `K8s Agent đã thực thi khởi động lại Pod của dịch vụ "${targetName}" tại namespace "${ns}" để giải phóng tài nguyên bị treo.`,
      };
    }
    if (code === 'BLOCK_IP_TEMP' || code === 'TEMPORARY_IP_BLOCK') {
      const blockedIp =
        item.result?.details?.blocked_ip ||
        item.result?.params?.ip ||
        item.params?.ip ||
        (rawMsg.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0]);
      return {
        title: blockedIp
          ? `Đã chặn địa chỉ IP ${blockedIp} truy cập vào dịch vụ "${targetName}" thành công`
          : `Đã kích hoạt chặn IP tạm thời cho dịch vụ "${targetName}" thành công`,
        detail: (cleanDetail && !cleanDetail.includes('Self-healing mitigate action')) ? cleanDetail : `K8s NetworkPolicy đã thiết lập cô lập IP tấn công bảo vệ workload "${targetName}" tại namespace "${ns}".`,
      };
    }
    const cleanDetail = String(rawMsg || '')
      .replace(/\s*\(Post-Action Verification Failed\):?/gi, ':')
      .replace(/Post-Action Verification Failed:?\s*/gi, '')
      .trim();

    return {
      title: `Đã thực thi thành công ${ACTION_LABELS_VI[code] || code} trên dịch vụ "${targetName}"`,
      detail: cleanDetail && !cleanDetail.includes('Self-healing mitigate action') ? cleanDetail : `Đã hoàn tất lệnh tự phục hồi trên "${targetName}" (namespace "${ns}").`,
    };
  }

  // 4. Other failed messages
  if (rawMsg.includes('HTTPHeaderDict')) {
    const cleanMsg = rawMsg.split('HTTP response headers:')[0].trim();
    return {
      title: `Thực thi ${actionVi} trên dịch vụ "${targetName}" thất bại`,
      detail: cleanMsg || 'Lỗi kết nối Kubernetes API khi thực thi lệnh tự phục hồi.',
    };
  }

  return {
    title: rawMsg || `Thực thi ${actionVi} trên dịch vụ "${targetName}"`,
    detail: item.error_message && item.error_message !== rawMsg ? item.error_message : null,
  };
};

export const HealingActionsPage = ({ onNavigate }) => {
  const { currentOrg, currentEnv } = useDashboard();
  const { can } = usePermissions();
  const [runningActions, setRunningActions] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [operatingActionId, setOperatingActionId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [confirmAbortModal, setConfirmAbortModal] = useState({ isOpen: false, action: null, reason: '' });
  const [runningPage] = useState(1);
  const RUNNING_PER_PAGE = 5;

  const activeClusterId = useMemo(() => {
    return currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster || '';
  }, [currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster]);

  const activeOrgId = useMemo(() => {
    return currentOrg?.id || '';
  }, [currentOrg?.id]);

  const mapBackendActionToUI = useCallback((item) => {
    const shortId = item.id && item.id.length > 8 ? `ACT-${item.id.slice(0, 8).toUpperCase()}` : (item.id || 'N/A');
    const isCancelled = item.execution_status === 'CANCELLED';
    const isFailed = item.execution_status === 'FAILED';
    const isRunning = item.execution_status === 'RUNNING' || item.execution_status === 'PENDING' || item.execution_status === 'QUEUED';

    let progress = 100;
    let stage = '5. KNOWLEDGE';
    let status = 'completed';

    if (isRunning) {
      status = 'running';
      progress = item.execution_status === 'RUNNING' ? 70 : 30;
      stage = item.execution_status === 'RUNNING' ? '4. EXECUTE' : '3. PLAN';
    } else if (isCancelled) {
      status = 'cancelled';
      progress = 100;
      stage = 'ĐÃ HỦY BỎ (ABORTED)';
    } else if (isFailed) {
      status = 'failed';
      progress = 100;
      stage = 'THẤT BẠI (FAILED)';
    }

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
    const elapsedSec = computedDurationMs > 0
      ? `${(computedDurationMs / 1000).toFixed(1)}s`
      : (item.elapsed_seconds !== undefined && item.elapsed_seconds !== null ? `${item.elapsed_seconds}s` : '0.1s');

    const targetName = item.target_name || item.target_id || 'Chưa xác định';
    const actionTypeCode = item.action_type_code || item.action_type_name || 'RESTART_POD';
    const clusterName = item.cluster_name || currentEnv?.name || currentEnv?.cluster || 'Mặc định';
    const orgName = item.organization_name || currentOrg?.name || 'Tổ chức hiện tại';
    const policyName = item.policy_name || 'Tự phục hồi trực tiếp (AI Trigger)';
    const formattedInfo = formatHealingActionDetails(item, actionTypeCode, targetName);

    const resolvedNs = item.result?.details?.namespace ||
      item.result?.namespace ||
      item.namespace ||
      (item.result?.message?.match(/namespace "([^"]+)"/)?.[1]) ||
      (item.error_message?.match(/namespace "([^"]+)"/)?.[1]) ||
      'default';

    return {
      id: shortId,
      rawId: item.id,
      title: formattedInfo.title,
      detailMessage: formattedInfo.detail,
      service: targetName,
      clusterName,
      orgName,
      namespace: resolvedNs,
      stage,
      progress,
      elapsed: elapsedSec,
      policy: policyName,
      status,
      executionStatus: item.execution_status || 'UNKNOWN',
      riskLevel: item.risk_level || 'LOW',
      executionMode: item.execution_mode || 'AUTO',
      approvalStatus: item.approval_status || 'NOT_REQUIRED',
      errorMessage: formattedInfo.detail || null,
      rawItem: item,
    };
  }, [currentEnv?.cluster, currentEnv?.name, currentOrg?.name]);

  // Dynamic 5-stage MAPE-K Autonomous Loop
  const mapekStages = useMemo(() => {
    const hasRunning = runningActions.some((a) => a.executionStatus === 'RUNNING');
    const hasPlanning = runningActions.some((a) => a.executionStatus === 'PENDING' || a.executionStatus === 'QUEUED');

    return [
      {
        step: '1. MONITOR',
        name: 'Giám Sát Viễn Trắc',
        desc: 'Thu thập tín hiệu eBPF và Kubelet telemetry liên tục mỗi 500ms',
        active: true,
        color: '#0284C7',
      },
      {
        step: '2. ANALYZE',
        name: 'Phân Tích Bất Thường',
        desc: 'Mô hình AI đối chiếu baseline và nhận diện chỉ số suy biến',
        active: hasPlanning || hasRunning,
        color: '#2563EB',
      },
      {
        step: '3. PLAN',
        name: 'Lập Kế Hoạch Vá Lỗi',
        desc: 'Tính toán blast radius, kiểm tra PDB và chuẩn bị payload',
        active: hasPlanning,
        color: '#7C3AED',
      },
      {
        step: '4. EXECUTE',
        name: 'Thực Thi Tự Động',
        desc: 'Điều phối API Kubernetes qua K8s Agent kết nối trực tiếp',
        active: hasRunning,
        color: '#059669',
      },
      {
        step: '5. KNOWLEDGE',
        name: 'Cập Nhật Tri Thức',
        desc: 'Lưu vết MTTR và cập nhật trọng số chính sách vào cơ sở dữ liệu',
        active: !hasRunning && !hasPlanning,
        color: '#0D9488',
      },
    ];
  }, [runningActions]);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    try {
      const [runningRes, recentRes] = await Promise.allSettled([
        selfHealingService.getRunningActions({
          cluster_id: activeClusterId,
          organization_id: activeOrgId,
        }),
        selfHealingService.getActions({
          cluster_id: activeClusterId,
          organization_id: activeOrgId,
          limit: 5,
        }),
      ]);

      if (runningRes.status === 'fulfilled') {
        const runningItems = runningRes.value?.items || (Array.isArray(runningRes.value) ? runningRes.value : []);
        setRunningActions(runningItems.map(mapBackendActionToUI));
      } else {
        setRunningActions([]);
      }

      if (recentRes.status === 'fulfilled') {
        const recentItems = recentRes.value?.items || (Array.isArray(recentRes.value) ? recentRes.value : []);
        setRecentActions(recentItems.map(mapBackendActionToUI));
      } else {
        setRecentActions([]);
      }
    } catch (err) {
      console.warn('[HealingActionsPage] Lỗi tải action:', err.message);
      setRunningActions([]);
      setRecentActions([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeClusterId, activeOrgId, mapBackendActionToUI]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // WebSocket Subscription for Realtime Updates from Main Backend
  useEffect(() => {
    let ws = null;
    try {
      const isSecure = window.location.protocol === 'https:';
      const protocol = isSecure ? 'wss:' : 'ws:';
      let host = window.location.host;
      if (['3000', '3001', '3002', '3003', '3004', '3005'].includes(window.location.port)) {
        const targetHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? '127.0.0.1'
          : window.location.hostname;
        host = `${targetHost}:5005`;
      }
      const token =
        localStorage.getItem('selfheal_auth_token') ||
        localStorage.getItem('token');
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const clusterParam = activeClusterId ? `&cluster_id=${encodeURIComponent(activeClusterId)}` : '';
      const wsUrl = `${protocol}//${host}/api/v1/telemetry/ws?${tokenParam}${clusterParam}`;

      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (
            payload.type === 'healing_action_started' ||
            payload.type === 'healing_action_completed' ||
            payload.type === 'healing_action_aborted' ||
            payload.type === 'healing_action_updated'
          ) {
            console.log('[HealingActionsPage] Live WebSocket notification received:', payload.type);
            fetchActions();
          }
        } catch (e) {
          // ignore non-json
        }
      };
    } catch (wsErr) {
      console.warn('[HealingActionsPage] WebSocket connection failed:', wsErr);
    }

    return () => {
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [activeClusterId, fetchActions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchActions();
  };

  const handleOpenAbortModal = (act) => {
    setConfirmAbortModal({
      isOpen: true,
      action: act,
      reason: 'Dừng can thiệp thủ công để kiểm tra sự cố',
    });
  };

  const handleConfirmAbort = async () => {
    if (!confirmAbortModal.action) return;
    const actionId = confirmAbortModal.action.rawId;
    const reason = confirmAbortModal.reason || 'Dừng can thiệp bởi quản trị viên';

    setOperatingActionId(actionId);
    try {
      await selfHealingService.abortAction(actionId, reason);
      setFeedbackMessage({ type: 'success', text: 'Đã gửi lệnh dừng khẩn cấp hành động thành công!' });
      setConfirmAbortModal({ isOpen: false, action: null, reason: '' });
      await fetchActions();
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: `Không thể hủy hành động: ${err.message}` });
    } finally {
      setOperatingActionId(null);
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  const totalRunningPages = Math.max(1, Math.ceil(runningActions.length / RUNNING_PER_PAGE));
  const safeRunningPage = Math.min(Math.max(1, runningPage), totalRunningPages);
  const paginatedRunningActions = useMemo(() => {
    const start = (safeRunningPage - 1) * RUNNING_PER_PAGE;
    return runningActions.slice(start, start + RUNNING_PER_PAGE);
  }, [runningActions, safeRunningPage]);

  const activeClusterLabel = currentEnv?.cluster || currentEnv?.name || 'Toàn hệ thống';

  const recentStats = useMemo(() => {
    const total = recentActions.length;
    const succeeded = recentActions.filter((a) => a.executionStatus === 'SUCCEEDED').length;
    const failed = recentActions.filter((a) => a.executionStatus === 'FAILED').length;
    const rate = total > 0 ? Math.round((succeeded / total) * 100) : 100;
    return { total, succeeded, failed, rate };
  }, [recentActions]);

  const kpiCardStyle = (accent) => ({
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(226, 232, 240, 0.95)',
    borderTop: `2.5px solid ${accent}`,
    borderRadius: '12px',
    padding: '11px 14px',
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
    minWidth: 0,
  });

  const actionBtnStyle = (variant = 'default', disabled = false) => ({
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    backgroundColor: variant === 'emerald' ? '#ECFDF5' : '#FFFFFF',
    border: variant === 'emerald' ? '1px solid #A7F3D0' : '1px solid rgba(203, 213, 225, 0.9)',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
    fontSize: '0.8rem',
    fontWeight: variant === 'emerald' ? 700 : 600,
    color: variant === 'emerald' ? '#047857' : disabled ? '#94A3B8' : '#334155',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  });

  return (
    <div className="dashboard-healing-actions-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: feedbackMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: feedbackMessage.type === 'success' ? '#047857' : '#B91C1C',
            border: `1px solid ${feedbackMessage.type === 'success' ? '#A7F3D0' : '#FCA5A5'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.825rem',
            fontWeight: 600,
          }}
        >
          {feedbackMessage.type === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

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
            <Zap size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Hành Động Tự Phục Hồi
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Giám sát chu trình tự phục hồi MAPE-K &amp; tiến trình can thiệp trực tiếp trên cụm{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{activeClusterLabel}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/self-healing/history')}
              style={actionBtnStyle('emerald', false)}
              title="Xem lịch sử phục hồi và phân tích MTTR"
            >
              <Clock size={14} />
              <span>Lịch sử phục hồi &rarr;</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={actionBtnStyle('default', isRefreshing || isLoading)}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Hàng 4 Thẻ KPI Tóm Tắt */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div style={kpiCardStyle('#3B82F6')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>ĐANG THỰC THI</span>
            <Activity size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: runningActions.length > 0 ? '#2563EB' : '#0F172A' }}>
              {runningActions.length}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
              {runningActions.length > 0 ? 'Tiến trình đang chạy' : 'Không có lệnh chờ'}
            </span>
          </div>
        </div>

        <div style={kpiCardStyle('#059669')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>HOÀN TẤT GẦN ĐÂY</span>
            <CheckCircle2 size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {recentStats.total}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
              {recentStats.succeeded} thành công
            </span>
          </div>
        </div>

        <div style={kpiCardStyle(recentStats.failed > 0 ? '#EF4444' : '#10B981')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>TỶ LỆ THÀNH CÔNG</span>
            <ShieldCheck size={14} color={recentStats.failed > 0 ? '#EF4444' : '#10B981'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#059669' }}>
              {recentStats.rate}%
            </span>
            <span style={{ fontSize: '0.7rem', color: recentStats.failed > 0 ? '#DC2626' : '#64748B' }}>
              {recentStats.failed > 0 ? `${recentStats.failed} thất bại` : 'Độ tin cậy cao'}
            </span>
          </div>
        </div>

        <div style={kpiCardStyle('#10B981')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>VÒNG LẶP MAPE-K</span>
            <Zap size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 9px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: '#ECFDF5',
                color: '#059669',
                border: '1px solid #A7F3D0',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              Đang hoạt động
            </span>
          </div>
        </div>
      </div>

      {/* 5-Stage MAPE-K Interactive Loop Visualization */}
      <div
        className="dash-card"
        style={{
          padding: '16px 18px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Tiến Trình 5 Giai Đoạn Của Vòng Lặp MAPE-K
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Chu trình phản hồi khép kín tự khắc phục sự cố không làm gián đoạn dịch vụ
            </p>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '999px',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              border: '1px solid #A7F3D0',
            }}
          >
            AUTONOMOUS LOOP: HOẠT ĐỘNG
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '10px',
          }}
        >
          {mapekStages.map((st, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px 14px',
                backgroundColor: st.active ? `${st.color}08` : '#F8FAFC',
                border: st.active ? `1px solid ${st.color}66` : '1px solid #E2E8F0',
                borderTop: `2.5px solid ${st.color}`,
                borderRadius: '11px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: st.active ? `0 4px 12px ${st.color}14` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: st.color }}>
                  {st.step}
                </span>
                {st.active && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: st.color,
                      display: 'inline-block',
                    }}
                  />
                )}
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>
                {st.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748B', lineHeight: 1.4 }}>
                {st.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIVE IN-FLIGHT ACTIONS CONTAINER */}
      <div
        className="dash-card"
        style={{
          padding: '16px 18px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={17} color="#059669" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Các Tiến Trình Can Thiệp Đang Diễn Ra
              </h3>
              <span
                style={{
                  padding: '2px 9px',
                  borderRadius: '999px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: runningActions.length > 0 ? '#EFF6FF' : '#F1F5F9',
                  color: runningActions.length > 0 ? '#1D4ED8' : '#64748B',
                  border: runningActions.length > 0 ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                }}
              >
                {runningActions.length} Đang thực thi
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '3px 0 0 0' }}>
              Lệnh can thiệp tự động đang được áp dụng trực tiếp lên Pods và Kubernetes API của cụm
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {runningActions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '38px 24px',
                backgroundColor: '#F8FAFC',
                borderRadius: '12px',
                border: '1px dashed #CBD5E1',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto',
                }}
              >
                <ShieldCheck size={26} color="#059669" />
              </div>
              <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '4px', fontSize: '0.98rem' }}>
                Cụm Kubernetes Đang Vận Hành Ổn Định
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748B', maxWidth: '520px', margin: '0 auto 16px auto', lineHeight: 1.5 }}>
                Hiện không có can thiệp tự phục hồi nào đang chạy ngầm trên cụm{' '}
                <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{activeClusterLabel}</strong>. Toàn bộ dịch vụ và Pods đều ở trạng thái an toàn.
              </p>

              {/* Quick Navigation Pills */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {onNavigate && (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/self-healing/history')}
                      style={actionBtnStyle('default', false)}
                    >
                      <Clock size={14} color="#2563EB" />
                      <span>Lịch sử phục hồi &amp; MTTR &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/self-healing/policies')}
                      style={actionBtnStyle('default', false)}
                    >
                      <Shield size={14} color="#059669" />
                      <span>Chính sách tự động &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/self-healing/approvals')}
                      style={actionBtnStyle('default', false)}
                    >
                      <CheckCircle2 size={14} color="#D97706" />
                      <span>Cổng phê duyệt HITL &rarr;</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            paginatedRunningActions.map((act) => (
              <div
                key={act.id}
                style={{
                  padding: '14px 18px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderLeft: '3.5px solid #2563EB',
                  borderRadius: '11px',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 700, color: '#047857' }}>
                        {act.id}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                        &bull; Mục tiêu: <strong style={{ color: '#0F172A' }}>{act.service}</strong> ({act.namespace})
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        {act.stage}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                      {act.title}
                    </div>
                    {act.detailMessage && (
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '3px', lineHeight: 1.45 }}>
                        {act.detailMessage}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: '#2563EB' }}>
                        TIẾN ĐỘ: {act.progress}%
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                        Thời gian: {act.elapsed} &bull; {act.policy}
                      </div>
                    </div>

                    {/* Abort button */}
                    {can(PERMISSIONS.POLICY_MANAGE) && (
                      <button
                        type="button"
                        disabled={operatingActionId === act.rawId}
                        onClick={() => handleOpenAbortModal(act)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          height: '32px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid #FECACA',
                          color: '#DC2626',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: operatingActionId === act.rawId ? 'not-allowed' : 'pointer',
                        }}
                        title="Hủy bỏ can thiệp này ngay lập tức"
                      >
                        <XCircle size={13} />
                        <span>{operatingActionId === act.rawId ? 'Đang hủy...' : 'Dừng can thiệp'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${act.progress}%`,
                      height: '100%',
                      backgroundColor: '#2563EB',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RECENT COMPLETED ACTIONS SECTION */}
      <div
        className="dash-card"
        style={{
          padding: '16px 18px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={17} color="#059669" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Các Can Thiệp Tự Phục Hồi Vừa Hoàn Tất
              </h3>
              <span
                style={{
                  padding: '2px 9px',
                  borderRadius: '999px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                }}
              >
                {recentActions.length} mới nhất
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '3px 0 0 0' }}>
              Nhật ký các hành động tự phục hồi vừa thực thi xong trên các Pods / Deployments trong cụm
            </p>
          </div>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/self-healing/history')}
              style={actionBtnStyle('default', false)}
            >
              <span>Toàn bộ lịch sử &amp; MTTR</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {recentActions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: '#64748B', fontSize: '0.825rem', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1' }}>
            Chưa ghi nhận hành động tự phục hồi nào trong cơ sở dữ liệu.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentActions.map((act) => {
              const isSuccess = act.executionStatus === 'SUCCEEDED';
              const isFailed = act.executionStatus === 'FAILED';
              const badgeBg = isSuccess ? '#ECFDF5' : isFailed ? '#FEF2F2' : '#F1F5F9';
              const badgeColor = isSuccess ? '#047857' : isFailed ? '#DC2626' : '#64748B';
              const badgeBorder = isSuccess ? '#A7F3D0' : isFailed ? '#FECACA' : '#CBD5E1';
              const badgeText = isSuccess ? 'Thành công' : isFailed ? 'Thất bại' : act.executionStatus;

              return (
                <div
                  key={act.id || act.rawId}
                  style={{
                    padding: '12px 15px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderLeft: `3.5px solid ${isSuccess ? '#10B981' : isFailed ? '#EF4444' : '#64748B'}`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#334155',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                          padding: '1px 7px',
                        }}
                      >
                        {act.id}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isSuccess ? <CheckCircle2 size={11} /> : isFailed ? <XCircle size={11} /> : null}
                        {badgeText}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                        Mục tiêu: <strong style={{ color: '#047857', fontFamily: 'var(--font-mono)' }}>{act.service}</strong>{' '}
                        <span style={{ color: '#94A3B8' }}>({act.namespace})</span>
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>
                      {act.title}
                    </div>
                    {act.detailMessage && (
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px', lineHeight: 1.45 }}>
                        {act.detailMessage}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '130px', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                      Thời gian: <strong style={{ color: '#0F172A' }}>{act.elapsed}</strong>
                    </div>
                    {act.rawItem?.created_at && (
                      <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '2px' }}>
                        {new Date(act.rawItem.created_at).toLocaleString('vi-VN')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ARCHITECTURAL SEPARATION GUIDE FOOTER */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <Activity size={15} color="#2563EB" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>1. Hành Động Tự Sửa</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Theo dõi thời gian thực các can thiệp đang chạy trên cụm K8s và chu trình MAPE-K. Hỗ trợ ngắt dừng khẩn cấp can thiệp.
          </p>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('/dashboard/self-healing/history')}
          style={{
            padding: '14px 16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
            cursor: onNavigate ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <Clock size={15} color="#059669" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>2. Lịch Sử Phục Hồi</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Toàn bộ nhật ký hành động đã hoàn tất/thất bại, lọc theo ngày/tháng/năm và biểu đồ phân tích thời gian hồi phục MTTR.
          </p>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('/dashboard/self-healing/approvals')}
          style={{
            padding: '14px 16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
            cursor: onNavigate ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <CheckCircle2 size={15} color="#D97706" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>3. Cổng Phê Duyệt (HITL)</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Cơ chế bảo vệ Human-in-the-Loop cho phép kỹ sư vận hành phê duyệt các hành động rủi ro cao trước khi áp dụng.
          </p>
        </div>
      </div>

      {/* MODAL: Xác Nhận Dừng Can Thiệp Tự Động */}
      {confirmAbortModal.isOpen && confirmAbortModal.action && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setConfirmAbortModal({ isOpen: false, action: null, reason: '' })}
        >
          <div
            className="dash-card"
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
              border: '1px solid var(--dash-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #FEE2E2',
                backgroundColor: '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#FEE2E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={18} color="#DC2626" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#991B1B' }}>
                    Xác Nhận Dừng Can Thiệp Tự Động
                  </h3>
                  <span style={{ fontSize: '0.6875rem', color: '#EF4444', fontFamily: 'var(--font-mono)' }}>
                    {confirmAbortModal.action.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmAbortModal({ isOpen: false, action: null, reason: '' })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--dash-text-primary)', lineHeight: 1.5 }}>
                Bạn có chắc chắn muốn dừng khẩn cấp can thiệp tự phục hồi đang chạy trên dịch vụ{' '}
                <strong>&ldquo;{confirmAbortModal.action.service}&rdquo;</strong>?
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', marginBottom: '6px' }}>
                  Lý do dừng khẩn cấp:
                </label>
                <input
                  type="text"
                  value={confirmAbortModal.reason}
                  onChange={(e) => setConfirmAbortModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Nhập lý do dừng can thiệp..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--dash-text-primary)',
                  }}
                />
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: '#92400E',
                  lineHeight: 1.4,
                }}
              >
                Hành động sẽ chuyển sang trạng thái <strong>ĐÃ HỦY BỎ (ABORTED)</strong> và ngắt tiến trình can thiệp trên cụm Kubernetes.
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid var(--dash-border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setConfirmAbortModal({ isOpen: false, action: null, reason: '' })}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={operatingActionId === confirmAbortModal.action.rawId}
                onClick={handleConfirmAbort}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: operatingActionId === confirmAbortModal.action.rawId ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <XCircle size={14} />
                <span>{operatingActionId === confirmAbortModal.action.rawId ? 'Đang dừng...' : 'Dừng Can Thiệp Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealingActionsPage;
