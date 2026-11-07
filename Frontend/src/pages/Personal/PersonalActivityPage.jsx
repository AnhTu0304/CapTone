import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  Activity,
  UserCheck,
  ShieldCheck,
  Building2,
  Download,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Server,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';

export const formatActivityDescription = (desc, fallbackTitle) => {
  if (!desc) return fallbackTitle || "";
  let cleaned = desc
    .replace(/^Người dùng \[[^\]]+\]\s*/i, "")
    .replace(/\[[^\]]+@[^\]]+\]\s*/i, "")
    .trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned || fallbackTitle || "";
};

export const PersonalActivityPage = () => {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'AUTH' | 'PROFILE' | 'COMPANY' | 'SECURITY'
  const [searchTerm, setSearchTerm] = useState('');

  // Tải dữ liệu từ database thông qua personalPortalService
  const loadActivities = useCallback(async (cat = categoryFilter, search = searchTerm, page = currentPage, limit = pageSize) => {
    setIsLoading(true);
    try {
      const data = await personalPortalService.fetchActivityHistory({
        category: cat !== 'ALL' ? cat : undefined,
        search: search && search.trim() ? search.trim() : undefined,
        page,
        limit,
      });
      if (Array.isArray(data)) {
        setActivities(data);
        setTotalItems(typeof data.total === 'number' ? data.total : data.length);
      } else if (data?.items) {
        setActivities(data.items);
        setTotalItems(typeof data.total === 'number' ? data.total : data.items.length);
      } else {
        setActivities([]);
        setTotalItems(0);
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadActivities(categoryFilter, searchTerm, currentPage, pageSize);
    }, 200);
    return () => clearTimeout(timer);
  }, [categoryFilter, searchTerm, currentPage, pageSize, loadActivities]);

  // Client-side filter safeguard
  const filtered = activities.filter((act) => {
    const matchesCategory = categoryFilter === 'ALL' || act.category === categoryFilter;
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return matchesCategory;
    const matchesSearch =
      (act.title && act.title.toLowerCase().includes(searchLower)) ||
      (act.description && act.description.toLowerCase().includes(searchLower)) ||
      (act.ipAddress && String(act.ipAddress).includes(searchLower)) || (act.organizationName && act.organizationName.toLowerCase().includes(searchLower)) || (act.clusterName && act.clusterName.toLowerCase().includes(searchLower));
    return matchesCategory && matchesSearch;
  });

  const handleExportCSV = () => {
    const headers = 'ID,Hành động,Mô tả,Công ty,Cụm K8s,Thời gian,IP,Danh mục,Trạng thái\n';
    const rows = filtered
      .map(
        (a) =>
          `"${a.id || ''}","${(a.title || '').replace(/"/g, '""')}","${(a.description || '').replace(/"/g, '""')}","${(a.organizationName || '').replace(/"/g, '""')}","${(a.clusterName || '').replace(/"/g, '""')}","${a.timestamp || ''}","${a.ipAddress || ''}","${a.category || ''}","${a.status || ''}"`
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `personal_activity_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'AUTH':
        return { label: 'Đăng nhập / Đăng xuất', bg: '#EFF6FF', text: '#2563EB', icon: History };
      case 'PROFILE':
        return { label: 'Cập nhật hồ sơ', bg: '#F5F3FF', text: '#7C3AED', icon: UserCheck };
      case 'COMPANY':
        return { label: 'Tổ chức & Hạ tầng', bg: '#ECFDF5', text: '#059669', icon: Building2 };
      case 'SECURITY':
        return { label: 'Bảo mật & Token', bg: '#FEF3C7', text: '#D97706', icon: ShieldCheck };
      default:
        return { label: 'Chung', bg: '#F1F5F9', text: '#475569', icon: Activity };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Activity History — Lịch Sử Hoạt Động Cá Nhân
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Nhật ký kiểm toán toàn diện ghi nhận các thao tác đăng nhập, đổi bảo mật, xoay vòng Token và cụm K8s của bạn.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => loadActivities(categoryFilter, searchTerm)}
            disabled={isLoading}
            title="Làm mới dữ liệu"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              fontSize: '0.78125rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw
              size={15}
              style={{
                animation: isLoading ? 'spinSlow 1s linear infinite' : 'none',
              }}
            />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              fontSize: '0.78125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={15} />
            <span>Xuất Báo Cáo CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          padding: '12px 16px',
          border: '1px solid #E2E8F0',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search
            size={16}
            color="#94A3B8"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Tìm theo hành động, IP, chi tiết sự kiện..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '0.8125rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            fontSize: '0.8125rem',
            backgroundColor: '#FFFFFF',
            outline: 'none',
          }}
        >
          <option value="ALL">Tất cả hành động ({totalItems || activities.length})</option>
          <option value="AUTH">Đăng nhập / Đăng xuất</option>
          <option value="PROFILE">Cập nhật hồ sơ</option>
          <option value="COMPANY">Tổ chức & Cụm K8s</option>
          <option value="SECURITY">Bảo mật & Token Agent</option>
        </select>
      </div>

      {/* Activities Timeline Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#64748B' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Hành Động & Chi Tiết</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Phân Loại</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Công Ty & Cụm K8s</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Địa Chỉ IP</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Thời Gian Thực Thi</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((act) => {
                const badge = getCategoryBadge(act.category);
                const BadgeIcon = badge.icon;

                return (
                  <tr key={act.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{act.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                        {act.description}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: badge.bg,
                          color: badge.text,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <BadgeIcon size={13} />
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78125rem', fontWeight: 600, color: '#1E293B' }}>
                          <Building2 size={13} style={{ color: '#0284C7', flexShrink: 0 }} />
                          <span>{act.organizationName || 'Cá nhân'}</span>
                        </div>
                        {act.clusterName ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.71875rem', fontWeight: 600, color: '#7C3AED' }}>
                            <Server size={12} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                            <span>Cụm: {act.clusterName}</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.71875rem', color: '#94A3B8' }}>
                            Không gắn cụm
                          </div>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono, monospace)', color: '#334155' }}>
                      {act.ipAddress}
                    </td>

                    <td style={{ padding: '14px 16px', color: '#64748B' }}>{act.timestamp}</td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {act.status === 'FAILED' ? (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AlertTriangle size={12} />
                          <span>Thất bại</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: '#ECFDF5',
                            color: '#059669',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={12} />
                          <span>Hoàn thành</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filtered.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '14px 16px',
              borderTop: '1px solid #F1F5F9',
              fontSize: '0.8125rem',
              color: '#334155',
            }}
          >
            {/* Cụm trái: Hiển thị mỗi trang */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Hiển thị mỗi trang:</span>
              <select
                aria-label="Hiển thị mỗi trang"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Cụm phải: Số trang và nút Trước / Sau */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>
                Trang {currentPage} trên tổng {totalPages}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isLoading}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: currentPage <= 1 || isLoading ? '#94A3B8' : '#0F172A',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: currentPage <= 1 || isLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  &lsaquo; Trước
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isLoading}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: currentPage >= totalPages || isLoading ? '#94A3B8' : '#0F172A',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: currentPage >= totalPages || isLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Sau &rsaquo;
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && filtered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: '#64748B',
            }}
          >
            <RefreshCw
              size={28}
              style={{
                margin: '0 auto',
                color: '#3B82F6',
                animation: 'spinSlow 1s linear infinite',
              }}
            />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: '#64748B',
            }}
          >
            <History size={36} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1E293B' }}>Không có hoạt động nào</div>
            <p style={{ fontSize: '0.8125rem', margin: '4px 0 0 0' }}>
              Không có sự kiện phù hợp với từ khóa hoặc bộ lọc đã chọn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalActivityPage;
