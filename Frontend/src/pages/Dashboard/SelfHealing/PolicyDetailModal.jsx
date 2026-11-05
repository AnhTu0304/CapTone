import React from 'react';
import {
  X,
  Shield,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
  Lock,
  Trash2,
  Clock,
  Activity,
  Layers,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

export const PolicyDetailModal = ({
  isOpen,
  policy,
  onClose,
  onDelete,
  canManagePolicies,
  currentEnv,
  deletingPolicyId,
}) => {
  if (!isOpen || !policy) return null;

  const isHighRisk = policy.riskLevel === 'HIGH' || policy.riskLevel === 'CRITICAL';
  const isMedRisk = policy.riskLevel === 'MEDIUM';

  const clusterName = currentEnv?.cluster || currentEnv?.name || policy.targetCluster || 'Tất cả cụm';
  const isAgentOnline = currentEnv?.agentStatus === 'ONLINE';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'dashFadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: policy.enabled ? '#ECFDF5' : '#F1F5F9',
                border: `1px solid ${policy.enabled ? '#A7F3D0' : '#CBD5E1'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: policy.enabled ? '#059669' : '#64748B',
                flexShrink: 0,
              }}
            >
              <Shield size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    color: 'var(--dash-primary, #059669)',
                  }}
                >
                  {policy.code || policy.id}
                </span>

                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: policy.enabled ? '#ECFDF5' : '#F1F5F9',
                    color: policy.enabled ? '#059669' : '#64748B',
                    border: `1px solid ${policy.enabled ? '#A7F3D0' : '#CBD5E1'}`,
                  }}
                >
                  {policy.enabled ? '● Đang Bật' : '○ Đã Tắt'}
                </span>

                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: isHighRisk ? '#FEF2F2' : isMedRisk ? '#FFFBEB' : '#ECFDF5',
                    color: isHighRisk ? '#DC2626' : isMedRisk ? '#D97706' : '#059669',
                    border: `1px solid ${isHighRisk ? '#FECACA' : isMedRisk ? '#FDE68A' : '#A7F3D0'}`,
                  }}
                >
                  Rủi ro: {isHighRisk ? 'Cao' : isMedRisk ? 'Vừa' : 'Thấp'}
                </span>

                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: policy.hitlRequired ? '#EFF6FF' : '#F8FAFC',
                    color: policy.hitlRequired ? '#2563EB' : '#475569',
                    border: `1px solid ${policy.hitlRequired ? '#BFDBFE' : '#E2E8F0'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {policy.hitlRequired ? <Lock size={10} /> : <Zap size={10} />}
                  <span>{policy.hitlRequired ? 'Cần duyệt (HITL)' : 'Tự động chạy'}</span>
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                Chi tiết quy tắc tự phục hồi MAPE-K
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E2E8F0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Policy Name Banner */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#F8FAFC',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
              TÊN QUY TẮC PHỤC HỒI
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.4 }}>
              {policy.name}
            </div>
          </div>

          {/* Scope & Cluster */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                <Server size={12} />
                <span>CỤM KUBERNETES</span>
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                {clusterName}
              </div>
              <div style={{ fontSize: '0.6875rem', color: isAgentOnline ? '#059669' : '#D97706', marginTop: '2px', fontWeight: 600 }}>
                {isAgentOnline ? '● Tác tử eBPF Trực tuyến' : '▲ Tác tử Ngoại tuyến'}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                <Layers size={12} />
                <span>KHÔNG GIAN TÊN (NAMESPACE)</span>
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'monospace', color: '#0F172A' }}>
                {policy.targetNamespace || 'production'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                Phạm vi bảo vệ workload
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                <Activity size={12} />
                <span>PHÂN LOẠI QUY TẮC</span>
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                {policy.category}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                Hệ điều phối MAPE-K
              </div>
            </div>
          </div>

          {/* Trigger Condition & Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Condition Card */}
            <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', marginBottom: '6px' }}>
                <Activity size={13} />
                <span>ĐIỀU KIỆN VIỄN TRẮC KÍCH HOẠT (TRIGGER CONDITION)</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#1E293B', fontWeight: 600, lineHeight: 1.5 }}>
                {policy.condition}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '6px' }}>
                Được giám sát liên tục qua eBPF Kernel Probe và đường truyền viễn trắc thời gian thực.
              </div>
            </div>

            {/* Action Card */}
            <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: '6px' }}>
                <Zap size={13} />
                <span>HÀNH ĐỘNG TỰ KHẮC PHỤC K8S (REMEDIATION ACTION)</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#1E293B', fontWeight: 700, lineHeight: 1.5 }}>
                {policy.action}
              </div>
              <div style={{ marginTop: '8px' }}>
                {isAgentOnline ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#059669',
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    <CheckCircle2 size={11} />
                    <span>Đã cấp quyền thực thi tự động trên cụm {clusterName}</span>
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#D97706',
                      backgroundColor: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    <AlertTriangle size={11} />
                    <span>Chưa cấp quyền (Tác tử eBPF Ngoại tuyến)</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Safety & HITL Guardrails */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
                CỔNG PHÊ DUYỆT (HITL):
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: policy.hitlRequired ? '#2563EB' : '#059669' }}>
                {policy.hitlRequired ? 'Bắt buộc phê duyệt kỹ sư' : 'Tự động kích hoạt ngay'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
                THỜI GIAN HẠ NHIỆT (COOLDOWN):
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                {policy.cooldown || 300} giây (Chống giật xung)
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
                BẢO VỆ BÁN KÍNH SỰ CỐ:
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#059669' }}>
                Bảo vệ qua Pod Disruption Budget
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Nút Xóa ở dưới */}
          <div>
            <button
              type="button"
              onClick={() => onDelete(policy)}
              disabled={!canManagePolicies || deletingPolicyId === policy.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #FECACA',
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: canManagePolicies ? 'pointer' : 'not-allowed',
                opacity: !canManagePolicies ? 0.5 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (canManagePolicies) e.currentTarget.style.backgroundColor = '#FEE2E2';
              }}
              onMouseLeave={(e) => {
                if (canManagePolicies) e.currentTarget.style.backgroundColor = '#FEF2F2';
              }}
              title={
                !canManagePolicies
                  ? 'Chỉ SME Owner và DevOps mới có quyền xóa quy tắc'
                  : 'Xóa vĩnh viễn quy tắc này khỏi cụm'
              }
            >
              <Trash2 size={14} />
              <span>{deletingPolicyId === policy.id ? 'Đang xóa...' : 'Xóa Quy Tắc Này'}</span>
            </button>
          </div>

          {/* Nút Đóng */}
          <div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 18px',
                borderRadius: '8px',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1E293B')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0F172A')}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyDetailModal;
