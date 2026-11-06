// CapTone Enterprise: Members & RBAC Management
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
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
  UserX,
  User,
  Phone,
  Calendar,
  Briefcase
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

const getMemberInitials = (name) => {
  if (!name) return 'TV';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const MembersPage = () => {
  const { currentOrg } = useDashboard();
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, warning: toastWarning, error: toastError } = useToast();

  // Xác định thẩm quyền quản trị của người dùng hiện tại

  // Chỉ SME_OWNER hoặc Quản trị viên hệ thống (Admin/SuperAdmin) mới có quyền Mời / Sửa / Xóa thành viên
  const { canManageOrg: canManageMembers } = usePermissions();

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

  // Modal Chi tiết hồ sơ cá nhân thành viên
  const [selectedMemberDetail, setSelectedMemberDetail] = useState(null);

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
              });

      setShowInviteModal(false);
      setInviteEmail('');
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
              Thành Viên & Ma Trận Phân Quyền
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Phân quyền chặt chẽ theo nguyên tắc tối thiểu (Least Privilege) cho SME Owner, DevOps và Viewer
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

      {/* 3. Member & Invitation List Table Card */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        {/* Card Header & Controls */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Quản Lý Danh Sách Nhân Sự & Lời Mời
              </h3>
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
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Vai Trò</th>
                
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Hoạt Động / Tham Gia</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Trạng Thái</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Đang tải danh sách thành viên và lời mời...</span>
                    </div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
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
                  const isOwnerRole = roleCode === 'SME_OWNER';
                  const isSelf = Boolean(
                    (currentUser?.id && (m.user?.id === currentUser.id || m.user_id === currentUser.id)) ||
                    (currentUser?.email && (m.user?.email === currentUser.email || m.email === currentUser.email))
                  );

                  let localStoredAvatar = null;
                  try {
                    const profileKey = `selfheal_profile_${memberEmail.toLowerCase().trim()}`;
                    const rawProfile = localStorage.getItem(profileKey);
                    if (rawProfile) {
                      const p = JSON.parse(rawProfile);
                      localStoredAvatar = p?.avatar || p?.avatarUrl || p?.avatar_url || null;
                    }
                  } catch {
                    // ignore
                  }

                  const memberAvatar =
                    m.user?.avatar_url ||
                    m.user?.avatarUrl ||
                    m.user?.avatar ||
                    m.avatar_url ||
                    m.avatarUrl ||
                    m.avatar ||
                    (isSelf ? (currentUser?.avatar_url || currentUser?.avatarUrl || currentUser?.avatar) : null) ||
                    localStoredAvatar ||
                    null;

                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                      {/* Name & Email */}
                      <td style={{ padding: '14px 16px' }}>
                        <div
                          onClick={() => setSelectedMemberDetail(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                          title="Bấm để xem chi tiết hồ sơ cá nhân"
                        >
                                                    {memberAvatar ? (
                            <img
                              src={memberAvatar}
                              alt={memberName}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                flexShrink: 0,
                                border: '1px solid var(--dash-border, #E2E8F0)',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  e.currentTarget.nextElementSibling.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: roleCode === 'SME_OWNER' ? '#ECFDF5' : roleCode === 'DEVOPS' ? '#EFF6FF' : '#F1F5F9',
                              color: roleCode === 'SME_OWNER' ? '#059669' : roleCode === 'DEVOPS' ? '#2563EB' : '#475569',
                              display: memberAvatar ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              flexShrink: 0,
                            }}
                          >
                            {getMemberInitials(memberName)}
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

                      

                      {/* Last Active / Joined Date */}
                      <td style={{ padding: '14px 16px', fontSize: '0.75rem' }}>
                        {isInvited ? (
                          <div>
                            <div style={{ color: 'var(--dash-text-primary)', fontWeight: 600 }}>
                              {m.expires_at ? `Hạn chót: ${new Date(m.expires_at).toLocaleDateString('vi-VN')}` : 'Hạn chót: 7 ngày sau'}
                            </div>
                            {m.inviter && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                                Mời bởi: {m.inviter.full_name || m.inviter.email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: 'var(--dash-text-primary)', fontWeight: 600 }}>
                              {m.lastActive || (m.user?.last_login_at ? `Đăng nhập: ${new Date(m.user.last_login_at).toLocaleDateString('vi-VN')}` : 'Hoạt động gần đây')}
                            </div>
                            {m.joined_at && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                                Tham gia: {new Date(m.joined_at).toLocaleDateString('vi-VN')}
                              </div>
                            )}
                          </div>
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
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedMemberDetail(m)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--dash-text-secondary)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Xem chi tiết hồ sơ cá nhân"
                          >
                            <Eye size={15} />
                          </button>
                          {isOwnerRole ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.6875rem',
                              color: '#059669',
                              backgroundColor: '#ECFDF5',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #A7F3D0',
                              fontWeight: 700,
                            }}
                            title="Chủ sở hữu tổ chức được bảo vệ tối cao (Không thể tự hạ cấp vai trò hoặc xóa tài khoản)"
                          >
                            <ShieldCheck size={13} color="#059669" />
                            <span>Chủ Sở Hữu</span>
                          </span>
                        ) : isSelf ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.6875rem',
                              color: '#2563EB',
                              backgroundColor: '#EFF6FF',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #BFDBFE',
                              fontWeight: 700,
                            }}
                            title="Tài khoản đăng nhập của bạn (Không thể tự xóa khỏi tổ chức tại đây)"
                          >
                            <Lock size={12} color="#2563EB" />
                            <span>Tài Khoản Của Bạn</span>
                          </span>
                        ) : canManageMembers ? (
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
                        </div>
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
            Ma Trận So Sánh Quyền Hạn Chi Tiết
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
                  Email Thành Viên <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="thanhvien@gmail.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Phân Quyền Vai Trò (Organization Role) <span style={{ color: '#EF4444' }}>*</span>
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
                  Lưu ý: Vai trò này quyết định quyền hạn thao tác tài nguyên trong tổ chức và có thể thay đổi bất kỳ lúc nào.
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
                  Thay Đổi Vai Trò
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

      {/* 8. Modal: Chi Tiết Hồ Sơ Cá Nhân Thành Viên */}
      {selectedMemberDetail && (() => {
        const m = selectedMemberDetail;
        const memberName = m.user?.full_name || m.name || 'Thành viên mới';
        const memberEmail = m.user?.email || m.email || '';
        const roleCode = m.role?.code || m.role || 'VIEWER';
        const roleName =
          m.role?.name ||
          m.roleLabel ||
          (roleCode === 'SME_OWNER'
            ? 'Chủ Doanh Nghiệp (SME Owner)'
            : roleCode === 'DEVOPS'
            ? 'Kỹ Sư DevOps Lead'
            : 'Người Xem / Kiểm Toán (Viewer)');
        const isOwner = roleCode === 'SME_OWNER';
        const isDevOps = roleCode === 'DEVOPS';

        let localStoredAvatar = null;
        try {
          const profileKey = `selfheal_profile_${memberEmail.toLowerCase().trim()}`;
          const rawProfile = localStorage.getItem(profileKey);
          if (rawProfile) {
            const p = JSON.parse(rawProfile);
            localStoredAvatar = p?.avatar || p?.avatarUrl || p?.avatar_url || null;
          }
        } catch {
          // ignore
        }

        const memberAvatar =
          m.user?.avatar_url ||
          m.user?.avatarUrl ||
          m.user?.avatar ||
          m.avatar_url ||
          m.avatarUrl ||
          m.avatar ||
          localStoredAvatar ||
          null;

        const phone = m.user?.phone || 'Chưa cập nhật';
        const jobTitle = m.user?.job_title || (isOwner ? 'Chủ Doanh Nghiệp' : isDevOps ? 'Kỹ Sư Hạ Tầng & SRE Lead' : 'Chuyên Viên Phân Tích / Kiểm Toán');
        const joinDate = m.joined_at ? new Date(m.joined_at).toLocaleDateString('vi-VN') : (m.created_at ? new Date(m.created_at).toLocaleDateString('vi-VN') : 'Mới tham gia');
        const lastActive = m.lastActive || (m.user?.last_login_at ? `Đăng nhập: ${new Date(m.user.last_login_at).toLocaleString('vi-VN')}` : 'Đang hoạt động');

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedMemberDetail(null);
            }}
          >
            <div
              className="dash-card"
              style={{
                width: '100%',
                maxWidth: '480px',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                padding: '0',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--dash-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--dash-bg-canvas, #F8FAFC)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={18} color="var(--dash-primary, #059669)" />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    Chi Tiết Hồ Sơ Cá Nhân
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMemberDetail(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--dash-text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Đóng cửa sổ"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Profile Card Banner */}
              <div style={{ padding: '24px 20px 16px', textAlign: 'center', borderBottom: '1px solid var(--dash-border)' }}>
                <div style={{ display: 'inline-block', position: 'relative', marginBottom: '12px' }}>
                  {memberAvatar ? (
                    <img
                      src={memberAvatar}
                      alt={memberName}
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '16px',
                        objectFit: 'cover',
                        border: '3px solid #FFFFFF',
                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.12)',
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextElementSibling) {
                          e.currentTarget.nextElementSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '16px',
                      backgroundColor: roleCode === 'SME_OWNER' ? '#ECFDF5' : roleCode === 'DEVOPS' ? '#EFF6FF' : '#F1F5F9',
                      color: roleCode === 'SME_OWNER' ? '#059669' : roleCode === 'DEVOPS' ? '#2563EB' : '#475569',
                      display: memberAvatar ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.5rem',
                      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    {getMemberInitials(memberName)}
                  </div>
                </div>

                <h4 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
                  {memberName}
                </h4>
                <p style={{ margin: '0 0 10px', fontSize: '0.8125rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {memberEmail}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: roleCode === 'SME_OWNER' ? '#ECFDF5' : roleCode === 'DEVOPS' ? '#EFF6FF' : '#F1F5F9',
                      color: roleCode === 'SME_OWNER' ? '#059669' : roleCode === 'DEVOPS' ? '#2563EB' : '#475569',
                      border: `1px solid ${roleCode === 'SME_OWNER' ? '#A7F3D0' : roleCode === 'DEVOPS' ? '#BFDBFE' : '#CBD5E1'}`,
                    }}
                  >
                    {roleName}
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: m.status === 'ACTIVE' ? '#ECFDF5' : '#FFFBEB',
                      color: m.status === 'ACTIVE' ? '#059669' : '#D97706',
                      border: `1px solid ${m.status === 'ACTIVE' ? '#A7F3D0' : '#FDE68A'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {m.status === 'ACTIVE' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                    <span>{m.status === 'ACTIVE' ? 'Đang Hoạt Động' : 'Chờ Chấp Nhận'}</span>
                  </span>
                </div>
              </div>

              {/* Profile Details List */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                    <Briefcase size={15} color="#64748B" />
                    <span>Chức danh:</span>
                  </div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{jobTitle}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                    <Phone size={15} color="#64748B" />
                    <span>Số điện thoại:</span>
                  </div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{phone}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                    <Calendar size={15} color="#64748B" />
                    <span>Ngày tham gia:</span>
                  </div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{joinDate}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                    <Clock size={15} color="#64748B" />
                    <span>Hoạt động:</span>
                  </div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{lastActive}</strong>
                </div>

                {/* Quyền hạn tóm tắt trong tổ chức */}
                <div style={{ marginTop: '2px', padding: '10px 12px', backgroundColor: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                    <Shield size={13} />
                    <span>Phạm vi quyền hạn ({roleCode}):</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.71875rem', color: '#15803D', lineHeight: 1.4 }}>
                    {isOwner
                      ? 'Toàn quyền kiểm soát tài nguyên công ty, quản lý thành viên, phê duyệt khẩn cấp HITL và điều phối hạ tầng K8s.'
                      : isDevOps
                      ? 'Quản trị cụm máy chủ K8s, cài đặt tác tử eBPF, vận hành hệ thống viễn trắc và kích hoạt kịch bản tự chữa lành L1/L2.'
                      : 'Quyền xem chỉ đọc: theo dõi bảng điều khiển tổng quan, số liệu viễn trắc, nhật ký kiểm toán và báo cáo SLA.'}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--dash-border)',
                  backgroundColor: 'var(--dash-bg-canvas, #F8FAFC)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedMemberDetail(null)}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--dash-border)',
                    borderRadius: '8px',
                    color: 'var(--dash-text-secondary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
