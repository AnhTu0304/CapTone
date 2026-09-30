import React from 'react';
import { Server, Activity, CheckCircle2, AlertTriangle, ShieldAlert, Cpu } from 'lucide-react';

export const OrganizationClusters = ({ clusters = [], isLoading = false }) => {
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
          Đang tải danh sách cụm Kubernetes...
        </span>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'READY':
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
            <CheckCircle2 size={12} /> Sẵn Sàng
          </span>
        );
      case 'DEGRADED':
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
            <AlertTriangle size={12} /> Suy Giảm
          </span>
        );
      case 'DISCONNECTED':
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
            <ShieldAlert size={12} /> Mất Kết Nối
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
          Cụm Kubernetes Đã Đăng Ký ({clusters.length})
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
          Kết nối hạ tầng K8s thực tế, số lượng Pods, Nodes và độ trễ nhịp tim (Heartbeat) của tác tử.
        </p>
      </div>

      {clusters.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
          Tổ chức chưa kết nối cụm Kubernetes nào.
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
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Tên Cụm</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Phiên Bản K8s</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Khu Vực (Region)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Nodes</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Pods</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Độ Trễ Agent</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster, idx) => (
                <tr
                  key={cluster.id || idx}
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
                      <Server size={16} style={{ color: '#059669' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{cluster.name}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'monospace' }}>
                          {cluster.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--dash-text-secondary)' }}>
                    {cluster.version}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--dash-text-secondary)' }}>
                    {cluster.region}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Cpu size={14} style={{ color: 'var(--dash-text-muted)' }} />
                      {cluster.nodesCount}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {cluster.podsCount}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#059669',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}
                    >
                      <Activity size={12} /> {cluster.agentLatency}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getStatusBadge(cluster.status)}
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

export default OrganizationClusters;
