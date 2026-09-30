import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  Trash2,
  X,
  Check
} from 'lucide-react';

const INITIAL_MEMBERS = [
  {
    id: 'MEM-01',
    name: 'Lê Minh Quân',
    email: 'quan.le@acmecorp.vn',
    role: 'SME_OWNER',
    roleLabel: 'Chủ DN (SME Owner)',
    mfa: true,
    lastActive: '5 phút trước',
    status: 'Active',
  },
  {
    id: 'MEM-02',
    name: 'Trần Đình Tuấn',
    email: 'tuan.tran@acmecorp.vn',
    role: 'DEVOPS',
    roleLabel: 'Kỹ Sư DevOps Lead',
    mfa: true,
    lastActive: '22 phút trước',
    status: 'Active',
  },
  {
    id: 'MEM-03',
    name: 'Nguyễn Văn Hoàng',
    email: 'hoang.nguyen@acmecorp.vn',
    role: 'VIEWER',
    roleLabel: 'Kiểm Toán & Giám Sát',
    mfa: false,
    lastActive: '2 ngày trước',
    status: 'Active',
  },
];

const RBAC_PERMISSIONS = [
  { feature: 'Xem Bảng Điều Khiển Tổng Quan & Metrics', owner: true, devops: true, viewer: true },
  { feature: 'Truy cập Logs Container & Sự Kiện K8s', owner: true, devops: true, viewer: true },
  { feature: 'Xem Phân Tích Nguyên Nhân Gốc Rễ (RCA)', owner: true, devops: true, viewer: true },
  { feature: 'Cài đặt Tác tử eBPF & Quản lý Cụm Máy Chủ', owner: true, devops: true, viewer: false },
  { feature: 'Kích hoạt Hành Động Sửa Lỗi Tự Động L1/L2', owner: true, devops: true, viewer: false },
  { feature: 'Cấu hình Ma Trận Chính Sách Tự Phục Hồi', owner: true, devops: false, viewer: false },
  { feature: 'Ký Duyệt Hành Động Khẩn Cấp (HITL Gate)', owner: true, devops: false, viewer: false },
  { feature: 'Quản lý Hồ sơ Tổ chức & Gói Dịch Vụ', owner: true, devops: false, viewer: false },
];

export const MembersPage = () => {
  const { currentOrg } = useDashboard();
  const { success: toastSuccess, warning: toastWarning } = useToast();
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('DEVOPS');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;

    const newMember = {
      id: `MEM-0${members.length + 1}`,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      roleLabel: inviteRole === 'SME_OWNER' ? 'Chủ DN (SME Owner)' : inviteRole === 'DEVOPS' ? 'Kỹ Sư DevOps' : 'Người Xem (Viewer)',
      mfa: false,
      lastActive: 'Vừa mời',
      status: 'Pending',
    };

    setMembers([...members, newMember]);
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteName('');
    setInviteSuccess(true);
    toastSuccess(`Đã gửi thư mời tham gia tổ chức tới ${inviteEmail}!`, 'Mời Thành Viên');
    setTimeout(() => setInviteSuccess(false), 3000);
  };

  const handleRemoveMember = (id) => {
    setMembers(members.filter((m) => m.id !== id));
    toastWarning('Đã xóa thành viên khỏi danh sách tổ chức.', 'Quản Lý Nhân Sự');
  };

  return (
    <div className="dashboard-members-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Thành Viên & Ma Trận Phân Quyền RBAC
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; Phân quyền chặt chẽ theo nguyên tắc tối thiểu (Least Privilege) cho SME Owner, DevOps và Viewer
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: 'var(--dash-primary)',
            border: 'none',
            borderRadius: 'var(--dash-radius-md)',
            color: '#FFFFFF',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <UserPlus size={16} />
          <span>Mời Thành Viên Mới</span>
        </button>
      </div>

      {inviteSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--dash-radius-md)',
            color: '#065F46',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>Thư mời tham gia tổ chức đã được gửi tới thành viên mới!</span>
        </div>
      )}

      {/* 3 Role Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ShieldCheck size={18} color="#059669" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
              Chủ DN (SME Owner)
            </h3>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.45 }}>
            Toàn quyền quản trị cao nhất: Ký duyệt hành động HITL Gate, điều chỉnh ma trận chính sách, quản lý thành viên và thanh toán gói cước.
          </p>
        </div>

        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #2563EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Lock size={18} color="#2563EB" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
              Kỹ Sư DevOps Lead
            </h3>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.45 }}>
            Vận hành hạ tầng: Cài đặt tác tử eBPF, xem chi tiết logs/metrics, cấu hình cụm máy chủ và đề xuất phương án tự phục hồi.
          </p>
        </div>

        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #64748B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Eye size={18} color="#64748B" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
              Người Xem (Viewer)
            </h3>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.45 }}>
            Quyền chỉ đọc an toàn: Theo dõi trạng thái cụm, xem biểu đồ tài nguyên và tải báo cáo SLA, không thể can thiệp hay sửa đổi trạng thái.
          </p>
        </div>
      </div>

      {/* Member List Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Danh Sách Thành Viên ({members.length})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Nhân sự được cấp phép truy cập vào bảng điều khiển tổ chức {currentOrg.name}
            </p>
          </div>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Họ Tên & Email</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Vai Trò RBAC</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Bảo Mật 2FA</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Hoạt Động Gần Nhất</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Trạng Thái</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{m.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>{m.email}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--dash-radius-full)',
                        backgroundColor: m.role === 'SME_OWNER' ? '#ECFDF5' : m.role === 'DEVOPS' ? '#EFF6FF' : '#F1F5F9',
                        color: m.role === 'SME_OWNER' ? '#059669' : m.role === 'DEVOPS' ? '#2563EB' : '#64748B',
                        border: `1px solid ${m.role === 'SME_OWNER' ? '#A7F3D0' : m.role === 'DEVOPS' ? '#BFDBFE' : '#CBD5E1'}`,
                      }}
                    >
                      {m.roleLabel}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '0.75rem', color: m.mfa ? '#059669' : '#D97706', fontWeight: 600 }}>
                      {m.mfa ? '● Đã Bật' : '○ Chưa Bật'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--dash-text-muted)' }}>{m.lastActive}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
                      {m.status === 'Active' ? 'Hoạt Động' : 'Chờ Chấp Nhận'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {m.role !== 'SME_OWNER' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.id)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                        title="Xóa thành viên"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RBAC Permission Matrix */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Ma Trận So Sánh Quyền Hạn RBAC Chi Tiết
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
            Đối chiếu phân quyền rõ ràng giữa các vai trò nhằm bảo vệ an toàn cho hệ thống
          </p>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Tính Năng / Thao Tác Hệ Thống</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'center' }}>SME Owner</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'center' }}>DevOps Lead</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'center' }}>Viewer</th>
              </tr>
            </thead>
            <tbody>
              {RBAC_PERMISSIONS.map((perm, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--dash-text-primary)', fontWeight: 500 }}>{perm.feature}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {perm.owner ? <Check size={16} color="#059669" style={{ margin: '0 auto' }} /> : <span style={{ color: '#CBD5E1' }}>&mdash;</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {perm.devops ? <Check size={16} color="#059669" style={{ margin: '0 auto' }} /> : <span style={{ color: '#CBD5E1' }}>&mdash;</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {perm.viewer ? <Check size={16} color="#059669" style={{ margin: '0 auto' }} /> : <span style={{ color: '#CBD5E1' }}>&mdash;</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="dash-card"
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                  Mời Thành Viên Mới Vào Tổ Chức
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--dash-text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Họ và Tên
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Đặng Quốc Tuấn..."
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Email Công Ty
                </label>
                <input
                  type="email"
                  required
                  placeholder="tuan.dang@acmecorp.vn"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Phân Quyền Vai Trò (RBAC Role)
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                >
                  <option value="DEVOPS">Kỹ Sư DevOps Lead (Quản trị cụm & xem viễn trắc)</option>
                  <option value="VIEWER">Người Xem / Kiểm Toán (Chỉ đọc số liệu & SLA)</option>
                  <option value="SME_OWNER">Chủ DN (SME Owner - Toàn quyền & Duyệt HITL)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 'var(--dash-radius-md)',
                    color: 'var(--dash-text-secondary)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--dash-primary)',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-md)',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Gửi Thư Mời
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersPage;
