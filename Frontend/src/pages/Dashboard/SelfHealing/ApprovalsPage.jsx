import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { getIntlLocale } from '../../../i18n';

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
  const { t, i18n: i18nInstance } = useTranslation('dashHealing');
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

  // Chế độ Tự Động Hủy Yêu Cầu Quá Hạn (>15m) hoặc khi sự cố đã đóng
  const [isAutoDismissEnabled, setIsAutoDismissEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('captone_hitl_auto_dismiss');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const toggleAutoDismiss = useCallback(() => {
    const next = !isAutoDismissEnabled;
    setIsAutoDismissEnabled(next);
    try {
      localStorage.setItem('captone_hitl_auto_dismiss', String(next));
    } catch {}
    if (next) {
      toastSuccess(t('approvals.autoDismiss.toastOn'));
    } else {
      toastWarning(t('approvals.autoDismiss.toastOff'));
    }
  }, [isAutoDismissEnabled, toastSuccess, toastWarning, t]);
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
    
    let actionFriendlyName = t('approvals.actions.default');
    let actionCategory = 'POD';

    if (searchCode.includes('DRAIN')) {
      actionFriendlyName = t('approvals.actions.drain');
      actionCategory = 'NODE';
    } else if (searchCode.includes('CORDON')) {
      actionFriendlyName = t('approvals.actions.cordon');
      actionCategory = 'NODE';
    } else if (searchCode.includes('ROLLBACK')) {
      actionFriendlyName = t('approvals.actions.rollback');
      actionCategory = 'DEPLOYMENT';
    } else if (searchCode.includes('SCALE')) {
      actionFriendlyName = t('approvals.actions.scale');
      actionCategory = 'WORKLOAD';
    } else if (searchCode.includes('RESTART_DEPLOYMENT') || (searchCode.includes('RESTART') && searchCode.includes('DEPLOYMENT'))) {
      actionFriendlyName = t('approvals.actions.restartDeployment');
      actionCategory = 'DEPLOYMENT';
    } else if (searchCode.includes('RESTART')) {
      actionFriendlyName = t('approvals.actions.restartPod');
      actionCategory = 'POD';
    } else if (searchCode.includes('REPLACE')) {
      actionFriendlyName = t('approvals.actions.replacePod');
      actionCategory = 'POD';
    } else if (searchCode.includes('ADJUST') || searchCode.includes('LIMIT')) {
      actionFriendlyName = t('approvals.actions.adjustLimits');
      actionCategory = 'WORKLOAD';
    } else if (searchCode.includes('CLEANUP') || searchCode.includes('TEMP')) {
      actionFriendlyName = t('approvals.actions.cleanup');
      actionCategory = 'STORAGE';
    } else if (searchCode.includes('BLOCK')) {
      actionFriendlyName = t('approvals.actions.blockIp');
      actionCategory = 'SECURITY';
    } else if (searchCode.includes('NO_ACTION')) {
      actionFriendlyName = t('approvals.actions.noAction');
      actionCategory = 'POD';
    } else if (item.action_name) {
      actionFriendlyName = item.action_name;
    }

    const rootCause = item.root_cause_type || (item.incident_title ? item.incident_title.replace(/^\[.*?\]\s*/, '') : t('approvals.mapped.unknownRootCause'));
    const confidence = item.confidence_score !== null && item.confidence_score !== undefined
      ? Math.round(Number(item.confidence_score) <= 1 ? Number(item.confidence_score) * 100 : Number(item.confidence_score))
      : null;

    const rawRisk = (item.risk_level || item.recommendation_risk_level || '').toUpperCase();
    let riskLevelVi = t('common.unclassified');
    if (rawRisk === 'LOW') riskLevelVi = t('approvals.risks.LOW');
    else if (rawRisk === 'MEDIUM') riskLevelVi = t('approvals.risks.MEDIUM');
    else if (rawRisk === 'HIGH') riskLevelVi = t('approvals.risks.HIGH');
    else if (rawRisk === 'CRITICAL') riskLevelVi = t('approvals.risks.CRITICAL');

    const policyName = item.policy_name || 'POL-SAFETY-DEFAULT';

    const rawTitle = item.incident_title || t('approvals.mapped.titleFallback', { action: actionFriendlyName, target: targetName });
    let cleanTitle = translateIncidentTitle(rawTitle);
    if (!cleanTitle.toLowerCase().startsWith('sự cố') && !cleanTitle.toLowerCase().startsWith('lỗi') && !cleanTitle.toLowerCase().startsWith('incident')) {
      cleanTitle = t('approvals.mapped.incidentPrefix', { title: cleanTitle });
    }

    const actionShortId = item.healing_action_id && item.healing_action_id.length > 8
      ? `ACT-${item.healing_action_id.slice(0, 8).toUpperCase()}`
      : null;

    const intlLocale = getIntlLocale(i18nInstance.language);

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
      aiReasoning: item.ai_reasoning || item.reason || t('approvals.mapped.aiReasoningDefault', { action: actionFriendlyName, target: targetName }),
      policyName,
      requestedBy: t('approvals.mapped.requestedBy'),
      riskLevelVi,
      urgency: rawRisk || 'UNCLASSIFIED',
      reason: item.reason || t('approvals.mapped.reasonDefault', { policy: policyName }),
      blastRadius: t('approvals.mapped.blastRadius'),
      rawRequestedAt: item.requested_at,
      timestamp: item.requested_at ? new Date(item.requested_at).toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date(item.requested_at).toLocaleDateString(intlLocale) : t('common.justNow'),
      actionResult: item.action_result,
      diff: {
        file: `${targetName}-deployment.yaml`,
        before: t('approvals.diffModal.beforeYaml', { target: targetName, risk: riskLevelVi }),
        after: t('approvals.diffModal.afterYaml', { target: targetName, action: actionFriendlyName }),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, i18nInstance.language]);


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

        const shouldDismiss = isAutoDismissEnabled && (isStale || isIncidentResolved);

        if (shouldDismiss) {
          const actionId = item.healing_action_id || item.id;
          const dismissReason = isWorkloadSelfHealed
            ? t('approvals.autoDismiss.reasonSelfHealed')
            : isStale
            ? t('approvals.autoDismiss.reasonStale')
            : t('approvals.autoDismiss.reasonResolved');

          if (actionId) {
            selfHealingService.rejectAction(actionId, dismissReason).catch(() => {});
          }
          if (item.incident_id && isWorkloadSelfHealed) {
            aiService.updateIncidentStatus(item.incident_id, 'RESOLVED').catch(() => {});
          }

          newlyDismissed.push({
            id: item.id,
            targetName: cleanTarget || item.target_name,
            actionName: item.action_name || t('approvals.actions.default'),
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
  }, [currentOrg?.id, currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster, clusterFilter, searchTerm, mapBackendApprovalToUI, isAutoDismissEnabled, refreshPendingApprovals, t]);

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
        await selfHealingService.approveAction(actionId, t('approvals.toast.approveNote'));
      }
      toastSuccess(t('approvals.toast.approveSuccess'), t('approvals.toast.approveTitle'));

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
      toastSuccess(t('approvals.toast.approveFallback'), t('approvals.toast.approveTitle'));
    }
  };

  const [sendingEmailId, setSendingEmailId] = useState(null);

  const handleSendEmail = async (req) => {
    const actionId = req?.rawId || req?.id;
    if (!actionId) return;
    setSendingEmailId(req.id);
    try {
      const res = await selfHealingService.resendNotification(actionId);
      toastSuccess(res?.message || t('approvals.toast.emailSuccess'), t('approvals.toast.emailTitle'));
    } catch (err) {
      toastWarning(err?.message || t('approvals.toast.emailError'), t('approvals.toast.emailFailTitle'));
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
        await selfHealingService.rejectAction(actionId, t('approvals.toast.rejectNote'));
      }
      toastWarning(t('approvals.toast.rejectSuccess'), t('approvals.toast.rejectTitle'));
      setTimeout(() => {
        fetchApprovals(currentPage);
      }, 500);
    } catch (err) {
      console.warn('Lỗi gửi từ chối tới DB:', err.message);
      toastWarning(t('approvals.toast.rejectFallback'), t('approvals.toast.rejectTitle'));
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
          {t('approvals.pagination.showingPrefix')} <strong style={{ color: '#0F172A' }}>{startIdx}–{endIdx}</strong> {t('approvals.pagination.showingMiddle')}{' '}
          <strong style={{ color: '#0F172A' }}>{totalItems}</strong> {t('approvals.pagination.showingSuffix', { perPage: ITEMS_PER_PAGE })}
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
            &laquo; {t('common.prevShort')}
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
            {t('common.nextShort')} &raquo;
          </button>
        </div>
      </div>
    );
  };

  const activeClusterLabel = currentEnv?.cluster || currentEnv?.name || t('common.systemWide');

  const approvalStats = useMemo(() => {
    const highRiskCount = displayedRequests.filter(
      (r) => r.urgency === 'HIGH' || r.urgency === 'CRITICAL'
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
              {t('approvals.header.title')}
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              {t('approvals.header.subtitlePrefix')}{' '}
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
            <span>{isRefreshing ? t('common.refreshing') : t('common.refresh')}</span>
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
              {t('approvals.autoDismiss.label')}
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
                  ? t('approvals.autoDismiss.turnOffTitle')
                  : t('approvals.autoDismiss.turnOnTitle')
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
              title={t('approvals.autoDismiss.toggleBadgeTitle')}
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
              <span>{isAutoDismissEnabled ? t('approvals.autoDismiss.statusOn') : t('approvals.autoDismiss.statusOff')}</span>
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
              ? t('approvals.autoDismiss.descOn')
              : t('approvals.autoDismiss.descOff')}
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
              <Trans
                i18nKey="dashHealing:approvals.autoDismiss.bannerText"
                values={{ count: autoDismissedList.length, services: autoDismissedList.map((a) => a.targetName).join(', ') }}
                components={{ strong: <strong /> }}
              />
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#166534', opacity: 0.85, fontWeight: 600 }}>
            {t('approvals.autoDismiss.auditSynced')}
          </span>
        </div>
      )}

      {/* Hàng 4 Thẻ KPI Tóm Tắt */}
      <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div style={kpiCardStyle('#F59E0B')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('approvals.kpi.pendingTitle')}</span>
            <Clock size={14} color="#F59E0B" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: totalCount > 0 ? '#D97706' : '#0F172A' }}>
              {totalCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('approvals.kpi.pendingSub')}</span>
          </div>
        </div>

        <div style={kpiCardStyle('#EF4444')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('approvals.kpi.highRiskTitle')}</span>
            <AlertTriangle size={14} color="#EF4444" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: approvalStats.highRiskCount > 0 ? '#DC2626' : '#0F172A' }}>
              {approvalStats.highRiskCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('approvals.kpi.highRiskSub')}</span>
          </div>
        </div>

        <div style={kpiCardStyle('#10B981')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('approvals.kpi.processedTitle')}</span>
            <ShieldCheck size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#059669' }}>
              {approvedIds.length + rejectedIds.length}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
              {t('approvals.kpi.processedSub', { approved: approvedIds.length, rejected: rejectedIds.length })}
            </span>
          </div>
        </div>

        <div style={kpiCardStyle(isWsConnected ? '#059669' : '#3B82F6')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('approvals.kpi.syncTitle')}</span>
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
              {isWsConnected ? t('approvals.kpi.wsLive') : t('approvals.kpi.wsPolling')}
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
              {t('approvals.filters.sectionTitle')}
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
              title={t('approvals.filters.clusterSelectTitle')}
            >
              <option value="all">{t('approvals.filters.allClusters')}</option>
              <option value="current">{t('approvals.filters.currentCluster', { name: currentEnv?.cluster || t('common.default') })}</option>
              {envList && envList.filter(c => (c.cluster || c.name) !== currentEnv?.cluster).map((c) => (
                <option key={c.id} value={c.id}>
                  {t('approvals.filters.clusterOption', { name: c.cluster || c.name })}
                </option>
              ))}
            </select>

            <div className="dash-search-box" style={{ position: 'relative', maxWidth: '100%' }}>
              <input
                type="text"
                placeholder={t('approvals.filters.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  height: '34px',
                  width: '260px',
                  maxWidth: '100%',
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
                  aria-label={t('approvals.filters.clearSearchAria')}
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
                  ? t('approvals.empty.searchTitle', { term: searchTerm })
                  : clusterFilter === 'current'
                    ? t('approvals.empty.clusterTitle', { cluster: currentEnv?.cluster || t('common.current') })
                    : t('approvals.empty.defaultTitle')}
              </div>
              <div style={{ fontSize: '0.8125rem', maxWidth: '560px', margin: '0 auto 14px auto', lineHeight: 1.5 }}>
                {searchTerm
                  ? t('approvals.empty.searchSub')
                  : t('approvals.empty.defaultSub')}
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
                  <span>{t('approvals.empty.viewAllBtn')}</span>
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
                        <span>{t('approvals.card.serviceLabel')} <strong style={{ color: '#0F172A' }}>{req.targetName}</strong></span>
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
                              <span>{isHealthy ? t('approvals.card.podsHealthy', { healthy: matched.healthy, total: matched.total }) : t('approvals.card.podsWarning', { healthy: matched.healthy, total: matched.total })}</span>
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
                        <span>{t('approvals.card.clusterLabel')} <strong>{req.clusterName || t('common.unknown')}</strong></span>
                      </span>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 9px',
                          borderRadius: '6px',
                          backgroundColor: req.urgency === 'HIGH' || req.urgency === 'CRITICAL' ? '#FEF2F2' : '#FFFBEB',
                          color: req.urgency === 'HIGH' || req.urgency === 'CRITICAL' ? '#DC2626' : '#B45309',
                          border: `1px solid ${req.urgency === 'HIGH' || req.urgency === 'CRITICAL' ? '#FECACA' : '#FDE68A'}`,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <span>{t('approvals.card.riskLabel', { level: req.riskLevelVi })}</span>
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
                        <strong style={{ color: '#0369A1', fontWeight: 700 }}>{t('approvals.card.healingActionLabel')} </strong>
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
                        <span>{t('approvals.card.policyLabel')}</span>
                        <strong style={{ color: '#0F172A' }}>{req.policyName}</strong>
                      </span>
                      <span style={{ color: '#CBD5E1' }}>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Sparkles size={13} color="#D97706" />
                        <span>{t('approvals.card.confidenceLabel')}</span>
                        <strong style={{ color: '#059669', fontWeight: 700 }}>
                          {req.confidenceScore !== null && req.confidenceScore !== undefined ? `${req.confidenceScore}%` : t('common.notEvaluated')}
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
                        <span>{t('common.details')}</span>
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
                        <span>{t('approvals.card.previewDiff')}</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isApproved ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontWeight: 700, fontSize: '0.78125rem' }}>
                          <Check size={15} />
                          <span>{t('approvals.card.approvedStatus')}</span>
                        </div>
                      ) : isRejected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 700, fontSize: '0.78125rem' }}>
                          <X size={15} />
                          <span>{t('approvals.card.rejectedStatus')}</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <div style={{ fontSize: '0.71rem', color: isAutoDismissEnabled ? '#D97706' : '#64748B', fontStyle: 'italic' }}>
                            {isAutoDismissEnabled
                              ? t('approvals.card.autoDismissHint')
                              : t('approvals.card.manualHint')}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <PermissionGate permission={PERMISSIONS.HITL_APPROVE} renderDisabled={true} disabledTooltip={t('approvals.card.approveDisabledTip')}>
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
                                <span>{t('approvals.card.approveBtn')}</span>
                              </button>
                            </PermissionGate>

                            <PermissionGate permission={PERMISSIONS.HITL_APPROVE} renderDisabled={true} disabledTooltip={t('approvals.card.rejectDisabledTip')}>
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
                                {t('approvals.card.rejectBtn')}
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
                    {t('approvals.diffModal.title')}
                  </h3>
                  <div style={{ fontSize: '0.71875rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{activeDiffModal.diff.file}</span>
                    <span>•</span>
                    <span>{t('approvals.diffModal.actionLabel')} <strong style={{ color: '#FFFFFF' }}>{activeDiffModal.actionName} ({activeDiffModal.actionCode})</strong></span>
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
                    <span>{t('approvals.diffModal.beforeTitle')}</span>
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
                    <span>{t('approvals.diffModal.afterTitle')}</span>
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
                {t('common.cancelAction')}
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
                <span>{t('approvals.diffModal.approveApplyBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsPage;
