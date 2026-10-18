import React from 'react';
import {
  Zap,
  Building2,
  AlertTriangle,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import RiskBadge from './RiskBadge';
import ExecutionModeBadge from './ExecutionModeBadge';
import { ApprovalStatusBadge, ExecutionStatusBadge } from './ActionStatusBadge';

export const HealingActionsTable = ({
  actions = [],
  isLoading = false,
  onNavigateToApprovals,
}) => {
  if (isLoading) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Đang tải danh sách hành động tự phục hồi...
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px dashed var(--dash-border)',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Không tìm thấy hành động tự phục hồi nào phù hợp với bộ lọc hiện tại.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Strict Security Notice: No Approval Bypass */}
      <div
        style={{
          padding: '14px 18px',
          backgroundColor: '#FFFBEB',
          borderRadius: '12px',
          border: '1px solid #FDE68A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '780px' }}>
          <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.8125rem', color: '#92400E', lineHeight: 1.5 }}>
            <strong>Chính Sách An Toàn & Phân Định Quyền Hạn:</strong> Hệ thống tuân thủ nghiêm ngặt quy trình phê duyệt an toàn. <strong>Tuyệt đối không cho phép bỏ qua (bypass) quy trình phê duyệt HITL</strong>. Các hành động rủi ro cao hoặc đang chờ duyệt bắt buộc phải thông qua Cổng Phê Duyệt HITL Gate.
          </div>
        </div>

        {onNavigateToApprovals && (
          <button
            type="button"
            onClick={onNavigateToApprovals}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #FDE68A',
              color: '#92400E',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <span>Đến Cổng Phê Duyệt HITL</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Main Table Container */}
      <div
        className="dash-table-container"
        style={{
          border: '1px solid var(--dash-border)',
          borderRadius: '14px',
          overflowX: 'auto',
          boxShadow: 'var(--dash-shadow-xs)',
          backgroundColor: '#FFFFFF',
        }}
      >
        <table className="dash-table" style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                background: 'linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 100%)',
                borderBottom: '1px solid #BBF7D0',
                color: '#166534',
                textAlign: 'left',
              }}
            >
              <th style={{ minWidth: '180px', padding: '12px 14px', fontWeight: 700 }}>Loại Hành Động (Action Type)</th>
              <th style={{ minWidth: '220px', padding: '12px 14px', fontWeight: 700 }}>Tài Nguyên Đích (Target)</th>
              <th style={{ minWidth: '150px', padding: '12px 14px', fontWeight: 700 }}>Tổ Chức (Organization)</th>
              <th style={{ minWidth: '110px', padding: '12px 14px', fontWeight: 700 }}>Môi Trường (Environment)</th>
              <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>Mức Rủi Ro (Risk Level)</th>
              <th style={{ minWidth: '160px', padding: '12px 14px', fontWeight: 700 }}>Chế Độ (Execution Mode)</th>
              <th style={{ minWidth: '160px', padding: '12px 14px', fontWeight: 700 }}>Phê Duyệt (Approval Status)</th>
              <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>Thực Thi (Execution Status)</th>
              <th style={{ minWidth: '160px', padding: '12px 14px', fontWeight: 700 }}>Yêu Cầu Bởi (Requested By)</th>
              <th style={{ minWidth: '160px', padding: '12px 14px', fontWeight: 700 }}>Thực Thi Bởi (Executed By)</th>
              <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>Thời Gian Yêu Cầu (Requested Time)</th>
              <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>Bắt Đầu (Started Time)</th>
              <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>Hoàn Tất (Completed Time)</th>
              <th style={{ minWidth: '260px', padding: '12px 14px', fontWeight: 700 }}>Kết Quả (Result)</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((act, idx) => (
              <tr
                key={act.id}
                style={{
                  borderBottom: '1px solid var(--dash-border)',
                  backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
              >
                {/* 1. Action Type */}
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} style={{ color: '#059669', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{act.actionType}</span>
                  </div>
                  <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                    {act.id}
                  </div>
                </td>

                {/* 2. Target */}
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#0F172A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Terminal size={13} style={{ color: 'var(--dash-text-muted)', flexShrink: 0 }} />
                    <span>{act.target}</span>
                  </div>
                </td>

                {/* 3. Organization */}
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Building2 size={13} style={{ color: 'var(--dash-text-muted)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{act.organization}</span>
                  </div>
                </td>

                {/* 4. Environment */}
                <td style={{ padding: '12px 14px' }}>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: act.environment === 'Production' ? '#EFF6FF' : '#FEF3C7',
                      color: act.environment === 'Production' ? '#1D4ED8' : '#92400E',
                      border: `1px solid ${act.environment === 'Production' ? '#BFDBFE' : '#FDE68A'}`,
                    }}
                  >
                    {act.environment}
                  </span>
                </td>

                {/* 5. Risk Level */}
                <td style={{ padding: '12px 14px' }}>
                  <RiskBadge riskLevel={act.riskLevel} />
                </td>

                {/* 6. Execution Mode */}
                <td style={{ padding: '12px 14px' }}>
                  <ExecutionModeBadge mode={act.executionMode} />
                </td>

                {/* 7. Approval Status */}
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    <ApprovalStatusBadge status={act.approvalStatus} />
                    {act.approvalStatus === 'AWAITING_APPROVAL' && onNavigateToApprovals && (
                      <button
                        type="button"
                        onClick={onNavigateToApprovals}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: '0.6875rem',
                          color: '#DC2626',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Chuyển Đến Duyệt &rarr;
                      </button>
                    )}
                  </div>
                </td>

                {/* 8. Execution Status */}
                <td style={{ padding: '12px 14px' }}>
                  <ExecutionStatusBadge status={act.executionStatus} />
                </td>

                {/* 9. Requested By */}
                <td style={{ padding: '12px 14px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                  {act.requestedBy}
                </td>

                {/* 10. Executed By */}
                <td style={{ padding: '12px 14px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                  {act.executedBy}
                </td>

                {/* 11. Requested Time */}
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                  {act.requestedTime}
                </td>

                {/* 12. Started Time */}
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                  {act.startedTime}
                </td>

                {/* 13. Completed Time */}
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                  {act.completedTime}
                </td>

                {/* 14. Result */}
                <td style={{ padding: '12px 14px', color: 'var(--dash-text-primary)', lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 600 }}>{act.result}</div>
                  {act.auditHash && (
                    <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)', marginTop: '3px' }}>
                      {act.auditHash}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HealingActionsTable;
