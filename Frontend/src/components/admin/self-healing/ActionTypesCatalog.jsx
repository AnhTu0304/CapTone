import React from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Undo2, Info } from 'lucide-react';
import RiskBadge from './RiskBadge';

export const ActionTypesCatalog = ({ actionTypes = [], isLoading = false }) => {
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
        Đang tải danh mục các loại hành động tự phục hồi...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Information Header Box */}
      <div
        style={{
          padding: '14px 18px',
          backgroundColor: '#F0FDF4',
          borderRadius: '12px',
          border: '1px solid #BBF7D0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Info size={18} style={{ color: '#166534', flexShrink: 0 }} />
        <div style={{ fontSize: '0.8125rem', color: '#166534', lineHeight: 1.5 }}>
          <strong>Thư Viện Loại Hành Động Chuẩn Hóa:</strong> Các thao tác cứu hộ được kiểm thử nghiêm ngặt, phân loại rủi ro và xác định sẵn cơ chế hoàn nguyên (Rollback) tương ứng. Tác vụ có nguy cơ gián đoạn bắt buộc phải kích hoạt cổng HITL Gate.
        </div>
      </div>

      {/* Grid of Action Types */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '16px',
        }}
      >
        {actionTypes.map((type) => (
          <div
            key={type.id}
            className="dash-card"
            style={{
              padding: '20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--dash-shadow-xs)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
              transition: 'all 0.15s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: '#059669',
                    backgroundColor: '#ECFDF5',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #A7F3D0',
                  }}
                >
                  {type.id} • {type.category}
                </span>
                <RiskBadge riskLevel={type.defaultRiskLevel} />
              </div>

              <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: '0 0 8px 0' }}>
                {type.name}
              </h4>

              <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {type.description}
              </p>
            </div>

            <div
              style={{
                paddingTop: '12px',
                borderTop: '1px solid var(--dash-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--dash-text-muted)' }}>Tài nguyên tác động:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0F172A' }}>
                  {type.targetResourceType}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--dash-text-muted)' }}>Yêu cầu phê duyệt:</span>
                <span style={{ fontWeight: 700, color: type.defaultApprovalRequired ? '#D97706' : '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {type.defaultApprovalRequired ? (
                    <>
                      <CheckCircle2 size={12} /> Bắt buộc duyệt HITL
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={12} /> Cho phép Tự Trị
                    </>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--dash-text-muted)' }}>Hỗ trợ hoàn nguyên (Rollback):</span>
                <span style={{ fontWeight: 700, color: type.supportsRollback ? '#059669' : '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {type.supportsRollback ? (
                    <>
                      <Undo2 size={12} /> Có hỗ trợ
                    </>
                  ) : (
                    <>
                      <XCircle size={12} /> Không hỗ trợ
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionTypesCatalog;
