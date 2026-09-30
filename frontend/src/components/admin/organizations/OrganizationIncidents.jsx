import React from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Search, Clock, Zap } from 'lucide-react';

export const OrganizationIncidents = ({ incidents = [], isLoading = false }) => {
  if (isLoading) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '24px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
        }}
      >
        <span style={{ color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
          Đang tải lịch sử sự cố tổ chức...
        </span>
      </div>
    );
  }

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
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
            Nghiêm Trọng (P1)
          </span>
        );
      case 'MAJOR':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#FFFBEB',
              color: '#D97706',
              border: '1px solid #FDE68A',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            Đáng Kể (P2)
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#F1F5F9',
              color: '#475569',
              border: '1px solid #E2E8F0',
              fontWeight: 600,
              fontSize: '0.6875rem',
            }}
          >
            Nhỏ (P3)
          </span>
        );
    }
  };

  const getIncidentStatusBadge = (status) => {
    switch (status) {
      case 'RESOLVED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            <CheckCircle2 size={12} /> Đã Cứu Hộ Thành Công
          </span>
        );
      case 'SELF_HEALING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            <RefreshCw size={12} /> Đang Tự Phục Hồi
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #FDE68A',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            <Search size={12} /> Đang Điều Tra
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
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
          Lịch Sử Sự Cố & Cứu Hộ Tự Động ({incidents.length})
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
          Các cảnh báo và sự cố được hệ thống tự chẩn đoán nguyên nhân gốc rễ (Root Cause) và thời gian phục hồi (MTTR).
        </p>
      </div>

      {incidents.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
          Không ghi nhận sự cố nào phát sinh trong tổ chức này.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr
                style={{
                  background: 'linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 100%)',
                  borderBottom: '1px solid #BBF7D0',
                  color: '#166534',
                }}
              >
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Mã Sự Cố</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Mức Độ</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Dịch Vụ Bị Ảnh Hưởng</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Chẩn Đoán Nguyên Nhân Gốc (Root Cause)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Thời Gian MTTR</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng Thái Cứu Hộ</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Thời Điểm</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc, idx) => (
                <tr
                  key={inc.id || idx}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                >
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={14} style={{ color: '#059669' }} />
                      {inc.id}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getSeverityBadge(inc.severity)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {inc.service}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--dash-text-secondary)', maxWidth: '280px' }}>
                    {inc.rootCause}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 700,
                        color: '#059669',
                      }}
                    >
                      <Zap size={13} /> {inc.mttr}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getIncidentStatusBadge(inc.status)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--dash-text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {inc.timestamp}
                    </span>
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

export default OrganizationIncidents;
