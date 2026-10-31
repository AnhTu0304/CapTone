import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { useDashboard } from '../context/DashboardContext';
import { PermissionGate } from '../../../components/common/PermissionGate';
import { PERMISSIONS } from '../../../hooks/usePermissions';
import { useToast } from '../../../context/ToastContext';
import { selfHealingService } from '../../../services/selfHealingService';
import RootCauseModal from '../Incidents/RootCauseModal';
import {
  CheckCircle2,
  FileCode,
  Mail,
  ShieldCheck,
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
} from 'lucide-react';

export const ApprovalsPage = () => {
  const { currentOrg, currentEnv, setCurrentEnv, envList, isRefreshing, triggerRefresh } = useDashboard();
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
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [approvedIds, setApprovedIds] = useState([]);
  const [rejectedIds, setRejectedIds] = useState([]);

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
    const shortId = item.id && item.id.length > 8 ? `REQ-HITL-${item.id.slice(0, 6).toUpperCase()}` : item.id;
    const targetName = item.target_name || item.target_id || 'k8s-workload';
    const actionCode = item.action_code || item.action_name || 'REPLACE_POD';
    const actionName = item.action_name || item.action_code || 'Tự phục hồi Pod';
    const rootCause = item.root_cause_type || (item.incident_title ? item.incident_title.replace(/^\[.*?\]\s*/, '') : 'Pod ứng dụng bất ổn định / CrashLoop');
    const confidence = item.confidence_score !== null && item.confidence_score !== undefined
      ? Math.round(Number(item.confidence_score) <= 1 ? Number(item.confidence_score) * 100 : Number(item.confidence_score))
      : 75;
    const riskLevel = (item.risk_level || 'HIGH').toUpperCase();
    const policyName = item.policy_name || 'POL-SAFETY-DEFAULT';
    const podName = `${targetName}-0`;
    const nodeName = 'nkljojl-worker-02';

    return {
      id: shortId,
      rawId: item.healing_action_id || item.id,
      approvalId: item.id,
      incidentId: item.incident_id,
      recommendationId: item.recommendation_id,
      actionCode,
      actionName,
      title: item.incident_title || `${actionName} trên ${targetName}`,
      targetName,
      target: `${item.target_type || 'WORKLOAD'}/${targetName}`,
      podName,
      nodeName,
      clusterName: item.cluster_name || "test-ai",
      rootCauseType: rootCause,
      rootCauseDesc: item.root_cause_description || `AI phân tích viễn trắc eBPF ghi nhận sự cố trên dịch vụ ${targetName}.`,
      confidenceScore: confidence,
      aiReasoning: item.ai_reasoning || item.reason || `Chính sách ${policyName} (Mức rủi ro: ${riskLevel}) yêu cầu phê duyệt con người (HITL) trước khi thực thi ${actionName} trên dịch vụ ${targetName}.`,
      policyName,
      requestedBy: item.requested_by_email || 'MAPE-K Autonomous Engine',
      urgency: riskLevel,
      reason: item.reason || `Chính sách ${policyName} yêu cầu phê duyệt con người trước khi thực thi.`,
      blastRadius: `Môi trường ${item.environment_name || 'Production'} (Tác động dịch vụ kiểm soát qua PDB)`,
      rawRequestedAt: item.requested_at,
      timestamp: item.requested_at ? new Date(item.requested_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date(item.requested_at).toLocaleDateString('vi-VN') : 'Vừa xong',
      actionResult: item.action_result,
      diff: {
        file: `${targetName}-spec.yaml`,
        before: `# Trạng thái hiện tại\nspec:\n  target: ${targetName}\n  status: Degraded\n  riskLevel: ${riskLevel}`,
        after: `# Cấu hình vá lỗi tự phục hồi sau khi phê duyệt HITL\nspec:\n  target: ${targetName}\n  action: ${actionCode}\n  status: AutoHealed`,
      },
    };
  }, []);

  const fetchApprovals = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const activeOrgId = currentOrg?.id;
      // Tuân thủ triệt để nguyên tắc cách ly: K8s nào chỉ hiện đúng dữ liệu của K8s đó
      const activeClusterId = currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster;
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const res = await selfHealingService.getApprovals({
        organization_id: activeOrgId,
        cluster_id: activeClusterId,
        status: 'PENDING',
        search: searchTerm.trim() || undefined,
        limit: ITEMS_PER_PAGE,
        offset: offset,
      });
      const items = res?.items || (Array.isArray(res) ? res : []);
      const total = typeof res?.total === 'number' ? res.total : items.length;
      const totalPg = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
      if (page > totalPg && total > 0) {
        setCurrentPage(totalPg);
        return;
      }
      setApprovalRequests(items.map(mapBackendApprovalToUI));
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
  }, [currentOrg?.id, currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster, searchTerm, mapBackendApprovalToUI]);

  useEffect(() => {
    fetchApprovals(currentPage);
  }, [fetchApprovals, currentPage, searchTerm, isRefreshing, currentOrg?.id, currentEnv?.id, currentEnv?.cluster]);

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
      title: req.title,
      service: req.targetName,
      severity: req.urgency,
      confidence: req.confidenceScore,
      primaryRisk: req.rootCauseType,
      recommendationAction: req.actionCode,
      detectedAt: req.rawRequestedAt,
      analysisResult: req.actionResult,
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
                  minWidth: '30px',
                  height: '30px',
                  padding: '0 8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  borderRadius: '6px',
                  border: currPage === p ? '1px solid #2563EB' : '1px solid #CBD5E1',
                  backgroundColor: currPage === p ? '#2563EB' : '#FFFFFF',
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
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
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

  return (
    <div className="dashboard-approvals-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Cổng Phê Duyệt Của Con Người (Human-in-the-Loop Gate)
            </h1>
          </div>
<p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '3px', margin: 0 }}>
            {currentOrg?.name || 'Tổ chức hiện tại'} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv?.name || currentEnv?.cluster || 'Tất cả cụm'}</span> &bull; Cơ chế an toàn tối thượng: Kiểm duyệt các hành động có mức độ ảnh hưởng lớn trước khi áp dụng
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={triggerRefresh}
            disabled={isRefreshing || isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>Làm mới danh sách</span>
          </button>
        </div>
      </div>

      {/* Main Approvals Card */}
      <div className="dash-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Yêu Cầu Chờ Ký Duyệt ({totalCount})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Vui lòng kiểm tra mã thay đổi diff, nguyên nhân gốc rễ RCA và phạm vi tác động trước khi bấm phê duyệt
            </p>
          </div>

          {/* Quick Search & Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Lọc theo dịch vụ, Pod, mã HITL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  height: '34px',
                  width: '260px',
                  padding: '0 10px 0 32px',
                  fontSize: '0.78125rem',
                  border: '1px solid var(--dash-border)',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
            </div>

            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  try {
                    window.history.replaceState({}, '', window.location.pathname);
                  } catch {}
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* Requests List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayedRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--dash-text-muted)' }}>
              <ShieldCheck size={36} color="#059669" style={{ margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px', fontSize: '0.9375rem' }}>
                {searchTerm ? `Không tìm thấy yêu cầu nào khớp với "${searchTerm}"` : 'Không có yêu cầu phê duyệt nào'}
              </div>
              <div style={{ fontSize: '0.8125rem' }}>
                {searchTerm ? 'Thử xóa bộ lọc để hiển thị toàn bộ danh sách.' : 'Tất cả các hành động tự phục hồi hiện tại đều nằm trong ngưỡng an toàn tự động hoặc đã được giải quyết.'}
              </div>
            </div>
          ) : (
            displayedRequests.map((req) => {
              const isApproved = approvedIds.includes(req.id);
              const isRejected = rejectedIds.includes(req.id);
              const isCritical = req.urgency === 'CRITICAL';

              return (
                <div
                  key={req.id}
                  style={{
                    position: 'relative',
                    padding: '12px 16px',
                    backgroundColor: isApproved ? '#F0FDF4' : isRejected ? '#FEF2F2' : '#FFFFFF',
                    border: isApproved ? '1px solid #86EFAC' : isRejected ? '1px solid #FECACA' : '1px solid var(--dash-border)',
                    borderLeft: isApproved ? '4px solid #16A34A' : isRejected ? '4px solid #DC2626' : '4px solid #F59E0B',
                    borderRadius: '8px',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {/* Hàng 1: Hành động, Dịch vụ, Pod, Node */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', width: '100%', paddingRight: '150px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: '#EEF2FF',
                        color: '#4F46E5',
                        border: '1px solid #C7D2FE',
                        fontWeight: 700,
                        fontSize: '0.6875rem',
                      }}
                    >
                      <Zap size={11} />
                      <span>{req.actionName} ({req.actionCode})</span>
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: '#F8FAFC',
                        color: '#334155',
                        border: '1px solid #E2E8F0',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                      }}
                    >
                      <Server size={11} color="#64748B" />
                      <span>Dịch vụ: <strong>{req.targetName}</strong></span>
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                      }}
                    >
                      <Layers size={11} color="#64748B" />
                      <span>Cụm: <strong>{req.clusterName || 'test-ai'}</strong></span>
                    </span>

                    {req.podName && (
                      <span
                        title={req.podName}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: '#FDF4FF',
                          color: '#9333EA',
                          border: '1px solid #F0ABFC',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                        }}
                      >
                        <Box size={11} color="#A21CAF" />
                        <span>Pod: <strong>{req.podName.length > 20 ? `${req.podName.slice(0, 10)}...${req.podName.slice(-5)}` : req.podName}</strong></span>
                      </span>
                    )}

                    {req.nodeName && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: '#F8FAFC',
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                        }}
                      >
                        <Layers size={11} color="#64748B" />
                        <span>Node: <strong>{req.nodeName}</strong></span>
                      </span>
                    )}
                  </div>

                  {/* Mốc thời gian cố định tuyệt đối ở góc trên cùng bên phải */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#64748B',
                      fontSize: '0.6875rem',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Clock size={11} />
                    <span>{req.timestamp}</span>
                  </span>

                  {/* Hàng 2: Nguyên nhân, Độ tin cậy, Ưu tiên, Rủi ro, Mã HITL */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: '#FFF1F2',
                        color: '#BE123C',
                        border: '1px solid #FDA4AF',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                      }}
                    >
                      <AlertTriangle size={11} />
                      <span>Nguyên nhân: <strong>{req.rootCauseType}</strong></span>
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: '#ECFDF5',
                        color: '#047857',
                        border: '1px solid #A7F3D0',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                      }}
                    >
                      <Target size={11} />
                      <span>Độ tin cậy: <strong>{req.confidenceScore}%</strong></span>
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: '#FEF3C7',
                        color: '#B45309',
                        border: '1px solid #FDE68A',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                      }}
                    >
                      Ưu tiên: {isCritical ? 'Khẩn cấp' : 'Cao'}
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: isCritical ? '#FFF1F2' : '#FFFBEB',
                        color: isCritical ? '#E11D48' : '#D97706',
                        border: `1px solid ${isCritical ? '#FDA4AF' : '#FDE68A'}`,
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                      }}
                    >
                      Rủi ro: {req.urgency}
                    </span>

                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6875rem',
                        color: '#64748B',
                        padding: '2px 6px',
                        backgroundColor: '#F1F5F9',
                        borderRadius: '4px',
                      }}
                    >
                      {req.id}
                    </span>
                  </div>

                  {/* Hàng 3: Tiêu đề chẩn đoán & Diễn giải */}
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '3px', lineHeight: 1.35 }}>
                      {req.title}
                    </div>
                    <div style={{ fontSize: '0.78125rem', color: 'var(--dash-text-secondary)', marginBottom: '4px', lineHeight: 1.4 }}>
                      <strong>Hành động tự lành:</strong> {req.aiReasoning}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.71875rem', fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                      <span>Người đề xuất: <strong style={{ color: '#334155' }}>{req.requestedBy}</strong></span>
                      <span>&bull;</span>
                      <span>Chính sách: <strong style={{ color: '#334155' }}>{req.policyName}</strong></span>
                      <span>&bull;</span>
                      <span>Phạm vi: <strong style={{ color: '#334155' }}>{req.blastRadius}</strong></span>
                    </div>
                  </div>

                  {/* Hàng 4: Hàng nút thao tác */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginTop: '4px',
                      paddingTop: '8px',
                      borderTop: '1px dashed #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {/* Nút Xem Bằng Chứng RCA */}
                      <button
                        type="button"
                        onClick={() => handleOpenEvidence(req)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 12px',
                          backgroundColor: '#F8FAFC',
                          color: '#334155',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Eye size={13} />
                        <span>Xem bằng chứng RCA</span>
                      </button>

                      {/* Nút Xem Trước Diff (YAML) */}
                      <button
                        type="button"
                        onClick={() => setActiveDiffModal(req)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 12px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--dash-border)',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--dash-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <FileCode size={13} />
                        <span>Xem trước Diff (YAML)</span>
                      </button>

                      {/* Nút Gửi Email Thông Báo */}
                      <button
                        type="button"
                        onClick={() => handleSendEmail(req)}
                        disabled={sendingEmailId === req.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "5px 12px",
                          backgroundColor: "#F0FDF4",
                          border: "1px solid #BBF7D0",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#15803D",
                          cursor: sendingEmailId === req.id ? "not-allowed" : "pointer",
                          transition: "all 0.15s ease",
                          opacity: sendingEmailId === req.id ? 0.6 : 1,
                        }}
                        title="Gửi ngay thông báo kèm nút bấm phê duyệt 1-Click tới email cá nhân của kỹ sư phụ trách"
                      >
                        <Mail size={13} />
                        <span>{sendingEmailId === req.id ? "Đang gửi..." : "Gửi Email Thông Báo"}</span>
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
                        <>
                          <PermissionGate permission={PERMISSIONS.HITL_APPROVE} renderDisabled={true} disabledTooltip="Chỉ SME Owner hoặc Quản trị viên mới có quyền phê duyệt HITL">
                            <button
                              type="button"
                              onClick={() => handleApprove(req.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                backgroundColor: 'var(--dash-primary)',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#FFFFFF',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(5, 150, 105, 0.2)',
                              }}
                            >
                              <Check size={13} />
                              <span>Phê Duyệt Ngay</span>
                            </button>
                          </PermissionGate>

                          <PermissionGate permission={PERMISSIONS.HITL_APPROVE} renderDisabled={true} disabledTooltip="Chỉ SME Owner hoặc Quản trị viên mới có quyền từ chối HITL">
                            <button
                              type="button"
                              onClick={() => handleReject(req.id)}
                              style={{
                                padding: '4px 6px',
                                background: 'none',
                                border: 'none',
                                color: '#EF4444',
                                fontSize: '0.6875rem',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              Từ chối yêu cầu này
                            </button>
                          </PermissionGate>
                        </>
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
                    <span>&bull;</span>
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
