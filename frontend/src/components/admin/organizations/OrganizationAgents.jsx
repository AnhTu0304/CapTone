import React from 'react';
import { Bot, CheckCircle2, AlertTriangle, ShieldAlert, Clock, Terminal } from 'lucide-react';

export const OrganizationAgents = ({ agents = [], isLoading = false }) => {
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
          Đang tải danh sách tác tử eBPF DaemonSet...
        </span>
      </div>
    );
  }

  const getStatusBadge = (status) => {
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
            <CheckCircle2 size={12} /> Trực Tuyến
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
            <ShieldAlert size={12} /> Ngoại Tuyến
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
          Tác Tử Giám Sát eBPF DaemonSet ({agents.length})
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
          Tình trạng hoạt động của các sensor eBPF chạy ở kernel-level trên các node máy chủ.
        </p>
      </div>

      {agents.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
          Chưa có tác tử eBPF nào được ghi nhận.
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
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Mã Tác Tử (Agent ID)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Node Máy Chủ</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Cụm Trực Thuộc</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Phiên Bản eBPF</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Linux Kernel</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Nhịp Tim Cuối</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, idx) => (
                <tr
                  key={agent.id || idx}
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
                      <Bot size={16} style={{ color: '#059669' }} />
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--dash-text-primary)' }}>
                        {agent.id}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--dash-text-secondary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Terminal size={13} style={{ color: 'var(--dash-text-muted)' }} />
                      {agent.node}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--dash-text-secondary)', fontFamily: 'monospace' }}>
                    {agent.clusterId}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        fontSize: '0.6875rem',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    >
                      {agent.version}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>
                    {agent.kernel}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} style={{ color: 'var(--dash-text-muted)' }} />
                      {agent.heartbeat}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getStatusBadge(agent.status)}
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

export default OrganizationAgents;
