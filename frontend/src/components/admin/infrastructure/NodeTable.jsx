import React from 'react';
import { Server, Layers, CheckCircle2, ShieldAlert, Cpu, HardDrive, Wrench, ShieldCheck } from 'lucide-react';

export const NodeTable = ({ nodes = [], isLoading = false, onScheduleMaintenance, onVerifyNode }) => {
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
        Đang tải danh sách máy chủ hạ tầng (Nodes)...
      </div>
    );
  }

  if (!nodes || nodes.length === 0) {
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
        Không tìm thấy máy chủ nào phù hợp với bộ lọc hiện tại.
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
            <CheckCircle2 size={11} /> Sẵn Sàng (Ready)
          </span>
        );
      case 'MAINTENANCE':
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
            <Wrench size={11} /> Đang Bảo Trì
          </span>
        );
      case 'NOT_READY':
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
            <ShieldAlert size={11} /> Chưa Sẵn Sàng
          </span>
        );
    }
  };

  return (
    <div
      className="dash-table-container"
      role="region"
      aria-label="Bảng danh sách máy chủ Nodes"
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
            <th style={{ minWidth: '220px', padding: '12px 16px', fontWeight: 700 }}>Tên Máy Chủ (Node Name)</th>
            <th style={{ minWidth: '180px', padding: '12px 16px', fontWeight: 700 }}>Cụm Kubernetes (Cluster)</th>
            <th style={{ minWidth: '110px', padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
            <th style={{ minWidth: '170px', padding: '12px 16px', fontWeight: 700 }}>Dung Lượng CPU (Capacity)</th>
            <th style={{ minWidth: '170px', padding: '12px 16px', fontWeight: 700 }}>Dung Lượng RAM (Memory)</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700 }}>Phiên Bản K8s</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node, idx) => (
            <tr
              key={node.id}
              style={{
                borderBottom: '1px solid var(--dash-border)',
                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
            >
              {/* Node Name */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={16} style={{ color: '#059669', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {node.name}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                      {node.organizationName}
                    </div>
                  </div>
                </div>
              </td>

              {/* Cluster */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={13} style={{ color: 'var(--dash-text-muted)' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{node.clusterName}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {node.clusterId}
                    </div>
                  </div>
                </div>
              </td>

              {/* Status */}
              <td style={{ padding: '12px 16px' }}>{renderStatus(node.status)}</td>

              {/* CPU Capacity with visual progress bar */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Cpu size={12} style={{ color: 'var(--dash-text-muted)' }} />
                    {node.cpuAllocated} / {node.cpuTotal} Cores
                  </span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: node.cpuPercent > 80 ? '#DC2626' : '#059669' }}>
                    {node.cpuPercent}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${node.cpuPercent}%`,
                      height: '100%',
                      backgroundColor: node.cpuPercent > 80 ? '#DC2626' : '#059669',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </td>

              {/* Memory Capacity with visual progress bar */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <HardDrive size={12} style={{ color: 'var(--dash-text-muted)' }} />
                    {node.memoryAllocatedGB} / {node.memoryTotalGB} GB
                  </span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: node.memoryPercent > 80 ? '#DC2626' : '#059669' }}>
                    {node.memoryPercent}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${node.memoryPercent}%`,
                      height: '100%',
                      backgroundColor: node.memoryPercent > 80 ? '#DC2626' : '#059669',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </td>

              {/* K8s Version */}
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                {node.k8sVersion}
              </td>

              {/* Abstract safe actions - NO raw K8s commands exposed */}
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onScheduleMaintenance && onScheduleMaintenance(node)}
                    aria-label={`Đặt lịch bảo trì an toàn máy chủ ${node.name}`}
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
                    <Wrench size={12} />
                    <span>Bảo Trì</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onVerifyNode && onVerifyNode(node)}
                    aria-label={`Kiểm tra tài nguyên máy chủ ${node.name}`}
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
                    <span>Kiểm Tra</span>
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

export default NodeTable;
