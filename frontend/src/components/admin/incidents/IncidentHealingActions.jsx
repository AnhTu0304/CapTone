import React from 'react';
import { Zap, AlertTriangle, ArrowRight, Hash, Layers } from 'lucide-react';

export const IncidentHealingActions = ({ actions = [], isLoading = false, onNavigateToApprovals }) => {
  if (isLoading) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '30px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          textAlign: 'center',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Đang tải danh sách kế hoạch hành động tự phục hồi...
      </div>
    );
  }

  const renderStateBadge = (state) => {
    switch (state) {
      case 'APPLIED':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            Đã Thi Hành
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              border: '1px solid #FECACA',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            Chờ Duyệt HITL
          </span>
        );
      case 'EXECUTING':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            Đang Thi Hành
          </span>
        );
      case 'RECOMMENDED':
      default:
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#FFFBEB',
              color: '#92400E',
              border: '1px solid #FDE68A',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            Khuyến Nghị (Chưa duyệt)
          </span>
        );
    }
  };

  return (
    <div
      className="dash-card"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} style={{ color: '#059669' }} />
          Kế Hoạch & Hành Động Tự Phục Hồi (Self-Healing Actions)
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
          Chi tiết các thay đổi cấu hình hạ tầng K8s và chữ ký mật mã kiểm toán SHA-256 tương ứng.
        </p>
      </div>

      {/* Safety Gate Alert - Explicit Non-Execution from this Page */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: '#FFFBEB',
          borderBottom: '1px solid #FDE68A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '720px' }}>
          <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.8125rem', color: '#92400E', lineHeight: 1.5 }}>
            <strong>Chính Sách An Toàn & Phân Định Quyền Hạn:</strong> Trang này chỉ phục vụ mục đích giám sát và phân tích. <strong>Không được phép kích hoạt hay thực thi trực tiếp hành động tự phục hồi từ trang này</strong>. Mọi tác vụ cần phê duyệt bắt buộc phải chuyển qua Cổng Phê Duyệt An Toàn (HITL Approval Gate).
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

      {/* Table of Actions */}
      {actions.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
          Chưa có hành động phục hồi nào được đề xuất cho sự cố này.
        </div>
      ) : (
        <div
          className="dash-table-container"
          role="region"
          aria-label="Bảng hành động tự phục hồi"
          tabIndex={0}
          style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr
                style={{
                  background: 'linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 100%)',
                  borderBottom: '1px solid #BBF7D0',
                  color: '#166534',
                }}
              >
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Hành Động Đề Xuất</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Phân Loại</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Đối Tượng K8s</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Tham Số Cấu Hình</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Thời Điểm Thực Hiện</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Chữ Ký Kiểm Toán SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((act, idx) => (
                <tr
                  key={act.id || idx}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                >
                  {/* Action Title */}
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={14} style={{ color: '#059669', flexShrink: 0 }} />
                      <span>{act.action}</span>
                    </div>
                  </td>

                  {/* Type */}
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#F1F5F9',
                        color: '#334155',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                      }}
                    >
                      {act.type}
                    </span>
                  </td>

                  {/* Target */}
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={12} style={{ color: 'var(--dash-text-muted)' }} />
                      <span>{act.target}</span>
                    </div>
                  </td>

                  {/* Parameters */}
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#0F172A', maxWidth: '240px' }}>
                    {act.parameters}
                  </td>

                  {/* State */}
                  <td style={{ padding: '12px 16px' }}>{renderStateBadge(act.state)}</td>

                  {/* Executed At */}
                  <td style={{ padding: '12px 16px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {act.executedAt}
                  </td>

                  {/* SHA-256 Audit Hash */}
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Hash size={11} />
                      <span>{act.auditHash}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default IncidentHealingActions;
