import React from 'react';
import { AlertCircle, Building2, Layers, ArrowUpRight, Zap } from 'lucide-react';
import SeverityBadge from './SeverityBadge';
import IncidentStatusBadge from './IncidentStatusBadge';

export const IncidentTable = ({ incidents = [], isLoading = false, onViewIncident }) => {
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
        Đang tải danh sách sự cố nền tảng...
      </div>
    );
  }

  if (!incidents || incidents.length === 0) {
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
        Không tìm thấy sự cố nào phù hợp với bộ lọc hiện tại.
      </div>
    );
  }

  return (
    <div
      className="dash-table-container"
      style={{
        border: '1px solid var(--dash-border)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: 'var(--dash-shadow-xs)',
        backgroundColor: '#FFFFFF',
      }}
    >
      <table className="dash-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
        <thead>
          <tr
            style={{
              background: 'linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 100%)',
              borderBottom: '1px solid #BBF7D0',
              color: '#166534',
            }}
          >
            <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>Mã Sự Cố (ID)</th>
            <th style={{ minWidth: '220px', padding: '12px 14px', fontWeight: 700 }}>Tiêu Đề (Title)</th>
            <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>Mức Độ (Severity)</th>
            <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>Trạng Thái (Status)</th>
            <th style={{ minWidth: '150px', padding: '12px 14px', fontWeight: 700 }}>Tổ Chức (Org)</th>
            <th style={{ minWidth: '110px', padding: '12px 14px', fontWeight: 700 }}>Môi Trường (Env)</th>
            <th style={{ minWidth: '150px', padding: '12px 14px', fontWeight: 700 }}>Cụm K8s (Cluster)</th>
            <th style={{ minWidth: '160px', padding: '12px 14px', fontWeight: 700 }}>Nguồn (Source)</th>
            <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>Phát Hiện (Detected)</th>
            <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>Bắt Đầu (Started)</th>
            <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>Khắc Phục (Resolved)</th>
            <th style={{ minWidth: '110px', padding: '12px 14px', fontWeight: 700 }}>Thời Gian (MTTR)</th>
            <th style={{ minWidth: '100px', padding: '12px 14px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc, idx) => (
            <tr
              key={inc.id}
              style={{
                borderBottom: '1px solid var(--dash-border)',
                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
            >
              {/* Incident ID */}
              <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} style={{ color: '#059669', flexShrink: 0 }} />
                  <span>{inc.id}</span>
                </div>
              </td>

              {/* Title */}
              <td style={{ padding: '12px 14px' }}>
                <button
                  type="button"
                  onClick={() => onViewIncident && onViewIncident(inc)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--dash-text-primary)',
                    cursor: 'pointer',
                    display: 'block',
                    lineHeight: 1.3,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#059669')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dash-text-primary)')}
                >
                  {inc.title}
                </button>
              </td>

              {/* Severity */}
              <td style={{ padding: '12px 14px' }}>
                <SeverityBadge severity={inc.severity} />
              </td>

              {/* Status */}
              <td style={{ padding: '12px 14px' }}>
                <IncidentStatusBadge status={inc.status} />
              </td>

              {/* Organization */}
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Building2 size={13} style={{ color: 'var(--dash-text-muted)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {inc.organizationName}
                  </span>
                </div>
              </td>

              {/* Environment */}
              <td style={{ padding: '12px 14px' }}>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    backgroundColor:
                      inc.environment === 'Production'
                        ? '#EFF6FF'
                        : inc.environment === 'Staging'
                        ? '#FEF3C7'
                        : '#F1F5F9',
                    color:
                      inc.environment === 'Production'
                        ? '#1D4ED8'
                        : inc.environment === 'Staging'
                        ? '#92400E'
                        : '#475569',
                    border: `1px solid ${
                      inc.environment === 'Production'
                        ? '#BFDBFE'
                        : inc.environment === 'Staging'
                        ? '#FDE68A'
                        : '#E2E8F0'
                    }`,
                  }}
                >
                  {inc.environment}
                </span>
              </td>

              {/* Cluster */}
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Layers size={13} style={{ color: 'var(--dash-text-muted)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                    {inc.clusterName}
                  </span>
                </div>
              </td>

              {/* Source */}
              <td style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                {inc.source}
              </td>

              {/* Detected Time */}
              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                {inc.detectedTime}
              </td>

              {/* Started Time */}
              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                {inc.startedTime}
              </td>

              {/* Resolved Time */}
              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                {inc.resolvedTime}
              </td>

              {/* Recovery Duration (MTTR) */}
              <td style={{ padding: '12px 14px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 700,
                    color: inc.recoveryDuration.includes('m') ? '#059669' : '#D97706',
                  }}
                >
                  <Zap size={12} />
                  {inc.recoveryDuration}
                </span>
              </td>

              {/* Actions */}
              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => onViewIncident && onViewIncident(inc)}
                  aria-label={`Xem chi tiết sự cố ${inc.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--dash-border)',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--dash-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--dash-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--dash-primary-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--dash-border)';
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                >
                  <span>Chi Tiết</span>
                  <ArrowUpRight size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default IncidentTable;
