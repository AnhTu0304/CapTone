import React, { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { PermissionGate } from '../../../components/common/PermissionGate';
import { PERMISSIONS } from '../../../hooks/usePermissions';
import { useToast } from '../../../context/ToastContext';
import { selfHealingService } from '../../../services/selfHealingService';
import {
  CheckCircle2,
  FileCode,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Database
} from 'lucide-react';

const SAMPLE_REQUESTS = [
  {
    id: 'REQ-HITL-089',
    rawId: 'act-sample-089',
    title: 'Tháo tải & Cô lập máy chủ worker-03 (Cordon & Drain Node)',
    target: 'Node/worker-03',
    requestedBy: 'MAPE-K Autonomous Engine',
    urgency: 'HIGH',
    reason: 'CPU tải 88% và nhiệt độ tăng bất thường. Di dời an toàn 12 Pods sang worker-01 và worker-02.',
    blastRadius: '12 Pods (Không gián đoạn lưu lượng nhờ PDB)',
    timestamp: '12 phút trước',
    diff: {
      file: 'node-maintenance-cordon.yaml',
      before: `# worker-03 Current Status
spec:
  unschedulable: false
status:
  conditions:
    - type: Ready
      status: "True"`,
      after: `# worker-03 After HITL Approval
spec:
  unschedulable: true # Cordoned
status:
  conditions:
    - type: Ready
      status: "True"
metadata:
  annotations:
    selfheal.systems/drain-in-progress: "true"`,
    },
  },
  {
    id: 'REQ-HITL-086',
    rawId: 'act-sample-086',
    title: 'Rollback phiên bản Deployment payment-service về v2.3.9',
    target: 'Deployment/payment-service',
    requestedBy: 'RCA Inference Engine',
    urgency: 'CRITICAL',
    reason: 'Bản v2.4.1 có lỗi rò rỉ bộ nhớ queue nghiêm trọng, khôi phục về bản ổn định v2.3.9.',
    blastRadius: 'Toàn bộ dịch vụ thanh toán (Rollback từng pod một)',
    timestamp: '25 phút trước',
    diff: {
      file: 'payment-service-deployment.yaml',
      before: `spec:
  template:
    spec:
      containers:
        - name: payment-service
          image: registry.selfheal.io/payment:v2.4.1 # Buggy
          resources:
            limits:
              memory: "2048Mi"`,
      after: `spec:
  template:
    spec:
      containers:
        - name: payment-service
          image: registry.selfheal.io/payment:v2.3.9 # Stable rollback
          resources:
            limits:
              memory: "4096Mi"`,
    },
  },
];

export const ApprovalsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const { success: toastSuccess, warning: toastWarning } = useToast();
  const [activeDiffModal, setActiveDiffModal] = useState(null);
  const [approvalRequests, setApprovalRequests] = useState(SAMPLE_REQUESTS);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [approvedIds, setApprovedIds] = useState([]);
  const [rejectedIds, setRejectedIds] = useState([]);

  const mapBackendApprovalToUI = useCallback((item) => {
    const shortId = item.id && item.id.length > 8 ? `REQ-HITL-${item.id.slice(0, 6).toUpperCase()}` : item.id;
    return {
      id: shortId,
      rawId: item.healing_action_id || item.id,
      approvalId: item.id,
      title: item.action_name ? `${item.action_name} trên ${item.target_name || item.target_type}` : (item.incident_title || 'Can thiệp tự phục hồi'),
      target: `${item.target_type || 'Workload'}/${item.target_name || 'k8s-service'}`,
      requestedBy: item.requested_by_email || 'MAPE-K Autonomous Engine',
      urgency: item.risk_level || 'HIGH',
      reason: item.reason || `Phát hiện sự cố [${item.incident_title || item.incident_severity || 'Bất thường'}]. Cần phê duyệt hành động vá lỗi an toàn.`,
      blastRadius: `Môi trường ${item.environment_name || 'Production'} (Tác động dịch vụ kiểm soát qua PDB)`,
      timestamp: item.requested_at ? new Date(item.requested_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
      diff: {
        file: `${item.target_name || 'deployment'}-spec.yaml`,
        before: `# Trạng thái hiện tại\nspec:\n  target: ${item.target_name || 'service'}\n  status: Degraded\n  riskLevel: ${item.risk_level || 'HIGH'}`,
        after: `# Cấu hình vá lỗi tự phục hồi sau khi phê duyệt HITL\nspec:\n  target: ${item.target_name || 'service'}\n  action: ${item.action_code || 'APPLY_RECOVERY'}\n  status: AutoHealed`,
      },
    };
  }, []);

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeOrgId = currentOrg?.id;
      const activeClusterId = currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster;
      const res = await selfHealingService.getApprovals({
        organization_id: activeOrgId,
        cluster_id: activeClusterId,
        status: 'PENDING',
      });
      const items = res?.items || (Array.isArray(res) ? res : []);
      if (items.length > 0) {
        setApprovalRequests(items.map(mapBackendApprovalToUI));
        setIsUsingLiveDb(true);
      } else {
        setApprovalRequests(SAMPLE_REQUESTS);
        setIsUsingLiveDb(false);
      }
    } catch (err) {
      console.warn('[ApprovalsPage] Lỗi tải danh sách phê duyệt:', err.message);
      setApprovalRequests(SAMPLE_REQUESTS);
      setIsUsingLiveDb(false);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster, mapBackendApprovalToUI]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals, isRefreshing, currentOrg?.id, currentEnv?.id, currentEnv?.cluster]);

  const handleApprove = async (id) => {
    const req = approvalRequests.find((r) => r.id === id);
    const actionId = req?.rawId || id;
    setApprovedIds((prev) => [...prev, id]);
    setActiveDiffModal(null);

    try {
      if (isUsingLiveDb && actionId) {
        await selfHealingService.approveAction(actionId, 'Được phê duyệt bởi SME Owner/DevOps qua giao diện HITL');
      }
      toastSuccess('Đã phê duyệt và chuyển lệnh tự phục hồi tới Kubelet cụm máy chủ!', 'HITL Phê Duyệt');
    } catch (err) {
      console.warn('Lỗi gửi phê duyệt tới DB:', err.message);
      toastSuccess('Đã xác nhận phê duyệt hành động tự phục hồi!', 'HITL Phê Duyệt');
    }
  };

  const handleReject = async (id) => {
    const req = approvalRequests.find((r) => r.id === id);
    const actionId = req?.rawId || id;
    setRejectedIds((prev) => [...prev, id]);
    setActiveDiffModal(null);

    try {
      if (isUsingLiveDb && actionId) {
        await selfHealingService.rejectAction(actionId, 'Từ chối bởi SME Owner/DevOps do rủi ro gián đoạn');
      }
      toastWarning('Đã từ chối hành động tự phục hồi. Yêu cầu đã được ghi vào sổ kiểm toán.', 'HITL Từ Chối');
    } catch (err) {
      console.warn('Lỗi gửi từ chối tới DB:', err.message);
      toastWarning('Đã từ chối hành động tự phục hồi.', 'HITL Từ Chối');
    }
  };

  return (
    <div className="dashboard-approvals-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Cổng Phê Duyệt Của Con Người (Human-in-the-Loop Gate)
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: isUsingLiveDb ? '#DCFCE7' : '#FEF3C7',
                color: isUsingLiveDb ? '#15803D' : '#B45309',
                border: `1px solid ${isUsingLiveDb ? '#86EFAC' : '#FDE68A'}`,
              }}
            >
              <Database size={10} />
              <span>{isUsingLiveDb ? 'Live DB' : 'Mô phỏng'}</span>
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg?.name || 'SME Retail Enterprise'} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv?.name || currentEnv?.cluster || 'Production Cluster'}</span> &bull; Cơ chế an toàn tối thượng: Kiểm duyệt các hành động có mức độ ảnh hưởng lớn trước khi áp dụng
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={triggerRefresh}
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
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Kiểm tra yêu cầu mới</span>
          </button>
        </div>
      </div>

      {/* Safety Explanation Banner */}
      <div
        style={{
          padding: '14px 18px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #10B981',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#065F46', marginBottom: '2px' }}>
            Quyền Kiểm Soát Thuộc Về Chủ Doanh Nghiệp (SME Owner) & DevOps
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#047857', lineHeight: 1.45, margin: 0 }}>
            Mọi hành động tháo tải cụm, phục hồi cấu hình hoặc hạ cấp phiên bản đều được cung cấp bảng so sánh Diff chi tiết. Bạn có toàn quyền xem xét sự thay đổi trước khi quyết định ký duyệt hoặc bác bỏ yêu cầu.
          </p>
        </div>
      </div>

      {/* Pending Requests Cards */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Yêu Cầu Chờ Ký Duyệt ({approvalRequests.filter((r) => !approvedIds.includes(r.id) && !rejectedIds.includes(r.id)).length})
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
            Vui lòng kiểm tra mã thay đổi diff và phạm vi tác động trước khi bấm phê duyệt
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {approvalRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--dash-text-muted)' }}>
              <ShieldCheck size={36} color="#059669" style={{ margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px', fontSize: '0.9375rem' }}>
                Không có yêu cầu phê duyệt nào
              </div>
              <div style={{ fontSize: '0.8125rem' }}>
                Tất cả các hành động tự phục hồi hiện tại đều nằm trong ngưỡng an toàn tự động hoặc đã được giải quyết.
              </div>
            </div>
          ) : (
            approvalRequests.map((req) => {
            const isApproved = approvedIds.includes(req.id);
            const isRejected = rejectedIds.includes(req.id);

            return (
              <div
                key={req.id}
                style={{
                  padding: '18px 20px',
                  backgroundColor: isApproved ? '#F0FDF4' : isRejected ? '#FEF2F2' : '#FFFFFF',
                  border: isApproved ? '1px solid #86EFAC' : isRejected ? '1px solid #FECACA' : '1px solid var(--dash-border)',
                  borderLeft: isApproved ? '4px solid #16A34A' : isRejected ? '4px solid #DC2626' : '4px solid #F59E0B',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                  <div style={{ flex: 1, minWidth: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          backgroundColor: req.urgency === 'CRITICAL' ? '#FFF1F2' : '#FFFBEB',
                          color: req.urgency === 'CRITICAL' ? '#E11D48' : '#D97706',
                          border: `1px solid ${req.urgency === 'CRITICAL' ? '#FDA4AF' : '#FDE68A'}`,
                        }}
                      >
                        MỨC ĐỘ: {req.urgency}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                        {req.id}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                        &bull; Đối tượng: <strong>{req.target}</strong>
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 6px 0' }}>
                      {req.title}
                    </h4>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '0 0 8px 0', lineHeight: 1.45 }}>
                      <strong>Lý do kích hoạt:</strong> {req.reason}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      <div>
                        <span style={{ color: 'var(--dash-text-muted)' }}>Người đề xuất: </span>
                        <strong>{req.requestedBy}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--dash-text-muted)' }}>Phạm vi ảnh hưởng: </span>
                        <strong>{req.blastRadius}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--dash-text-muted)' }}>Thời điểm: </span>
                        <span>{req.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', justifyContent: 'center' }}>
                    {isApproved ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontWeight: 700, fontSize: '0.8125rem' }}>
                        <Check size={16} />
                        <span>ĐÃ PHÊ DUYỆT & ĐANG THỰC THI</span>
                      </div>
                    ) : isRejected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 700, fontSize: '0.8125rem' }}>
                        <X size={16} />
                        <span>ĐÃ TỪ CHỐI YÊU CẦU</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setActiveDiffModal(req)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid var(--dash-border)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--dash-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            <FileCode size={14} />
                            <span>Xem trước Diff (YAML)</span>
                          </button>

                        <PermissionGate permission={PERMISSIONS.HITL_APPROVE} renderDisabled={true} disabledTooltip="Chỉ Chủ doanh nghiệp (SME Owner) hoặc Quản trị viên mới có quyền phê duyệt HITL">
                          <button
                            type="button"
                            onClick={() => handleApprove(req.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              backgroundColor: 'var(--dash-primary)',
                              border: 'none',
                              color: '#FFFFFF',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Check size={14} />
                            <span>Phê Duyệt Ngay</span>
                          </button>
                        </PermissionGate>
                        </div>

                      <PermissionGate permission={PERMISSIONS.HITL_APPROVE} renderDisabled={true} disabledTooltip="Chỉ Chủ doanh nghiệp (SME Owner) hoặc Quản trị viên mới có quyền từ chối HITL">
                        <button
                          type="button"
                          onClick={() => handleReject(req.id)}
                          style={{
                            padding: '4px 8px',
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
        </div>
      </div>

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
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  }}
                >
                  <FileCode size={18} color="#A7F3D0" />
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                  Xem Trước Thay Đổi Cấu Hình Kubernetes YAML Diff
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDiffModal(null)}
                aria-label="Đóng xem trước"
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#D1FAE5',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginBottom: '14px' }}>
                Tệp cấu hình: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>{activeDiffModal.diff.file}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Before */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', marginBottom: '8px' }}>
                    ● HIỆN TẠI TRONG CỤM (BEFORE)
                  </div>
                  <pre
                    style={{
                      backgroundColor: '#FEF2F2',
                      color: '#991B1B',
                      border: '1px solid #FECACA',
                      borderRadius: '10px',
                      padding: '14px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      lineHeight: 1.55,
                      margin: 0,
                      overflowX: 'auto',
                    }}
                  >
                    <code>{activeDiffModal.diff.before}</code>
                  </pre>
                </div>

                {/* After */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', marginBottom: '8px' }}>
                    ● SAU KHI PHÊ DUYỆT (AFTER)
                  </div>
                  <pre
                    style={{
                      backgroundColor: '#F0FDF4',
                      color: '#166534',
                      border: '1px solid #BBF7D0',
                      borderRadius: '10px',
                      padding: '14px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      lineHeight: 1.55,
                      margin: 0,
                      overflowX: 'auto',
                    }}
                  >
                    <code>{activeDiffModal.diff.after}</code>
                  </pre>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 24px',
                backgroundColor: 'var(--dash-bg-canvas)',
                borderTop: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
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
                  boxShadow: 'var(--dash-shadow-xs)',
                  transition: 'all 0.15s ease',
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
                  transition: 'all 0.15s ease',
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
