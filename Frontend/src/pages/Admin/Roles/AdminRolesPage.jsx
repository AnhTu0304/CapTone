import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Search,
  CheckCircle2,
  KeyRound,
  Sliders,
  Clock,
  Shield,
  UserCheck,
  RefreshCw,
  AlertTriangle,
  X,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import adminUsersService from '../../../services/adminUsersService';
import { getAuditLogs } from '../../../services/adminAuditLogsService';

/**
 * Ma trận phân quyền chi tiết cho toàn bộ các vai trò (Role Permissions Matrix)
 * Phản ánh chính sách bảo mật thực tế được thực thi ở tầng backend middleware
 */
const PERMISSIONS_MATRIX = [
  {
    module: 'Quản Trị Toàn Nền Tảng & RBAC',
    apiPath: '/api/v1/roles/**',
    SUPER_ADMIN: 'Toàn quyền (Tạo, gán, thu hồi vai trò toàn sàn)',
    ADMIN: 'Xem danh sách, kiểm tra thẩm quyền',
    SME_OWNER: 'Phân quyền nội bộ trong doanh nghiệp mình',
    DEVOPS: 'Không có quyền (Deny)',
    VIEWER: 'Chỉ xem danh sách (Read-only)',
  },
  {
    module: 'Cấu Hình Hệ Thống & Cài Đặt Lõi (Settings)',
    apiPath: '/api/v1/admin/settings/**',
    SUPER_ADMIN: 'Toàn quyền (Core runtime, maintenance mode, quota)',
    ADMIN: 'Không có quyền (Deny - chỉ Super Admin)',
    SME_OWNER: 'Cấu hình hồ sơ doanh nghiệp',
    DEVOPS: 'Không có quyền (Deny)',
    VIEWER: 'Không có quyền (Deny)',
  },
  {
    module: 'Quản Lý Tài Khoản Người Dùng (Users)',
    apiPath: '/api/v1/users/**',
    SUPER_ADMIN: 'Toàn quyền (Tạo, khóa, reset mật khẩu, xóa)',
    ADMIN: 'Xem danh sách, chi tiết, khóa/mở khóa tài khoản',
    SME_OWNER: 'Mời và quản lý thành viên công ty',
    DEVOPS: 'Không có quyền (Deny)',
    VIEWER: 'Xem hồ sơ cá nhân',
  },
  {
    module: 'Quản Lý Doanh Nghiệp (Organizations)',
    apiPath: '/api/v1/organizations/**',
    SUPER_ADMIN: 'Toàn quyền (Tạo mới, phê duyệt, xóa tổ chức)',
    ADMIN: 'Xem danh sách, kích hoạt / tạm khóa theo chính sách',
    SME_OWNER: 'Toàn quyền quản trị doanh nghiệp của mình',
    DEVOPS: 'Xem thông tin doanh nghiệp được gán',
    VIEWER: 'Xem thông tin doanh nghiệp (Read-only)',
  },
  {
    module: 'Cụm Hạ Tầng & Kubernetes (Clusters)',
    apiPath: '/api/v1/clusters/**',
    SUPER_ADMIN: 'Toàn quyền (Multi-cluster, cấp phát quota vật lý)',
    ADMIN: 'Giám sát và điều phối tài nguyên cụm toàn sàn',
    SME_OWNER: 'Xem cụm và tài nguyên được cấp phát cho công ty',
    DEVOPS: 'Toàn quyền điều khiển Pod, Node, Restart service',
    VIEWER: 'Xem trạng thái cụm (Read-only)',
  },
  {
    module: 'Tác Tử Tự Phục Hồi & Tự Hành (Agents)',
    apiPath: '/api/v1/agents/**',
    SUPER_ADMIN: 'Toàn quyền (Cấp token, cấu hình sâu chính sách an toàn)',
    ADMIN: 'Điều phối fleet agent, duyệt hành động nguy cơ cao',
    SME_OWNER: 'Bật / Tắt agent dịch vụ công ty',
    DEVOPS: 'Tối ưu hóa playbook, kiểm thử tác tử, debug logs',
    VIEWER: 'Xem nhật ký hoạt động của agent',
  },
  {
    module: 'Động Cơ AI & Chẩn Đoán Sự Cố (AI Models & RCA)',
    apiPath: '/api/v1/ai/**',
    SUPER_ADMIN: 'Toàn quyền (Quản lý model, benchmark, tinh chỉnh ngưỡng)',
    ADMIN: 'Theo dõi model, xem phân tích RCA toàn hệ thống',
    SME_OWNER: 'Xem báo cáo RCA và khuyến nghị tối ưu chi phí DN',
    DEVOPS: 'Phân tích sâu nguyên nhân gốc rễ (RCA) & telemetry',
    VIEWER: 'Xem đồ thị dự báo dị thường (Read-only)',
  },
  {
    module: 'Giám Sát & Viễn Trắc Thời Gian Thực (Telemetry & APM)',
    apiPath: '/api/v1/telemetry/**',
    SUPER_ADMIN: 'Toàn quyền cấu hình telemetry & ngưỡng khẩn cấp',
    ADMIN: 'Giám sát trực tiếp thời gian thực, quản lý SLA',
    SME_OWNER: 'Nhận cảnh báo sự cố ảnh hưởng doanh nghiệp',
    DEVOPS: 'Tiếp nhận cảnh báo P0/P1, xử lý khắc phục tức thì',
    VIEWER: 'Xem bảng tổng quan giám sát',
  },
  {
    module: 'Nhật Ký Kiểm Toán An Ninh (Audit Logs)',
    apiPath: '/api/v1/audit-logs/**',
    SUPER_ADMIN: 'Toàn quyền tra cứu kiểm toán toàn hệ thống',
    ADMIN: 'Tra cứu kiểm toán vận hành (Read-only)',
    SME_OWNER: 'Tra cứu nhật ký nội bộ tổ chức',
    DEVOPS: 'Tra cứu nhật ký thao tác kỹ thuật',
    VIEWER: 'Không có quyền (Deny)',
  },
];

const getRoleBadgeStyle = (role) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', label: 'SUPER_ADMIN (Tối Cao)' };
    case 'ADMIN':
    case 'SYSTEM_ADMIN':
      return { bg: '#FEFCE8', border: '#FDE68A', color: '#D97706', label: 'ADMIN (Vận Hành)' };
    case 'SME_OWNER':
      return { bg: '#ECFDF5', border: '#A7F3D0', color: '#059669', label: 'SME_OWNER (Chủ DN)' };
    case 'DEVOPS':
      return { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', label: 'DEVOPS (Kỹ Sư)' };
    case 'VIEWER':
      return { bg: '#F1F5F9', border: '#CBD5E1', color: '#64748B', label: 'VIEWER (Chỉ Xem)' };
    default:
      return { bg: '#F8FAFC', border: '#E2E8F0', color: '#475569', label: role || 'USER' };
  }
};

/**
 * Trích xuất vai trò chính của người dùng từ dữ liệu thực tế
 */
export const resolveUserRole = (u) => {
  if (Array.isArray(u.system_roles) && u.system_roles.length > 0) {
    if (u.system_roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
    if (u.system_roles.includes('ADMIN') || u.system_roles.includes('SYSTEM_ADMIN')) return 'ADMIN';
  }
  if (Array.isArray(u.organization_roles) && u.organization_roles.length > 0) {
    const codes = u.organization_roles.map((r) => (r.role_code || r.role_name || '').toUpperCase());
    if (codes.includes('SME_OWNER')) return 'SME_OWNER';
    if (codes.includes('DEVOPS')) return 'DEVOPS';
    if (codes.includes('VIEWER')) return 'VIEWER';
  }
  return u.currentRole || 'VIEWER';
};

/**
 * Trích xuất tên công ty/tổ chức của người dùng
 */
export const resolveUserOrg = (u) => {
  if (Array.isArray(u.system_roles) && u.system_roles.includes('SUPER_ADMIN')) {
    return 'Toàn Hệ Thống (Platform Root)';
  }
  if (Array.isArray(u.system_roles) && (u.system_roles.includes('ADMIN') || u.system_roles.includes('SYSTEM_ADMIN'))) {
    return 'Platform Operations';
  }
  if (Array.isArray(u.organization_roles) && u.organization_roles.length > 0) {
    if (u.organization_roles.length === 1) {
      return u.organization_roles[0].organization_name || 'Doanh nghiệp liên kết';
    }
    const ownerOrg = u.organization_roles.find((r) => (r.role_code || r.role_name) === 'SME_OWNER');
    const primaryName = (ownerOrg || u.organization_roles[0]).organization_name || 'Doanh nghiệp liên kết';
    return primaryName + ' (+' + (u.organization_roles.length - 1) + ' khác)';
  }
  return u.org || 'Chưa liên kết tổ chức';
};

export const AdminRolesPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('assignment'); // 'assignment' | 'matrix' | 'audit'

  // Tab 1: Users state
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userError, setUserError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Tab 3: Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState(null);

  // Modal 1: Gán vai trò
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [targetRole, setTargetRole] = useState('ADMIN');
  const [assignReason, setAssignReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Modal 2: Chi tiết người dùng
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  /**
   * Tải danh sách người dùng thực tế từ API
   */
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setUserError(null);
    try {
      const res = await adminUsersService.getUsers({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
      });

      const rawItems = res?.items || (Array.isArray(res) ? res : []);
      const pagination = res?.pagination || {};

      const mapped = rawItems.map((u) => ({
        id: u.id,
        name: u.full_name || u.name || 'Người dùng',
        email: u.email,
        currentRole: resolveUserRole(u),
        org: resolveUserOrg(u),
        status: u.status || 'ACTIVE',
        lastActive: u.last_login_at
          ? new Date(u.last_login_at).toLocaleString('vi-VN')
          : (u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : 'Chưa đăng nhập'),
        raw: u,
      }));

      setUsers(mapped);
      setTotalPages(pagination.totalPages || 1);
      setTotalUsers(pagination.total || mapped.length);
    } catch (err) {
      console.error('[AdminRolesPage] Lỗi lấy danh sách người dùng:', err);
      setUserError(err.message || 'Không thể tải danh sách người dùng từ hệ thống');
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [page, pageSize, search]);

  /**
   * Tải nhật ký kiểm toán phân quyền thực tế từ API
   */
  const fetchAuditLogs = useCallback(async () => {
    setIsLoadingAudit(true);
    setAuditError(null);
    try {
      const res = await getAuditLogs(
        { action: 'ALL' },
        { page: 1, pageSize: 20 },
        { field: 'timestamp', direction: 'desc' }
      );

      const items = res?.data || [];
      // Lọc các bản ghi liên quan đến phân quyền hoặc lấy toàn bộ kiểm toán bảo mật
      const roleLogs = items.filter(
        (l) =>
          l.action?.includes('ROLE') ||
          l.action?.includes('PERMISSION') ||
          l.action?.includes('ASSIGN') ||
          l.action?.includes('USER')
      );

      setAuditLogs(roleLogs.length > 0 ? roleLogs : items);
    } catch (err) {
      console.error('[AdminRolesPage] Lỗi tải nhật ký kiểm toán:', err);
      setAuditError(err.message || 'Không thể tải nhật ký kiểm toán');
      setAuditLogs([]);
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // Mở modal điều chỉnh vai trò
  const openAssignModal = (u) => {
    setSelectedUser(u);
    setTargetRole(u.currentRole || 'ADMIN');
    setAssignReason('');
    setModalError(null);
    setIsRoleModalOpen(true);
  };

  // Mở modal chi tiết người dùng
  const openDetailModal = (u) => {
    setDetailUser(u);
    setIsDetailModalOpen(true);
  };

  // Xử lý nộp form thay đổi vai trò
  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser || isSubmitting) return;

    const oldRole = selectedUser.currentRole;
    if (oldRole === targetRole) {
      setModalError(`Người dùng "${selectedUser.email}" hiện tại đã mang vai trò [${targetRole}]. Vui lòng chọn vai trò khác để điều chuyển.`);
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await adminUsersService.assignRole(
        selectedUser.id,
        targetRole,
        assignReason.trim() || `Điều chỉnh vai trò từ ${oldRole} sang ${targetRole} bởi Super Admin`
      );

      showToast(`Đã điều chuyển vai trò của "${selectedUser.email}" từ [${oldRole}] sang [${targetRole}] thành công!`);
      setIsRoleModalOpen(false);

      // Refresh dữ liệu
      await fetchUsers();
      if (activeTab === 'audit') {
        await fetchAuditLogs();
      }
    } catch (err) {
      console.error('[AdminRolesPage] Lỗi gán vai trò:', err);
      setModalError(err.message || 'Không thể cập nhật vai trò người dùng');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lọc người dùng tại client theo vai trò (nếu cần)
  const filteredUsers = users.filter((u) => {
    const matchRole = selectedRoleFilter === 'ALL' || u.currentRole === selectedRoleFilter;
    return matchRole;
  });

  return (
    <div
      className="admin-roles-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '48px',
      }}
    >
      {/* 1. Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Cấp Quyền & Ma Trận Phân Cấp RBAC (Role Assignment)
            </h1>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                color: '#DC2626',
                fontSize: '0.6875rem',
                fontWeight: 700,
                border: '1px solid rgba(220, 38, 38, 0.25)',
              }}
            >
              SUPER ADMIN ONLY
            </span>
          </div>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--dash-text-secondary)',
              marginTop: '4px',
              margin: '4px 0 0 0',
            }}
          >
            Quản trị quyền hạn cấp cao: Thăng cấp, hạ cấp và phân bổ vai trò hệ thống cho tất cả người dùng nền tảng.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'assignment') fetchUsers();
              else if (activeTab === 'audit') fetchAuditLogs();
            }}
            disabled={isLoadingUsers || isLoadingAudit}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} className={isLoadingUsers || isLoadingAudit ? 'animate-spin' : ''} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. Visual Hierarchy Explainer Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound size={17} color="#059669" />
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Nguyên Tắc Kế Thừa Phân Cấp Vai Trò (Role Hierarchy)
            </h3>
          </div>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#059669',
              backgroundColor: '#ECFDF5',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid #A7F3D0',
            }}
          >
            RBAC Full System
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
          Hệ thống áp dụng mô hình phân cấp nghiêm ngặt. Vai trò cấp cao tự động kế thừa 100% tất cả các quyền hạn của các cấp thấp hơn:
        </p>

        {/* Visual Hierarchy Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontWeight: 800,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ShieldAlert size={15} color="#DC2626" />
            <span>SUPER_ADMIN (Tối Cao)</span>
          </div>
          <span style={{ color: 'var(--dash-text-muted)', fontWeight: 800, fontSize: '1rem' }}>&gt;</span>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#FEFCE8',
              border: '1px solid #FDE68A',
              color: '#D97706',
              fontWeight: 800,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ShieldCheck size={15} color="#D97706" />
            <span>ADMIN (Vận Hành)</span>
          </div>
          <span style={{ color: 'var(--dash-text-muted)', fontWeight: 800, fontSize: '1rem' }}>&gt;</span>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#059669',
              fontWeight: 800,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Users size={15} color="#059669" />
            <span>SME_OWNER (Chủ DN)</span>
          </div>
          <span style={{ color: 'var(--dash-text-muted)', fontWeight: 800, fontSize: '1rem' }}>&gt;</span>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              color: '#1D4ED8',
              fontWeight: 700,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Shield size={15} color="#1D4ED8" />
            <span>DEVOPS (Kỹ Sư)</span>
          </div>
          <span style={{ color: 'var(--dash-text-muted)', fontWeight: 800, fontSize: '1rem' }}>&gt;</span>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#64748B',
              fontWeight: 600,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <UserCheck size={15} color="#64748B" />
            <span>VIEWER (Chỉ Xem)</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--dash-border)', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('assignment')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'assignment' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'assignment' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'assignment' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={16} />
          <span>Gán Vai Trò Người Dùng ({totalUsers})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'matrix' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'matrix' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'matrix' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sliders size={16} />
          <span>Ma Trận Quyền Hạn Chi Tiết ({PERMISSIONS_MATRIX.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'audit' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'audit' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={16} />
          <span>Nhật Ký Kiểm Toán Phân Quyền ({auditLogs.length})</span>
        </button>
      </div>

      {/* 4. Tab 1: User Role Assignment Table */}
      {activeTab === 'assignment' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            boxShadow: 'var(--dash-shadow-xs)',
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
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Danh Sách Phân Quyền Người Dùng Trực Tiếp
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
                Chọn &quot;Thay đổi vai trò&quot; để mở quy trình xác thực nâng/hạ cấp an toàn
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  color="var(--dash-text-muted)"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Tìm tên, email, công ty..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: '6px 12px 6px 30px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    minWidth: '220px',
                  }}
                />
              </div>

              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--dash-text-primary)',
                }}
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SME_OWNER">SME_OWNER</option>
                <option value="DEVOPS">DEVOPS</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>
          </div>

          {/* Error State */}
          {userError && (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <AlertTriangle size={32} color="#DC2626" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#DC2626', marginBottom: '6px' }}>
                Không thể tải danh sách người dùng
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '14px' }}>
                {userError}
              </div>
              <button
                type="button"
                onClick={fetchUsers}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: '1px solid #DC2626',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoadingUsers && !userError && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.8125rem' }}>Đang tải danh sách người dùng từ hệ thống...</div>
            </div>
          )}

          {/* Table Data */}
          {!isLoadingUsers && !userError && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>NGƯỜI DÙNG</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>TỔ CHỨC / CÔNG TY</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>VAI TRÒ HIỆN TẠI</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>HOẠT ĐỘNG GẦN NHẤT</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                        Không tìm thấy người dùng nào phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const badge = getRoleBadgeStyle(u.currentRole);
                      return (
                        <tr
                          key={u.id}
                          style={{
                            borderBottom: '1px solid var(--dash-border)',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{u.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {u.email}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--dash-text-secondary)', fontWeight: 500 }}>
                            {u.org}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                backgroundColor: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              {u.currentRole}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>
                            {u.lastActive}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => openDetailModal(u)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--dash-border)',
                                  backgroundColor: '#F8FAFC',
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  color: 'var(--dash-text-secondary)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Eye size={13} />
                                <span>Chi tiết</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openAssignModal(u)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid #A7F3D0',
                                  backgroundColor: '#ECFDF5',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  color: '#065F46',
                                  cursor: 'pointer',
                                }}
                              >
                                Thay đổi vai trò
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div
                  style={{
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--dash-border)',
                    fontSize: '0.75rem',
                    color: 'var(--dash-text-muted)',
                  }}
                >
                  <div>
                    Trang {page} / {totalPages} (Tổng cộng {totalUsers} người dùng)
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: '#FFFFFF',
                        cursor: page <= 1 ? 'not-allowed' : 'pointer',
                        opacity: page <= 1 ? 0.5 : 1,
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: '#FFFFFF',
                        cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                        opacity: page >= totalPages ? 0.5 : 1,
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Full Permissions Matrix */}
      {activeTab === 'matrix' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            boxShadow: 'var(--dash-shadow-xs)',
            overflowX: 'auto',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Ma Trận Quyền Hạn Chi Tiết & Khả Năng Truy Cập (Full Permissions Matrix)
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
                  Quy chiếu thẩm quyền cho từng vai trò trên các phân hệ cốt lõi của nền tảng Self-Healing.
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: '#475569',
                  backgroundColor: '#F1F5F9',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                }}
              >
                Chế độ Chỉ Đọc (Read-Only Policy Enforced)
              </span>
            </div>

            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                backgroundColor: '#EFF6FF',
                borderRadius: '8px',
                border: '1px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.75rem',
                color: '#1E40AF',
              }}
            >
              <Info size={16} color="#1D4ED8" />
              <span>
                <strong>Lưu ý kiến trúc:</strong> Chính sách phân quyền được cấu hình cứng và xác thực độc lập tại tầng RBAC Middleware của API Server.
                Mọi hành vi vượt cấp đều bị chặn với mã lỗi HTTP 403 Forbidden.
              </span>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                <th style={{ padding: '12px 18px', fontWeight: 700, width: '22%' }}>Phân Hệ & API Route</th>
                <th style={{ padding: '12px 12px', fontWeight: 700, color: '#DC2626', width: '16%' }}>SUPER_ADMIN</th>
                <th style={{ padding: '12px 12px', fontWeight: 700, color: '#D97706', width: '16%' }}>ADMIN</th>
                <th style={{ padding: '12px 12px', fontWeight: 700, color: '#059669', width: '16%' }}>SME_OWNER</th>
                <th style={{ padding: '12px 12px', fontWeight: 700, color: '#1D4ED8', width: '16%' }}>DEVOPS</th>
                <th style={{ padding: '12px 12px', fontWeight: 700, color: '#64748B', width: '14%' }}>VIEWER</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS_MATRIX.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{row.module}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)', fontSize: '0.6875rem' }}>{row.apiPath}</div>
                  </td>
                  <td style={{ padding: '14px 12px', fontWeight: 600, color: '#DC2626' }}>{row.SUPER_ADMIN}</td>
                  <td style={{ padding: '14px 12px', color: row.ADMIN.includes('Deny') ? '#94A3B8' : '#B45309', fontWeight: 600 }}>{row.ADMIN}</td>
                  <td style={{ padding: '14px 12px', color: row.SME_OWNER.includes('Deny') ? '#94A3B8' : '#047857', fontWeight: 600 }}>{row.SME_OWNER}</td>
                  <td style={{ padding: '14px 12px', color: row.DEVOPS.includes('Deny') ? '#94A3B8' : '#1D4ED8', fontWeight: 600 }}>{row.DEVOPS}</td>
                  <td style={{ padding: '14px 12px', color: row.VIEWER.includes('Deny') ? '#94A3B8' : '#64748B' }}>{row.VIEWER}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Tab 3: System Role Audit History */}
      {activeTab === 'audit' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            boxShadow: 'var(--dash-shadow-xs)',
            overflowX: 'auto',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Nhật Ký Kiểm Toán Phân Quyền (RBAC Audit Trail)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
              Ghi vết an toàn chống chối bỏ mọi thao tác nâng cấp/hạ cấp vai trò trên toàn hệ thống từ cơ sở dữ liệu thực tế.
            </p>
          </div>

          {/* Audit Loading & Error */}
          {isLoadingAudit && (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.8125rem' }}>Đang tải nhật ký kiểm toán từ máy chủ...</div>
            </div>
          )}

          {auditError && (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: '#DC2626' }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 6px auto' }} />
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{auditError}</div>
              <button
                type="button"
                onClick={fetchAuditLogs}
                style={{
                  marginTop: '10px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #DC2626',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Tải lại nhật ký
              </button>
            </div>
          )}

          {!isLoadingAudit && !auditError && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Thời Gian</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Người Thực Hiện (Actor)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Đối Tượng Nhận Quyền</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Hành Động / Chuyển Đổi</th>
                  <th style={{ padding: '12px 20px', fontWeight: 700 }}>Lý Do / Căn Cứ Nghiệp Vụ</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                      Chưa có sự kiện kiểm toán phân quyền nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    const oldRole = log.beforeData?.roles?.[0] || log.oldRole || 'USER';
                    const newRole = log.afterData?.role || log.metadata?.role || log.newRole || log.action;
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                        <td style={{ padding: '12px 20px', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {log.timestamp}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                          {log.actor}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#059669' }}>
                          {log.resourceId || log.target || log.target_id || 'Người dùng'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--dash-text-secondary)' }}>{oldRole}</span>
                          <span style={{ margin: '0 6px', color: 'var(--dash-text-muted)' }}>&rarr;</span>
                          <span style={{ fontWeight: 700, color: '#1D4ED8' }}>{newRole}</span>
                        </td>
                        <td style={{ padding: '12px 20px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                          {log.metadata?.reason || log.description || log.reason || 'Cập nhật vai trò qua Admin Dashboard'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal 1: Cấp Quyền & Ghi Chú Căn Cứ */}
      {isRoleModalOpen && selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                Điều Chỉnh Thẩm Quyền Phân Cấp
              </h3>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dash-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error in modal */}
            {modalError && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  color: '#991B1B',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{modalError}</span>
              </div>
            )}

            <div style={{ marginBottom: '14px', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Tài khoản đối tượng</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>{selectedUser.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)' }}>{selectedUser.email}</div>
              <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--dash-text-muted)' }}>
                Vai trò hiện tại:{' '}
                <strong style={{ color: getRoleBadgeStyle(selectedUser.currentRole).color }}>
                  {selectedUser.currentRole}
                </strong>
              </div>
            </div>

            {/* Prominent Safety Warning for Super Admin modification */}
            {(targetRole === 'SUPER_ADMIN' || selectedUser.currentRole === 'SUPER_ADMIN') && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '8px',
                  color: '#92400E',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <ShieldAlert size={16} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Cảnh báo an ninh cấp cao:</strong>{' '}
                  {targetRole === 'SUPER_ADMIN'
                    ? 'Bạn đang thăng cấp tài khoản này lên SUPER_ADMIN với toàn quyền kiểm soát hệ thống.'
                    : 'Bạn đang hạ cấp một tài khoản SUPER_ADMIN. Hệ thống sẽ tự động ngăn chặn nếu đây là Super Admin khả dụng duy nhất.'}
                </div>
              </div>
            )}

            <form onSubmit={handleModalSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Vai Trò Áp Dụng Mới:
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Quản trị Tối Cao Nền Tảng)</option>
                  <option value="ADMIN">ADMIN (Quản trị Vận Hành Nền Tảng)</option>
                  <option value="SME_OWNER">SME_OWNER (Chủ Doanh Nghiệp Khách Hàng)</option>
                  <option value="DEVOPS">DEVOPS (Kỹ Sư Vận Hành Hạ Tầng)</option>
                  <option value="VIEWER">VIEWER (Người Dùng Chỉ Xem)</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Lý Do / Căn Cứ Bổ Nhiệm (Bắt buộc lưu Audit Log):
                </label>
                <textarea
                  rows={3}
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="Nhập căn cứ nghiệp vụ điều chuyển vai trò..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsRoleModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isSubmitting ? '#9CA3AF' : '#059669',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isSubmitting && <RefreshCw size={14} className="animate-spin" />}
                  <span>{isSubmitting ? 'Đang Lưu...' : 'Lưu & Áp Dụng Ngay'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Chi Tiết Người Dùng (An toàn bảo mật) */}
      {isDetailModalOpen && detailUser && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} color="#059669" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Hồ Sơ & Thẩm Quyền Tài Khoản
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dash-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8125rem' }}>
              <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>MÃ ĐỊNH DANH HỆ THỐNG (USER ID)</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                  {detailUser.id}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>HỌ VÀ TÊN</div>
                  <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{detailUser.name}</div>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>TRẠNG THÁI</div>
                  <div style={{ fontWeight: 700, color: detailUser.status === 'ACTIVE' ? '#059669' : '#DC2626' }}>
                    {detailUser.status}
                  </div>
                </div>
              </div>

              <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>ĐỊA CHỈ EMAIL</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                  {detailUser.email}
                </div>
              </div>

              <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>TỔ CHỨC / CÔNG TY TRỰC THUỘC</div>
                <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{detailUser.org}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>VAI TRÒ HIỆN HÀNH</div>
                  <div style={{ fontWeight: 800, color: getRoleBadgeStyle(detailUser.currentRole).color }}>
                    {detailUser.currentRole}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>HOẠT ĐỘNG GẦN NHẤT</div>
                  <div style={{ fontWeight: 500, color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                    {detailUser.lastActive}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
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
    </div>
  );
};

export default AdminRolesPage;
