import React from 'react';
import { Layers, Building2, CheckCircle2, AlertTriangle, ShieldAlert, Cpu, Radio, RefreshCw, ShieldCheck } from 'lucide-react';

export const ClusterTable = ({ clusters = [], isLoading = false, onSyncCluster, onInspectCluster }) => {
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
        Đang tải danh sách cụm Kubernetes...
      </div>
    );
  }

  if (!clusters || clusters.length === 0) {
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
        Không tìm thấy cụm Kubernetes nào phù hợp với bộ lọc hiện tại.
      </div>
    );
  }

  const renderStatus = (status) => {
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
            <CheckCircle2 size={11} /> Sẵn Sàng
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
            <AlertTriangle size={11} /> Cảnh Báo
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
            <ShieldAlert size={11} /> Nguy Cấp
          </span>
        );
    }
  };

  return (
    <div
      className="dash-table-container"
      role="region"
      aria-label="Bảng danh sách cụm Kubernetes"
      tabIndex={0}
      style={{
        border: '1px solid var(--dash-border)',
        borderRadius: '14px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
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
            <th style={{ minWidth: '220px', padding: '12px 16px', fontWeight: 700 }}>Tên Cụm (Cluster Name)</th>
            <th style={{ minWidth: '160px', padding: '12px 16px', fontWeight: 700 }}>Tổ Chức (Organization)</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700 }}>Môi Trường</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700 }}>Phiên Bản K8s</th>
            <th style={{ minWidth: '110px', padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
            <th style={{ minWidth: '90px', padding: '12px 16px', fontWeight: 700 }}>Nodes</th>
            <th style={{ minWidth: '90px', padding: '12px 16px', fontWeight: 700 }}>Pods</th>
            <th style={{ minWidth: '140px', padding: '12px 16px', fontWeight: 700 }}>Tác Tử eBPF</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700 }}>Đồng Bộ Cuối</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((cluster, idx) => (
            <tr
              key={cluster.id}
              style={{
                borderBottom: '1px solid var(--dash-border)',
                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
            >
              {/* Cluster Name */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} style={{ color: '#059669', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{cluster.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {cluster.id}
                    </div>
                  </div>
                </div>
              </td>

              {/* Organization */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={13} style={{ color: 'var(--dash-text-muted)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {cluster.organizationName || cluster.organization || 'Hệ Thống'}
                  </span>
                </div>
              </td>

              {/* Environment */}
              <td style={{ padding: '12px 16px' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    backgroundColor:
                      (cluster.environment || 'Production') === 'Production'
                        ? '#EFF6FF'
                        : cluster.environment === 'Staging'
                        ? '#FEF3C7'
                        : '#F1F5F9',
                    color:
                      (cluster.environment || 'Production') === 'Production'
                        ? '#1D4ED8'
                        : cluster.environment === 'Staging'
                        ? '#92400E'
                        : '#475569',
                    border: `1px solid ${
                      (cluster.environment || 'Production') === 'Production'
                        ? '#BFDBFE'
                        : cluster.environment === 'Staging'
                        ? '#FDE68A'
                        : '#E2E8F0'
                    }`,
                  }}
                >
                  {cluster.environment || 'Production'}
                </span>
              </td>

              {/* K8s Version */}
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                {cluster.k8sVersion || cluster.version || 'v1.30.0'}
              </td>

              {/* Status */}
              <td style={{ padding: '12px 16px' }}>{renderStatus(cluster.status)}</td>

              {/* Node count */}
              <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Cpu size={13} style={{ color: 'var(--dash-text-muted)' }} />
                  {cluster.nodeCount ?? cluster.nodesCount ?? 0}
                </span>
              </td>

              {/* Pod count */}
              <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                {(cluster.podCount ?? cluster.podsCount ?? 0).toLocaleString('vi-VN')}
              </td>

              {/* Agent info */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Radio
                    size={12}
                    style={{
                      color: (cluster.agentStatus || 'ONLINE') === 'ONLINE' ? '#059669' : cluster.agentStatus === 'DEGRADED' ? '#D97706' : '#DC2626',
                    }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--dash-text-primary)' }}>
                      {cluster.agentStatus || 'ONLINE'}
                    </span>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {cluster.agentVersion || cluster.agentLatency || 'v2.4.1-ebpf'}
                    </div>
                  </div>
                </div>
              </td>

              {/* Last sync */}
              <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                {cluster.lastSync || 'Vừa xong'}
              </td>

              {/* Abstract safe actions - NO raw K8s commands exposed */}
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onSyncCluster && onSyncCluster(cluster)}
                    aria-label={`Đồng bộ trạng thái cụm ${cluster.name}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--dash-border)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--dash-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Đồng Bộ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onInspectCluster && onInspectCluster(cluster)}
                    aria-label={`Kiểm tra an toàn cụm ${cluster.name}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#065F46',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <ShieldCheck size={12} />
                    <span>Quét An Toàn</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ClusterTable;
