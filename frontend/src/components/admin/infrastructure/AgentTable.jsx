import React from 'react';
import { Bot, Building2, Layers, CheckCircle2, AlertTriangle, ShieldAlert, Clock, Activity, Zap } from 'lucide-react';

export const AgentTable = ({ agents = [], isLoading = false, onPingAgent }) => {
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
        Đang tải danh sách tác tử eBPF...
      </div>
    );
  }

  if (!agents || agents.length === 0) {
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
        Không tìm thấy tác tử eBPF nào phù hợp với bộ lọc hiện tại.
      </div>
    );
  }

  const renderStatus = (status) => {
    switch (status) {
      case 'ONLINE':
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
            <CheckCircle2 size={11} /> Trực Tuyến
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
            <AlertTriangle size={11} /> Suy Giảm
          </span>
        );
      case 'OFFLINE':
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
            <ShieldAlert size={11} /> Ngoại Tuyến
          </span>
        );
    }
  };

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
            <th style={{ minWidth: '220px', padding: '12px 16px', fontWeight: 700 }}>Tên Tác Tử (Agent Name)</th>
            <th style={{ minWidth: '160px', padding: '12px 16px', fontWeight: 700 }}>Tổ Chức (Organization)</th>
            <th style={{ minWidth: '180px', padding: '12px 16px', fontWeight: 700 }}>Cụm Kubernetes (Cluster)</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700 }}>Phiên Bản</th>
            <th style={{ minWidth: '110px', padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
            <th style={{ minWidth: '130px', padding: '12px 16px', fontWeight: 700 }}>Nhịp Tim Cuối</th>
            <th style={{ minWidth: '110px', padding: '12px 16px', fontWeight: 700 }}>Độ Trễ</th>
            <th style={{ minWidth: '120px', padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, idx) => (
            <tr
              key={agent.id}
              style={{
                borderBottom: '1px solid var(--dash-border)',
                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
            >
              {/* Agent Name */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={16} style={{ color: '#059669', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{agent.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {agent.id}
                    </div>
                  </div>
                </div>
              </td>

              {/* Organization */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={13} style={{ color: 'var(--dash-text-muted)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {agent.organizationName}
                  </span>
                </div>
              </td>

              {/* Cluster */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={13} style={{ color: 'var(--dash-text-muted)' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{agent.clusterName}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {agent.clusterId}
                    </div>
                  </div>
                </div>
              </td>

              {/* Version */}
              <td style={{ padding: '12px 16px' }}>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                  }}
                >
                  {agent.version}
                </span>
              </td>

              {/* Status */}
              <td style={{ padding: '12px 16px' }}>{renderStatus(agent.status)}</td>

              {/* Last heartbeat */}
              <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} style={{ color: 'var(--dash-text-muted)' }} />
                  {agent.lastHeartbeat}
                </span>
              </td>

              {/* Latency */}
              <td style={{ padding: '12px 16px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: agent.status === 'ONLINE' ? '#059669' : agent.status === 'DEGRADED' ? '#D97706' : '#DC2626',
                  }}
                >
                  <Activity size={12} /> {agent.latency}
                </span>
              </td>

              {/* Abstract safe actions - NO raw K8s commands exposed */}
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => onPingAgent && onPingAgent(agent)}
                  aria-label={`Kiểm tra nhịp tim tác tử ${agent.name}`}
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
                  <Zap size={12} />
                  <span>Đo Nhịp Tim</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AgentTable;
