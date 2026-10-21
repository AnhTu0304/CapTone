import React from 'react';
import {
  Mail,
  Phone,
  Briefcase,
  Building2,
  Shield,
  Calendar,
  Clock,
  KeyRound,
  CheckCircle2,
  Lock,
  AlertTriangle
} from 'lucide-react';

export const ProfileOverview = ({ profile }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
      {/* Card 1: Thông tin liên hệ & cá nhân */}
      <div
        className="dash-card"
        style={{
          padding: '24px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: 'var(--dash-radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--dash-border)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Thông Tin Cá Nhân & Liên Hệ
          </h3>
          <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Mã: {profile.id}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Họ và tên
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
              {profile.fullName}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
                Địa chỉ Email
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <Lock size={10} /> Read-only
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-primary)' }}>
              <Mail size={15} color="var(--dash-text-muted)" />
              <span>{profile.email}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Số điện thoại
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-primary)' }}>
              <Phone size={15} color="var(--dash-text-muted)" />
              <span>{profile.phone || 'Chưa cập nhật'}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Chức danh chuyên môn
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-primary)' }}>
              <Briefcase size={15} color="var(--dash-primary)" />
              <span>{profile.jobTitle || 'Chưa thiết lập'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Tổ chức & Phân quyền */}
      <div
        className="dash-card"
        style={{
          padding: '24px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: 'var(--dash-radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--dash-border)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Tổ Chức & Phân Quyền Vận Hành
          </h3>
          <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            <Lock size={10} /> Quản trị
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Tổ chức đang tham gia
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
              <Building2 size={15} color="var(--dash-primary)" />
              <span>{profile.organization}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Vai trò Hệ thống (System Role)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={15} color="#2563EB" />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#EFF6FF',
                  color: '#1E40AF',
                  border: '1px solid #BFDBFE',
                }}
              >
                {profile.systemRole}
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Vai trò trong Tổ chức (Organization Role)
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-primary)' }}>
              {profile.organizationRole}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Múi giờ vận hành
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--dash-text-secondary)' }}>
              <Clock size={14} color="var(--dash-text-muted)" />
              <span>{profile.timezone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Trạng thái & Bảo mật */}
      <div
        className="dash-card"
        style={{
          padding: '24px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: 'var(--dash-radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--dash-border)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Trạng Thái & Bảo Mật Tài Khoản
          </h3>
          <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 700 }}>Bảo mật cao</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Trạng thái tài khoản
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {(() => {
                const status = (profile.accountStatus || profile.status || 'ACTIVE').toUpperCase();
                if (status === 'ACTIVE') {
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: 'var(--dash-radius-full)',
                        backgroundColor: '#ECFDF5',
                        color: '#059669',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: '1px solid #A7F3D0',
                      }}
                    >
                      <CheckCircle2 size={12} />
                      <span>Hoạt động (Active)</span>
                    </span>
                  );
                } else if (status === 'SUSPENDED') {
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: 'var(--dash-radius-full)',
                        backgroundColor: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: '1px solid #FECACA',
                      }}
                    >
                      <Lock size={12} />
                      <span>Tạm khóa (Suspended)</span>
                    </span>
                  );
                } else if (status === 'INACTIVE') {
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: 'var(--dash-radius-full)',
                        backgroundColor: '#F3F4F6',
                        color: '#6B7280',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: '1px solid #E5E7EB',
                      }}
                    >
                      <AlertTriangle size={12} />
                      <span>Ngừng hoạt động (Inactive)</span>
                    </span>
                  );
                } else {
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: 'var(--dash-radius-full)',
                        backgroundColor: '#FFFBEB',
                        color: '#D97706',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: '1px solid #FDE68A',
                      }}
                    >
                      <Clock size={12} />
                      <span>Chờ kích hoạt (Pending)</span>
                    </span>
                  );
                }
              })()}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Ngày tạo tài khoản
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
              <Calendar size={14} color="var(--dash-text-muted)" />
              <span>{profile.createdAt}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Đăng nhập gần nhất
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--dash-text-secondary)' }}>
              <Clock size={14} color="var(--dash-text-muted)" />
              <span>{profile.lastLogin}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>
              Xác thực 2 yếu tố (2FA)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#059669', fontWeight: 600 }}>
              <KeyRound size={14} color="#059669" />
              <span>Đã kích hoạt bảo vệ tài khoản</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;
