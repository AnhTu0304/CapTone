import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { organizationMemberService } from '../../../services/organizationMemberService';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  Trash2,
  X,
  Check,
  Search,
  RefreshCw,
  Edit3,
  AlertTriangle,
  Shield,
  Clock,
  UserX
} from 'lucide-react';

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
  const auth = useAuth();
  const { success: toastSuccess, warning: toastWarning, error: toastError } = useToast();

  // Xác định thẩm quyền quản trị của người dùng hiện tại
  const currentUser = auth?.user || null;
  const isViewer = auth?.isViewer ? auth.isViewer(currentUser) : false;
  const isDevOps = auth?.isDevOps ? auth.isDevOps(currentUser) : false;
  const activeRole = auth?.activeRole || 'SME_OWNER';

  // Chỉ SME_OWNER hoặc Quản trị viên hệ thống (Admin/SuperAdmin) mới có quyền Mời / Sửa / Xóa thành viên
  const canManageMembers =
    !isViewer &&
    !isDevOps &&
    (activeRole === 'SME_OWNER' || activeRole === 'ADMIN' || activeRole === 'SUPER_ADMIN');

  // Danh sách thành viên và trạng thái tải dữ liệu
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bộ lọc & Tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INVITED'

  // Modal Mời thành viên mới
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('DEVOPS');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Modal Đổi vai trò thành viên
  const [editingMember, setEditingMember] = useState(null);
  const [editRole, setEditRole] = useState('DEVOPS');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Modal Xác nhận xóa thành viên
  const [deletingMember, setDeletingMember] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orgId = currentOrg?.id || localStorage.getItem('selfheal_active_org_id') || 'org-acme';
      const result = await organizationMemberService.getMembers(orgId, {
        search: searchTerm,
        role: selectedRole,
        status: activeTab,
      });
      setMembers(result?.items || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách thành viên:', err);
      setError('Không thể tải danh sách thành viên từ máy chủ. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, searchTerm, selectedRole, activeTab]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const orgId = currentOrg?.id || localStorage.getItem('selfheal_active_org_id') || 'org-acme';
        const result = await organizationMemberService.getMembers(orgId, {
          search: searchTerm,
          role: selectedRole,
          status: activeTab,
        });
        if (isMounted) {
          setMembers(result?.items || []);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Lỗi khi tải danh sách thành viên:', err);
          setError('Không thể tải danh sách thành viên từ máy chủ. Vui lòng thử lại sau.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [currentOrg?.id, searchTerm, selectedRole, activeTab]);

  // Đếm số lượng theo trạng thái
  const counts = useMemo(() => {
    let all = members.length;
    let active = members.filter((m) => m.status === 'ACTIVE').length;
    let invited = members.filter((m) => m.status === 'INVITED').length;
    return { all, active, invited };
  }, [members]);

  // Xử lý gửi lời mời thành viên mới
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviteError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!inviteEmail || !emailRegex.test(inviteEmail.trim())) {
      setInviteError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setIsInviting(true);
    try {
      const orgId = currentOrg?.id || 'org-acme';
      await organizationMemberService.inviteMember(orgId, {
        email: inviteEmail.trim(),
        role_code: inviteRole,
        full_name: inviteName.trim() || undefined,
      });

      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('DEVOPS');
      toastSuccess(`Đã gửi thư mời tham gia tổ chức tới ${inviteEmail}!`, 'Mời Thành Viên');
      await fetchMembers();
    } catch (err) {
      setInviteError(err.message || 'Không thể gửi thư mời. Vui lòng thử lại.');
      toastError(err.message || 'Gửi thư mời thất bại', 'Lỗi Mời Thành Viên');
    } finally {
      setIsInviting(false);
    }
  };

  // Xử lý cập nhật vai trò thành viên
  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editingMember) return;

    // Ràng buộc bảo vệ: Không cho phép hạ cấp nếu là SME_OWNER duy nhất đang hoạt động
    if (editingMember.role?.code === 'SME_OWNER' && editRole !== 'SME_OWNER') {
      const activeOwners = members.filter(
        (m) => m.status === 'ACTIVE' && (m.role?.code === 'SME_OWNER' || m.role === 'SME_OWNER')
      );
      if (activeOwners.length <= 1) {
        toastError('Không thể hạ quyền SME Owner duy nhất của tổ chức.', 'Bảo Vệ Quyền Hạn');
        return;
      }
    }

    setIsUpdatingRole(true);
    try {
      const orgId = currentOrg?.id || 'org-acme';
      const targetUserId = editingMember.user?.id || editingMember.id;
      await organizationMemberService.updateMember(orgId, targetUserId, {
        role_code: editRole,
      });

      toastSuccess(
        `Đã cập nhật vai trò của ${editingMember.user?.full_name || editingMember.name} thành công.`,
        'Phân Quyền Thành Viên'
      );
      setEditingMember(null);
      await fetchMembers();
    } catch (err) {
      toastError(err.message || 'Cập nhật vai trò thất bại', 'Lỗi Phân Quyền');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Xử lý xóa thành viên hoặc thu hồi lời mời
  const handleConfirmDelete = async () => {
    if (!deletingMember) return;

    setIsDeleting(true);
    try {
      const orgId = currentOrg?.id || 'org-acme';
      const targetUserId = deletingMember.user?.id || deletingMember.id;
      await organizationMemberService.removeMember(orgId, targetUserId);

      toastWarning(
        `Đã loại bỏ ${deletingMember.user?.full_name || deletingMember.name} khỏi tổ chức.`,
        'Quản Lý Nhân Sự'
      );
      setDeletingMember(null);
      await fetchMembers();
    } catch (err) {
      toastError(err.message || 'Không thể loại bỏ thành viên', 'Lỗi Thao Tác');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="dashboard-members-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Thành Viên & Ma Trận Phân Quyền RBAC
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg?.name || 'Tổ chức Doanh Nghiệp'} &bull; Phân quyền chặt chẽ theo nguyên tắc tối thiểu (Least Privilege) cho SME Owner, DevOps và Viewer
          </p>
        </div>

        {canManageMembers ? (
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
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
          >
            <UserPlus size={16} />
            <span>Mời Thành Viên Mới</span>
          </button>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#F1F5F9',
              borderRadius: 'var(--dash-radius-full)',
              color: '#475569',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Eye size={14} />
            <span>Chế độ Xem Chỉ Đọc (Không có quyền mời/sửa thành viên)</span>
          </div>
        )}
      </div>

      {/* 2. 3 Role Overview Cards */}
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

      {/* 3. Member & Invitation List Table Card */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        {/* Card Header & Controls */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Quản Lý Danh Sách Nhân Sự & Lời Mời
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
                Danh sách tài khoản được cấp phép truy cập vào bảng điều khiển tổ chức {currentOrg?.name || ''}
              </p>
            </div>

            <button
              type="button"
              onClick={fetchMembers}
              disabled={isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                color: 'var(--dash-text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Tải lại danh sách"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                style={{
                  padding: '5px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'ALL' ? 700 : 500,
                  backgroundColor: activeTab === 'ALL' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'ALL' ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                  boxShadow: activeTab === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Tất Cả ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ACTIVE')}
                style={{
                  padding: '5px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'ACTIVE' ? 700 : 500,
                  backgroundColor: activeTab === 'ACTIVE' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'ACTIVE' ? '#059669' : 'var(--dash-text-secondary)',
                  boxShadow: activeTab === 'ACTIVE' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Đang Hoạt Động ({counts.active})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('INVITED')}
                style={{
                  padding: '5px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'INVITED' ? 700 : 500,
                  backgroundColor: activeTab === 'INVITED' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'INVITED' ? '#D97706' : 'var(--dash-text-secondary)',
                  boxShadow: activeTab === 'INVITED' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Lời Mời Đang Chờ ({counts.invited})
              </button>
            </div>

            {/* Search and Role Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dash-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    fontSize: '0.75rem',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 'var(--dash-radius-md)',
                    outline: 'none',
                  }}
                />
              </div>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  color: 'var(--dash-text-secondary)',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="ALL">Tất Cả Vai Trò</option>
                <option value="SME_OWNER">SME Owner</option>
                <option value="DEVOPS">DevOps Lead</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#FEF2F2', borderBottom: '1px solid #FEE2E2', color: '#B91C1C', fontSize: '0.875rem' }}>
            <p style={{ margin: '0 0 8px 0' }}>{error}</p>
            <button
              type="button"
              onClick={fetchMembers}
              style={{
                padding: '4px 12px',
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Thử Lại
            </button>
          </div>
        )}

        {/* Table Content */}
        <div className="dash-table-container" style={{ border: 'none', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Thành Viên / Ứng Viên</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Vai Trò RBAC</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Xác Thực 2FA</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Hoạt Động / Tham Gia</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Trạng Thái</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Đang tải danh sách thành viên và lời mời...</span>
                    </div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Users size={28} color="#94A3B8" />
                      <span style={{ fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Không tìm thấy thành viên hoặc lời mời nào</span>
                      <span style={{ fontSize: '0.75rem' }}>Thử thay đổi bộ lọc tìm kiếm hoặc mời thêm nhân sự vào tổ chức</span>
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const memberName = m.user?.full_name || m.name || 'Thành viên mới';
                  const memberEmail = m.user?.email || m.email || '';
                  const roleCode = m.role?.code || m.role || 'VIEWER';
                  const roleName =
                    m.role?.name ||
                    m.roleLabel ||
                    (roleCode === 'SME_OWNER'
                      ? 'Chủ DN (SME Owner)'
                      : roleCode === 'DEVOPS'
                      ? 'Kỹ Sư DevOps Lead'
                      : 'Người Xem (Viewer)');
                  const isInvited = m.status === 'INVITED';

                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                      {/* Name & Email */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: roleCode === 'SME_OWNER' ? '#ECFDF5' : roleCode === 'DEVOPS' ? '#EFF6FF' : '#F1F5F9',
                              color: roleCode === 'SME_OWNER' ? '#059669' : roleCode === 'DEVOPS' ? '#2563EB' : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              flexShrink: 0,
                            }}
                          >
                            {memberName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{memberName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>{memberEmail}</div>
                          </div>
                        </div>
                      </td>

                      {/* RBAC Role */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--dash-radius-full)',
                            backgroundColor: roleCode === 'SME_OWNER' ? '#ECFDF5' : roleCode === 'DEVOPS' ? '#EFF6FF' : '#F1F5F9',
                            color: roleCode === 'SME_OWNER' ? '#059669' : roleCode === 'DEVOPS' ? '#2563EB' : '#64748B',
                            border: `1px solid ${roleCode === 'SME_OWNER' ? '#A7F3D0' : roleCode === 'DEVOPS' ? '#BFDBFE' : '#CBD5E1'}`,
                          }}
                        >
                          {roleName}
                        </span>
                      </td>

                      {/* 2FA */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '0.75rem', color: m.mfa ? '#059669' : '#94A3B8', fontWeight: 600 }}>
                          {m.mfa ? '● Đã Bật' : '○ Chưa Bật'}
                        </span>
                      </td>

                      {/* Last Active / Invited time */}
                      <td style={{ padding: '14px 16px', color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>
                        {isInvited && m.inviter ? (
                          <span>Mời bởi {m.inviter.full_name || m.inviter.email}</span>
                        ) : (
                          m.lastActive || 'Hoạt động gần đây'
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: m.status === 'ACTIVE' ? '#059669' : m.status === 'INVITED' ? '#D97706' : '#64748B',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {m.status === 'ACTIVE' && <CheckCircle2 size={13} color="#059669" />}
                          {m.status === 'INVITED' && <Clock size={13} color="#D97706" />}
                          <span>{m.status === 'ACTIVE' ? 'Hoạt Động' : m.status === 'INVITED' ? 'Chờ Chấp Nhận' : 'Vô Hiệu Hóa'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {canManageMembers ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            {/* Nút Đổi Vai Trò */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMember(m);
                                setEditRole(roleCode);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--dash-text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                              }}
                              title="Thay đổi vai trò RBAC"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Nút Xóa / Thu hồi */}
                            <button
                              type="button"
                              onClick={() => setDeletingMember(m)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#EF4444',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                              }}
                              title={isInvited ? 'Thu hồi lời mời' : 'Loại bỏ thành viên khỏi tổ chức'}
                            >
                              {isInvited ? <UserX size={15} /> : <Trash2 size={15} />}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>&mdash;</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. RBAC Permission Matrix */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Ma Trận So Sánh Quyền Hạn RBAC Chi Tiết
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
            Đối chiếu phân quyền rõ ràng giữa các vai trò nhằm bảo vệ an toàn cho hệ thống
          </p>
        </div>

        <div className="dash-table-container" style={{ border: 'none', overflowX: 'auto' }}>
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

      {/* 5. Modal: Mời Thành Viên Mới */}
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
              {inviteError && (
                <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '6px', color: '#B91C1C', fontSize: '0.8125rem' }}>
                  {inviteError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Email Công Ty <span style={{ color: '#EF4444' }}>*</span>
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
                  Họ và Tên (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="VD: Đặng Quốc Tuấn"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Phân Quyền Vai Trò (Organization RBAC Role) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem', backgroundColor: '#FFFFFF' }}
                >
                  <option value="DEVOPS">Kỹ Sư DevOps Lead (Quản trị cụm & xem viễn trắc)</option>
                  <option value="VIEWER">Người Xem / Kiểm Toán (Chỉ đọc số liệu & SLA)</option>
                  <option value="SME_OWNER">Chủ DN (SME Owner - Toàn quyền & Duyệt HITL)</option>
                </select>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.71875rem', color: 'var(--dash-text-muted)' }}>
                  Lưu ý: Vai trò này chỉ có hiệu lực nội bộ trong tổ chức, không cấp quyền Platform Super Admin.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  disabled={isInviting}
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
                  disabled={isInviting}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--dash-primary)',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-md)',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: isInviting ? 'not-allowed' : 'pointer',
                    opacity: isInviting ? 0.7 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isInviting && <RefreshCw size={14} className="animate-spin" />}
                  <span>{isInviting ? 'Đang gửi...' : 'Gửi Thư Mời'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Cập Nhật Vai Trò Thành Viên */}
      {editingMember && (
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
              maxWidth: '460px',
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
                <Shield size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                  Thay Đổi Vai Trò RBAC
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                style={{ background: 'none', border: 'none', color: 'var(--dash-text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateRole} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', display: 'block' }}>Thành viên:</span>
                <strong style={{ fontSize: '0.9375rem', color: 'var(--dash-text-primary)' }}>
                  {editingMember.user?.full_name || editingMember.name} ({editingMember.user?.email || editingMember.email})
                </strong>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Vai Trò Cấp Mới
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem', backgroundColor: '#FFFFFF' }}
                >
                  <option value="SME_OWNER">Chủ DN (SME Owner - Toàn quyền & Duyệt HITL)</option>
                  <option value="DEVOPS">Kỹ Sư DevOps Lead (Quản trị cụm máy chủ & Agent)</option>
                  <option value="VIEWER">Người Xem / Kiểm Toán (Chỉ đọc số liệu & SLA)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  disabled={isUpdatingRole}
                  onClick={() => setEditingMember(null)}
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
                  disabled={isUpdatingRole}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--dash-primary)',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-md)',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: isUpdatingRole ? 'not-allowed' : 'pointer',
                    opacity: isUpdatingRole ? 0.7 : 1,
                  }}
                >
                  {isUpdatingRole ? 'Đang cập nhật...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Xác Nhận Xóa / Thu Hồi Thành Viên */}
      {deletingMember && (
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
              maxWidth: '460px',
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
                borderBottom: '1px solid #FEE2E2',
                backgroundColor: '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <AlertTriangle size={20} color="#DC2626" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#991B1B' }}>
                {deletingMember.status === 'INVITED' ? 'Xác Nhận Thu Hồi Lời Mời' : 'Xác Nhận Loại Bỏ Thành Viên'}
              </h3>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--dash-text-primary)', lineHeight: 1.5 }}>
                {deletingMember.status === 'INVITED' ? (
                  <>
                    Bạn có chắc chắn muốn thu hồi lời mời tham gia tổ chức gửi tới{' '}
                    <strong>{deletingMember.user?.email || deletingMember.email}</strong>?
                  </>
                ) : (
                  <>
                    Bạn có chắc chắn muốn loại bỏ thành viên{' '}
                    <strong>{deletingMember.user?.full_name || deletingMember.name}</strong> (
                    {deletingMember.user?.email || deletingMember.email}) khỏi tổ chức?
                  </>
                )}
              </p>

              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: '#92400E',
                  lineHeight: 1.4,
                }}
              >
                Hành động này sẽ ngay lập tức thu hồi toàn bộ quyền truy cập vào hạ tầng, cụm Kubernetes và các bảng điều khiển của tổ chức.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingMember(null)}
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
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#DC2626',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-md)',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    opacity: isDeleting ? 0.7 : 1,
                  }}
                >
                  {isDeleting ? 'Đang xử lý...' : 'Xác Nhận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersPage;
