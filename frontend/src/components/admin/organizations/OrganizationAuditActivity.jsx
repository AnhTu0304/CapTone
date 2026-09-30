import React from 'react';
import { ShieldCheck, History, UserCheck, Cpu, Hash, Clock } from 'lucide-react';

export const OrganizationAuditActivity = ({ auditLogs = [], isLoading = false }) => {
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
          Đang tải nhật ký kiểm toán Platform Admin...
        </span>
      </div>
    );
  }

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
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} style={{ color: '#059669' }} />
            Nhật Ký Kiểm Toán Cấp Quản Trị Hệ Thống ({auditLogs.length})
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Toàn bộ thao tác can thiệp của Quản Trị Viên Nền Tảng (Platform Super Admin) và tiến trình tự động trên Tenant này.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#065F46', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: '6px', border: '1px solid #A7F3D0' }}>
          <ShieldCheck size={14} /> Chữ ký mật mã SHA-256 bất biến
        </div>
      </div>

      {auditLogs.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
          Chưa có nhật ký kiểm toán nào được ghi nhận cho tổ chức này.
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
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Thời Điểm</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Người Thực Hiện / Tác Nhân</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Hành Động Can Thiệp</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Đối Tượng Tác Động</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Mã Băm Kiểm Tra (Hash)</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((item, idx) => {
                const isSuperAdmin = item.actorRole === 'Platform Super Admin';

                return (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid var(--dash-border)',
                      backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} style={{ color: 'var(--dash-text-muted)' }} />
                        {item.time}
                      </span>
                    </td>

                    {/* Actor */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isSuperAdmin ? (
                          <UserCheck size={16} style={{ color: '#DC2626' }} />
                        ) : (
                          <Cpu size={16} style={{ color: '#059669' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{item.actor}</div>
                          <div
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              color: isSuperAdmin ? '#B91C1C' : '#047857',
                            }}
                          >
                            {item.actorRole}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                      {item.action}
                    </td>

                    {/* Target */}
                    <td style={{ padding: '12px 16px', color: 'var(--dash-text-secondary)', fontFamily: 'monospace' }}>
                      {item.target}
                    </td>

                    {/* Hash */}
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--dash-text-muted)', fontSize: '0.6875rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Hash size={12} />
                        {item.hash}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrganizationAuditActivity;
