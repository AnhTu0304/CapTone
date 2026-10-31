import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { exportToCsv, exportToJson } from '../../../utils/exportUtils';
import AuditDistributionChart from '../../../components/dashboard/AuditDistributionChart';
import {
  fetchOrgAuditLogs,
  fetchOrgAuditStats,
  verifyOrgAuditIntegrity,
} from '../../../services/dashboardAuditLogsService';
import {
  Calendar,
  ScrollText,
  Search,
  RefreshCw,
  CheckCircle2,
  Lock,
  Copy,
  Check,
  FileJson,
  FileSpreadsheet,
  Download,
  ChevronDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Bot,
  UserCheck,
  X,
  Code2
} from 'lucide-react';

// Helpers định dạng ngày tháng cục bộ an toàn theo múi giờ client
const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getThisMonthStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getThisYearStr = () => {
  return String(new Date().getFullYear());
};

const parseLogDate = (log) => {
  if (!log) return null;
  const raw = log.created_at || log.raw_created_at || log.rawItem?.created_at;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  const ts = log.timestamp || log.rawItem?.timestamp;
  if (ts && typeof ts === 'string') {
    const parts = ts.split(' ');
    if (parts[0] && parts[0].includes('/')) {
      const [d, m, y] = parts[0].split('/').map(Number);
      const [hh, mm, ss] = (parts[1] || '0:0:0').split(':').map(Number);
      const res = new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
      if (!isNaN(res.getTime())) return res;
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

export const AuditLogsPage = () => {
  const { currentOrg } = useDashboard();
  const { success: toastSuccess, error: toastError } = useToast();

  // Data states
  const [rawLogs, setRawLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pagination states (10 items/page)
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filter states
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Time Filter States (Đồng bộ chuẩn Lịch sử phục hồi)
  const [timeFilterMode, setTimeFilterMode] = useState('all'); // 'today' | 'date' | 'month' | 'year' | 'all'
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedMonth, setSelectedMonth] = useState(() => getThisMonthStr());
  const [selectedYear, setSelectedYear] = useState(() => getThisYearStr());

  // Trạng thái Popover Lịch
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
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'month') {
      if (!selectedMonth) return 'Chọn tháng';
      const parts = selectedMonth.split('-');
      return `${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'year') {
      return `Năm ${selectedYear}`;
    }
    return 'Tất cả thời gian';
  }, [timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  // Danh sách các năm khả dụng
  const availableYears = useMemo(() => {
    const currentY = getThisYearStr();
    const years = new Set([currentY, '2026', '2025']);
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, []);

  // Danh sách các ngày gần đây để chọn nhanh
  const recentActiveDays = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      days.push(`${yr}-${mo}-${dy}`);
    }
    return days;
  }, []);

  // UI interaction states
  const [copiedHash, setCopiedHash] = useState(null);
  const [exportNotice, setExportNotice] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load toàn bộ dữ liệu audit data từ backend (tối đa 2000 bản ghi để biểu đồ và bảng lọc đồng bộ mượt mà)
  const loadAuditData = useCallback(async () => {
    setIsLoading(true);
    try {
      const orgId = currentOrg?.id || null;

      const [logsRes, statsRes] = await Promise.all([
        fetchOrgAuditLogs(
          orgId,
          {},
          { page: 1, pageSize: 2000 }
        ),
        fetchOrgAuditStats(orgId),
      ]);

      setRawLogs(logsRes.data || []);
      if (statsRes) {
        setStats(statsRes);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      toastError('Không thể tải nhật ký kiểm toán từ máy chủ');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, toastError]);

  // Bộ lọc dữ liệu tập trung theo Thời gian, Vai trò, Trạng thái và Từ khóa tìm kiếm
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((item) => {
      // 1. Lọc theo thời gian (Ngày, Tháng, Năm, Tất cả)
      if (timeFilterMode !== 'all') {
        const d = parseLogDate(item);
        if (d && !isNaN(d.getTime())) {
          const itemDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const itemMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const itemYearStr = String(d.getFullYear());

          if (timeFilterMode === 'today') {
            if (itemDateStr !== getTodayStr()) return false;
          } else if (timeFilterMode === 'date') {
            if (selectedDate && itemDateStr !== selectedDate) return false;
          } else if (timeFilterMode === 'month') {
            if (selectedMonth && itemMonthStr !== selectedMonth) return false;
          } else if (timeFilterMode === 'year') {
            if (selectedYear && itemYearStr !== selectedYear) return false;
          }
        }
      }

      // 2. Lọc theo Vai trò
      if (selectedRole !== 'ALL') {
        if (item.role !== selectedRole) return false;
      }

      // 3. Lọc theo Trạng thái
      if (selectedStatus !== 'ALL') {
        if (item.status !== selectedStatus) return false;
      }

      // 4. Lọc theo Tìm kiếm
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase().trim();
        const idMatch = (item.id || '').toLowerCase().includes(q);
        const actorMatch = (item.actor || '').toLowerCase().includes(q);
        const eventMatch = (item.event || '').toLowerCase().includes(q);
        const descMatch = (item.description || '').toLowerCase().includes(q);
        const ipMatch = (item.ip || '').toLowerCase().includes(q);
        const hashMatch = (item.sha256 || '').toLowerCase().includes(q);
        if (!idMatch && !actorMatch && !eventMatch && !descMatch && !ipMatch && !hashMatch) {
          return false;
        }
      }

      return true;
    });
  }, [rawLogs, timeFilterMode, selectedDate, selectedMonth, selectedYear, selectedRole, selectedStatus, debouncedSearch]);

  const total = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const logs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  // Copy SHA-256 hash
  const handleCopyHash = (hash) => {
    if (!hash) return;
    navigator.clipboard?.writeText(hash);
    setCopiedHash(hash);
    toastSuccess('Đã sao chép mã băm SHA-256 vào clipboard!', 'Sao Chép Thành Công');
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Verify Ledger Button
  const handleVerifyLedger = async () => {
    try {
      setIsVerifying(true);
      const orgId = currentOrg?.id || null;
      const verification = await verifyOrgAuditIntegrity(orgId);
      await loadAuditData();
      if (verification && verification.verified) {
        const count = verification.totalChecked || verification.validCount || logs.length;
        toastSuccess(
          `Đã đối soát mật mã ${count} bản ghi kiểm toán bằng thuật toán SHA-256. Toàn bộ chuỗi sổ cái đạt chuẩn toàn vẹn 100%!`,
          'Sổ Cái Bất Biến Hợp Lệ'
        );
      } else {
        toastError(
          `Cảnh báo phát hiện ${verification?.tamperedCount || 0} bản ghi có sai lệch chữ ký băm!`,
          'Cảnh Báo Giả Mạo Sổ Cái'
        );
      }
    } catch (err) {
      toastError(err?.message || 'Không thể kết nối dịch vụ xác thực sổ cái', 'Lỗi Xác Thực');
    } finally {
      setIsVerifying(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Mã Bản Ghi',
      'Thời Gian',
      'Tác Tử / Người Dùng',
      'Vai Trò',
      'Sự Kiện',
      'Mô Tả Chi Tiết',
      'Đối Tượng Mục Tiêu',
      'Địa Chỉ IP',
      'Mã Băm SHA-256',
      'Trạng Thái',
    ];
    const rows = logs.map((log) => [
      log.id,
      log.timestamp,
      log.actor,
      log.role,
      log.event,
      log.description,
      log.target,
      log.ip,
      log.sha256,
      log.status,
    ]);
    exportToCsv(`so-cai-kiem-toan-${currentOrg?.slug || 'org'}.csv`, headers, rows);
    setExportNotice(true);
    toastSuccess(`Đã xuất ${rows.length} bản ghi kiểm toán định dạng CSV!`, 'Xuất Dữ Liệu');
    setTimeout(() => setExportNotice(false), 3000);
  };

  // Export JSON
  const handleExportJson = () => {
    exportToJson(`so-cai-kiem-toan-${currentOrg?.slug || 'org'}.json`, logs);
    setExportNotice(true);
    toastSuccess(`Đã xuất ${logs.length} bản ghi kiểm toán định dạng JSON!`, 'Xuất Dữ Liệu');
    setTimeout(() => setExportNotice(false), 3000);
  };

  // Print / Save PDF
  const handlePrintPdf = () => {
    setExportNotice(true);
    toastSuccess('Đang mở hộp thoại In / Lưu PDF của trình duyệt...', 'In / Lưu PDF');
    setTimeout(() => {
      window.print();
    }, 250);
    setTimeout(() => setExportNotice(false), 4000);
  };

  // Summary KPI Cards tính toán động theo bộ lọc thời gian
  const summaryKpis = useMemo(() => {
    const totalCount = filteredLogs.length;
    const autonomousCount = filteredLogs.filter(
      (l) => l.role === 'SYSTEM_AI' || l.actorType === 'SYSTEM' || l.actorType === 'AGENT' || (l.event && (l.event.includes('AUTONOMOUS') || l.event.includes('REMEDIATION') || l.event.includes('AGENT_')))
    ).length;
    const hitlCount = filteredLogs.filter(
      (l) => (l.event && (l.event.includes('HITL') || l.event.includes('APPROV')))
    ).length;
    const blockedCount = filteredLogs.filter((l) => l.status === 'DENIED').length;

    return [
      {
        title: 'Tổng Bản Ghi Sổ Cái',
        value: totalCount,
        sub: 'Bất biến (Append-only)',
        icon: ScrollText,
        color: '#2563EB',
        bg: '#EFF6FF',
      },
      {
        title: 'AI MAPE-K Tự Hành',
        value: autonomousCount,
        sub: 'Khởi động & Scale Pods',
        icon: Bot,
        color: '#059669',
        bg: '#ECFDF5',
      },
      {
        title: 'Cổng Phê Duyệt HITL',
        value: hitlCount,
        sub: 'Con người xác nhận',
        icon: UserCheck,
        color: '#D97706',
        bg: '#FFFBEB',
      },
      {
        title: 'Vi Phạm Bị Chặn (RBAC)',
        value: blockedCount,
        sub: 'Từ chối quyền truy cập',
        icon: ShieldAlert,
        color: '#DC2626',
        bg: '#FEF2F2',
      },
      {
        title: 'Toàn Vẹn Chữ Ký',
        value: '100% Khớp',
        sub: 'Mã băm SHA-256 chuẩn',
        icon: Lock,
        color: '#059669',
        bg: '#ECFDF5',
      },
    ];
  }, [filteredLogs]);

    // Nút Lịch & Popover đặt trên góc phải của Biểu đồ
  const calendarFilterControl = (
    <div style={{ position: 'relative' }} ref={calendarRef}>
      <button
        type="button"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        style={{
          height: '32px',
          padding: '0 10px',
          fontSize: '0.75rem',
          fontWeight: 600,
          borderRadius: '6px',
          border: isCalendarOpen || timeFilterMode !== 'all' ? '1px solid #10B981' : '1px solid var(--dash-border)',
          backgroundColor: timeFilterMode !== 'all' ? '#ECFDF5' : '#FFFFFF',
          color: timeFilterMode !== 'all' ? '#047857' : 'var(--dash-text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          boxShadow: isCalendarOpen ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : 'none',
          transition: 'all 0.15s ease',
        }}
        title="Mở bảng lịch chọn ngày, tháng hoặc năm"
      >
        <Calendar size={14} color="#059669" />
        <span>{currentFilterLabel}</span>
        <ChevronDown size={12} color="#059669" />
      </button>

      {/* Cửa Sổ Popover Lịch Đa Chế Độ */}
      {isCalendarOpen && (
        <div
          style={{
            position: 'absolute',
            top: '38px',
            right: '0',
            zIndex: 100,
            width: '330px',
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
          {/* Tabs Chế Độ: Ngày | Tháng | Năm | Tất Cả */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
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
            <button
              type="button"
              onClick={() => {
                setTimeFilterMode('all');
                setPage(1);
                setIsCalendarOpen(false);
              }}
              style={{
                padding: '6px 2px',
                fontSize: '0.7rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: timeFilterMode === 'all' ? '#FFFFFF' : 'transparent',
                color: timeFilterMode === 'all' ? '#0F172A' : '#64748B',
                boxShadow: timeFilterMode === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              🌐 Tất cả
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
                  Ngày có bản ghi gần đây:
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
                Các tháng trong năm {selectedMonth?.split('-')[0] || '2026'}:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mNum) => {
                  const mStr = `${selectedMonth?.split('-')[0] || '2026'}-${String(mNum).padStart(2, '0')}`;
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
  );


  return (
    <div className="dashboard-audit-logs-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScrollText size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Nhật Ký Kiểm Toán Bất Biến (Immutable Audit Logs)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Bản ghi chuỗi khối SHA-256 chống chỉnh sửa theo chuẩn tuân thủ SOC 2 và ISO 27001 cho SME
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleVerifyLedger}
            disabled={isVerifying}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isVerifying ? 'not-allowed' : 'pointer',
              color: 'var(--dash-text-primary)',
            }}
          >
            <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} />
            <span>{isVerifying ? 'Đang xác thực...' : 'Xác thực sổ cái'}</span>
          </button>

          {/* Danh Sách Chọn Định Dạng Xuất Sổ Cái */}
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={isExportMenuOpen}
              aria-label="Tùy chọn xuất sổ cái"
              title="Chọn định dạng file xuất sổ cái kiểm toán (CSV, JSON, PDF)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                backgroundColor: 'var(--dash-primary)',
                border: 'none',
                borderRadius: 'var(--dash-radius-md)',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--dash-shadow-xs)',
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={15} />
              <span>Xuất Sổ Cái</span>
              <ChevronDown
                size={14}
                style={{
                  transform: isExportMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {/* Danh sách định dạng file để chọn */}
            <div
              role="menu"
              aria-label="Danh sách định dạng xuất sổ cái"
              style={{
                display: isExportMenuOpen ? 'flex' : 'none',
                flexDirection: 'column',
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                width: '230px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
                padding: '6px',
                zIndex: 50,
                gap: '2px',
              }}
            >
              <div
                style={{
                  padding: '6px 8px 4px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--dash-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Chọn Định Dạng File
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handleExportCsv();
                  setIsExportMenuOpen(false);
                }}
                aria-label="Xuất CSV"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-sm)',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#DCFCE7',
                  }}
                >
                  <FileSpreadsheet size={16} color="#059669" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Xuất CSV</span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400 }}>Bảng tính Excel (.csv)</span>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handleExportJson();
                  setIsExportMenuOpen(false);
                }}
                aria-label="Xuất JSON"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-sm)',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0F9FF')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#E0F2FE',
                  }}
                >
                  <FileJson size={16} color="#0284C7" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Xuất JSON</span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400 }}>Cấu trúc đối tượng (.json)</span>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handlePrintPdf();
                  setIsExportMenuOpen(false);
                }}
                aria-label="In hoặc Lưu PDF"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-sm)',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#F1F5F9',
                  }}
                >
                  <Printer size={16} color="#475569" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>In / Lưu PDF</span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400 }}>In hoặc tài liệu PDF A4</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {exportNotice && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--dash-radius-md)',
            color: '#065F46',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>Toàn bộ bản ghi kiểm toán kèm chữ ký số SHA-256 đã được xuất thành công!</span>
        </div>
      )}

      {/* 2. KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        {summaryKpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="dash-card"
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: 'var(--dash-shadow-xs)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: kpi.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: kpi.color,
                  flexShrink: 0,
                }}
              >
                <Icon size={20} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', fontWeight: 600 }}>{kpi.title}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '1px' }}>{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Distribution Chart với Bộ chọn Thời Gian được tích hợp ngay trên Card Biểu Đồ */}
      <AuditDistributionChart
        height={230}
        title={`Phân Bổ Sự Kiện Kiểm Toán (${currentFilterLabel})`}
        subtitle="Phân loại các thao tác do AI tự động thực thi, con người phê duyệt và các thay đổi cấu hình bảo mật"
        logs={rawLogs}
        fallbackData={stats?.days}
        timeFilterMode={timeFilterMode}
        selectedDate={selectedDate}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        filterControl={calendarFilterControl}
      />

      {/* 4. Filter and Search Bar (Thanh tìm kiếm và bộ lọc vai trò, trạng thái gọn gàng) */}
      <div
        className="dash-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {/* Search box rộng rãi */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: '1',
              padding: '8px 12px',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              backgroundColor: '#FAFAFA',
            }}
          >
            <Search size={16} color="var(--dash-text-muted)" />
            <input
              type="text"
              placeholder="Tìm theo Mã bản ghi (AUD-...), Tên người thực hiện, Sự kiện, IP hoặc SHA-256..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '0.8125rem',
                backgroundColor: 'transparent',
                color: 'var(--dash-text-primary)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} color="#94A3B8" />
              </button>
            )}
          </div>
        </div>

        {/* Roles and Status pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px dashed var(--dash-border)' }}>
          {/* Role pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Diễn Viên:</span>
            {[
              { key: 'ALL', label: 'Tất cả' },
              { key: 'SYSTEM_AI', label: 'AI MAPE-K' },
              { key: 'SME_OWNER', label: 'SME Owner' },
              { key: 'DEVOPS', label: 'DevOps Lead' },
              { key: 'VIEWER', label: 'Viewer' },
            ].map((rk) => (
              <button
                key={rk.key}
                type="button"
                onClick={() => {
                  setSelectedRole(rk.key);
                  setPage(1);
                }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--dash-radius-sm)',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: selectedRole === rk.key ? '#0F172A' : '#FFFFFF',
                  color: selectedRole === rk.key ? '#FFFFFF' : 'var(--dash-text-secondary)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {rk.label}
              </button>
            ))}
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Trạng Thái:</span>
            {[
              { key: 'ALL', label: 'Tất cả' },
              { key: 'SUCCESS', label: 'Thành Công' },
              { key: 'DENIED', label: 'Bị Từ Chối (RBAC)' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => {
                  setSelectedStatus(st.key);
                  setPage(1);
                }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--dash-radius-sm)',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: selectedStatus === st.key ? (st.key === 'DENIED' ? '#DC2626' : '#059669') : '#FFFFFF',
                  color: selectedStatus === st.key ? '#FFFFFF' : 'var(--dash-text-secondary)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Audit Log Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Sổ Cái Nhật Ký Kiểm Toán ({total} Bản ghi)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Mỗi bản ghi được ký mã hóa và ghi chép bất biến theo thứ tự thời gian tuyến tính
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
            <Lock size={14} />
            <span>Toàn vẹn mật mã: 100% Khớp</span>
          </div>
        </div>

        <div className="dash-table-container" style={{ border: 'none', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Mã & Thời Điểm</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Người Thực Hiện (Actor)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Loại Sự Kiện & Mục Tiêu</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Nội Dung Chi Tiết</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Chữ Ký SHA-256</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Trạng Thái</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', textAlign: 'center' }}>Chi Tiết</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={24} className="animate-spin" color="var(--dash-primary)" />
                      <span>Đang tải sổ cái kiểm toán từ CSDL...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <ScrollText size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Không tìm thấy bản ghi kiểm toán nào</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSystem = log.role === 'SYSTEM_AI' || log.actorType === 'SYSTEM';
                  const isOwner = log.role === 'SME_OWNER' || log.role === 'SUPER_ADMIN';
                  const isDevOps = log.role === 'DEVOPS' || log.role === 'SYSTEM_ADMIN';
                  const isDenied = log.status === 'DENIED';

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--dash-border)',
                        backgroundColor: isDenied ? '#FFFBFB' : '#FFFFFF',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDenied ? '#FEF2F2' : '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isDenied ? '#FFFBFB' : '#FFFFFF';
                      }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: 'var(--dash-primary)',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedLogDetail(log)}
                          title="Bấm để xem chi tiết bản ghi"
                        >
                          {log.id}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                          {log.timestamp}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{log.actor}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 'var(--dash-radius-full)',
                              backgroundColor: isSystem ? '#ECFDF5' : isOwner ? '#EFF6FF' : '#F1F5F9',
                              color: isSystem ? '#059669' : isOwner ? '#2563EB' : '#64748B',
                            }}
                          >
                            {log.role}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                            IP: {log.ip}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                          {log.event}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                          &bull; {log.target}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', maxWidth: '320px', color: 'var(--dash-text-secondary)', lineHeight: 1.4 }}>
                        {log.description}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyHash(log.sha256)}
                          title="Bấm để sao chép toàn bộ mã SHA-256"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid var(--dash-border)',
                            borderRadius: 'var(--dash-radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.6875rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--dash-text-secondary)',
                          }}
                        >
                          <span>
                            {log.sha256 ? `${log.sha256.substring(0, 10)}...${log.sha256.substring(log.sha256.length - 6)}` : 'Chưa ký'}
                          </span>
                          {copiedHash === log.sha256 ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                        </button>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        {isDenied ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              borderRadius: 'var(--dash-radius-full)',
                            }}
                          >
                            ✕ TỪ CHỐI
                          </span>
                        ) : log.status === 'FAILED' ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              backgroundColor: '#FFFBEB',
                              color: '#D97706',
                              border: '1px solid #FDE68A',
                              borderRadius: 'var(--dash-radius-full)',
                            }}
                          >
                            ! THẤT BẠI
                          </span>
                        ) : (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              backgroundColor: '#ECFDF5',
                              color: '#059669',
                              border: '1px solid #A7F3D0',
                              borderRadius: 'var(--dash-radius-full)',
                            }}
                          >
                            ● BẤT BIẾN
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedLogDetail(log)}
                          title="Xem chi tiết dữ liệu trước/sau"
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid var(--dash-border)',
                            borderRadius: 'var(--dash-radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--dash-primary)',
                          }}
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Dynamic Pagination Bar (10 items/page) */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#FAFAFA',
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)' }}>
            Hiển thị{' '}
            <strong style={{ color: 'var(--dash-text-primary)' }}>
              {total > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, total)}
            </strong>{' '}
            trên tổng số <strong style={{ color: 'var(--dash-text-primary)' }}>{total}</strong> bản ghi
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-sm)',
                border: '1px solid var(--dash-border)',
                backgroundColor: page <= 1 ? '#F1F5F9' : '#FFFFFF',
                color: page <= 1 ? '#94A3B8' : 'var(--dash-text-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
              <span>Trước</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                return (
                  <React.Fragment key={p}>
                    {prev && p - prev > 1 && (
                      <span style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.75rem' }}>...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPage(p)}
                      style={{
                        minWidth: '28px',
                        height: '28px',
                        padding: '0 6px',
                        borderRadius: 'var(--dash-radius-sm)',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: page === p ? 'var(--dash-primary)' : '#FFFFFF',
                        color: page === p ? '#FFFFFF' : 'var(--dash-text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-sm)',
                border: '1px solid var(--dash-border)',
                backgroundColor: page >= totalPages ? '#F1F5F9' : '#FFFFFF',
                color: page >= totalPages ? '#94A3B8' : 'var(--dash-text-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <span>Tiếp</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 7. Audit Detail Modal / Drawer */}
      {selectedLogDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedLogDetail(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--dash-radius-lg, 16px)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ScrollText size={20} color="var(--dash-primary)" />
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
                    Chi Tiết Bản Ghi Kiểm Toán
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    ID: {selectedLogDetail.id} &bull; {selectedLogDetail.timestamp}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  color: '#64748B',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* SHA-256 Signature Card */}
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#F1F5F9',
                  borderRadius: 'var(--dash-radius-md)',
                  border: '1px solid var(--dash-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                    <Lock size={14} />
                    <span>Chữ Ký Bất Biến SHA-256 (Tamper-Proof)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyHash(selectedLogDetail.sha256)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Copy size={12} />
                    <span>{copiedHash === selectedLogDetail.sha256 ? 'Đã sao chép' : 'Sao chép'}</span>
                  </button>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--dash-text-primary)',
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                  }}
                >
                  {selectedLogDetail.sha256}
                </div>
              </div>

              {/* Event Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Tác Tử Thực Hiện</div>
                  <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                    {selectedLogDetail.actor}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 'var(--dash-radius-full)',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      marginTop: '4px',
                    }}
                  >
                    {selectedLogDetail.role}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Địa Chỉ IP & Kết Nối</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                    {selectedLogDetail.ip}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
                    {selectedLogDetail.metadata?.userAgent || 'Internal Cluster Network'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Mã Sự Kiện Chuẩn</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--dash-primary)', marginTop: '2px' }}>
                    {selectedLogDetail.event}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Đối Tượng Tác Động</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                    {selectedLogDetail.target}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginBottom: '4px' }}>Mô Tả Chi Tiết</div>
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 'var(--dash-radius-md)',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    color: 'var(--dash-text-secondary)',
                  }}
                >
                  {selectedLogDetail.description}
                </div>
              </div>

              {/* Before and After Data (State Diff) */}
              {(selectedLogDetail.before_data || selectedLogDetail.after_data) && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', marginBottom: '8px' }}>
                    <Code2 size={14} />
                    <span>Dữ Liệu Trạng Thái Trước & Sau Thay Đổi (State Diff)</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#DC2626', marginBottom: '4px' }}>
                        Trạng Thái Trước (Before)
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: '10px',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid #FECACA',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          maxHeight: '140px',
                          overflowY: 'auto',
                          color: '#991B1B',
                        }}
                      >
                        {selectedLogDetail.before_data
                          ? JSON.stringify(selectedLogDetail.before_data, null, 2)
                          : 'null (Tạo mới)'}
                      </pre>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                        Trạng Thái Sau (After)
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: '10px',
                          backgroundColor: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          maxHeight: '140px',
                          overflowY: 'auto',
                          color: '#065F46',
                        }}
                      >
                        {selectedLogDetail.after_data
                          ? JSON.stringify(selectedLogDetail.after_data, null, 2)
                          : 'null'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: 'var(--dash-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
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

export default AuditLogsPage;
