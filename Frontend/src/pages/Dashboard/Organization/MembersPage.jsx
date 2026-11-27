// CapTone Enterprise: Members & RBAC Management
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../../i18n';
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
  Briefcase,
  Mail,
} from 'lucide-react';

const RBAC_PERMISSIONS = [
  { featureKey: 'members.rbac.features.viewOverview', owner: true, devops: true, viewer: true },
  { featureKey: 'members.rbac.features.accessLogs', owner: true, devops: true, viewer: true },
  { featureKey: 'members.rbac.features.viewRca', owner: true, devops: true, viewer: true },
  { featureKey: 'members.rbac.features.installAgent', owner: true, devops: true, viewer: false },
  { featureKey: 'members.rbac.features.triggerHealing', owner: true, devops: true, viewer: false },
  { featureKey: 'members.rbac.features.configPolicies', owner: true, devops: false, viewer: false },
  { featureKey: 'members.rbac.features.approveHitl', owner: true, devops: false, viewer: false },
  { featureKey: 'members.rbac.features.manageOrg', owner: true, devops: false, viewer: false },
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
  const { t, i18n } = useTranslation('dashAdmin');
  const intlLocale = getIntlLocale(i18n.language);
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
      setError(t('members.toasts.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, searchTerm, selectedRole, activeTab, t]);

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
          setError(t('members.toasts.loadError'));
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
  }, [currentOrg?.id, searchTerm, selectedRole, activeTab, t]);

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
      setInviteError(t('members.toasts.invalidEmail'));
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
      toastSuccess(
        t('members.toasts.inviteSuccess', { email: inviteEmail }),
        t('members.toasts.inviteSuccessTitle')
      );
      await fetchMembers();
    } catch (err) {
      setInviteError(err.message || t('members.toasts.inviteFailed'));
      toastError(err.message || t('members.toasts.inviteErrorShort'), t('members.toasts.inviteErrorTitle'));
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
        toastError(t('members.toasts.cannotDemoteOnlyOwner'), t('members.toasts.protectPrivilegeTitle'));
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
        t('members.toasts.updateRoleSuccess', { name: editingMember.user?.full_name || editingMember.name }),
        t('members.toasts.updateRoleSuccessTitle')
      );
      setEditingMember(null);
      await fetchMembers();
    } catch (err) {
      toastError(err.message || t('members.toasts.updateRoleFailed'), t('members.toasts.updateRoleErrorTitle'));
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
        t('members.toasts.removeSuccess', { name: deletingMember.user?.full_name || deletingMember.name }),
        t('members.toasts.removeSuccessTitle')
      );
      setDeletingMember(null);
      await fetchMembers();
    } catch (err) {
      toastError(err.message || t('members.toasts.removeFailed'), t('members.toasts.removeErrorTitle'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="dashboard-members-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
            }}
          >
            <Users size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              {t('members.title')}
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              {t('members.subtitle')}
            </p>
          </div>
        </div>

        {canManageMembers ? (
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            style={{
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 14px',
              backgroundColor: '#059669',
              border: '1px solid #059669',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
            }}
          >
            <UserPlus size={15} />
            <span>{t('members.inviteBtn')}</span>
          </button>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '999px',
              color: '#475569',
              fontSize: '0.74rem',
              fontWeight: 600,
            }}
          >
            <Eye size={14} />
            <span>{t('members.readOnlyBadge')}</span>
          </div>
        )}
      </div>

      {/* Hàng 3 Thẻ KPI Tóm Tắt Nhân Sự */}
      <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: '2.5px solid #059669', borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>
              {t('members.kpis.totalLabel')}
            </span>
            <Users size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{counts.all}</span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('members.kpis.totalSub')}</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: '2.5px solid #10B981', borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>
              {t('members.kpis.activeLabel')}
            </span>
            <CheckCircle2 size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#059669' }}>{counts.active}</span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>{t('members.kpis.activeSub')}</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: '2.5px solid #F59E0B', borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>
              {t('members.kpis.invitedLabel')}
            </span>
            <Mail size={14} color="#F59E0B" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: counts.invited > 0 ? '#D97706' : '#0F172A' }}>{counts.invited}</span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('members.kpis.invitedSub')}</span>
          </div>
        </div>
      </div>

      {/* 3. Member & Invitation List Table Card */}
      <div className="dash-card" style={{ padding: '0', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)', overflow: 'hidden' }}>
        {/* Card Header & Controls */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {t('members.list.title')}
              </h3>
            </div>

            <button
              type="button"
              onClick={fetchMembers}
              disabled={isLoading}
              style={{
                height: '32px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(203, 213, 225, 0.9)',
                borderRadius: '9px',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                color: '#334155',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title={t('members.list.refreshTitle')}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>{t('members.list.refresh')}</span>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            {/* Status Tabs */}
            <div style={{ display: 'inline-flex', gap: '3px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', padding: '3px', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                style={{
                  height: '28px',
                  padding: '0 12px',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'ALL' ? 700 : 600,
                  backgroundColor: activeTab === 'ALL' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'ALL' ? '#047857' : '#64748B',
                  boxShadow: activeTab === 'ALL' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {t('members.list.tabAll', { count: counts.all })}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ACTIVE')}
                style={{
                  height: '28px',
                  padding: '0 12px',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'ACTIVE' ? 700 : 600,
                  backgroundColor: activeTab === 'ACTIVE' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'ACTIVE' ? '#059669' : '#64748B',
                  boxShadow: activeTab === 'ACTIVE' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {t('members.list.tabActive', { count: counts.active })}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('INVITED')}
                style={{
                  height: '28px',
                  padding: '0 12px',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'INVITED' ? 700 : 600,
                  backgroundColor: activeTab === 'INVITED' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'INVITED' ? '#D97706' : '#64748B',
                  boxShadow: activeTab === 'INVITED' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {t('members.list.tabInvited', { count: counts.invited })}
              </button>
            </div>

            {/* Search and Role Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '240px', maxWidth: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder={t('members.list.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 12px 0 32px',
                    fontSize: '0.8rem',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                    color: '#0F172A',
                    outline: 'none',
                  }}
                />
              </div>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  color: '#334155',
                  backgroundColor: '#F8FAFC',
                  outline: 'none',
                }}
              >
                <option value="ALL">{t('members.list.allRoles')}</option>
                <option value="SME_OWNER">{t('members.list.roleSmeOwnerShort')}</option>
                <option value="DEVOPS">{t('members.list.roleDevopsShort')}</option>
                <option value="VIEWER">{t('members.list.roleViewerShort')}</option>
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
              {t('members.list.retry')}
            </button>
          </div>
        )}

        {/* Table Content */}
        <div className="dash-table-container" style={{ border: 'none', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>{t('members.list.colMember')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>{t('members.list.colRole')}</th>
                
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>{t('members.list.colActivity')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>{t('members.list.colStatus')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'right' }}>{t('members.list.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>{t('members.list.loading')}</span>
                    </div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Users size={28} color="#94A3B8" />
                      <span style={{ fontWeight: 600, color: 'var(--dash-text-secondary)' }}>{t('members.list.emptyTitle')}</span>
                      <span style={{ fontSize: '0.75rem' }}>{t('members.list.emptyDesc')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const memberName = m.user?.full_name || m.name || t('members.row.defaultName');
                  const memberEmail = m.user?.email || m.email || '';
                  const roleCode = m.role?.code || m.role || 'VIEWER';
                  const roleName =
                    m.role?.name ||
                    m.roleLabel ||
                    (roleCode === 'SME_OWNER'
                      ? t('members.row.roleSmeOwner')
                      : roleCode === 'DEVOPS'
                      ? t('members.row.roleDevops')
                      : t('members.row.roleViewer'));
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
                          title={t('members.row.viewProfileTitle')}
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
                              {m.expires_at
                                ? t('members.row.deadline', { date: new Date(m.expires_at).toLocaleDateString(intlLocale) })
                                : t('members.row.deadlineDefault')}
                            </div>
                            {m.inviter && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                                {t('members.row.invitedBy', { name: m.inviter.full_name || m.inviter.email })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: 'var(--dash-text-primary)', fontWeight: 600 }}>
                              {m.lastActive ||
                                (m.user?.last_login_at
                                  ? t('members.row.lastLogin', { date: new Date(m.user.last_login_at).toLocaleDateString(intlLocale) })
                                  : t('members.row.recentActivity'))}
                            </div>
                            {m.joined_at && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                                {t('members.row.joinedAt', { date: new Date(m.joined_at).toLocaleDateString(intlLocale) })}
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
                          <span>
                            {m.status === 'ACTIVE'
                              ? t('members.row.statusActive')
                              : m.status === 'INVITED'
                              ? t('members.row.statusInvited')
                              : t('members.row.statusDisabled')}
                          </span>
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
                            title={t('members.row.viewProfileBtnTitle')}
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
                            title={t('members.row.ownerTitle')}
                          >
                            <ShieldCheck size={13} color="#059669" />
                            <span>{t('members.row.ownerBadge')}</span>
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
                            title={t('members.row.yourAccountTitle')}
                          >
                            <Lock size={12} color="#2563EB" />
                            <span>{t('members.row.yourAccountBadge')}</span>
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
                              title={t('members.row.changeRoleTitle')}
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
                              title={isInvited ? t('members.row.revokeInviteTitle') : t('members.row.removeMemberTitle')}
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
            {t('members.rbac.title')}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
            {t('members.rbac.subtitle')}
          </p>
        </div>

        <div className="dash-table-container" style={{ border: 'none', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>{t('members.rbac.colFeature')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'center' }}>{t('members.rbac.colOwner')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'center' }}>{t('members.rbac.colDevops')}</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'center' }}>{t('members.rbac.colViewer')}</th>
              </tr>
            </thead>
            <tbody>
              {RBAC_PERMISSIONS.map((perm, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--dash-text-primary)', fontWeight: 500 }}>{t(perm.featureKey)}</td>
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
                  {t('members.inviteModal.title')}
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
                  {t('members.inviteModal.emailLabel')} <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder={t('members.inviteModal.emailPlaceholder')}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  {t('members.inviteModal.roleLabel')} <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem', backgroundColor: '#FFFFFF' }}
                >
                  <option value="DEVOPS">{t('members.inviteModal.roleDevops')}</option>
                  <option value="VIEWER">{t('members.inviteModal.roleViewer')}</option>
                  <option value="SME_OWNER">{t('members.inviteModal.roleOwner')}</option>
                </select>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.71875rem', color: 'var(--dash-text-muted)' }}>
                  {t('members.inviteModal.note')}
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
                  {t('members.inviteModal.cancel')}
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
                  <span>{isInviting ? t('members.inviteModal.sending') : t('members.inviteModal.submit')}</span>
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
                  {t('members.editModal.title')}
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
                <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', display: 'block' }}>{t('members.editModal.memberLabel')}</span>
                <strong style={{ fontSize: '0.9375rem', color: 'var(--dash-text-primary)' }}>
                  {editingMember.user?.full_name || editingMember.name} ({editingMember.user?.email || editingMember.email})
                </strong>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  {t('members.editModal.newRoleLabel')}
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem', backgroundColor: '#FFFFFF' }}
                >
                  <option value="SME_OWNER">{t('members.editModal.roleOwner')}</option>
                  <option value="DEVOPS">{t('members.editModal.roleDevops')}</option>
                  <option value="VIEWER">{t('members.editModal.roleViewer')}</option>
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
                  {t('members.editModal.cancel')}
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
                  {isUpdatingRole ? t('members.editModal.updating') : t('members.editModal.save')}
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
        const memberName = m.user?.full_name || m.name || t('members.row.defaultName');
        const memberEmail = m.user?.email || m.email || '';
        const roleCode = m.role?.code || m.role || 'VIEWER';
        const roleName =
          m.role?.name ||
          m.roleLabel ||
          (roleCode === 'SME_OWNER'
            ? t('members.detailModal.roleOwnerFull')
            : roleCode === 'DEVOPS'
            ? t('members.detailModal.roleDevopsFull')
            : t('members.detailModal.roleViewerFull'));
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

        const phone = m.user?.phone || t('members.detailModal.phoneUnset');
        const jobTitle =
          m.user?.job_title ||
          (isOwner
            ? t('members.detailModal.jobOwner')
            : isDevOps
            ? t('members.detailModal.jobDevops')
            : t('members.detailModal.jobViewer'));
        const joinDate = m.joined_at
          ? new Date(m.joined_at).toLocaleDateString(intlLocale)
          : m.created_at
          ? new Date(m.created_at).toLocaleDateString(intlLocale)
          : t('members.detailModal.justJoined');
        const lastActive =
          m.lastActive ||
          (m.user?.last_login_at
            ? t('members.detailModal.lastLogin', { datetime: new Date(m.user.last_login_at).toLocaleString(intlLocale) })
            : t('members.detailModal.currentlyActive'));

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
                    {t('members.detailModal.title')}
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
                  title={t('members.detailModal.closeTitle')}
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
                    <span>{m.status === 'ACTIVE' ? t('members.detailModal.statusActive') : t('members.detailModal.statusInvited')}</span>
                  </span>
                </div>
              </div>

              {/* Profile Details List */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                    <Briefcase size={15} color="#64748B" />
                    <span>{t('members.detailModal.jobTitleLabel')}</span>
                  </div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{jobTitle}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                    <Phone size={15} color="#64748B" />
                    <span>{t('members.detailModal.phoneLabel')}</span>
                  </div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{phone}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                    <Calendar size={15} color="#64748B" />
                    <span>{t('members.detailModal.joinDateLabel')}</span>
                  </div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{joinDate}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                    <Clock size={15} color="#64748B" />
                    <span>{t('members.detailModal.activityLabel')}</span>
                  </div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>{lastActive}</strong>
                </div>

                {/* Quyền hạn tóm tắt trong tổ chức */}
                <div style={{ marginTop: '2px', padding: '10px 12px', backgroundColor: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                    <Shield size={13} />
                    <span>{t('members.detailModal.scopeTitle', { role: roleCode })}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.71875rem', color: '#15803D', lineHeight: 1.4 }}>
                    {isOwner
                      ? t('members.detailModal.scopeOwner')
                      : isDevOps
                      ? t('members.detailModal.scopeDevops')
                      : t('members.detailModal.scopeViewer')}
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
                  {t('members.detailModal.close')}
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
                {deletingMember.status === 'INVITED'
                  ? t('members.deleteModal.titleRevoke')
                  : t('members.deleteModal.titleRemove')}
              </h3>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--dash-text-primary)', lineHeight: 1.5 }}>
                {deletingMember.status === 'INVITED' ? (
                  <>
                    {t('members.deleteModal.confirmRevokePrefix')}{' '}
                    <strong>{deletingMember.user?.email || deletingMember.email}</strong>?
                  </>
                ) : (
                  <>
                    {t('members.deleteModal.confirmRemovePrefix')}{' '}
                    <strong>{deletingMember.user?.full_name || deletingMember.name}</strong> (
                    {deletingMember.user?.email || deletingMember.email}) {t('members.deleteModal.confirmRemoveSuffix')}
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
                {t('members.deleteModal.warning')}
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
                  {t('members.deleteModal.cancel')}
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
                  {isDeleting ? t('members.deleteModal.processing') : t('members.deleteModal.confirm')}
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
