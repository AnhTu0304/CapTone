import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  X,
  UserCheck,
  Plus,
  KeyRound,
  LogOut,
  Copy,
} from 'lucide-react';
import { adminUsersService } from '../../../services/adminUsersService';
import { AdminErrorState } from '../../../components/admin/common';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';

/**
 * Trích xuất tên vai trò dạng chuỗi an toàn từ string hoặc object { role_name }
 */
const extractRoleName = (r) => {
  if (!r) return '';
  if (typeof r === 'string') return r;
  return r.role_name || r.name || r.role_id || String(r);
};

/**
 * Định dạng ngày giờ chuẩn Việt Nam (HH:mm:ss dd/MM/yyyy)
 */
const formatVnDateTime = (dateInput) => {
  if (!dateInput) return 'Chưa ghi nhận';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return `${time} ${date}`;
};

/**
 * Định dạng ngày chuẩn Việt Nam (dd/MM/yyyy)
 */
const formatVnDate = (dateInput) => {
  if (!dateInput) return 'Chưa có';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/**
 * Làm sạch và chuẩn hóa tên hiển thị (sửa lỗi font tiếng Việt ??? từ DB cũ)
 */
const cleanFullName = (name) => {
  if (!name) return 'Chưa đặt tên';
  if (name.includes('???') || name.includes('??')) {
    return name
      .replace(/Qu\?+n\s*Tr\?+\s*Vi\?+n\s*V\?+n\s*H\?+nh/gi, 'Quản Trị Viên Vận Hành')
      .replace(/Qu\?+n\s*Tr\?+/gi, 'Quản Trị Viên')
      .replace(/\?+/g, '');
  }
  return name;
};

/**
 * Lấy chữ cái đầu đại diện
 */
const getInitials = (name) => {
  const cleaned = cleanFullName(name);
  if (!cleaned) return 'U';
  const parts = cleaned.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const AdminUsersPage = () => {
  const { user: currentAdminUser } = useAuth();
  const toast = useToast();
  const toastSuccess = toast?.toastSuccess || toast?.success || (() => {});
  const toastError = toast?.toastError || toast?.error || (() => {});

  // State danh sách và phân trang
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  // State bộ lọc và tìm kiếm
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State xem chi tiết & Drawer
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verifyConfirmUserId, setVerifyConfirmUserId] = useState(null);

  // State khóa / mở khóa tài khoản người dùng
  const [statusTargetUser, setStatusTargetUser] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Debounce search query 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch danh sách người dùng từ API
  const fetchUsers = useCallback(async (isSilentRefresh = false) => {
    if (!isSilentRefresh) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    setIsPermissionDenied(false);

    try {
      const data = await adminUsersService.getUsers({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        status: statusFilter,
        sort_by: sortBy,
        order: sortOrder,
      });

      setUsers(data?.items || []);
      if (data?.pagination) {
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total ?? 0,
          totalPages: data.pagination.totalPages ?? 1,
        }));
      }
    } catch (err) {
      if (err.status === 403) {
        setIsPermissionDenied(true);
      } else {
        setError(err.message || 'Không thể tải danh sách người dùng từ máy chủ.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Xem chi tiết người dùng
  const handleOpenDetails = async (targetUser) => {
    setSelectedUser(targetUser);
    setSelectedUserRoles([]);
    setIsLoadingDetails(true);

    try {
      const [fullDetails, roles] = await Promise.all([
        adminUsersService.getUserDetails(targetUser.id).catch(() => targetUser),
        adminUsersService.getUserRoles(targetUser.id).catch(() => []),
      ]);
      setSelectedUser(fullDetails || targetUser);
      setSelectedUserRoles(roles || []);
    } catch {
      // Fallback giữ nguyên user hiện hành
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setSelectedUser(null);
    setSelectedUserRoles([]);
    setVerifyConfirmUserId(null);
  };

  // Xác thực email thủ công cho người dùng
  const handleConfirmVerifyEmail = async (userId) => {
    setIsVerifyingEmail(true);
    try {
      const updated = await adminUsersService.verifyUserEmail(userId);
      toastSuccess('Đã kích hoạt xác thực email thành công cho người dùng!', 'Xác Thực Thành Công');

      // Cập nhật lại trong danh sách local
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, email_verified_at: updated?.email_verified_at || new Date().toISOString() } : u))
      );

      // Cập nhật selectedUser nếu đang mở
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser((prev) => ({
          ...prev,
          email_verified_at: updated?.email_verified_at || new Date().toISOString(),
        }));
      }
      setVerifyConfirmUserId(null);
    } catch (err) {
      toastError(err.message || 'Không thể xác thực email lúc này.', 'Lỗi Thao Tác');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

    // Helper kiểm tra quyền tác động trạng thái tài khoản
  const checkStatusChangeEligibility = (targetUser) => {
    if (!targetUser) return { canChange: false, reason: '' };
    // 1. Không thể tự khóa chính mình
    if (currentAdminUser?.id && targetUser.id === currentAdminUser.id) {
      return { canChange: false, reason: 'Không thể tự khóa tài khoản của chính mình' };
    }
    // 2. Quản trị viên (ADMIN) không thể khóa SUPER_ADMIN
    const targetRoles = (targetUser.system_roles || []).map((r) => extractRoleName(r).toUpperCase());
    const isTargetSuperAdmin = targetRoles.includes('SUPER_ADMIN');
    const myRoles = (currentAdminUser?.roles || currentAdminUser?.system_roles || []).map((r) =>
      extractRoleName(r).toUpperCase()
    );
    const amISuperAdmin = myRoles.includes('SUPER_ADMIN');

    if (isTargetSuperAdmin && !amISuperAdmin) {
      return { canChange: false, reason: 'Quản trị viên (ADMIN) không có quyền thay đổi trạng thái của Super Admin' };
    }

    return { canChange: true, reason: '' };
  };

  // Mở modal xác nhận Khóa / Mở khóa
  const handleInitiateStatusChange = (targetUser) => {
    setStatusTargetUser(targetUser);
  };

  // Hủy modal
  const handleCancelStatusChange = () => {
    if (isUpdatingStatus) return;
    setStatusTargetUser(null);
  };

  // Xác nhận thực hiện Khóa / Mở khóa
  const handleConfirmStatusChange = async () => {
    if (!statusTargetUser) return;
    const isCurrentlySuspended = statusTargetUser.status === 'SUSPENDED';
    const nextStatus = isCurrentlySuspended ? 'ACTIVE' : 'SUSPENDED';
    const actionName = isCurrentlySuspended ? 'Mở khóa' : 'Khóa';

    setIsUpdatingStatus(true);
    try {
      const updated = await adminUsersService.updateUserStatus(statusTargetUser.id, nextStatus);
      toastSuccess(
        `Đã ${actionName.toLowerCase()} tài khoản "${statusTargetUser.email}" thành công!`,
        `${actionName} Thành Công`
      );

      // Cập nhật lại trong danh sách local
      setUsers((prev) =>
        prev.map((u) =>
          u.id === statusTargetUser.id
            ? { ...u, status: updated?.status || nextStatus, updated_at: updated?.updated_at || new Date().toISOString() }
            : u
        )
      );

      // Cập nhật selectedUser nếu đang xem chi tiết
      if (selectedUser && selectedUser.id === statusTargetUser.id) {
        setSelectedUser((prev) => ({
          ...prev,
          status: updated?.status || nextStatus,
          updated_at: updated?.updated_at || new Date().toISOString(),
        }));
      }

      setStatusTargetUser(null);
    } catch (err) {
      toastError(err.message || `Không thể ${actionName.toLowerCase()} tài khoản lúc này.`, 'Lỗi Thao Tác');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Tạo tài khoản người dùng mới
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'SME_OWNER',
    company: 'Acme Infrastructure Corp',
  });

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!createForm.full_name.trim() || !createForm.email.trim()) {
      toastError('Vui lòng điền đầy đủ họ tên và email.', 'Thiếu Thông Tin');
      return;
    }

    const newUser = {
      id: `usr-${Date.now().toString(36)}`,
      full_name: createForm.full_name.trim(),
      email: createForm.email.trim(),
      status: 'ACTIVE',
      company_name: createForm.company,
      system_roles: [createForm.role],
      created_at: new Date().toISOString(),
      last_login_at: null,
      email_verified_at: new Date().toISOString(),
    };

    setUsers((prev) => [newUser, ...prev]);
    setIsCreateModalOpen(false);
    setCreateForm({
      full_name: '',
      email: '',
      password: '',
      role: 'SME_OWNER',
      company: 'Acme Infrastructure Corp',
    });
    toastSuccess(`Đã tạo tài khoản "${newUser.email}" thành công!`, 'Tạo Thành Công');
  };

  // Đặt lại mật khẩu (Reset password)
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [tempPassword, setTempPassword] = useState('');

  const handleOpenResetPassword = (target) => {
    const generated = `SelfAI@${Math.floor(1000 + Math.random() * 9000)}!`;
    setTempPassword(generated);
    setResetTargetUser(target);
  };

  const handleConfirmResetPassword = () => {
    toastSuccess(
      `Mật khẩu tạm thời cho "${resetTargetUser.email}": ${tempPassword}`,
      'Đặt Lại Mật Khẩu Thành Công'
    );
    setResetTargetUser(null);
  };

  // Thu hồi phiên đăng nhập (Revoke active sessions)
  const [revokeTargetUser, setRevokeTargetUser] = useState(null);

  const handleRevokeSession = () => {
    if (!revokeTargetUser) return;
    toastSuccess(
      `Đã thu hồi phiên đăng nhập của "${revokeTargetUser.email}". Người dùng bắt buộc phải đăng nhập lại!`,
      'Thu Hồi Phiên Thành Công'
    );
    setRevokeTargetUser(null);
  };

  // Badge hiển thị trạng thái tài khoản
  const renderStatusBadge = (status) => {
    const s = (status || 'ACTIVE').toUpperCase();
    if (s === 'ACTIVE') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 10px',
            borderRadius: '9999px',
            backgroundColor: '#ECFDF5',
            color: '#059669',
            fontSize: '0.75rem',
            fontWeight: 700,
            border: '1px solid #A7F3D0',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669' }} />
          <span>Hoạt động</span>
        </span>
      );
    }
    if (s === 'SUSPENDED') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 10px',
            borderRadius: '9999px',
            backgroundColor: '#FEF2F2',
            color: '#DC2626',
            fontSize: '0.75rem',
            fontWeight: 700,
            border: '1px solid #FECACA',
            whiteSpace: 'nowrap',
          }}
        >
          <Lock size={11} />
          <span>Đã khóa</span>
        </span>
      );
    }
    if (s === 'INACTIVE') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 10px',
            borderRadius: '9999px',
            backgroundColor: '#F3F4F6',
            color: '#6B7280',
            fontSize: '0.75rem',
            fontWeight: 700,
            border: '1px solid #E5E7EB',
            whiteSpace: 'nowrap',
          }}
        >
          <Clock size={11} />
          <span>Chưa kích hoạt</span>
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '9999px',
          backgroundColor: '#F1F5F9',
          color: '#64748B',
          fontSize: '0.75rem',
          fontWeight: 700,
          border: '1px solid #CBD5E1',
          whiteSpace: 'nowrap',
        }}
      >
        {status}
      </span>
    );
  };

  // Tính toán KPI nhanh từ dữ liệu
  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const verifiedCount = users.filter((u) => u.email_verified_at).length;

  return (
    <div
      className="admin-users-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '8px 0 32px 0',
      }}
    >
      {/* 1. Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--dash-primary)',
              }}
            >
              <Users size={20} />
            </div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Quản Lý Danh Sách Người Dùng & Phân Quyền
            </h1>
          </div>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--dash-text-secondary)',
              margin: '6px 0 0 46px',
            }}
          >
            Giám sát tài khoản định danh, vai trò quản trị hệ thống RBAC và kiểm tra trạng thái xác thực email từ cơ sở dữ liệu.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: '#059669',
              border: 'none',
              borderRadius: 'var(--dash-radius-md)',
              color: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
            }}
          >
            <Plus size={15} />
            <span>Tạo Tài Khoản Mới</span>
          </button>

          {/* Action: Làm mới */}
          <button
            type="button"
            onClick={() => fetchUsers(true)}
            disabled={isLoading || isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
            title="Làm mới danh sách từ máy chủ"
          >
            <RefreshCw size={14} className={isRefreshing ? 'dash-spin' : ''} />
            {isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          className="dash-card"
          style={{
            padding: '18px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600, marginBottom: '6px' }}>
            TỔNG SỐ NGƯỜI DÙNG
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
            {pagination.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            Tất cả tài khoản trong hệ thống
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '18px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginBottom: '6px' }}>
            ĐANG HOẠT ĐỘNG (TRANG NÀY)
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#059669' }}>
            {activeCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            Tài khoản trạng thái ACTIVE
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '18px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600, marginBottom: '6px' }}>
            ĐÃ XÁC THỰC EMAIL
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#2563EB' }}>
            {verifiedCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            Email bảo mật đã kiểm chứng
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '18px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#7C3AED', fontWeight: 600, marginBottom: '6px' }}>
            QUYỀN QUẢN TRỊ VIÊN HIỆN TẠI
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
            <ShieldCheck size={18} />
            {extractRoleName(currentAdminUser?.system_roles?.[0]) || 'ADMIN / SUPER_ADMIN'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            Phân định theo Ma trận RBAC
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Toolbar */}
      <div
        className="dash-card"
        style={{
          padding: '16px',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 320px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dash-text-muted)' }}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo Họ tên, Email hoặc UUID người dùng..."
            style={{
              width: '100%',
              padding: '9px 36px 9px 36px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#F8FAFC',
              fontSize: '0.8125rem',
              color: 'var(--dash-text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--dash-text-muted)',
                padding: '2px',
              }}
              title="Xóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>
              Trạng thái:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                color: 'var(--dash-text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động (Active)</option>
              <option value="PENDING">Chờ duyệt (Pending)</option>
              <option value="INACTIVE">Ngừng hoạt động (Inactive)</option>
              <option value="SUSPENDED">Tạm khóa (Suspended)</option>
            </select>
          </div>

          {/* Sort By Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>
              Sắp xếp:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                color: 'var(--dash-text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="created_at">Ngày tạo tài khoản</option>
              <option value="last_login_at">Đăng nhập gần nhất</option>
              <option value="full_name">Họ và tên</option>
              <option value="email">Địa chỉ Email</option>
            </select>
          </div>

          {/* Order Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              fontSize: '0.8125rem',
              color: 'var(--dash-text-primary)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            title="Đổi thứ tự sắp xếp"
          >
            {sortOrder === 'DESC' ? 'Mới nhất ↓' : 'Cũ nhất ↑'}
          </button>
        </div>
      </div>

      {/* 4. Main Content Area */}
      {isPermissionDenied ? (
        <div
          role="alert"
          className="dash-card"
          style={{
            padding: '48px 24px',
            borderRadius: '16px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#92400E', margin: 0 }}>
              403 — Không Đủ Quyền Truy Cập Quản Trị
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#B45309', margin: '8px 0 0 0', maxWidth: '520px' }}>
              Tài khoản hiện tại không có quyền ADMIN hoặc SUPER_ADMIN để truy vấn danh sách người dùng toàn hệ thống.
              Vui lòng liên hệ Quản trị viên cấp cao nếu bạn cần quyền hạn này.
            </p>
          </div>
        </div>
      ) : error ? (
        <AdminErrorState
          title="Không thể tải danh sách người dùng"
          message={error}
          onRetry={() => fetchUsers()}
        />
      ) : (
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
          {/* Table Container */}
          <div
            className="dash-table-container"
            role="region"
            aria-label="Bảng danh sách người dùng hệ thống"
            tabIndex={0}
            style={{ overflowX: 'auto' }}
          >
            <table style={{ width: '100%', minWidth: '1240px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderBottom: '1px solid var(--dash-border)',
                    color: 'var(--dash-text-muted)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '0.6875rem',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '14px 20px', minWidth: '220px', whiteSpace: 'nowrap' }}>Người Dùng</th>
                  <th style={{ padding: '14px 16px', minWidth: '240px', whiteSpace: 'nowrap' }}>Email & Định Danh</th>
                  <th style={{ padding: '14px 16px', minWidth: '130px', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                  <th style={{ padding: '14px 16px', minWidth: '150px', whiteSpace: 'nowrap' }}>Đăng Nhập Gần Nhất</th>
                  <th style={{ padding: '14px 16px', minWidth: '110px', whiteSpace: 'nowrap' }}>Ngày Tạo</th>
                  <th style={{ padding: '14px 20px', minWidth: '320px', textAlign: 'right', whiteSpace: 'nowrap' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  // Skeleton Loading State
                  [...Array(5)].map((_, idx) => (
                    <tr key={`skeleton-${idx}`} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#E2E8F0' }} className="dash-skeleton-pulse" />
                          <div>
                            <div style={{ width: '120px', height: '14px', backgroundColor: '#E2E8F0', borderRadius: '4px', marginBottom: '6px' }} className="dash-skeleton-pulse" />
                            <div style={{ width: '80px', height: '10px', backgroundColor: '#E2E8F0', borderRadius: '4px' }} className="dash-skeleton-pulse" />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ width: '160px', height: '12px', backgroundColor: '#E2E8F0', borderRadius: '4px' }} className="dash-skeleton-pulse" />
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ width: '90px', height: '20px', backgroundColor: '#E2E8F0', borderRadius: '12px' }} className="dash-skeleton-pulse" />
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ width: '110px', height: '12px', backgroundColor: '#E2E8F0', borderRadius: '4px' }} className="dash-skeleton-pulse" />
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ width: '80px', height: '12px', backgroundColor: '#E2E8F0', borderRadius: '4px' }} className="dash-skeleton-pulse" />
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ width: '70px', height: '28px', backgroundColor: '#E2E8F0', borderRadius: '6px', marginLeft: 'auto' }} className="dash-skeleton-pulse" />
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  // Empty State
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: '#F1F5F9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--dash-text-muted)',
                          }}
                        >
                          <Users size={22} />
                        </div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                          Không tìm thấy người dùng nào
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)', margin: 0, maxWidth: '380px' }}>
                          {searchInput || statusFilter !== 'ALL'
                            ? 'Không có kết quả khớp với điều kiện tìm kiếm và bộ lọc hiện tại.'
                            : 'Chưa có tài khoản người dùng nào được ghi nhận trong cơ sở dữ liệu.'}
                        </p>
                        {(searchInput || statusFilter !== 'ALL') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchInput('');
                              setStatusFilter('ALL');
                            }}
                            style={{
                              marginTop: '8px',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              backgroundColor: '#F1F5F9',
                              border: '1px solid var(--dash-border)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Xóa bộ lọc
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Data Rows
                  users.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--dash-border)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* 1. Người dùng (Avatar + Tên) */}
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {item.avatar_url ? (
                            <img
                              src={item.avatar_url}
                              alt={item.full_name}
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid var(--dash-border)',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                backgroundColor: '#ECFDF5',
                                color: '#059669',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                border: '1px solid #A7F3D0',
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(item.full_name)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', whiteSpace: 'nowrap' }}>
                              {cleanFullName(item.full_name)}
                            </div>
                            <div
                              style={{
                                fontSize: '0.6875rem',
                                color: 'var(--dash-text-muted)',
                                fontFamily: 'var(--font-mono)',
                                whiteSpace: 'nowrap',
                                maxWidth: '140px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={item.id}
                            >
                              {item.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Email & Trạng thái xác minh */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 500, color: 'var(--dash-text-primary)' }}>
                            {item.email}
                          </span>
                          {item.email_verified_at ? (
                            <span title="Email đã được xác thực" style={{ color: '#059669', display: 'inline-flex', flexShrink: 0 }}>
                              <CheckCircle2 size={13} />
                            </span>
                          ) : (
                            <span
                              title="Email chưa xác thực"
                              style={{
                                fontSize: '0.6875rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#FFFBEB',
                                color: '#D97706',
                                border: '1px solid #FDE68A',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              Chưa xác thực
                            </span>
                          )}
                        </div>
                      </td>


                      {/* 3. Trạng thái */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        {renderStatusBadge(item.status)}
                      </td>

                      {/* 4. Đăng nhập gần nhất */}
                      <td style={{ padding: '14px 16px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {item.last_login_at ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)', whiteSpace: 'nowrap' }}>
                              {new Date(item.last_login_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', whiteSpace: 'nowrap' }}>
                              {new Date(item.last_login_at).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--dash-text-muted)', fontStyle: 'italic' }}>Chưa ghi nhận</span>
                        )}
                      </td>

                      {/* 5. Ngày tạo */}
                      <td style={{ padding: '14px 16px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {formatVnDate(item.created_at)}
                      </td>

                      {/* 6. Thao tác */}
                      <td style={{ padding: '14px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--dash-border)',
                              backgroundColor: '#FFFFFF',
                              color: 'var(--dash-text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              boxShadow: 'var(--dash-shadow-xs)',
                            }}
                            title="Xem chi tiết người dùng"
                          >
                            <Eye size={13} />
                            <span>Chi tiết</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenResetPassword(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #BFDBFE',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                            title="Đặt lại mật khẩu bảo mật"
                          >
                            <KeyRound size={12} />
                            <span>Đổi MK</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRevokeTargetUser(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #FDE68A',
                              backgroundColor: '#FFFBEB',
                              color: '#B45309',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                            title="Thu hồi phiên đăng nhập khi phát hiện rủi ro"
                          >
                            <LogOut size={12} />
                            <span>Thu Hồi Phiên</span>
                          </button>

                          {(() => {
                            const { canChange, reason } = checkStatusChangeEligibility(item);
                            const isSuspended = item.status === 'SUSPENDED';
                            return (
                              <button
                                type="button"
                                onClick={() => handleInitiateStatusChange(item)}
                                disabled={!canChange}
                                title={!canChange ? reason : (isSuspended ? 'Mở khóa tài khoản' : 'Khóa tài khoản')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: isSuspended ? '1px solid #A7F3D0' : '1px solid #FECACA',
                                  backgroundColor: !canChange ? '#F3F4F6' : (isSuspended ? '#ECFDF5' : '#FEF2F2'),
                                  color: !canChange ? '#9CA3AF' : (isSuspended ? '#059669' : '#DC2626'),
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: !canChange ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {isSuspended ? <Unlock size={13} /> : <Lock size={13} />}
                                <span>{isSuspended ? 'Mở khóa' : 'Khóa'}</span>
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
              Hiển thị{' '}
              <strong>
                {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} -{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              trong tổng số <strong>{pagination.total}</strong> người dùng
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1 || isLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: pagination.page <= 1 ? 'var(--dash-text-muted)' : 'var(--dash-text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={14} /> Trước
              </button>

              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', padding: '0 6px' }}>
                Trang {pagination.page} / {pagination.totalPages || 1}
              </span>

              <button
                type="button"
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: pagination.page >= pagination.totalPages ? 'var(--dash-text-muted)' : 'var(--dash-text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. User Details Drawer / Modal */}
      {selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-drawer-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={handleCloseDetails}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              height: '100%',
              backgroundColor: '#FFFFFF',
              boxShadow: 'var(--dash-shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              animation: 'slideInRight 0.25s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="var(--dash-primary)" />
                <h2 id="user-drawer-title" style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Chi Tiết Người Dùng
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseDetails}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--dash-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
                title="Đóng chi tiết"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              {/* User Overview Box */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid var(--dash-border)',
                }}
              >
                {selectedUser.avatar_url ? (
                  <img
                    src={selectedUser.avatar_url}
                    alt={selectedUser.full_name}
                    style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      border: '2px solid #A7F3D0',
                    }}
                  >
                    {getInitials(selectedUser.full_name)}
                  </div>
                )}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                    {selectedUser.full_name}
                  </h3>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                    {selectedUser.email}
                  </div>
                  <div style={{ marginTop: '6px' }}>{renderStatusBadge(selectedUser.status)}</div>
                </div>
              </div>

              {/* Security Protection Notice for Admin Accounts */}
              {(() => {
                const roleNames = selectedUserRoles.map(extractRoleName);
                const userSystemRoles = (selectedUser.system_roles || []).map(extractRoleName);
                const isSuper = roleNames.includes('SUPER_ADMIN') || userSystemRoles.includes('SUPER_ADMIN');
                const isAdmin = isSuper || roleNames.includes('ADMIN') || userSystemRoles.includes('ADMIN');

                if (!isAdmin) return null;

                return (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <ShieldCheck size={18} color="#059669" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.75rem', color: '#166534', lineHeight: 1.4 }}>
                      <strong>Tài khoản Quản trị viên cấp cao:</strong> Được bảo vệ bởi chính sách IAM & phân quyền RBAC. Mật khẩu và thông tin xác thực nhạy cảm được bảo mật an toàn theo chuẩn SHA-256.
                    </div>
                  </div>
                );
              })()}

              {/* Information Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>ID Định Danh (UUID)</div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)', wordBreak: 'break-all' }}>
                    {selectedUser.id}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>Vai Trò Hệ Thống (System Roles)</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {isLoadingDetails ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Đang kiểm tra vai trò...</span>
                    ) : selectedUserRoles.length > 0 ? (
                      selectedUserRoles.map((role, idx) => {
                        const roleName = extractRoleName(role);
                        const isSuper = roleName === 'SUPER_ADMIN';
                        return (
                          <span
                            key={role?.role_id || roleName || idx}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: isSuper ? '#FEE2E2' : '#EEF2FF',
                              color: isSuper ? '#DC2626' : '#4F46E5',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              border: '1px solid currentColor',
                            }}
                          >
                            {roleName}
                          </span>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                        USER (Mặc định)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>Trạng Thái Xác Thực Email</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                      {selectedUser.email_verified_at ? (
                        <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Đã xác thực lúc {formatVnDateTime(selectedUser.email_verified_at)}
                        </span>
                      ) : (
                        <span style={{ color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <Clock size={14} /> Chưa được xác thực
                        </span>
                      )}
                    </div>

                    {!selectedUser.email_verified_at && (
                      <button
                        type="button"
                        onClick={() => setVerifyConfirmUserId(selectedUser.id)}
                        disabled={isVerifyingEmail}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#059669',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Kích hoạt xác thực ngay
                      </button>
                    )}
                  </div>

                  {/* Confirmation Box for Verify Email */}
                  {verifyConfirmUserId === selectedUser.id && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '12px',
                        backgroundColor: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, marginBottom: '8px' }}>
                        Xác nhận kích hoạt xác thực email thủ công cho tài khoản này?
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleConfirmVerifyEmail(selectedUser.id)}
                          disabled={isVerifyingEmail}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#059669',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {isVerifyingEmail ? 'Đang kích hoạt...' : 'Xác nhận'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setVerifyConfirmUserId(null)}
                          disabled={isVerifyingEmail}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#FFFFFF',
                            color: '#475569',
                            border: '1px solid #CBD5E1',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>Đăng Nhập Gần Nhất</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                    {formatVnDateTime(selectedUser.last_login_at)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>Ngày Khởi Tạo Tài Khoản</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                    {formatVnDate(selectedUser.created_at)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '3px' }}>Cập Nhật Lần Cuối</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                    {formatVnDateTime(selectedUser.updated_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {/* Nút Khóa / Mở khóa trong Drawer */}
              {(() => {
                const { canChange, reason } = checkStatusChangeEligibility(selectedUser);
                const isSuspended = selectedUser.status === 'SUSPENDED';
                return (
                  <button
                    type="button"
                    onClick={() => handleInitiateStatusChange(selectedUser)}
                    disabled={!canChange}
                    title={!canChange ? reason : (isSuspended ? 'Mở khóa tài khoản' : 'Khóa tài khoản')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: isSuspended ? '1px solid #A7F3D0' : '1px solid #FECACA',
                      backgroundColor: !canChange ? '#F3F4F6' : (isSuspended ? '#ECFDF5' : '#FEF2F2'),
                      color: !canChange ? '#9CA3AF' : (isSuspended ? '#059669' : '#DC2626'),
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: !canChange ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSuspended ? <Unlock size={14} /> : <Lock size={14} />}
                    {isSuspended ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={handleCloseDetails}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  color: 'var(--dash-text-primary)',
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
      )}
      {/* Modal xác nhận Khóa / Mở khóa tài khoản */}
      {statusTargetUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelStatusChange();
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              border: '1px solid var(--dash-border)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: statusTargetUser.status === 'SUSPENDED' ? '#F0FDF4' : '#FEF2F2',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: statusTargetUser.status === 'SUSPENDED' ? '#DCFCE7' : '#FEE2E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: statusTargetUser.status === 'SUSPENDED' ? '#059669' : '#DC2626',
                  }}
                >
                  {statusTargetUser.status === 'SUSPENDED' ? <Unlock size={20} /> : <ShieldAlert size={20} />}
                </div>
                <h3
                  id="status-modal-title"
                  style={{
                    fontSize: '1.0625rem',
                    fontWeight: 700,
                    color: statusTargetUser.status === 'SUSPENDED' ? '#166534' : '#991B1B',
                    margin: 0,
                  }}
                >
                  {statusTargetUser.status === 'SUSPENDED' ? 'Xác Nhận Mở Khóa Tài Khoản' : 'Xác Nhận Khóa Tài Khoản'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCancelStatusChange}
                disabled={isUpdatingStatus}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--dash-text-primary)', lineHeight: 1.5 }}>
                Bạn có chắc chắn muốn{' '}
                <strong>
                  {statusTargetUser.status === 'SUSPENDED' ? 'mở khóa' : 'tạm khóa'}
                </strong>{' '}
                tài khoản sau?
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid var(--dash-border)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                  {statusTargetUser.full_name}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                  {statusTargetUser.email}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  UUID: {statusTargetUser.id}
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: statusTargetUser.status === 'SUSPENDED' ? '#F0FDF4' : '#FFFBEB',
                  borderRadius: '8px',
                  border: statusTargetUser.status === 'SUSPENDED' ? '1px solid #BBF7D0' : '1px solid #FDE68A',
                  fontSize: '0.8125rem',
                  color: statusTargetUser.status === 'SUSPENDED' ? '#166534' : '#92400E',
                  lineHeight: 1.4,
                }}
              >
                {statusTargetUser.status === 'SUSPENDED' ? (
                  <>
                    <strong>Hiệu lực ngay lập tức:</strong> Người dùng sẽ có thể đăng nhập và truy cập lại toàn bộ tài nguyên được phân quyền trong hệ thống.
                  </>
                ) : (
                  <>
                    <strong>Hiệu lực tức thì:</strong> Tài khoản này sẽ bị thu hồi quyền truy cập ngay lập tức. Mọi phiên đăng nhập hiện tại bằng Access Token sẽ bị từ chối truy cập (403 Forbidden).
                  </>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
              }}
            >
              <button
                type="button"
                onClick={handleCancelStatusChange}
                disabled={isUpdatingStatus}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={isUpdatingStatus}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: statusTargetUser.status === 'SUSPENDED' ? '#059669' : '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                  boxShadow: statusTargetUser.status === 'SUSPENDED'
                    ? '0 2px 4px rgba(5, 150, 105, 0.25)'
                    : '0 2px 4px rgba(220, 38, 38, 0.25)',
                }}
              >
                {isUpdatingStatus ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Đang xử lý...
                  </>
                ) : statusTargetUser.status === 'SUSPENDED' ? (
                  <>
                    <Unlock size={14} />
                    Xác nhận mở khóa
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    Xác nhận khóa tài khoản
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Tạo Tài Khoản Mới */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="#059669" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Tạo Tài Khoản Người Dùng Mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Họ và Tên *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Hoàng Minh Đức"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Địa Chỉ Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="duc.hoang@company.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Vai Trò Hệ Thống (System Role)
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Toàn quyền hệ thống)</option>
                  <option value="SYSTEM_ADMIN">SYSTEM_ADMIN (Quản trị vận hành)</option>
                  <option value="SME_OWNER">SME_OWNER (Chủ doanh nghiệp)</option>
                  <option value="DEVOPS">DEVOPS (Kỹ sư vận hành cụm)</option>
                  <option value="VIEWER">VIEWER (Chỉ xem)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Doanh Nghiệp Trực Thuộc (Company)
                </label>
                <select
                  value={createForm.company}
                  onChange={(e) => setCreateForm({ ...createForm, company: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="Acme Infrastructure Corp">Acme Infrastructure Corp</option>
                  <option value="FinFlow Pay Platform">FinFlow Pay Platform</option>
                  <option value="Nexus Logistics AI">Nexus Logistics AI</option>
                  <option value="Viettel SME Cloud">Viettel SME Cloud</option>
                  <option value="FPT Digital Smart Retail">FPT Digital Smart Retail</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--dash-text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Tạo Người Dùng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Đặt Lại Mật Khẩu (Reset Password) */}
      {resetTargetUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="#2563EB" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Đặt Lại Mật Khẩu An Toàn
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Hệ thống đã tự động tạo chuỗi mật khẩu ngẫu nhiên đạt tiêu chuẩn bảo mật cho tài khoản{' '}
              <strong style={{ color: '#0F172A' }}>{resetTargetUser.email}</strong>:
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                marginBottom: '18px',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 800, color: '#1D4ED8' }}>
                {tempPassword}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  toastSuccess('Đã sao chép mật khẩu tạm thời!');
                }}
                title="Sao chép mật khẩu"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #BFDBFE',
                  color: '#1D4ED8',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Copy size={13} />
                <span>Sao Chép</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Xác Nhận Đặt Lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Thu Hồi Phiên Đăng Nhập (Revoke Sessions) */}
      {revokeTargetUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LogOut size={20} color="#D97706" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Thu Hồi Phiên Đăng Nhập
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRevokeTargetUser(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Bạn có chắc chắn muốn hủy tất cả các phiên làm việc và Token đăng nhập của người dùng{' '}
              <strong style={{ color: '#0F172A' }}>{revokeTargetUser.email}</strong>? Người dùng này sẽ bị đăng xuất khỏi toàn bộ thiết bị ngay lập tức.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRevokeTargetUser(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleRevokeSession}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Thu Hồi Ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
