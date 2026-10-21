import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  Shield,
  UserCheck,
  Info,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export const AdminRolesPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState('');

  // Mock users with roles for quick assignment
  const [userList, setUserList] = useState([
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
      email: 'tran.kiemdinh@acme.com',
      currentRole: 'ADMIN',
      org: 'Acme Corporation',
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
  ]);

  const handleRoleChange = (userId, newRole) => {
    setUserList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return { ...u, currentRole: newRole };
        }
        return u;
      })
    );
    setToastMessage(`Đã cập nhật vai trò của tài khoản sang ${newRole} thành công!`);
    setTimeout(() => setToastMessage(''), 3500);
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

      {/* 2. Hierarchy Explainer Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <KeyRound size={18} color="#059669" />
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Nguyên Tắc Kế Thừa Phân Cấp Vai Trò (Role Hierarchy)
          </h3>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
          Hệ thống áp dụng mô hình phân cấp nghiêm ngặt. Vai trò cấp cao tự động kế thừa 100% tất cả các quyền của các cấp thấp hơn:
        </p>

        {/* Visual Hierarchy Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontWeight: 800, fontSize: '0.75rem' }}>
            SUPER_ADMIN (Tối Cao)
          </span>
          <span style={{ color: 'var(--dash-text-muted)', fontWeight: 700 }}>&gt;</span>
          <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#FEFCE8', border: '1px solid #FDE68A', color: '#D97706', fontWeight: 700, fontSize: '0.75rem' }}>
            ADMIN (Vận Hành)
          </span>
          <span style={{ color: 'var(--dash-text-muted)', fontWeight: 700 }}>&gt;</span>
          <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', fontWeight: 700, fontSize: '0.75rem' }}>
            SME_OWNER (Chủ DN)
          </span>
          <span style={{ color: 'var(--dash-text-muted)', fontWeight: 700 }}>&gt;</span>
          <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontWeight: 600, fontSize: '0.75rem' }}>
            DEVOPS (Kỹ Sư)
          </span>
          <span style={{ color: 'var(--dash-text-muted)', fontWeight: 700 }}>&gt;</span>
          <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', color: '#64748B', fontWeight: 500, fontSize: '0.75rem' }}>
            VIEWER (Chỉ Xem)
          </span>
        </div>
      </div>

      {/* 3. User Role Assignment Table */}
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
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--dash-text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
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

            {/* Filter by Role */}
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
              {filteredUsers.map((u) => (
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
                        backgroundColor:
                          u.currentRole === 'SUPER_ADMIN'
                            ? '#FEF2F2'
                            : u.currentRole === 'ADMIN'
                            ? '#FEFCE8'
                            : u.currentRole === 'SME_OWNER'
                            ? '#ECFDF5'
                            : '#EFF6FF',
                        color:
                          u.currentRole === 'SUPER_ADMIN'
                            ? '#DC2626'
                            : u.currentRole === 'ADMIN'
                            ? '#D97706'
                            : u.currentRole === 'SME_OWNER'
                            ? '#059669'
                            : '#1D4ED8',
                        border: `1px solid ${
                          u.currentRole === 'SUPER_ADMIN'
                            ? '#FECACA'
                            : u.currentRole === 'ADMIN'
                            ? '#FDE68A'
                            : u.currentRole === 'SME_OWNER'
                            ? '#A7F3D0'
                            : '#BFDBFE'
                        }`,
                      }}
                    >
                      {u.currentRole}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>
                    {u.lastActive}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRolesPage;
