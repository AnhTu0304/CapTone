import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { useDashboard } from '../context/DashboardContext';
import { PermissionGate } from '../../../components/common/PermissionGate';
import { PERMISSIONS } from '../../../hooks/usePermissions';
import { useToast } from '../../../context/ToastContext';
import { selfHealingService } from '../../../services/selfHealingService';
import telemetryService from '../../../services/telemetryService';
import { podService } from '../../../services/podService';
import aiService from '../../../services/aiService';
import RootCauseModal from '../Incidents/RootCauseModal';
import { translateIncidentTitle } from '../Incidents/incidentUtils';
import {
  CheckCircle2,
  FileCode,
  Mail,
  ShieldCheck,
  Sparkles,
  Check,
  X,
  RefreshCw,
  Zap,
  Server,
  Box,
  Layers,
  Clock,
  AlertTriangle,
  Target,
  Eye,
  Search,
  Filter,
  CheckCheck,
  ShieldAlert,
  Info,
} from 'lucide-react';

export const ApprovalsPage = () => {
  const { currentOrg, currentEnv, setCurrentEnv, envList, isRefreshing, triggerRefresh, refreshPendingApprovals } = useDashboard();
  const { success: toastSuccess, warning: toastWarning } = useToast();
  const getQueryTarget = () => {
    try {
      return new URLSearchParams(window.location.search).get('target') || '';
    } catch {
      return '';
    }
  };

  const [activeDiffModal, setActiveDiffModal] = useState(null);
  const [evidenceIncident, setEvidenceIncident] = useState(null);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [searchTerm, setSearchTerm] = useState(getQueryTarget());
  const [clusterFilter, setClusterFilter] = useState('all');
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);

  const [approvedIds, setApprovedIds] = useState([]);
  const [rejectedIds, setRejectedIds] = useState([]);

  // Lựa chọn 1: Chế độ Tự Động Hủy Khi Dịch Vụ Tự Lành (100% Tự động)
  const [isAutoDismissEnabled, setIsAutoDismissEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('captone_hitl_auto_dismiss');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleAutoDismiss = useCallback(() => {
    const next = !isAutoDismissEnabled;
    setIsAutoDismissEnabled(next);
    try {
      localStorage.setItem('captone_hitl_auto_dismiss', String(next));
    } catch {}
    if (next) {
      toastSuccess('Đã BẬT cơ chế tự động hủy khi dịch vụ tự lành (100% Tự động).');
    } else {
      toastWarning('Đã TẮT cơ chế tự động hủy (Chuyển sang chế độ duyệt thủ công).');
    }
  }, [isAutoDismissEnabled, toastSuccess, toastWarning]);
  const [autoDismissedList, setAutoDismissedList] = useState([]);
  const [workloadHealthMap, setWorkloadHealthMap] = useState({});

  // Cập nhật searchTerm nếu URL query param thay đổi
  useEffect(() => {
    const handleUrlChange = () => {
      const q = getQueryTarget();
      if (q) setSearchTerm(q);
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const mapBackendApprovalToUI = useCallback((item) => {
    const shortId = item.id && item.id.length > 8 ? `REQ-HITL-${item.id.slice(0, 6).toUpperCase()}` : (item.id || 'N/A');
    const rawTarget = item.target_name || item.target_id || 'k8s-workload';
    const targetName = String(rawTarget).replace(/^[A-Za-z0-9_-]+\//i, '').trim();

    const rawActionCode = item.action_code || item.action_type_code || item.action_name || item.action_type_name || '';
    const searchCode = (String(rawActionCode) + ' ' + String(item.policy_name || '') + ' ' + String(item.ai_reasoning || '')).toUpperCase();
    
    let actionFriendlyName = 'Tự phục hồi dịch vụ';
    let actionCategory = 'POD';

    if (searchCode.includes('DRAIN')) {
      actionFriendlyName = 'Di tản & Cô lập Node (Drain Node)';
      actionCategory = 'NODE';
    } else if (searchCode.includes('CORDON')) {
      actionFriendlyName = 'Khóa lập lịch Node (Cordon Node)';
      actionCategory = 'NODE';
    } else if (searchCode.includes('ROLLBACK')) {
      actionFriendlyName = 'Hoàn nguyên (Rollback Deployment)';
      actionCategory = 'DEPLOYMENT';
    } else if (searchCode.includes('SCALE')) {
      actionFriendlyName = 'Mở rộng bản sao (Scale Replicas)';
      actionCategory = 'WORKLOAD';
    } else if (searchCode.includes('RESTART_DEPLOYMENT') || (searchCode.includes('RESTART') && searchCode.includes('DEPLOYMENT'))) {
      actionFriendlyName = 'Khởi động lại Deployment';
      actionCategory = 'DEPLOYMENT';
    } else if (searchCode.includes('RESTART')) {
      actionFriendlyName = 'Khởi động lại Pod (Restart Pod)';
      actionCategory = 'POD';
    } else if (searchCode.includes('REPLACE')) {
      actionFriendlyName = 'Thay thế Pod (Replace Pod)';
      actionCategory = 'POD';
    } else if (searchCode.includes('ADJUST') || searchCode.includes('LIMIT')) {
      actionFriendlyName = 'Điều chỉnh tài nguyên (Adjust Limits)';
      actionCategory = 'WORKLOAD';
    } else if (searchCode.includes('CLEANUP') || searchCode.includes('TEMP')) {
      actionFriendlyName = 'Dọn dẹp lưu trữ (Cleanup Storage)';
      actionCategory = 'STORAGE';
    } else if (searchCode.includes('BLOCK')) {
      actionFriendlyName = 'Chặn IP bất thường (Block IP)';
      actionCategory = 'SECURITY';
    } else if (searchCode.includes('NO_ACTION')) {
      actionFriendlyName = 'Không can thiệp (No Action)';
      actionCategory = 'POD';
    } else if (item.action_name) {
      actionFriendlyName = item.action_name;
    }

    const rootCause = item.root_cause_type || (item.incident_title ? item.incident_title.replace(/^\[.*?\]\s*/, '') : 'Chưa xác định nguyên nhân gốc rễ');
    const confidence = item.confidence_score !== null && item.confidence_score !== undefined
      ? Math.round(Number(item.confidence_score) <= 1 ? Number(item.confidence_score) * 100 : Number(item.confidence_score))
      : null;

    const rawRisk = (item.risk_level || item.recommendation_risk_level || '').toUpperCase();
    let riskLevelVi = 'Chưa phân loại';
    if (rawRisk === 'LOW') riskLevelVi = 'Thấp';
    else if (rawRisk === 'MEDIUM') riskLevelVi = 'Trung bình';
    else if (rawRisk === 'HIGH') riskLevelVi = 'Cao';
    else if (rawRisk === 'CRITICAL') riskLevelVi = 'Khẩn cấp';

    const policyName = item.policy_name || 'POL-SAFETY-DEFAULT';

    const rawTitle = item.incident_title || `${actionFriendlyName} trên ${targetName}`;
    let cleanTitle = translateIncidentTitle(rawTitle);
    if (!cleanTitle.toLowerCase().startsWith('sự cố') && !cleanTitle.toLowerCase().startsWith('lỗi')) {
      cleanTitle = `Sự cố: ${cleanTitle}`;
    }

    const actionShortId = item.healing_action_id && item.healing_action_id.length > 8
      ? `ACT-${item.healing_action_id.slice(0, 8).toUpperCase()}`
      : null;

    return {
      id: shortId,
      actionShortId,
      rawId: item.healing_action_id || item.id,
      approvalId: item.id,
      incidentId: item.incident_id,
      predictionId: item.prediction_id || null,
      recommendationId: item.recommendation_id,
      actionCode: rawActionCode,
      actionName: actionFriendlyName,
      actionFriendlyName,
      actionCategory,
      cleanTitle,
      title: cleanTitle,
      targetName,
      target: targetName,
      clusterName: item.cluster_name || null,
      clusterId: item.cluster_id || null,
      recommendationRiskLevel: item.recommendation_risk_level || item.risk_level || null,
      recommendationPriority: item.recommendation_priority || null,
      analysisMethod: item.analysis_method || null,
      rootCauseType: rootCause,
      rootCauseDesc: item.root_cause_description || null,
      confidenceScore: confidence,
      aiReasoning: item.ai_reasoning || item.reason || `Đề xuất thực thi ${actionFriendlyName} trên dịch vụ ${targetName}.`,
      policyName,
      requestedBy: 'Hệ thống AI Tự thích ứng (MAPE-K)',
      riskLevelVi,
      urgency: rawRisk || 'Chưa phân loại',
      reason: item.reason || `Chính sách ${policyName} yêu cầu phê duyệt con người trước khi thực thi.`,
      blastRadius: `Môi trường Production (Bảo vệ qua PDB)`,
      rawRequestedAt: item.requested_at,
      timestamp: item.requested_at ? new Date(item.requested_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date(item.requested_at).toLocaleDateString('vi-VN') : 'Vừa xong',
      actionResult: item.action_result,
      diff: {
        file: `${targetName}-deployment.yaml`,
        before: `# Cấu hình hiện tại (${targetName})\nspec:\n  dịch_vụ: ${targetName}\n  trạng_thái: Bị suy giảm hiệu năng (Degraded)\n  mức_độ_rủi_ro: ${riskLevelVi}`,
        after: `# Cấu hình tự phục hồi sau khi phê duyệt\nspec:\n  dịch_vụ: ${targetName}\n  hành_động: ${actionFriendlyName}\n  kết_quả_dự_kiến: Tự phục hồi an toàn (AutoHealed)`,
      },
    };
  }, []);


  const fetchApprovals = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const activeOrgId = currentOrg?.id;
      let targetClusterId;
      if (clusterFilter === 'all') {
        targetClusterId = 'all';
      } else if (clusterFilter === 'current') {
        targetClusterId = currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster;
      } else {
        targetClusterId = clusterFilter;
      }

      // 1. Kiểm tra trạng thái Pods thực tế trên cụm để đối chiếu sức khỏe dịch vụ
      let clusterPods = [];
      const effectiveClusterId = currentEnv?.clusterId || currentEnv?.id;
      if (effectiveClusterId && !effectiveClusterId.startsWith('org-')) {
        try {
          clusterPods = await podService.getPodsByCluster(effectiveClusterId);
        } catch {
          clusterPods = [];
        }
      }

      // Xây dựng bản đồ sức khỏe Workload theo Pods thực tế
      const healthMap = {};
      if (Array.isArray(clusterPods) && clusterPods.length > 0) {
        for (const pod of clusterPods) {
          const podName = String(pod.name || '').toLowerCase();
          const pStatus = String(pod.status || pod.phase || '').toLowerCase();
          const isHealthy = pStatus === 'running' || pStatus === 'succeeded';

          const baseName = podName.replace(/-[a-z0-9]{8,10}-[a-z0-9]{5}$/, '').replace(/-[a-z0-9]{5}$/, '');
          if (!healthMap[baseName]) {
            healthMap[baseName] = { total: 0, healthy: 0, pods: [] };
          }
          healthMap[baseName].total += 1;
          if (isHealthy) healthMap[baseName].healthy += 1;
          healthMap[baseName].pods.push(pod);
        }
      }
      setWorkloadHealthMap(healthMap);

      const offset = (page - 1) * ITEMS_PER_PAGE;
      const res = await selfHealingService.getApprovals({
        organization_id: activeOrgId,
        cluster_id: targetClusterId,
        status: 'PENDING',
        search: searchTerm.trim() || undefined,
        limit: ITEMS_PER_PAGE,
        offset: offset,
      });
      const rawItems = res?.items || (Array.isArray(res) ? res : []);
      let total = typeof res?.total === 'number' ? res.total : rawItems.length;

      // ⚡ RECONCILER (Lựa chọn 1: Tự động 100% khi dịch vụ tự lành)
      // Nếu dịch vụ đã tự ổn định lại (Pods Healthy 100%), hoặc sự cố đã giải quyết,
      // hoặc yêu cầu quá hạn (> 15 phút): Hệ thống TỰ ĐỘNG THU HỒI / HỦY BỎ.
      const now = Date.now();
      const validItems = [];
      const newlyDismissed = [];

      for (const item of rawItems) {
        const reqTime = new Date(item.requested_at || 0).getTime();
        const ageMs = now - reqTime;
        const isStale = ageMs > 15 * 60 * 1000;
        const isIncidentResolved = item.incident_status === 'RESOLVED' || item.incident_status === 'CLOSED';

        const rawTarget = item.target_name || item.target_id || '';
        const cleanTarget = String(rawTarget).replace(/^[A-Za-z0-9_-]+\//i, '').trim().toLowerCase();

        let isWorkloadSelfHealed = false;
        let matchedHealth = healthMap[cleanTarget];
        if (!matchedHealth) {
          const key = Object.keys(healthMap).find((k) => cleanTarget.includes(k) || k.includes(cleanTarget));
          if (key) matchedHealth = healthMap[key];
        }
        if (matchedHealth && matchedHealth.total > 0 && matchedHealth.healthy === matchedHealth.total) {
          isWorkloadSelfHealed = true;
        }

        const shouldDismiss = isAutoDismissEnabled && (isWorkloadSelfHealed || isStale || isIncidentResolved);

        if (shouldDismiss) {
          const actionId = item.healing_action_id || item.id;
          const dismissReason = isWorkloadSelfHealed
            ? 'Hệ thống tự động hủy: Dịch vụ đã tự phục hồi ổn định (Auto-recovered)'
            : isStale
            ? 'Hệ thống tự động hủy: Yêu cầu đã quá hạn (Stale HITL timeout > 15m), dịch vụ đã ổn định'
            : 'Hệ thống tự động hủy: Sự cố liên quan đã được xử lý (Incident Resolved)';

          if (actionId) {
            selfHealingService.rejectAction(actionId, dismissReason).catch(() => {});
          }
          if (item.incident_id && isWorkloadSelfHealed) {
            aiService.updateIncidentStatus(item.incident_id, 'RESOLVED').catch(() => {});
          }

          newlyDismissed.push({
            id: item.id,
            targetName: cleanTarget || item.target_name,
            actionName: item.action_name || 'Tự phục hồi dịch vụ',
            reason: dismissReason,
            dismissedAt: new Date(),
          });
          total = Math.max(0, total - 1);
        } else {
          validItems.push(item);
        }
      }

      if (newlyDismissed.length > 0) {
        setAutoDismissedList((prev) => [...newlyDismissed, ...prev].slice(0, 10));
        if (typeof refreshPendingApprovals === 'function') {
          refreshPendingApprovals();
        }
      }

      const totalPg = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
      if (page > totalPg && total > 0) {
        setCurrentPage(totalPg);
        return;
      }
      setApprovalRequests(validItems.map(mapBackendApprovalToUI));
      setTotalCount(total);
      setIsUsingLiveDb(true);
    } catch (err) {
      console.warn('[ApprovalsPage] Lỗi tải danh sách phê duyệt:', err.message);
      setApprovalRequests([]);
      setTotalCount(0);
      setIsUsingLiveDb(true);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster, clusterFilter, searchTerm, mapBackendApprovalToUI, isAutoDismissEnabled, refreshPendingApprovals]);

  useEffect(() => {
    fetchApprovals(currentPage);
  }, [fetchApprovals, currentPage, searchTerm, clusterFilter, isRefreshing, currentOrg?.id, currentEnv?.id, currentEnv?.cluster]);

  // ⚡ Lắng nghe WebSocket Real-time: Tự động cập nhật danh sách phê duyệt khi có sự kiện mới
  useEffect(() => {
    const activeClusterId = currentEnv?.clusterId || currentEnv?.id;
    const unsubscribe = telemetryService.subscribeWebSocket(
      'sme-order-service',
      (payload) => {
        if (!payload || !payload.type) return;

        if (
          payload.type === 'approval_created' ||
          payload.type === 'approval_status_changed' ||
          payload.type === 'healing_action_triggered' ||
          payload.type === 'healing_action_completed' ||
          payload.type === 'healing_action_aborted'
        ) {
          fetchApprovals(currentPage);
        }
      },
      (connected) => {
        setIsWsConnected(connected);
      },
      activeClusterId && !activeClusterId.startsWith('org-') ? activeClusterId : null
    );

    return () => {
      unsubscribe();
    };
  }, [fetchApprovals, currentPage, currentEnv?.clusterId, currentEnv?.id]);


  const handleApprove = async (id) => {
    const req = approvalRequests.find((r) => r.id === id);
    const actionId = req?.rawId || id;
    setApprovedIds((prev) => [...prev, id]);
    setActiveDiffModal(null);

    try {
      if (actionId) {
        await selfHealingService.approveAction(actionId, 'Được phê duyệt bởi SME Owner/DevOps qua giao diện HITL');
      }
      toastSuccess('Đã phê duyệt và chuyển lệnh tự phục hồi tới Kubelet cụm máy chủ!', 'HITL Phê Duyệt');

      try {
        const approvedRecs = JSON.parse(sessionStorage.getItem('applied_recommendations') || '[]');
        if (req?.recommendationId) approvedRecs.push(req.recommendationId);
        if (req?.targetName) approvedRecs.push(req.targetName.toLowerCase());
        sessionStorage.setItem('applied_recommendations', JSON.stringify(approvedRecs));
        window.dispatchEvent(new CustomEvent('hitl-approval-success', { detail: { actionId, req } }));
      } catch {}

      setTimeout(() => {
        fetchApprovals(currentPage);
      }, 500);
    } catch (err) {
      console.warn('Lỗi gửi phê duyệt tới DB:', err.message);
      toastSuccess('Đã xác nhận phê duyệt hành động tự phục hồi!', 'HITL Phê Duyệt');
    }
  };

  const [sendingEmailId, setSendingEmailId] = useState(null);

  const handleSendEmail = async (req) => {
    const actionId = req?.rawId || req?.id;
    if (!actionId) return;
    setSendingEmailId(req.id);
    try {
      const res = await selfHealingService.resendNotification(actionId);
      toastSuccess(res?.message || 'Đã gửi email thông báo phê duyệt tới các kỹ sư có quyền (SME/DevOps)!', 'Email Thông Báo');
    } catch (err) {
      toastWarning(err?.message || 'Không thể gửi email thông báo lúc này', 'Gửi Email Thất Bại');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleReject = async (id) => {
    const req = approvalRequests.find((r) => r.id === id);
    const actionId = req?.rawId || id;
    setRejectedIds((prev) => [...prev, id]);
    setActiveDiffModal(null);

    try {
      if (actionId) {
        await selfHealingService.rejectAction(actionId, 'Từ chối bởi SME Owner/DevOps do rủi ro gián đoạn');
      }
      toastWarning('Đã từ chối hành động tự phục hồi. Yêu cầu đã được ghi vào sổ kiểm toán.', 'HITL Từ Chối');
      setTimeout(() => {
        fetchApprovals(currentPage);
      }, 500);
    } catch (err) {
      console.warn('Lỗi gửi từ chối tới DB:', err.message);
      toastWarning('Đã từ chối hành động tự phục hồi.', 'HITL Từ Chối');
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    setApprovedIds([]);
    setRejectedIds([]);
  };

  const handleOpenEvidence = (req) => {
    setEvidenceIncident({
      id: req.incidentId || req.rawId,
      rawId: req.incidentId || req.rawId,
      incidentId: req.incidentId,
      predictionId: req.predictionId,
      approvalId: req.approvalId || req.id,
      title: req.title,
      service: req.targetName,
      target_name: req.targetName,
      cluster: req.clusterName || null,
      cluster_name: req.clusterName || null,
      cluster_id: req.clusterId || null,
      severity: req.urgency,
      confidence: req.confidenceScore,
      primaryRisk: req.rootCauseType,
      rootCauseType: req.rootCauseType,
      rootCauseDescription: req.rootCauseDesc,
      recommendationAction: req.actionCode,
      recommendationRiskLevel: req.recommendationRiskLevel,
      recommendationPriority: req.recommendationPriority,
      analysisMethod: req.analysisMethod,
      recommendationReason: req.aiReasoning,
      aiReasoning: req.aiReasoning,
      detectedAt: req.rawRequestedAt,
      analysisResult: req.actionResult,
      fromApprovals: true,
      hasPendingApproval: true,
      approvalStatus: 'PENDING',
      status: 'AWAITING_APPROVAL',
    });
  };

  // Lọc theo tìm kiếm cục bộ trên trang hiện tại
  const displayedRequests = useMemo(() => {
    if (!searchTerm.trim()) return approvalRequests;
    const term = searchTerm.toLowerCase();
    return approvalRequests.filter(
      (r) =>
        r.targetName.toLowerCase().includes(term) ||
        r.title.toLowerCase().includes(term) ||
        r.actionCode.toLowerCase().includes(term) ||
        r.rootCauseType.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term)
    );
  }, [approvalRequests, searchTerm]);

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
          gap: '12px',
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid var(--dash-border)',
        }}
      >
        <div style={{ fontSize: '0.78125rem', color: '#64748B', fontWeight: 500 }}>
          Hiển thị <strong style={{ color: '#0F172A' }}>{startIdx}–{endIdx}</strong> trong tổng số{' '}
          <strong style={{ color: '#0F172A' }}>{totalItems}</strong> yêu cầu chờ duyệt ({ITEMS_PER_PAGE} yêu cầu / trang)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            disabled={currPage <= 1}
            onClick={() => onPageChange(Math.max(1, currPage - 1))}
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: currPage <= 1 ? '#F8FAFC' : '#FFFFFF',
              color: currPage <= 1 ? '#94A3B8' : '#334155',
              cursor: currPage <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            &laquo; Trước
          </button>

          {pages.map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.75rem' }}>
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
                  padding: '0 8px',
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
              backgroundColor: currPage >= totalPg ? '#F8FAFC' : '#FFFFFF',
              color: currPage >= totalPg ? '#94A3B8' : '#334155',
              cursor: currPage >= totalPg ? 'not-allowed' : 'pointer',
            }}
          >
            Sau &raquo;
          </button>
        </div>
      </div>
    );
  };

  const activeClusterLabel = currentEnv?.cluster || currentEnv?.name || 'Toàn hệ thống';

  const approvalStats = useMemo(() => {
    const highRiskCount = displayedRequests.filter(
      (r) => r.riskLevelVi === 'Cao' || r.riskLevelVi === 'Khẩn cấp'
    ).length;
    return { highRiskCount };
  }, [displayedRequests]);

  const kpiCardStyle = (accent) => ({
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(226, 232, 240, 0.95)',
    borderTop: `2.5px solid ${accent}`,
    borderRadius: '12px',
    padding: '11px 14px',
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
    minWidth: 0,
  });

  const actionBtnStyle = (disabled = false) => ({
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(203, 213, 225, 0.9)',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: disabled ? '#94A3B8' : '#334155',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  });

  return (
    <div className="dashboard-approvals-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
            <CheckCircle2 size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Cổng Phê Duyệt HITL
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Kiểm duyệt các hành động tự phục hồi có mức ảnh hưởng cao trước khi áp dụng trên cụm{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{activeClusterLabel}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={triggerRefresh}
            disabled={isRefreshing || isLoading}
            style={actionBtnStyle(isRefreshing || isLoading)}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Đang làm mới...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Banner Chế độ Tự Động Hủy Khi Dịch Vụ Tự Lành (Option 1) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          borderRadius: '12px',
          backgroundColor: isAutoDismissEnabled ? '#ECFDF5' : '#F8FAFC',
          border: `1px solid ${isAutoDismissEnabled ? '#A7F3D0' : '#E2E8F0'}`,
          boxShadow: isAutoDismissEnabled
            ? '0 2px 8px rgba(16, 185, 129, 0.08)'
            : '0 1px 3px rgba(15, 23, 42, 0.04)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isAutoDismissEnabled ? '#10B981' : '#94A3B8',
                boxShadow: isAutoDismissEnabled ? '0 0 0 3px rgba(16, 185, 129, 0.25)' : 'none',
                display: 'inline-block',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
            />
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 800,
                color: isAutoDismissEnabled ? '#065F46' : '#334155',
                letterSpacing: '-0.01em',
              }}
            >
              Cơ chế Tự Động Hủy Khi Dịch Vụ Tự Lành (Auto-Dismiss when Self-Healed):
            </span>
          </div>

          {/* Nút Bật/Tắt dạng Toggle Switch chuẩn hiện đại */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              role="switch"
              aria-checked={isAutoDismissEnabled}
              onClick={toggleAutoDismiss}
              title={
                isAutoDismissEnabled
                  ? 'Bấm để TẮT cơ chế tự động hủy (Chuyển sang chế độ duyệt thủ công)'
                  : 'Bấm để BẬT cơ chế tự động hủy khi dịch vụ tự lành'
              }
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                width: '46px',
                height: '24px',
                borderRadius: '999px',
                backgroundColor: isAutoDismissEnabled ? '#10B981' : '#CBD5E1',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                boxShadow: isAutoDismissEnabled
                  ? '0 0 0 2px rgba(16, 185, 129, 0.2), inset 0 1px 2px rgba(0,0,0,0.1)'
                  : 'inset 0 1px 2px rgba(0,0,0,0.1)',
                outline: 'none',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  transform: isAutoDismissEnabled ? 'translateX(22px)' : 'translateX(0px)',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </button>

            {/* Badge nhãn trạng thái có thể click để toggle */}
            <button
              type="button"
              onClick={toggleAutoDismiss}
              title="Nhấn để chuyển đổi giữa Tự động và Thủ công"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                borderRadius: '6px',
                backgroundColor: isAutoDismissEnabled ? '#D1FAE5' : '#F1F5F9',
                color: isAutoDismissEnabled ? '#047857' : '#475569',
                fontWeight: 800,
                fontSize: '0.75rem',
                border: isAutoDismissEnabled ? '1px solid #6EE7B7' : '1px solid #CBD5E1',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{isAutoDismissEnabled ? 'ĐANG BẬT (100% Tự Động)' : 'ĐANG TẮT (Chế độ Thủ công)'}</span>
            </button>
          </div>
        </div>

        <div
          style={{
            fontSize: '0.78125rem',
            color: isAutoDismissEnabled ? '#047857' : '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Info size={14} color={isAutoDismissEnabled ? '#059669' : '#64748B'} />
          <span>
            {isAutoDismissEnabled
              ? 'Nếu dịch vụ tự ổn định lại (Pods Ready 100%) hoặc sự cố tự hết, hệ thống sẽ tự động hủy lệnh chờ — không cần từ chối thủ công.'
              : 'Chế độ thủ công đang bật: Các yêu cầu chờ phê duyệt sẽ được giữ nguyên cho đến khi kỹ sư trực tiếp Duyệt hoặc Từ chối.'}
          </span>
        </div>
      </div>

      {/* Thông báo nếu có yêu cầu vừa được tự động hủy */}
      {autoDismissedList.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '9px 15px',
            borderRadius: '9px',
            backgroundColor: '#F0FDF4',
            border: '1px dashed #86EFAC',
            fontSize: '0.78125rem',
            color: '#15803D',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <CheckCheck size={16} color="#16A34A" />
            <span>
              Hệ thống AI vừa <strong>tự động thu hồi {autoDismissedList.length} yêu cầu</strong> cho dịch vụ (<strong>{autoDismissedList.map((a) => a.targetName).join(', ')}</strong>) vì dịch vụ đã tự ổn định lại (Pods Healthy 100%).
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#166534', opacity: 0.85, fontWeight: 600 }}>
            Đã đồng bộ kiểm toán (Audit Logs)
          </span>
        </div>
      )}

      {/* Hàng 4 Thẻ KPI Tóm Tắt */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div style={kpiCardStyle('#F59E0B')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>CHỜ KÝ DUYỆT</span>
            <Clock size={14} color="#F59E0B" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: totalCount > 0 ? '#D97706' : '#0F172A' }}>
              {totalCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>yêu cầu đang mở</span>
          </div>
        </div>

        <div style={kpiCardStyle('#EF4444')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>RỦI RO CAO / KHẨN</span>
            <AlertTriangle size={14} color="#EF4444" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: approvalStats.highRiskCount > 0 ? '#DC2626' : '#0F172A' }}>
              {approvalStats.highRiskCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>trong trang hiện tại</span>
          </div>
        </div>

        <div style={kpiCardStyle('#10B981')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>ĐÃ XỬ LÝ PHIÊN NÀY</span>
            <ShieldCheck size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#059669' }}>
              {approvedIds.length + rejectedIds.length}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
              {approvedIds.length} duyệt &bull; {rejectedIds.length} từ chối
            </span>
          </div>
        </div>

        <div style={kpiCardStyle(isWsConnected ? '#059669' : '#3B82F6')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>ĐỒNG BỘ TRỰC TUYẾN</span>
            <Zap size={14} color={isWsConnected ? '#059669' : '#3B82F6'} />
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
                backgroundColor: isWsConnected ? '#ECFDF5' : '#EFF6FF',
                color: isWsConnected ? '#059669' : '#2563EB',
                border: isWsConnected ? '1px solid #A7F3D0' : '1px solid #BFDBFE',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isWsConnected ? '#10B981' : '#3B82F6' }} />
              {isWsConnected ? 'WebSocket Live' : 'Polling định kỳ'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Approvals Card */}
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '14px',
            paddingBottom: '12px',
            borderBottom: '1px solid #F1F5F9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Yêu Cầu Chờ Ký Duyệt
            </h3>
            <span
              style={{
                padding: '2px 9px',
                borderRadius: '999px',
                fontSize: '0.7rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                backgroundColor: totalCount > 0 ? '#FEF3C7' : '#ECFDF5',
                color: totalCount > 0 ? '#B45309' : '#047857',
                border: totalCount > 0 ? '1px solid #FDE68A' : '1px solid #A7F3D0',
              }}
            >
              {totalCount}
            </span>
          </div>

          {/* Quick Search & Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <select
              value={clusterFilter}
              onChange={(e) => {
                setClusterFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                height: '34px',
                padding: '0 10px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: '1px solid #CBD5E1',
                borderRadius: '9px',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                outline: 'none',
                cursor: 'pointer',
              }}
              title="Lọc yêu cầu phê duyệt theo Cụm Kubernetes"
            >
              <option value="all">Tất cả các cụm</option>
              <option value="current">Cụm đang xem: {currentEnv?.cluster || 'Mặc định'}</option>
              {envList && envList.filter(c => (c.cluster || c.name) !== currentEnv?.cluster).map((c) => (
                <option key={c.id} value={c.id}>
                  Cụm: {c.cluster || c.name}
                </option>
              ))}
            </select>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Lọc theo dịch vụ, Pod, mã HITL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  height: '34px',
                  width: '260px',
                  padding: '0 28px 0 32px',
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
                  onClick={() => {
                    setSearchTerm('');
                    try {
                      window.history.replaceState({}, '', window.location.pathname);
                    } catch {}
                  }}
                  aria-label="Xóa bộ lọc tìm kiếm"
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
          </div>
        </div>

        {/* Requests List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayedRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--dash-text-muted)' }}>
              <ShieldCheck size={38} color="#059669" style={{ margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px', fontSize: '0.95rem' }}>
                {searchTerm
                  ? `Không tìm thấy yêu cầu nào khớp với "${searchTerm}"`
                  : clusterFilter === 'current'
                    ? `Không có yêu cầu phê duyệt nào trên cụm "${currentEnv?.cluster || 'hiện tại'}"`
                    : 'Không có yêu cầu phê duyệt nào cần xử lý'}
              </div>
              <div style={{ fontSize: '0.8125rem', maxWidth: '560px', margin: '0 auto 14px auto', lineHeight: 1.5 }}>
                {searchTerm
                  ? 'Thử xóa bộ lọc để hiển thị toàn bộ danh sách.'
                  : 'Toàn bộ dịch vụ đang hoạt động ổn định. Cơ chế Tự Động Hủy (Auto-Dismiss) đã thu hồi các yêu cầu cũ khi dịch vụ tự phục hồi (tự lành) thành công để bảo vệ an toàn cụm máy chủ.'}
              </div>
              {!searchTerm && clusterFilter === 'current' && (
                <button
                  type="button"
                  onClick={() => {
                    setClusterFilter('all');
                    setCurrentPage(1);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    border: '1px solid #BFDBFE',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Layers size={14} />
                  <span>Xem yêu cầu phê duyệt trên tất cả các cụm &raquo;</span>
                </button>
              )}
            </div>
          ) : (
            displayedRequests.map((req) => {
              const isApproved = approvedIds.includes(req.id);
              const isRejected = rejectedIds.includes(req.id);

              return (
                <div
                  key={req.id}
                  style={{
                    position: 'relative',
                    padding: '16px 20px',
                    backgroundColor: isApproved ? '#F0FDF4' : isRejected ? '#FEF2F2' : '#FFFFFF',
                    border: isApproved ? '1px solid #86EFAC' : isRejected ? '1px solid #FECACA' : '1px solid #E2E8F0',
                    borderRadius: '12px',
                    boxShadow: '0 2px 6px -1px rgba(0, 0, 0, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Hàng 1: Thẻ thông tin hành động, dịch vụ, cụm (trái) và thời gian nằm góc phải phía trên */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: req.actionCategory === 'NODE' ? '#FEF2F2' : req.actionCategory === 'DEPLOYMENT' ? '#FFFBEB' : '#EEF2FF',
                          color: req.actionCategory === 'NODE' ? '#DC2626' : req.actionCategory === 'DEPLOYMENT' ? '#B45309' : '#4338CA',
                          border: `1px solid ${req.actionCategory === 'NODE' ? '#FECACA' : req.actionCategory === 'DEPLOYMENT' ? '#FDE68A' : '#C7D2FE'}`,
                          fontWeight: 700,
                          fontSize: '0.78125rem',
                        }}
                      >
                        <Zap size={14} color={req.actionCategory === 'NODE' ? '#DC2626' : req.actionCategory === 'DEPLOYMENT' ? '#B45309' : '#4F46E5'} />
                        <span>{req.actionFriendlyName || req.actionName}</span>
                      </span>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#F8FAFC',
                          color: '#1E293B',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.78125rem',
                          fontWeight: 600,
                        }}
                      >
                        <Server size={13} color="#64748B" />
                        <span>Dịch vụ: <strong style={{ color: '#0F172A' }}>{req.targetName}</strong></span>
                      </span>

                      {(() => {
                        const cleanTarget = String(req.targetName || '').toLowerCase();
                        const matched = workloadHealthMap[cleanTarget] || Object.entries(workloadHealthMap).find(([k]) => cleanTarget.includes(k) || k.includes(cleanTarget))?.[1];
                        if (matched && matched.total > 0) {
                          const isHealthy = matched.healthy === matched.total;
                          return (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 9px',
                                borderRadius: '6px',
                                backgroundColor: isHealthy ? '#ECFDF5' : '#FEF2F2',
                                color: isHealthy ? '#047857' : '#DC2626',
                                border: `1px solid ${isHealthy ? '#A7F3D0' : '#FECACA'}`,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isHealthy ? '#10B981' : '#EF4444' }} />
                              <span>{isHealthy ? `Đã tự ổn định (${matched.healthy}/${matched.total} Pods Ready)` : `Đang suy giảm (${matched.healthy}/${matched.total} Pods Ready)`}</span>
                            </span>
                          );
                        }
                        return null;
                      })()}

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#F8FAFC',
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        <Layers size={13} color="#64748B" />
                        <span>Cụm: <strong>{req.clusterName || 'Chưa xác định'}</strong></span>
                      </span>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 9px',
                          borderRadius: '6px',
                          backgroundColor: req.riskLevelVi === 'Cao' || req.riskLevelVi === 'Khẩn cấp' ? '#FEF2F2' : '#FFFBEB',
                          color: req.riskLevelVi === 'Cao' || req.riskLevelVi === 'Khẩn cấp' ? '#DC2626' : '#B45309',
                          border: `1px solid ${req.riskLevelVi === 'Cao' || req.riskLevelVi === 'Khẩn cấp' ? '#FECACA' : '#FDE68A'}`,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <span>Rủi ro: {req.riskLevelVi}</span>
                      </span>
                    </div>

                    {/* Mốc thời gian cố định ở góc phải phía trên */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.75rem',
                        color: '#64748B',
                        backgroundColor: '#F8FAFC',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Clock size={12} color="#94A3B8" />
                      <span>{req.timestamp}</span>
                    </div>
                  </div>

                  {/* Hàng 2: Chi tiết sự cố */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.4 }}>
                      {req.cleanTitle}
                    </div>

                    {/* Khung hành động tự lành (đã xóa viền màu đậm bên trái) */}
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: '#1E293B',
                        backgroundColor: '#F0F9FF',
                        border: '1px solid #BAE6FD',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        lineHeight: 1.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <div style={{ minWidth: '16px', marginTop: '2px' }}>
                        <Zap size={14} color="#0284C7" />
                      </div>
                      <div>
                        <strong style={{ color: '#0369A1', fontWeight: 700 }}>Hành động tự lành: </strong>
                        <span>{req.aiReasoning}</span>
                      </div>
                    </div>

                    {/* Hàng 3: Chính sách & Độ tin cậy AI */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.75rem',
                        color: '#64748B',
                        paddingTop: '2px',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <ShieldCheck size={14} color="#059669" />
                        <span>Chính sách:</span>
                        <strong style={{ color: '#0F172A' }}>{req.policyName}</strong>
                      </span>
                      <span style={{ color: '#CBD5E1' }}>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Sparkles size={13} color="#D97706" />
                        <span>Độ tin cậy AI:</span>
                        <strong style={{ color: '#059669', fontWeight: 700 }}>
                          {req.confidenceScore !== null && req.confidenceScore !== undefined ? `${req.confidenceScore}%` : 'Chưa đánh giá'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Hàng 4: Hàng nút thao tác phê duyệt & xem bằng chứng */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginTop: '4px',
                      paddingTop: '10px',
                      borderTop: '1px dashed #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Nút Xem Bằng Chứng RCA */}
                      <button
                        type="button"
                        onClick={() => handleOpenEvidence(req)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          backgroundColor: '#FFFFFF',
                          color: '#334155',
                          border: '1px solid #CBD5E1',
                          borderRadius: '7px',
                          fontSize: '0.78125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        <Eye size={14} color="#475569" />
                        <span>Chi tiết</span>
                      </button>

                      {/* Nút Xem Trước Diff (YAML) */}
                      <button
                        type="button"
                        onClick={() => setActiveDiffModal(req)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '7px',
                          fontSize: '0.78125rem',
                          fontWeight: 600,
                          color: '#0F766E',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        <FileCode size={14} color="#0F766E" />
                        <span>Xem trước Diff (YAML)</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isApproved ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontWeight: 700, fontSize: '0.78125rem' }}>
                          <Check size={15} />
                          <span>ĐÃ PHÊ DUYỆT & ĐANG THỰC THI</span>
                        </div>
                      ) : isRejected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 700, fontSize: '0.78125rem' }}>
                          <X size={15} />
                          <span>ĐÃ TỪ CHỐI YÊU CẦU</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <div style={{ fontSize: '0.71rem', color: '#64748B', fontStyle: 'italic' }}>
                            ⚡ Nếu dịch vụ tự ổn định (tự lành), hệ thống sẽ tự động hủy lệnh này
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <PermissionGate permission={PERMISSIONS.HITL_APPROVE} renderDisabled={true} disabledTooltip="Chỉ SME Owner hoặc Quản trị viên mới có quyền phê duyệt HITL">
                              <button
                                type="button"
                                onClick={() => handleApprove(req.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '7px 18px',
                                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                  border: 'none',
                                  borderRadius: '7px',
                                  color: '#FFFFFF',
                                  fontSize: '0.78125rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <Check size={14} />
                                <span>Phê Duyệt Ngay</span>
                              </button>
                            </PermissionGate>

                            <PermissionGate permission={PERMISSIONS.HITL_APPROVE} renderDisabled={true} disabledTooltip="Chỉ SME Owner hoặc Quản trị viên mới có quyền từ chối HITL">
                              <button
                                type="button"
                                onClick={() => handleReject(req.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#DC2626',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                  borderRadius: '6px',
                                  transition: 'background-color 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                Từ chối yêu cầu này
                              </button>
                            </PermissionGate>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {renderPaginationBar(currentPage, totalCount, handlePageChange)}
        </div>
      </div>

      {/* Root Cause Evidence Modal */}
      {evidenceIncident && (
        <RootCauseModal
          incident={evidenceIncident}
          onClose={() => setEvidenceIncident(null)}
          onResolve={() => {
            const req = approvalRequests.find(
              (r) =>
                r.id === evidenceIncident.approvalId ||
                r.approvalId === evidenceIncident.approvalId ||
                r.rawId === evidenceIncident.rawId ||
                r.incidentId === evidenceIncident.incidentId
            );
            if (req) {
              handleApprove(req.id);
            }
            setEvidenceIncident(null);
          }}
        />
      )}

      {/* YAML Diff Preview Modal */}
      {activeDiffModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '18px',
              boxShadow: '0 25px 50px -12px rgba(6, 95, 70, 0.22), 0 0 0 1px rgba(16, 185, 129, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                background: 'linear-gradient(135deg, #065F46 0%, #047857 55%, #059669 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(6, 95, 70, 0.15)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileCode size={16} color="#FFFFFF" />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9125rem', fontWeight: 700, margin: 0, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                    So Sánh Cấu Hình Can Thiệp (YAML Diff)
                  </h3>
                  <div style={{ fontSize: '0.71875rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{activeDiffModal.diff.file}</span>
                    <span>•</span>
                    <span>Hành động: <strong style={{ color: '#FFFFFF' }}>{activeDiffModal.actionName} ({activeDiffModal.actionCode})</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveDiffModal(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '10px 16px', overflowY: 'auto', flex: 1, backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
                    <span>CẤU HÌNH HIỆN TẠI (TRƯỚC KHI VÁ)</span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: '14px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #FECACA',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: '#991B1B',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {activeDiffModal.diff.before}
                  </pre>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                    <span>CẤU HÌNH ĐỀ XUẤT ÁP DỤNG (SAU PHÊ DUYỆT)</span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: '14px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #86EFAC',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: '#166534',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {activeDiffModal.diff.after}
                  </pre>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 24px',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveDiffModal(null)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={() => handleApprove(activeDiffModal.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 20px',
                  backgroundColor: 'var(--dash-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                }}
              >
                <CheckCircle2 size={16} />
                <span>Phê Duyệt & Tự Động Vá Cấu Hình</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsPage;
