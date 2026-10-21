import React, { useState, useMemo } from 'react';
import {
  Search,
      Lock,
  Unlock,
  KeyRound,
  LogOut,
  LogIn,
    ShieldCheck,
  ShieldAlert,
    RefreshCw,
    X,
  } from 'lucide-react';

const MOCK_USER_ACTIVITIES = [
  {
    id: 'ACT-901',
    timestamp: '22/10/2026 00:48:15',
    userName: 'Phạm Thái Sang',
    userEmail: 'phamthaisang1710@gmail.com',
    action: 'LOGIN',
    actionLabel: 'Đăng nhập thành công',
    ipAddress: '113.161.72.45',
    device: 'Chrome 129 / Windows 11',
    location: 'TP. Hồ Chí Minh, VN',
    riskLevel: 'LOW',
    details: 'Đăng nhập bằng mật khẩu & đã xác minh email',
  },
  {
    id: 'ACT-902',
    timestamp: '21/10/2026 23:35:10',
    userName: 'Lê Hoàng Nam',
    userEmail: 'nam.le@vngfin.vn',
    action: 'SUSPICIOUS_LOGIN',
    actionLabel: 'Đăng nhập bất thường',
    ipAddress: '45.134.22.10',
    device: 'Firefox 118 / Linux Ubuntu',
    location: 'Frankfurt, Đức',
    riskLevel: 'HIGH',
    details: 'Phát hiện vị trí IP cách xa vị trí thường lệ (>9,000km trong 30 phút)',
  },
  {
    id: 'ACT-903',
    timestamp: '21/10/2026 22:15:00',
    userName: 'Trần Minh Tuấn',
    userEmail: 'tuan.tm@tiki.vn',
    action: 'ROLE_CHANGE',
    actionLabel: 'Thay đổi vai trò',
    ipAddress: '14.162.88.19',
    device: 'Edge 128 / Windows 10',
    location: 'Hà Nội, VN',
    riskLevel: 'MEDIUM',
    details: 'Gán vai trò SME_OWNER cho công ty Tiki Supply Chain AI',
  },
  {
    id: 'ACT-904',
    timestamp: '21/10/2026 21:05:40',
    userName: 'Đỗ Quốc Bảo',
    userEmail: 'bao.do@suncloud.io',
    action: 'LOCK_USER',
    actionLabel: 'Khóa tài khoản',
    ipAddress: '118.69.12.80',
    device: 'Chrome 129 / macOS Sonoma',
    location: 'Đà Nẵng, VN',
    riskLevel: 'MEDIUM',
    details: 'Khóa tài khoản do vi phạm điều khoản quy chế bảo mật',
  },
  {
    id: 'ACT-905',
    timestamp: '21/10/2026 19:40:22',
    userName: 'Phạm Thu Hằng',
    userEmail: 'hangpt@viettel.com.vn',
    action: 'PASSWORD_RESET',
    actionLabel: 'Khôi phục mật khẩu',
    ipAddress: '125.235.4.11',
    device: 'Chrome Mobile / iOS 17.5',
    location: 'Hà Nội, VN',
    riskLevel: 'LOW',
    details: 'Yêu cầu đặt lại mật khẩu tạm thời thành công',
  },
  {
    id: 'ACT-906',
    timestamp: '21/10/2026 18:20:15',
    userName: 'Ngô Thanh Sơn',
    userEmail: 'son.ngo@greenagro.vn',
    action: 'LOGOUT',
    actionLabel: 'Đăng xuất chủ động',
    ipAddress: '171.244.10.5',
    device: 'Chrome 128 / Windows 11',
    location: 'Cần Thơ, VN',
    riskLevel: 'LOW',
    details: 'Người dùng nhấn Đăng xuất kết thúc phiên làm việc',
  },
  {
    id: 'ACT-907',
    timestamp: '21/10/2026 16:55:00',
    userName: 'Hoàng Anh Dũng',
    userEmail: 'dung.ha@finflow.io',
    action: 'REVOKE_SESSION',
    actionLabel: 'Thu hồi phiên đăng nhập',
    ipAddress: '27.72.85.100',
    device: 'Safari / macOS',
    location: 'TP. Hồ Chí Minh, VN',
    riskLevel: 'MEDIUM',
    details: 'Admin đã thu hồi token phiên làm việc do phát hiện rủi ro',
  },
  {
    id: 'ACT-908',
    timestamp: '21/10/2026 15:10:30',
    userName: 'Vũ Hải Đăng',
    userEmail: 'dang.vh@techhub.vn',
    action: 'UNLOCK_USER',
    actionLabel: 'Mở khóa tài khoản',
    ipAddress: '113.161.72.45',
    device: 'Chrome 129 / Windows 11',
    location: 'TP. Hồ Chí Minh, VN',
    riskLevel: 'LOW',
    details: 'Đã hoàn tất xác minh danh tính và mở khóa tài khoản',
  },
];

export const AdminUserActivityPage = ({ onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const filteredActivities = useMemo(() => {
    return MOCK_USER_ACTIVITIES.filter((act) => {
      const matchSearch =
        act.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        act.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        act.ipAddress.includes(searchTerm) ||
        act.details.toLowerCase().includes(searchTerm.toLowerCase());

      const matchAction = actionFilter === 'ALL' || act.action === actionFilter;
      const matchRisk = riskFilter === 'ALL' || act.riskLevel === riskFilter;

      return matchSearch && matchAction && matchRisk;
    });
  }, [searchTerm, actionFilter, riskFilter]);

  const renderActionBadge = (action, label) => {
    switch (action) {
      case 'LOGIN':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #A7F3D0' }}>
            <LogIn size={12} />
            <span>{label}</span>
          </span>
        );
      case 'LOGOUT':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#F1F5F9', color: '#475569', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #E2E8F0' }}>
            <LogOut size={12} />
            <span>{label}</span>
          </span>
        );
      case 'LOCK_USER':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #FECACA' }}>
            <Lock size={12} />
            <span>{label}</span>
          </span>
        );
      case 'UNLOCK_USER':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #A7F3D0' }}>
            <Unlock size={12} />
            <span>{label}</span>
          </span>
        );
      case 'PASSWORD_RESET':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #BFDBFE' }}>
            <KeyRound size={12} />
            <span>{label}</span>
          </span>
        );
      case 'ROLE_CHANGE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#F5F3FF', color: '#7C3AED', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #DDD6FE' }}>
            <ShieldCheck size={12} />
            <span>{label}</span>
          </span>
        );
      case 'SUSPICIOUS_LOGIN':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #F87171' }}>
            <ShieldAlert size={12} />
            <span>{label}</span>
          </span>
        );
      case 'REVOKE_SESSION':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FFFBEB', color: '#D97706', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #FDE68A' }}>
            <LogOut size={12} />
            <span>{label}</span>
          </span>
        );
      default:
        return <span>{label}</span>;
    }
  };

  const renderRiskBadge = (risk) => {
    if (risk === 'HIGH') {
      return (
        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #FECACA' }}>
          Nguy hiểm
        </span>
      );
    }
    if (risk === 'MEDIUM') {
      return (
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#D97706', backgroundColor: '#FEFCE8', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #FEF08A' }}>
          Chú ý
        </span>
      );
    }
    return (
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #A7F3D0' }}>
        Bình thường
      </span>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '40px',
      }}
    >
      {/* 1. Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              User Activity – Theo Dõi Hoạt Động Người Dùng
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                border: '1px solid #A7F3D0',
              }}
            >
              Real-time Logs
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', margin: '6px 0 0 0' }}>
            Lịch sử đăng nhập, thay đổi vai trò, khóa tài khoản và phát hiện các dấu hiệu đăng nhập bất thường.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--dash-border)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>LƯỢT ĐĂNG NHẬP HÔM NAY</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>1,248</div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '4px' }}>99.2% Thành công</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--dash-border)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>NGƯỜI DÙNG HOẠT ĐỘNG GẦN NHẤT</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>342</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>Trong vòng 15 phút qua</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--dash-border)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>CẢNH BÁO BẤT THƯỜNG</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>1</div>
          <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600, marginTop: '4px' }}>Phát hiện IP nước ngoài</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--dash-border)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>THAO TÁC QUẢN TRỊ ADMIN</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>18</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>Khóa, đổi vai trò, đổi MK</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          padding: '14px 18px',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
        }}
      >
        <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dash-text-muted)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Tên người dùng, Email, IP hoặc chi tiết hành động..."
            style={{
              width: '100%',
              padding: '9px 36px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#F8FAFC',
              fontSize: '0.8125rem',
              color: 'var(--dash-text-primary)',
              outline: 'none',
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-muted)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Tất cả hành động</option>
            <option value="LOGIN">Đăng nhập</option>
            <option value="LOGOUT">Đăng xuất</option>
            <option value="ROLE_CHANGE">Đổi vai trò</option>
            <option value="LOCK_USER">Khóa tài khoản</option>
            <option value="UNLOCK_USER">Mở khóa tài khoản</option>
            <option value="PASSWORD_RESET">Đổi mật khẩu</option>
            <option value="REVOKE_SESSION">Thu hồi phiên</option>
            <option value="SUSPICIOUS_LOGIN">Bất thường</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Mọi mức độ rủi ro</option>
            <option value="LOW">Bình thường</option>
            <option value="MEDIUM">Cần chú ý</option>
            <option value="HIGH">Nguy hiểm</option>
          </select>
        </div>
      </div>

      {/* 4. Main Activity Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          overflow: 'hidden',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: '#F8FAFC',
                  borderBottom: '1px solid var(--dash-border)',
                  color: 'var(--dash-text-muted)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '14px 20px', minWidth: '160px' }}>Thời Gian</th>
                <th style={{ padding: '14px 16px', minWidth: '220px' }}>Người Dùng</th>
                <th style={{ padding: '14px 16px', minWidth: '180px' }}>Hành Động</th>
                <th style={{ padding: '14px 16px', minWidth: '180px' }}>IP & Vị Trí</th>
                <th style={{ padding: '14px 16px', minWidth: '110px' }}>Mức Độ</th>
                <th style={{ padding: '14px 20px', minWidth: '260px' }}>Chi Tiết & Bối Cảnh</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    Không tìm thấy hoạt động nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((act) => (
                  <tr
                    key={act.id}
                    style={{ borderBottom: '1px solid var(--dash-border)', transition: 'background-color 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '14px 20px', color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      {act.timestamp}
                    </td>

                    {/* User */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{act.userName}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{act.userEmail}</div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px' }}>
                      {renderActionBadge(act.action, act.actionLabel)}
                    </td>

                    {/* IP & Location */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                        {act.ipAddress}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                        {act.location} &bull; {act.device.split('/')[0].trim()}
                      </div>
                    </td>

                    {/* Risk Level */}
                    <td style={{ padding: '14px 16px' }}>
                      {renderRiskBadge(act.riskLevel)}
                    </td>

                    {/* Details */}
                    <td style={{ padding: '14px 20px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {act.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUserActivityPage;
