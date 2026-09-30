import React from 'react';
import { ShieldCheck, ShieldAlert, User, Info, CheckCircle2, Clock } from 'lucide-react';

export const OrganizationMembers = ({ members = [], isLoading = false }) => {
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
          Đang tải danh sách nhân sự tổ chức...
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
      {/* Information Header - SME Role vs Platform Admin Segregation */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: '#F0FDF4',
          borderBottom: '1px solid #BBF7D0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Info size={18} style={{ color: '#059669', flexShrink: 0 }} />
        <div style={{ fontSize: '0.8125rem', color: '#065F46', lineHeight: 1.4 }}>
          <strong>Phân định quyền hạn Tenant:</strong> Các vai trò bên dưới (SME Owner, DevOps Lead, Viewer) chỉ có hiệu lực nội bộ trong phạm vi tài nguyên của tổ chức này. Thành viên <strong>không có quyền hạn cấp Quản Trị Hệ Thống (Platform Super Admin)</strong>.
        </div>
      </div>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Nhân Sự & Phân Quyền SME ({members.length})
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Danh sách các tài khoản người dùng được gán quyền quản lý hạ tầng tổ chức.
          </p>
        </div>
      </div>

      {members.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.875rem' }}>
          Không có thành viên nào trong tổ chức này.
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
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Thành Viên</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Vai Trò SME</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Phạm Vi Quyền Hạn</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Xác Thực 2FA</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Hoạt Động Gần Nhất</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, idx) => {
                const isOwner = member.smeRole === 'SME Owner';
                const isDevOps = member.smeRole === 'DevOps Lead';

                return (
                  <tr
                    key={member.id || idx}
                    style={{
                      borderBottom: '1px solid var(--dash-border)',
                      backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                  >
                    {/* User Name & Email */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: '#E0F2FE',
                            color: '#0369A1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          <User size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{member.name}</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{member.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* SME Role Badge */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.6875rem',
                          backgroundColor: isOwner ? '#FEF3C7' : isDevOps ? '#E0E7FF' : '#F1F5F9',
                          color: isOwner ? '#92400E' : isDevOps ? '#3730A3' : '#475569',
                          border: `1px solid ${isOwner ? '#FDE68A' : isDevOps ? '#C7D2FE' : '#E2E8F0'}`,
                        }}
                      >
                        {member.smeRole}
                      </span>
                    </td>

                    {/* Scope Note */}
                    <td style={{ padding: '12px 16px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {member.scopeNote || 'Phạm vi tổ chức'}
                    </td>

                    {/* 2FA Status */}
                    <td style={{ padding: '12px 16px' }}>
                      {member.twoFactorEnabled ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#059669',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          <ShieldCheck size={14} /> Bật
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#DC2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          <ShieldAlert size={14} /> Tắt
                        </span>
                      )}
                    </td>

                    {/* Last Active */}
                    <td style={{ padding: '12px 16px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} style={{ color: 'var(--dash-text-muted)' }} />
                        {member.lastActive}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: member.status === 'ACTIVE' ? '#059669' : '#D97706',
                        }}
                      >
                        <CheckCircle2 size={12} /> {member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Chờ xác nhận'}
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

export default OrganizationMembers;
