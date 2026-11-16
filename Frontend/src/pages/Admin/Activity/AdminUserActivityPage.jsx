import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ChevronDown,
  Activity,
} from 'lucide-react';
import {
  getUserActivities,
  getUserActivityStats,
} from '../../../services/adminAuditLogsService';
import { AdminTablePagination } from '../../../components/admin/common';

// Helper lấy chuỗi ngày tháng năm theo giờ địa phương
const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getThisMonthStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const getThisYearStr = () => {
  return String(new Date().getFullYear());
};

export const AdminUserActivityPage = ({ onNavigate }) => {
  // Data state
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter & Pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Time Filter States (Mặc định là 'today' - ngày hôm nay theo yêu cầu)
  const [timeFilterMode, setTimeFilterMode] = useState('today'); // 'today' | 'date' | 'month' | 'year'
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedMonth, setSelectedMonth] = useState(() => getThisMonthStr());
  const [selectedYear, setSelectedYear] = useState(() => getThisYearStr());

  // Trạng thái mở Popover Lịch
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef(null);

  // Đóng Popover Lịch khi bấm ra ngoài
  useEffect(() => {
    const handleClickOutsideCalendar = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutsideCalendar);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideCalendar);
    };
  }, [isCalendarOpen]);

  // Nhãn hiển thị trực quan trên nút Lịch
  const currentFilterLabel = useMemo(() => {
    if (timeFilterMode === 'today') {
      const parts = getTodayStr().split('-');
      return `Hôm nay (${parts[2]}/${parts[1]}/${parts[0]})`;
    }
    if (timeFilterMode === 'date') {
      if (!selectedDate) return 'Chọn ngày';
      const parts = selectedDate.split('-');
      const isToday = selectedDate === getTodayStr();
      return isToday ? `Hôm nay (${parts[2]}/${parts[1]}/${parts[0]})` : `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'month') {
      if (!selectedMonth) return 'Chọn tháng';
      const parts = selectedMonth.split('-');
      return `Tháng ${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'year') {
      return `Năm ${selectedYear}`;
    }
    const parts = getTodayStr().split('-');
    return `Hôm nay (${parts[2]}/${parts[1]}/${parts[0]})`;
  }, [timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  // Danh sách các năm khảo sát
  const availableYears = useMemo(() => {
    const currentY = Number(getThisYearStr());
    const years = new Set([String(currentY), String(currentY - 1), '2026', '2025']);
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, []);

  // Danh sách các ngày gần đây để chọn nhanh trong tab Ngày
  const recentActiveDays = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      days.push(`${yr}-${mo}-${dy}`);
    }
    return days;
  }, []);

  // Load KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const filters = {
        timeFilterMode,
        selectedDate,
        selectedMonth,
        selectedYear,
      };
      const data = await getUserActivityStats(filters);
      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.warn('Lỗi khi tải thống kê hoạt động người dùng:', err);
    }
  }, [timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  // Load Activities list
  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters = {
        timeFilterMode,
        selectedDate,
        selectedMonth,
        selectedYear,
      };
      if (searchTerm.trim()) {
        filters.search = searchTerm.trim();
      }
      if (actionFilter !== 'ALL') {
        filters.action = actionFilter;
      }

      const res = await getUserActivities(filters, { page, pageSize });
      if (res && Array.isArray(res.data)) {
        setActivities(res.data);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || Math.max(1, Math.ceil((res.total || 0) / pageSize)));
      } else {
        setActivities([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Lỗi khi tải nhật ký hoạt động người dùng:', err);
      setError(err.message || 'Không thể tải nhật ký hoạt động. Vui lòng thử lại.');
      setActivities([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchTerm, actionFilter, timeFilterMode, selectedDate, selectedMonth, selectedYear, page, pageSize]);

  // Initial load and filter change
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStats(), fetchActivities()]);
  };

  // Reset to page 1 when changing search or filter
  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setPage(1);
  };

  const handleActionFilterChange = (val) => {
    setActionFilter(val);
    setPage(1);
  };

  const handleRiskFilterChange = (val) => {
    setRiskFilter(val);
    setPage(1);
  };

  const handlePageSizeChange = (val) => {
    setPageSize(Number(val));
    setPage(1);
  };

  // Client-side risk filtering if specified
  const filteredActivities = useMemo(() => {
    if (riskFilter === 'ALL') return activities;
    return activities.filter((act) => act.riskLevel === riskFilter);
  }, [activities, riskFilter]);

  // Render Action Badge
  const renderActionBadge = (action, label) => {
    const act = String(action || '').toUpperCase();

    if (act === 'LOGIN' || act === 'AUTH_LOGIN_SUCCESS') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #A7F3D0' }}>
          <LogIn size={12} />
          <span>{label || 'Đăng nhập thành công'}</span>
        </span>
      );
    }

    if (act === 'LOGOUT' || act === 'AUTH_LOGOUT') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#F1F5F9', color: '#475569', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #E2E8F0' }}>
          <LogOut size={12} />
          <span>{label || 'Đăng xuất'}</span>
        </span>
      );
    }

    if (act === 'LOCK_USER' || act === 'ACCOUNT_LOCKED') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #FECACA' }}>
          <Lock size={12} />
          <span>{label || 'Khóa tài khoản'}</span>
        </span>
      );
    }

    if (act === 'UNLOCK_USER') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #A7F3D0' }}>
          <Unlock size={12} />
          <span>{label || 'Mở khóa tài khoản'}</span>
        </span>
      );
    }

    if (act === 'PASSWORD_RESET') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #BFDBFE' }}>
          <KeyRound size={12} />
          <span>{label || 'Khôi phục mật khẩu'}</span>
        </span>
      );
    }

    if (act.includes('ROLE')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#F5F3FF', color: '#7C3AED', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #DDD6FE' }}>
          <ShieldCheck size={12} />
          <span>{label || 'Thay đổi vai trò'}</span>
        </span>
      );
    }

    if (act.includes('DENIED') || act === 'AUTH_LOGIN_FAILURE' || act.includes('SUSPICIOUS')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #F87171' }}>
          <ShieldAlert size={12} />
          <span>{label || 'Từ chối / Thất bại'}</span>
        </span>
      );
    }

    if (act.includes('SESSION') || act.includes('TOKEN')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FFFBEB', color: '#D97706', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #FDE68A' }}>
          <RefreshCw size={12} />
          <span>{label || 'Thu hồi / Xoay token'}</span>
        </span>
      );
    }

    if (act.includes('HITL')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#F0FDF4', color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={12} />
          <span>{label || 'Phê duyệt HITL'}</span>
        </span>
      );
    }

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#F8FAFC', color: '#334155', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #CBD5E1' }}>
        <span>{label || act}</span>
      </span>
    );
  };

  // Render Risk Level Badge
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

  // Tính toán số liệu KPI hiển thị từ dữ liệu thật
  const loginSuccessRate = stats && stats.totalLogins > 0
    ? ((stats.successLogins / stats.totalLogins) * 100).toFixed(1)
    : '100.0';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 10px rgba(5, 150, 105, 0.25)',
              flexShrink: 0,
            }}
          >
            <Activity size={24} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Theo Dõi Hoạt Động Người Dùng
            </h1>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--dash-text-secondary)',
                margin: '4px 0 0 0',
              }}
            >
              Lịch sử đăng nhập, đăng xuất, thay đổi vai trò, khóa tài khoản và phát hiện các lần đăng nhập thất bại.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
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
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
              transition: 'background-color 0.15s ease',
            }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing || isLoading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Bar (Dữ liệu thật từ DB) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Lượt Đăng Nhập */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--dash-border)', boxShadow: 'var(--dash-shadow-xs)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>LƯỢT ĐĂNG NHẬP TÀI KHOẢN</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
            {stats ? stats.totalLogins.toLocaleString('vi-VN') : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
            {stats && stats.totalLogins > 0
              ? `${loginSuccessRate}% Thành công (${stats.successLogins}/${stats.totalLogins})`
              : '0 lượt đăng nhập trong khoảng thời gian này'}
          </div>
        </div>

        {/* Card 2: Người Dùng Hoạt Động */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--dash-border)', boxShadow: 'var(--dash-shadow-xs)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>NGƯỜI DÙNG KÍCH HOẠT (ACTIVE)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
            {stats ? stats.activeUsersCount.toLocaleString('vi-VN') : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
            {stats && typeof stats.totalActiveUsers === 'number'
              ? `${stats.activeUsersCount} tài khoản hoạt động / ${stats.totalActiveUsers} trong CSDL`
              : 'Tài khoản sẵn sàng hoạt động trong CSDL'}
          </div>
        </div>

        {/* Card 3: Đăng Nhập Thất Bại / Cảnh Báo */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--dash-border)', boxShadow: 'var(--dash-shadow-xs)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>ĐĂNG NHẬP THẤT BÀI / CẢNH BÁO</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {stats ? stats.securityAlerts.toLocaleString('vi-VN') : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: stats && stats.securityAlerts > 0 ? '#DC2626' : 'var(--dash-text-muted)', fontWeight: 600, marginTop: '4px' }}>
            {stats && stats.securityAlerts > 0 ? 'Sai mật khẩu hoặc vi phạm chính sách bảo mật' : 'Không có cảnh báo bảo mật trong kỳ'}
          </div>
        </div>

        {/* Card 4: Thao Tác Quản Trị Tài Khoản */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--dash-border)', boxShadow: 'var(--dash-shadow-xs)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>THAO TÁC QUẢN TRỊ TÀI KHOẢN</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>
            {stats ? stats.adminActions.toLocaleString('vi-VN') : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
            {stats && stats.adminActions > 0
              ? `${stats.adminActions} thao tác phân vai trò & bảo mật trong kỳ`
              : 'Không có thao tác quản trị trong kỳ'}
          </div>
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
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dash-text-muted)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
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
              boxSizing: 'border-box',
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-muted)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Component Bộ Lọc Thời Gian Chuẩn */}
          <div style={{ position: 'relative' }} ref={calendarRef}>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              style={{
                height: '38px',
                padding: '0 12px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: isCalendarOpen ? '1px solid #10B981' : '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: isCalendarOpen ? '0 0 0 2px rgba(16, 185, 129, 0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="Mở bảng lịch chọn ngày, tháng hoặc năm"
            >
              <Calendar size={15} color="#64748B" />
              <span>{currentFilterLabel}</span>
              <ChevronDown size={14} color="#64748B" />
            </button>

            {/* Cửa Sổ Popover Lịch Đa Chế Độ */}
            {isCalendarOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '44px',
                  left: '0',
                  zIndex: 100,
                  width: '330px',
                  maxWidth: 'calc(100vw - 32px)',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Tabs Chế Độ: Ngày | Tháng | Năm */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTimeFilterMode('date');
                      setPage(1);
                    }}
                    style={{
                      padding: '6px 2px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: timeFilterMode === 'date' || timeFilterMode === 'today' ? '#FFFFFF' : 'transparent',
                      color: timeFilterMode === 'date' || timeFilterMode === 'today' ? '#0F172A' : '#64748B',
                      boxShadow: timeFilterMode === 'date' || timeFilterMode === 'today' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    📅 Ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimeFilterMode('month');
                      setPage(1);
                    }}
                    style={{
                      padding: '6px 2px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: timeFilterMode === 'month' ? '#FFFFFF' : 'transparent',
                      color: timeFilterMode === 'month' ? '#0F172A' : '#64748B',
                      boxShadow: timeFilterMode === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    🗓️ Tháng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimeFilterMode('year');
                      setPage(1);
                    }}
                    style={{
                      padding: '6px 2px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: timeFilterMode === 'year' ? '#FFFFFF' : 'transparent',
                      color: timeFilterMode === 'year' ? '#0F172A' : '#64748B',
                      boxShadow: timeFilterMode === 'year' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    📆 Năm
                  </button>
                </div>

                {/* Tab Body: CHỌN NGÀY */}
                {(timeFilterMode === 'date' || timeFilterMode === 'today') && (
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                      Chọn ngày cụ thể:
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setTimeFilterMode('date');
                        setPage(1);
                      }}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 10px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />

                    {/* Quick presets for recent days */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                        Ngày có sự cố gần đây:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {recentActiveDays.map((dStr) => {
                          const dParts = dStr.split('-');
                          const isToday = dStr === getTodayStr();
                          const isSelected = (timeFilterMode === 'today' && isToday) || (timeFilterMode === 'date' && selectedDate === dStr);
                          return (
                            <button
                              key={dStr}
                              type="button"
                              onClick={() => {
                                if (isToday) {
                                  setTimeFilterMode('today');
                                } else {
                                  setTimeFilterMode('date');
                                }
                                setSelectedDate(dStr);
                                setPage(1);
                                setIsCalendarOpen(false);
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.6875rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '4px',
                                border: isSelected ? '1px solid #10B981' : '1px solid #E2E8F0',
                                backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC',
                                color: isSelected ? '#047857' : '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              {isToday ? `Hôm nay (${dParts[2]}/${dParts[1]})` : `${dParts[2]}/${dParts[1]}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Body: CHỌN THÁNG */}
                {timeFilterMode === 'month' && (
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                      Chọn tháng & năm:
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        setPage(1);
                      }}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 10px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginBottom: '10px',
                      }}
                    />

                    {/* 12 Months grid */}
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                      Các tháng trong năm {selectedMonth?.split('-')[0] || getThisYearStr()}:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mNum) => {
                        const mStr = `${selectedMonth?.split('-')[0] || getThisYearStr()}-${String(mNum).padStart(2, '0')}`;
                        const isSelected = selectedMonth === mStr;
                        return (
                          <button
                            key={mNum}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(mStr);
                              setPage(1);
                              setIsCalendarOpen(false);
                            }}
                            style={{
                              padding: '6px 2px',
                              fontSize: '0.6875rem',
                              fontWeight: isSelected ? 700 : 500,
                              borderRadius: '4px',
                              border: isSelected ? '1px solid #2563EB' : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFC',
                              color: isSelected ? '#1D4ED8' : '#334155',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            Tháng {mNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab Body: CHỌN NĂM */}
                {timeFilterMode === 'year' && (
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      Chọn năm khảo sát:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {availableYears.map((yr) => {
                        const isSelected = selectedYear === yr;
                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => {
                              setSelectedYear(yr);
                              setPage(1);
                              setIsCalendarOpen(false);
                            }}
                            style={{
                              padding: '10px 4px',
                              fontSize: '0.8125rem',
                              fontWeight: isSelected ? 700 : 600,
                              borderRadius: '6px',
                              border: isSelected ? '1px solid #7C3AED' : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? '#F5F3FF' : '#F8FAFC',
                              color: isSelected ? '#6D28D9' : '#334155',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            Năm {yr}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Popover Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #F1F5F9', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTimeFilterMode('today');
                      setSelectedDate(getTodayStr());
                      setPage(1);
                      setIsCalendarOpen(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.7rem',
                      color: '#10B981',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Về hôm nay
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: '#0F172A',
                      color: '#FFFFFF',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}
          </div>

          <select
            value={actionFilter}
            onChange={(e) => handleActionFilterChange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--dash-text-primary)',
            }}
          >
            <option value="ALL">Tất cả hành động</option>
            <option value="AUTH_LOGIN_SUCCESS">Đăng nhập thành công</option>
            <option value="AUTH_LOGIN_FAILURE">Đăng nhập thất bại</option>
            <option value="AUTH_LOGOUT">Đăng xuất</option>
            <option value="TOKEN_ROTATED">Xoay token phiên</option>
            <option value="ROLE">Đổi vai trò tài khoản</option>
            <option value="PASSWORD">Khôi phục mật khẩu</option>
            <option value="LOCK">Khóa / Mở khóa tài khoản</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => handleRiskFilterChange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--dash-text-primary)',
            }}
          >
            <option value="ALL">Mọi mức độ rủi ro</option>
            <option value="LOW">Bình thường</option>
            <option value="MEDIUM">Cần chú ý</option>
            <option value="HIGH">Nguy hiểm</option>
          </select>
        </div>
      </div>

      {/* 4. Error Alert if any */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.8125rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 5. Main Activity Table */}
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
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px auto', display: 'block' }} />
                    <span>Đang nạp dữ liệu hoạt động người dùng thực tế...</span>
                  </td>
                </tr>
              ) : filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    Không tìm thấy hoạt động nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((act) => (
                  <tr
                    key={act.rawId || act.id}
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
                        {act.location} &bull; {act.device ? act.device.split('/')[0].trim() : 'Web Client'}
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

        {/* 6. Pagination Footer Bar */}
        <AdminTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          itemLabel="hoạt động"
          pageSizeOptions={[10, 20, 50, 100]}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

AdminUserActivityPage.propTypes = {
  onNavigate: PropTypes.func,
};

export default AdminUserActivityPage;
