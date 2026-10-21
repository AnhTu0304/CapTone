import React from 'react';
import { ChevronRight, Shield } from 'lucide-react';

const PATH_NAME_MAP = {
  admin: 'Bảng Điều Khiển',
  overview: 'Dashboard Tổng Quan',
  analytics: 'Báo Cáo & Thống Kê',
  roles: 'Vai Trò & Phân Quyền',
  companies: 'Quản Lý Doanh Nghiệp',
  organizations: 'Quản Lý Doanh Nghiệp',
  users: 'Quản Lý Người Dùng',
  agents: 'Quản Lý Tác Tử',
  clusters: 'Tổng Quan Cụm K8s',
  ai: 'Động Cơ AI',
  models: 'Quản Trị Mô Hình AI',
  comparison: 'Đánh Giá & So Sánh Mô Hình AI',
  predictions: 'Lịch Sử Dự Báo AI',
  monitoring: 'Giám Sát Hệ Thống',
  alerts: 'Sự Cố & Cảnh Báo',
  incidents: 'Sự Cố & Cảnh Báo',
  'system-logs': 'Nhật Ký Hệ Thống',
  'audit-logs': 'Nhật Ký Kiểm Toán',
  activity: 'Hoạt Động Người Dùng',
  settings: 'Cài Đặt Hệ Thống',
  notifications: 'Phát Thông Báo Toàn Mạng',
  profile: 'Hồ Sơ Quản Trị Viên',
};

export const AdminBreadcrumb = ({ items, currentPath = '/admin', onNavigate }) => {
  // If custom items are passed, use them; otherwise parse from currentPath
  const breadcrumbItems = items || (() => {
    const cleaned = currentPath.split('?')[0].split('#')[0];
    const segments = cleaned.split('/').filter(Boolean);

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'admin')) {
      return [{ label: 'Bàn Điều Khiển Quản Trị', path: '/admin', isLast: true }];
    }

    let accPath = '';
    return segments.map((seg, idx) => {
      accPath += `/${seg}`;
      const isLast = idx === segments.length - 1;
      const label = PATH_NAME_MAP[seg] || (seg.charAt(0).toUpperCase() + seg.slice(1));
      return {
        label,
        path: accPath,
        isLast,
      };
    });
  })();

  const handleClick = (e, path, isLast) => {
    if (isLast) return;
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <nav
      aria-label="Thanh điều hướng phân cấp Admin"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.8125rem',
        color: 'var(--dash-text-muted)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--dash-primary)',
          fontWeight: 700,
        }}
      >
        <Shield size={14} color="var(--dash-primary)" />
        <span style={{ fontSize: '0.75rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          ADMIN
        </span>
      </div>

      <ChevronRight size={13} color="#94A3B8" />

      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={item.path || index}>
          {index > 0 && <ChevronRight size={13} color="#94A3B8" />}
          {item.isLast ? (
            <span
              style={{
                color: 'var(--dash-text-primary)',
                fontWeight: 600,
                cursor: 'default',
              }}
              aria-current="page"
            >
              {item.label}
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => handleClick(e, item.path, false)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--dash-text-secondary)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dash-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dash-text-secondary)')}
            >
              {item.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default AdminBreadcrumb;
