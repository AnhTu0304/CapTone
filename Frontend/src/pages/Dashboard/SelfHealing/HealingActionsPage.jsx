import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { selfHealingService } from '../../../services/selfHealingService';
import {
  Zap,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Layers,
  ChevronRight,
  Clock,
  Shield,
  FileText,
  Sliders,
  Check,
  X
} from 'lucide-react';

const ACTION_LABELS_VI = {
  RESTART_POD: 'Restart Pod',
  REPLACE_POD: 'Replace Pod',
  SCALE_REPLICAS: 'Scale Replicas',
  SCALE_UP: 'Scale Up',
  SCALE_DOWN: 'Scale Down',
  ROLLBACK_DEPLOYMENT: 'Rollback Deployment',
  CLEANUP_STORAGE: 'Cleanup Storage',
  CLEANUP_TEMP_FILES: 'Cleanup Temp Files',
  TEMPORARY_IP_BLOCK: 'Chặn tạm thời IP tấn công (TEMPORARY_IP_BLOCK)',
  BLOCK_IP_TEMP: 'Chặn tạm thời IP tấn công (BLOCK_IP_TEMP)',
  NO_ACTION: 'Giám sát an toàn (NO_ACTION)',
};

const formatHealingActionDetails = (item, actionCode, targetName) => {
  const ns = item.namespace || 'default';
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
    return {
      title: `Đã thực thi thành công ${ACTION_LABELS_VI[code] || code} trên dịch vụ "${targetName}"`,
      detail: rawMsg && !rawMsg.includes('Self-healing mitigate action') ? rawMsg : `Đã hoàn tất lệnh tự phục hồi trên "${targetName}" (namespace "${ns}").`,
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
  const [runningActions, setRunningActions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [operatingActionId, setOperatingActionId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [confirmAbortModal, setConfirmAbortModal] = useState({ isOpen: false, action: null, reason: '' });
  const [runningPage, setRunningPage] = useState(1);
  const RUNNING_PER_PAGE = 5;

  const activeClusterId = useMemo(() => {
    return currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster || '';
  }, [currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster]);

  const activeOrgId = useMemo(() => {
    return currentOrg?.id || '';
  }, [currentOrg?.id]);

  const mapBackendActionToUI = useCallback((item) => {
    const shortId = item.id && item.id.length > 8 ? `ACT-${item.id.slice(0, 8).toUpperCase()}` : (item.id || 'N/A');
    const isCompleted = item.execution_status === 'SUCCEEDED';
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

    const durMs = item.attempts && item.attempts[0]?.duration_ms ? item.attempts[0].duration_ms : 1500;
    const elapsedSec = item.elapsed_seconds !== undefined && item.elapsed_seconds !== null
      ? `${item.elapsed_seconds}s`
      : `${(durMs / 1000).toFixed(1)}s`;

    const targetName = item.target_name || item.target_id || 'Chưa xác định';
    const actionTypeCode = item.action_type_code || item.action_type_name || 'RESTART_POD';
    const clusterName = item.cluster_name || currentEnv?.name || currentEnv?.cluster || 'Mặc định';
    const orgName = item.organization_name || currentOrg?.name || 'Tổ chức hiện tại';
    const policyName = item.policy_name || 'Tự phục hồi trực tiếp (AI Trigger)';
    const formattedInfo = formatHealingActionDetails(item, actionTypeCode, targetName);

    return {
      id: shortId,
      rawId: item.id,
      title: formattedInfo.title,
      detailMessage: formattedInfo.detail,
      service: targetName,
      clusterName,
      orgName,
      namespace: item.namespace || 'default',
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
      const runningRes = await selfHealingService.getRunningActions({
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
      });

      const runningItems = runningRes?.items || (Array.isArray(runningRes) ? runningRes : []);
      setRunningActions(runningItems.map(mapBackendActionToUI));
    } catch (err) {
      console.warn('[HealingActionsPage] Lỗi tải action:', err.message);
      setRunningActions([]);
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
      if (window.location.port === '3000' || window.location.port === '3001') {
        host = `${window.location.hostname}:5000`;
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

  return (
    <div className="dashboard-healing-actions-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--dash-radius-md)',
            backgroundColor: feedbackMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
            color: feedbackMessage.type === 'success' ? '#15803D' : '#B91C1C',
            border: `1px solid ${feedbackMessage.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {feedbackMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Hành Động Tự Phục Hồi Đang Thực Thi (Active & In-Flight)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Giám sát tiến trình điều phối tự phục hồi MAPE-K và các can thiệp thời gian thực trên cụm máy chủ
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/self-healing/history')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Xem nhật ký kiểm toán và báo cáo MTTR"
            >
              <Clock size={14} />
              <span>Lịch Sử Phục Hồi & MTTR &rarr;</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>Đồng bộ tiến trình</span>
          </button>
        </div>
      </div>

      {/* 5-Stage MAPE-K Interactive Loop Visualization */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Tiến Trình 5 Giai Đoạn Của Vòng Lặp MAPE-K
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Chu trình phản hồi khép kín tự khắc phục sự cố không làm gián đoạn người dùng cuối
            </p>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              padding: '2px 8px',
              backgroundColor: 'rgba(5, 150, 105, 0.1)',
              color: '#059669',
              border: '1px solid #34D399',
            }}
          >
            AUTONOMOUS LOOP: HOẠT ĐỘNG
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
          }}
        >
          {mapekStages.map((st, idx) => (
            <div
              key={idx}
              style={{
                padding: '14px',
                backgroundColor: st.active ? 'rgba(37, 99, 235, 0.03)' : '#FFFFFF',
                border: st.active ? `1px solid ${st.color}` : '1px solid var(--dash-border)',
                borderTop: `3px solid ${st.color}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: st.active ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: st.color }}>
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
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                {st.name}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', lineHeight: 1.35 }}>
                {st.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIVE IN-FLIGHT ACTIONS CONTAINER */}
      <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#2563EB" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Các Tiến Trình Can Thiệp Đang Diễn Ra Trong Cụm
              </h3>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: runningActions.length > 0 ? '#DBEAFE' : '#F1F5F9',
                  color: runningActions.length > 0 ? '#1E40AF' : '#64748B',
                }}
              >
                {runningActions.length} Đang thực thi
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Lệnh can thiệp tự động đang được áp dụng trực tiếp lên Pods và Kubelet API của cụm máy chủ
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {runningActions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                backgroundColor: '#F8FAFC',
                borderRadius: '12px',
                border: '1px dashed #CBD5E1',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                }}
              >
                <ShieldCheck size={32} color="#15803D" />
              </div>
              <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '6px', fontSize: '1.125rem' }}>
                Cụm Kubernetes Đang Vận Hành Ổn Định
              </div>
              <p style={{ fontSize: '0.875rem', color: '#64748B', maxWidth: '540px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
                Hiện không có can thiệp tự phục hồi nào đang chạy ngầm trên cụm ({currentEnv?.name || currentEnv?.cluster || 'Production Cluster'}). Toàn bộ các dịch vụ và Pods đều ở trạng thái an toàn.
              </p>

              {/* Quick Navigation Pills */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {onNavigate && (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/self-healing/history')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 16px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: '#1E293B',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      <Clock size={15} color="#2563EB" />
                      <span>Tra cứu Lịch Sử Phục Hồi & Báo Cáo MTTR &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/self-healing/policies')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 16px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: '#1E293B',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      <Shield size={15} color="#059669" />
                      <span>Cấu Hình Chính Sách Tự Động &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/self-healing/approvals')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 16px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: '#1E293B',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      <CheckCircle2 size={15} color="#D97706" />
                      <span>Cổng Phê Duyệt (HITL) &rarr;</span>
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
                  padding: '16px 20px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderLeft: '4px solid #2563EB',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-primary)' }}>
                        {act.id}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                        &bull; Mục tiêu: <strong>{act.service}</strong> ({act.namespace})
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        {act.stage}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '4px' }}>
                      {act.title}
                    </div>
                    {act.detailMessage && (
                      <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '3px', lineHeight: 1.45 }}>
                        {act.detailMessage}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 700, color: '#2563EB' }}>
                        TIẾN ĐỘ: {act.progress}%
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                        Thời gian chạy: {act.elapsed} &bull; Chính sách: {act.policy}
                      </div>
                    </div>

                    {/* Abort button */}
                    <button
                      type="button"
                      disabled={operatingActionId === act.rawId}
                      onClick={() => handleOpenAbortModal(act)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: '#DC2626',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: operatingActionId === act.rawId ? 'not-allowed' : 'pointer',
                      }}
                      title="Hủy bỏ can thiệp này ngay lập tức"
                    >
                      <XCircle size={13} />
                      <span>{operatingActionId === act.rawId ? 'Đang hủy...' : 'Dừng can thiệp'}</span>
                    </button>
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

      {/* ARCHITECTURAL SEPARATION GUIDE FOOTER */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginTop: '4px',
        }}
      >
        <div style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Activity size={16} color="#2563EB" />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>1. Hành Động Tự Sửa</span>
          </div>
          <p style={{ fontSize: '0.78125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Theo dõi thời gian thực các can thiệp đang chạy (In-Flight) trên cụm K8s và chu trình MAPE-K. Hỗ trợ ngắt dừng khẩn cấp can thiệp.
          </p>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Clock size={16} color="#059669" />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>2. Lịch Sử Phục Hồi</span>
          </div>
          <p style={{ fontSize: '0.78125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Toàn bộ nhật ký kiểm toán hành động đã hoàn tất/thất bại, lọc theo ngày/tháng/năm và biểu đồ phân tích thời gian hồi phục MTTR.
          </p>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <CheckCircle2 size={16} color="#D97706" />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>3. Cổng Phê Duyệt (HITL)</span>
          </div>
          <p style={{ fontSize: '0.78125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Cơ chế bảo vệ Human-in-the-Loop cho phép kỹ sư vận hành phê duyệt các hành động có rủi ro cao trước khi áp dụng vào sản xuất.
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
