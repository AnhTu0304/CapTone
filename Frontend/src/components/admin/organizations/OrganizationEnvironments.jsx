import React from 'react';
import { Layers, ShieldAlert, CheckCircle2, AlertTriangle, Zap, SlidersHorizontal, Server } from 'lucide-react';

export const OrganizationEnvironments = ({ environments = [], isLoading = false }) => {
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
          Đang tải môi trường triển khai...
        </span>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'HEALTHY':
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
            <CheckCircle2 size={12} /> Khỏe Mạnh
          </span>
        );
      case 'WARNING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#FFFBEB',
              color: '#92400E',
              border: '1px solid #FDE68A',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            <AlertTriangle size={12} /> Cảnh Báo
          </span>
        );
      case 'CRITICAL':
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          >
            <ShieldAlert size={12} /> Nguy Cấp
          </span>
        );
    }
  };

  const getAutoHealingBadge = (mode) => {
    switch (mode) {
      case 'AUTOMATIC':
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
              fontWeight: 600,
              fontSize: '0.6875rem',
            }}
          >
            <Zap size={12} /> Tự Động (Autonomous)
          </span>
        );
      case 'HITL_REQUIRED':
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
              fontWeight: 600,
              fontSize: '0.6875rem',
            }}
          >
            <SlidersHorizontal size={12} /> Yêu Cầu Duyệt (HITL)
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
              backgroundColor: '#F1F5F9',
              color: '#475569',
              border: '1px solid #E2E8F0',
              fontWeight: 600,
              fontSize: '0.6875rem',
            }}
          >
            Chỉ Giám Sát (Audit)
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
          Môi Trường Triển Khai ({environments.length})
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
          Các phân vùng môi trường hạ tầng (Production, Staging, Dev) và chế độ cứu hộ tự động cấu hình.
        </p>
      </div>

      {environments.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
          Chưa thiết lập môi trường nào.
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
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Môi Trường</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Cụm Kubernetes</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Khối Lượng Tải (Workloads)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Chế Độ Cứu Hộ Tự Động</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng Thái Sức Khỏe</th>
              </tr>
            </thead>
            <tbody>
              {environments.map((env, idx) => (
                <tr
                  key={env.id || idx}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={16} style={{ color: '#059669' }} />
                      <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{env.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--dash-text-secondary)', fontFamily: 'monospace' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Server size={14} style={{ color: 'var(--dash-text-muted)' }} />
                      {env.clusterId}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {env.workloadsCount} dịch vụ
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getAutoHealingBadge(env.autoHealingMode)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getStatusBadge(env.status)}
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

export default OrganizationEnvironments;
