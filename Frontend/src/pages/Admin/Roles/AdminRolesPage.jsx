import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

/**
 * Danh sách người dùng mẫu với đầy đủ các vai trò trong hệ thống RBAC
 */
const INITIAL_USERS = [
  {
    id: 'usr-01',
    name: 'Nguyen Van Admin',
    email: 'admin@selfheal.systems',
    currentRole: 'SUPER_ADMIN',
    org: 'Toàn Hệ Thống (Platform Root)',
    lastActive: 'Vừa xong',
  },
  {
    id: 'usr-02',
    name: 'Tran Kiem Dinh',
    email: 'tran.kiemdinh@selfheal.systems',
    currentRole: 'ADMIN',
    org: 'Platform Operations Lead',
    lastActive: '15 phút trước',
  },
  {
    id: 'usr-03',
    name: 'Le Thi Owner',
    email: 'le.owner@finflow.io',
    currentRole: 'SME_OWNER',
    org: 'FinFlow Pay',
    lastActive: '1 giờ trước',
  },
  {
    id: 'usr-04',
    name: 'Pham DevOps Lead',
    email: 'devops.lead@nexus.logistics',
    currentRole: 'DEVOPS',
    org: 'Nexus Logistics AI',
    lastActive: 'Hôm qua',
  },
  {
    id: 'usr-05',
    name: 'Hoang Viewer An Ninh',
    email: 'hoang.security@viettel.vn',
    currentRole: 'VIEWER',
    org: 'Viettel SME Cloud',
    lastActive: '3 ngày trước',
  },
  {
    id: 'usr-06',
    name: 'Vuong Minh Tam',
    email: 'tam.vuong@acme.com',
    currentRole: 'DEVOPS',
    org: 'Acme Corporation',
    lastActive: '4 ngày trước',
  },
];

/**
 * Ma trận phân quyền chi tiết cho toàn bộ các vai trò (Role Permissions Matrix)
 */
const PERMISSIONS_MATRIX = [
  {
    module: 'Quản Trị Toàn Nền Tảng & RBAC',
    apiPath: '/api/v1/roles/**',
    SUPER_ADMIN: 'Toàn quyền (Tạo, gán, thu hồi vai trò toàn sàn)',
    ADMIN: 'Xem danh sách, kiểm tra quyền hạn',
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
    module: 'Giám Sát & Cảnh Báo Thời Gian Thực (Monitoring & Alerts)',
    apiPath: '/api/v1/monitoring/**',
    SUPER_ADMIN: 'Toàn quyền cấu hình kênh cảnh báo & ngưỡng khẩn cấp',
    ADMIN: 'Giám sát trực tiếp thời gian thực, quản lý SLA',
    SME_OWNER: 'Nhận cảnh báo sự cố ảnh hưởng doanh nghiệp',
    DEVOPS: 'Tiếp nhận cảnh báo P0/P1, xử lý khắc phục tức thì',
    VIEWER: 'Xem bảng tổng quan giám sát',
  },
];

const INITIAL_ROLE_AUDIT_LOGS = [
  {
    id: 'aud-01',
    timestamp: '2026-10-21 23:45:10',
    actor: 'admin@selfheal.systems',
    target: 'tran.kiemdinh@selfheal.systems',
    action: 'CẬP NHẬT VAI TRÒ',
    oldRole: 'DEVOPS',
    newRole: 'ADMIN',
    reason: 'Bổ nhiệm Quản trị viên vận hành nền tảng',
  },
  {
    id: 'aud-02',
    timestamp: '2026-10-20 14:22:04',
    actor: 'admin@selfheal.systems',
    target: 'devops.lead@nexus.logistics',
    action: 'CẬP NHẬT VAI TRÒ',
    oldRole: 'VIEWER',
    newRole: 'DEVOPS',
    reason: 'Cấp quyền kỹ sư vận hành hạ tầng cụm Kubernetes',
  },
  {
    id: 'aud-03',
    timestamp: '2026-10-18 09:15:30',
    actor: 'admin@selfheal.systems',
    target: 'le.owner@finflow.io',
    action: 'CẬP NHẬT VAI TRÒ',
    oldRole: 'VIEWER',
    newRole: 'SME_OWNER',
    reason: 'Kích hoạt vai trò Chủ doanh nghiệp cho đối tác FinFlow Pay',
  },
  {
    id: 'aud-04',
    timestamp: '2026-10-15 11:08:22',
    actor: 'admin@selfheal.systems',
    target: 'tam.vuong@acme.com',
    action: 'CẬP NHẬT VAI TRÒ',
    oldRole: 'ADMIN',
    newRole: 'DEVOPS',
    reason: 'Điều chuyển phụ trách kỹ thuật cụm',
  },
];

const getRoleBadgeStyle = (role) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', label: 'SUPER_ADMIN (Tối Cao)' };
    case 'ADMIN':
      return { bg: '#FEFCE8', border: '#FDE68A', color: '#D97706', label: 'ADMIN (Vận Hành)' };
    case 'SME_OWNER':
      return { bg: '#ECFDF5', border: '#A7F3D0', color: '#059669', label: 'SME_OWNER (Chủ DN)' };
    case 'DEVOPS':
      return { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', label: 'DEVOPS (Kỹ Sư)' };
    case 'VIEWER':
      return { bg: '#F1F5F9', border: '#CBD5E1', color: '#64748B', label: 'VIEWER (Chỉ Xem)' };
    default:
      return { bg: '#F8FAFC', border: '#E2E8F0', color: '#475569', label: role };
  }
};

export const AdminRolesPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('assignment'); // 'assignment' | 'matrix' | 'audit'
  const [search, setSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState('');
  const [userList, setUserList] = useState(INITIAL_USERS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_ROLE_AUDIT_LOGS);

  // Modal gán vai trò chi tiết
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [targetRole, setTargetRole] = useState('ADMIN');
  const [assignReason, setAssignReason] = useState('');

  const handleRoleChange = (userId, newRole) => {
    const targetUserObj = userList.find((u) => u.id === userId);
    if (!targetUserObj) return;

    const oldRole = targetUserObj.currentRole;
    if (oldRole === newRole) return;

    setUserList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, currentRole: newRole } : u))
    );

    // Ghi nhận vào lịch sử thay đổi quyền hạn
    const newLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: user?.email || 'admin@selfheal.systems',
      target: targetUserObj.email,
      action: 'CẬP NHẬT VAI TRÒ',
      oldRole,
      newRole,
      reason: 'Thay đổi trực tiếp bởi Super Admin qua giao diện phân quyền',
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    setToastMessage(`Đã cập nhật vai trò của "${targetUserObj.email}" từ [${oldRole}] sang [${newRole}] thành công!`);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const openAssignModal = (u) => {
    setSelectedUser(u);
    setTargetRole(u.currentRole);
    setAssignReason('');
    setIsModalOpen(true);
  };

  const handleModalSubmit = (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    const oldRole = selectedUser.currentRole;
    if (oldRole !== targetRole) {
      setUserList((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, currentRole: targetRole } : u))
      );

      const newLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        actor: user?.email || 'admin@selfheal.systems',
        target: selectedUser.email,
        action: 'CẬP NHẬT VAI TRÒ',
        oldRole,
        newRole: targetRole,
        reason: assignReason.trim() || 'Cập nhật có căn cứ nghiệp vụ từ Super Admin',
      };
      setAuditLogs((prev) => [newLog, ...prev]);

      setToastMessage(`Đã phân bổ lại vai trò [${targetRole}] cho tài khoản "${selectedUser.email}"!`);
      setTimeout(() => setToastMessage(''), 3500);
    }

    setIsModalOpen(false);
  };

  const filteredUsers = userList.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.org.toLowerCase().includes(search.toLowerCase());
    const matchRole = selectedRoleFilter === 'ALL' || u.currentRole === selectedRoleFilter;
    return matchSearch && matchRole;
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
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                color: '#059669',
                fontSize: '0.6875rem',
                fontWeight: 700,
                border: '1px solid rgba(5, 150, 105, 0.25)',
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
      </div>

      {toastMessage && (
        <div
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
          <span>Gán Vai Trò Người Dùng ({userList.length})</span>
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
                Chọn vai trò từ danh sách để áp dụng quyền ngay lập tức
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

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>NGƯỜI DÙNG</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>TỔ CHỨC / CÔNG TY</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>VAI TRÒ HIỆN TẠI</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>HOẠT ĐỘNG GẦN NHẤT</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>THAY ĐỔI VAI TRÒ</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
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
                            onClick={() => openAssignModal(u)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--dash-border)',
                              backgroundColor: '#F8FAFC',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: 'var(--dash-text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            Chi tiết
                          </button>
                          <select
                            value={u.currentRole}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--dash-border)',
                              backgroundColor: '#FFFFFF',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--dash-text-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="SUPER_ADMIN">Phong SUPER_ADMIN</option>
                            <option value="ADMIN">Phong ADMIN</option>
                            <option value="SME_OWNER">Phong SME_OWNER</option>
                            <option value="DEVOPS">Phong DEVOPS</option>
                            <option value="VIEWER">Phong VIEWER</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Ma Trận Quyền Hạn Chi Tiết & Khả Năng Truy Cập (Full Permissions Matrix)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
              Quy chiếu thẩm quyền cho từng vai trò trên các phân hệ cốt lõi của nền tảng Self-Healing.
            </p>
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
              Ghi vết an toàn chống chối bỏ mọi thao tác nâng cấp/hạ cấp vai trò trên toàn hệ thống.
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                <th style={{ padding: '12px 20px', fontWeight: 700 }}>Thời Gian</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Người Thực Hiện (Actor)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Đối Tượng Nhận Quyền</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Chuyển Đổi Quyền</th>
                <th style={{ padding: '12px 20px', fontWeight: 700 }}>Lý Do / Căn Cứ Nghiệp Vụ</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => {
                const oldBadge = getRoleBadgeStyle(log.oldRole);
                const newBadge = getRoleBadgeStyle(log.newRole);
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <td style={{ padding: '12px 20px', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      {log.timestamp}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                      {log.actor}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#059669' }}>
                      {log.target}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: oldBadge.color, fontWeight: 700 }}>{log.oldRole}</span>
                      <span style={{ margin: '0 6px', color: 'var(--dash-text-muted)' }}>&rarr;</span>
                      <span style={{ color: newBadge.color, fontWeight: 800 }}>{log.newRole}</span>
                    </td>
                    <td style={{ padding: '12px 20px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {log.reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Cấp Quyền & Ghi Chú Căn Cứ */}
      {isModalOpen && selectedUser && (
        <div
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
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: '0 0 16px 0' }}>
              Điều Chỉnh Thẩm Quyền Phân Cấp
            </h3>

            <div style={{ marginBottom: '14px', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Tài khoản đối tượng</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>{selectedUser.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)' }}>{selectedUser.email}</div>
            </div>

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
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Quản trị Tối Cao)</option>
                  <option value="ADMIN">ADMIN (Quản trị Vận Hành Nền Tảng)</option>
                  <option value="SME_OWNER">SME_OWNER (Chủ Doanh Nghiệp Khách Hàng)</option>
                  <option value="DEVOPS">DEVOPS (Kỹ Sư Vận Hành Hạ Tầng)</option>
                  <option value="VIEWER">VIEWER (Người Dùng Chỉ Xem)</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Lý Do / Căn Cứ Bổ Nhiệm:
                </label>
                <textarea
                  rows={3}
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="Nhập lý do nâng/hạ cấp vai trò (sẽ lưu vào Audit Trail)..."
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
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#FFFFFF',
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
                  Lưu & Áp Dụng Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRolesPage;
