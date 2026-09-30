import React from 'react';
import { Box, Layers, CheckCircle2, AlertTriangle, ShieldAlert, Eye, RefreshCw } from 'lucide-react';

export const WorkloadTable = ({ workloads = [], isLoading = false, onViewWorkload, onSafeRestart }) => {
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
        Đang tải danh sách khối công việc (Workloads)...
      </div>
    );
  }

  if (!workloads || workloads.length === 0) {
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
        Không tìm thấy khối công việc nào phù hợp với bộ lọc hiện tại.
      </div>
    );
  }

  const renderStatus = (status) => {
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
            <CheckCircle2 size={11} /> Khỏe Mạnh (Healthy)
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
            <AlertTriangle size={11} /> Cảnh Báo Replicas
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
            <ShieldAlert size={11} /> Nguy Cấp (0 Replicas)
          </span>
        );
    }
  };

  return (
    <div
      className="dash-table-container"
      role="region"
      aria-label="Bảng danh sách khối công việc Workloads"
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
            <th style={{ minWidth: '200px', padding: '12px 16px', fontWeight: 700 }}>Khối Công Việc (Workload)</th>
            <th style={{ minWidth: '140px', padding: '12px 16px', fontWeight: 700 }}>Không Gian Tên (Namespace)</th>
            <th style={{ minWidth: '180px', padding: '12px 16px', fontWeight: 700 }}>Cụm Kubernetes (Cluster)</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700 }}>Loại (Type)</th>
            <th style={{ minWidth: '100px', padding: '12px 16px', fontWeight: 700 }}>Replicas Kỳ Vọng</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700 }}>Replicas Khả Dụng</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
          </tr>
        </thead>
        <tbody>
          {workloads.map((wl, idx) => {
            const isReplicasFull = wl.availableReplicas === wl.replicas;

            return (
              <tr
                key={wl.id}
                style={{
                  borderBottom: '1px solid var(--dash-border)',
                  backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
              >
                {/* Workload Name */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Box size={16} style={{ color: '#059669', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{wl.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                        {wl.organizationName}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Namespace */}
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#F1F5F9',
                      color: '#475569',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                    }}
                  >
                    {wl.namespace}
                  </span>
                </td>

                {/* Cluster */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={13} style={{ color: 'var(--dash-text-muted)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                      {wl.clusterName}
                    </span>
                  </div>
                </td>

                {/* Type */}
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      backgroundColor:
                        wl.type === 'Deployment'
                          ? '#EFF6FF'
                          : wl.type === 'StatefulSet'
                          ? '#F5F3FF'
                          : '#FEF3C7',
                      color:
                        wl.type === 'Deployment'
                          ? '#1D4ED8'
                          : wl.type === 'StatefulSet'
                          ? '#6D28D9'
                          : '#92400E',
                      border: `1px solid ${
                        wl.type === 'Deployment'
                          ? '#BFDBFE'
                          : wl.type === 'StatefulSet'
                          ? '#DDD6FE'
                          : '#FDE68A'
                      }`,
                    }}
                  >
                    {wl.type}
                  </span>
                </td>

                {/* Replicas */}
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                  {wl.replicas} Pods
                </td>

                {/* Available Replicas */}
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: isReplicasFull ? '#059669' : wl.availableReplicas === 0 ? '#DC2626' : '#D97706',
                    }}
                  >
                    {wl.availableReplicas} / {wl.replicas}
                  </span>
                </td>

                {/* Status */}
                <td style={{ padding: '12px 16px' }}>{renderStatus(wl.status)}</td>

                {/* Abstract safe actions - NO raw K8s commands exposed */}
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onViewWorkload && onViewWorkload(wl)}
                      aria-label={`Xem chi tiết khối công việc ${wl.name}`}
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
                      <Eye size={12} />
                      <span>Chi Tiết</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSafeRestart && onSafeRestart(wl)}
                      aria-label={`Khởi động lại tuần tự an toàn ${wl.name}`}
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
                      <RefreshCw size={12} />
                      <span>Cuộn An Toàn</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WorkloadTable;
