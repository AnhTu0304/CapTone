import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { selfHealingService } from '../../../services/selfHealingService';
import {
  Zap,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Clock,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';

const ACTION_LABELS_VI = {
  RESTART_POD: 'Khởi động lại Pod (RESTART_POD)',
  REPLACE_POD: 'Thay thế Pod mới (REPLACE_POD)',
  SCALE_REPLICAS: 'Mở rộng bản sao (SCALE_REPLICAS)',
  SCALE_UP: 'Tăng số lượng Pod (SCALE_UP)',
  SCALE_DOWN: 'Thu hẹp bản sao (SCALE_DOWN)',
  ROLLBACK_DEPLOYMENT: 'Quay lui phiên bản (ROLLBACK_DEPLOYMENT)',
  CLEANUP_STORAGE: 'Dọn dẹp ổ đĩa (CLEANUP_STORAGE)',
  CLEANUP_TEMP_FILES: 'Dọn dẹp tệp tạm (CLEANUP_TEMP_FILES)',
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
    /User\\?\s*"([^"\\]+)\\?"\s+cannot\s+(\w+)\s+resource\s+\\?"([^"\\]+)\\?"(?:\s+in API group\s+\\?"([^"\\]*)\\?")?(?:\s+in the namespace\s+\\?"([^"\\]+)\\?")?/i
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

  // 4. Other failed messages (strip HTTPHeaderDict dump if present)
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

export const HealingActionsPage = () => {
  const { currentOrg, currentEnv } = useDashboard();
  const [runningActions, setRunningActions] = useState([]);
  const [historyActions, setHistoryActions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [operatingActionId, setOperatingActionId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

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
    const hasRecentCompleted = historyActions.some((a) => {
      if (a.status !== 'completed' || !a.rawItem?.completed_at) return false;
      return Date.now() - new Date(a.rawItem.completed_at).getTime() < 120000;
    });

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
        active: hasRecentCompleted,
        color: '#0D9488',
      },
    ];
  }, [runningActions, historyActions]);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch currently running actions from Main Backend
      const runningRes = await selfHealingService.getRunningActions({
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
      });

      // 2. Fetch history actions from Main Backend
      const historyRes = await selfHealingService.getActions({
        limit: 15,
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
      });

      const runningItems = runningRes?.items || (Array.isArray(runningRes) ? runningRes : []);
      const historyItems = historyRes?.items || (Array.isArray(historyRes) ? historyRes : []);

      setRunningActions(runningItems.map(mapBackendActionToUI));
      setHistoryActions(historyItems.map(mapBackendActionToUI));
      setIsUsingLiveDb(true);
    } catch (err) {
      console.warn('[HealingActionsPage] Lỗi tải action:', err.message);
      setRunningActions([]);
      setHistoryActions([]);
      setIsUsingLiveDb(true);
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

  const handleAbortAction = async (actionId) => {
    const reason = window.prompt(
      'Nhập lý do dừng khẩn cấp hành động tự phục hồi:',
      'Dừng can thiệp thủ công để kiểm tra sự cố'
    );
    if (reason === null) return;

    setOperatingActionId(actionId);
    try {
      await selfHealingService.abortAction(actionId, reason || 'Dừng can thiệp bởi quản trị viên');
      setFeedbackMessage({ type: 'success', text: 'Đã gửi lệnh dừng khẩn cấp hành động thành công!' });
      await fetchActions();
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: `Không thể hủy hành động: ${err.message}` });
    } finally {
      setOperatingActionId(null);
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  const handleExecuteAction = async (actionId) => {
    if (!window.confirm('Bạn có chắc chắn muốn kích hoạt chạy lại hành động tự phục hồi này?')) return;

    setOperatingActionId(actionId);
    try {
      await selfHealingService.executeAction(actionId);
      setFeedbackMessage({ type: 'success', text: 'Đã kích hoạt thực thi hành động thành công qua Agent K8s!' });
      await fetchActions();
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: `Lỗi kích hoạt hành động: ${err.message}` });
    } finally {
      setOperatingActionId(null);
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

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
              Hành Động Tự Phục Hồi Đang Thực Thi (MAPE-K Closed Loop)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Tổ chức: <strong>{currentOrg?.name || 'Tổ chức hiện tại'}</strong> &bull; Cụm K8s: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{currentEnv?.name || currentEnv?.cluster || 'Tất cả cụm'}</span> &bull; Phân quyền Multi-tenant cách ly nghiêm ngặt
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

      {/* SECTION 1: Currently Running Actions */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#2563EB" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Hành Động Đang Chạy Ngầm Trong Cụm ({runningActions.length} Đang thực thi)
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Các can thiệp tự động đang được áp dụng trực tiếp lên Pods và Kubelet API của cụm
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {runningActions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--dash-text-muted)' }}>
              <ShieldCheck size={36} color="#059669" style={{ margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px', fontSize: '0.9375rem' }}>
                Cụm đang vận hành ổn định
              </div>
              <div style={{ fontSize: '0.8125rem' }}>
                Không có can thiệp tự phục hồi nào đang chạy ngầm trên cụm ({currentEnv?.name || currentEnv?.cluster || 'Production Cluster'}). Toàn bộ tiến trình đang an toàn.
              </div>
            </div>
          ) : (
            runningActions.map((act) => (
              <div
                key={act.id}
                style={{
                  padding: '16px 20px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderLeft: '4px solid #2563EB',
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
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        {act.stage}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '4px 0 0 0' }}>
                      {act.title}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 800, color: '#2563EB' }}>
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
                      onClick={() => handleAbortAction(act.rawId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#FEE2E2',
                        border: '1px solid #FCA5A5',
                        color: '#B91C1C',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: operatingActionId === act.rawId ? 'not-allowed' : 'pointer',
                      }}
                      title="Dừng khẩn cấp can thiệp tự phục hồi"
                    >
                      <XCircle size={14} />
                      <span>{operatingActionId === act.rawId ? 'Đang dừng...' : 'Dừng can thiệp'}</span>
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
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

      {/* SECTION 2: Recent Healing Actions History */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--dash-text-primary)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Lịch Sử Các Hành Động Vừa Thực Thi Trong Cụm ({historyActions.length})
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Ghi nhận đầy đủ kiểm toán kết quả khôi phục, thời gian hoàn tất và chính sách tự phục hồi
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {historyActions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--dash-text-muted)', fontSize: '0.8125rem' }}>
              Chưa có lịch sử can thiệp tự phục hồi nào được ghi nhận cho cụm này.
            </div>
          ) : (
            historyActions.map((act) => {
              const isCompleted = act.status === 'completed';
              const isCancelled = act.status === 'cancelled';
              const isFailed = act.status === 'failed';

              let borderColor = 'var(--dash-border)';
              let leftColor = '#64748B';
              let badgeBg = '#F1F5F9';
              let badgeColor = '#475569';
              let badgeBorder = '#CBD5E1';

              if (isCompleted) {
                borderColor = '#34D399';
                leftColor = '#059669';
                badgeBg = '#ECFDF5';
                badgeColor = '#059669';
                badgeBorder = '#A7F3D0';
              } else if (isCancelled) {
                borderColor = '#FCD34D';
                leftColor = '#D97706';
                badgeBg = '#FEF3C7';
                badgeColor = '#B45309';
                badgeBorder = '#FDE68A';
              } else if (isFailed) {
                borderColor = '#FCA5A5';
                leftColor = '#DC2626';
                badgeBg = '#FEE2E2';
                badgeColor = '#DC2626';
                badgeBorder = '#FCA5A5';
              }

              return (
                <div
                  key={act.id}
                  style={{
                    padding: '14px 18px',
                    backgroundColor: isCompleted ? 'rgba(5, 150, 105, 0.02)' : '#FFFFFF',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: '1 1 520px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-primary)' }}>
                        {act.id}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                        &bull; Workload: <strong>{act.service}</strong>
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          borderRadius: '4px',
                        }}
                      >
                        {act.stage}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '4px' }}>
                      {act.title}
                    </div>
                    {act.errorMessage && (
                      <div style={{ fontSize: '0.78125rem', color: isFailed ? '#DC2626' : '#475569', marginTop: '3px', lineHeight: 1.45 }}>
                        {act.errorMessage}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: leftColor }}>
                        {act.executionStatus}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                        Thời lượng: {act.elapsed} &bull; {act.policy}
                      </div>
                    </div>

                    {/* Retry button */}
                    <button
                      type="button"
                      disabled={operatingActionId === act.rawId}
                      onClick={() => handleExecuteAction(act.rawId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        color: '#2563EB',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: operatingActionId === act.rawId ? 'not-allowed' : 'pointer',
                      }}
                      title="Kích hoạt chạy lại hành động tự phục hồi này"
                    >
                      <RotateCcw size={13} />
                      <span>{operatingActionId === act.rawId ? 'Đang chạy...' : 'Kích hoạt lại'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default HealingActionsPage;
