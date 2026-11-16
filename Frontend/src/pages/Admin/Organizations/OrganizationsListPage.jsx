import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getOrganizations, updateOrganizationStatus } from '../../../services/adminOrganizationsService';
import OrganizationTable from '../../../components/admin/organizations/OrganizationTable';
import OrganizationFilters from '../../../components/admin/organizations/OrganizationFilters';
import { useDebounce } from '../../../hooks/useDebounce';
import { AdminErrorState } from '../../../components/admin/common';

export const OrganizationsListPage = ({ onNavigate }) => {
  const [organizations, setOrganizations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset về trang 1 khi thay đổi từ khóa tìm kiếm hoặc trạng thái
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchOrganizationsData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getOrganizations({
        status: statusFilter,
        query: debouncedSearch,
      });
      setOrganizations(data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách tổ chức:', err);
      setError('Không thể tải danh sách tổ chức thuê bao. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchOrganizationsData();
  }, [fetchOrganizationsData]);

  const handleSelectOrg = (org) => {
    if (onNavigate) {
      const isCompanies = window.location.pathname.includes('/companies');
      onNavigate(isCompanies ? `/admin/companies/${org.id}` : `/admin/organizations/${org.id}`);
    }
  };

  const handleToggleOrgStatus = async (org) => {
    const newStatus = org.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await updateOrganizationStatus(org.id, newStatus);
      setOrganizations((prev) =>
        prev.map((item) => (item.id === org.id ? { ...item, status: newStatus } : item))
      );
      showToast(
        newStatus === 'ACTIVE'
          ? `Đã kích hoạt lại hoạt động cho công ty "${org.name}"!`
          : `Đã tạm ngưng hoạt động của công ty "${org.name}"!`
      );
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái tổ chức:', err);
      showToast('Không thể cập nhật trạng thái tổ chức. Vui lòng thử lại.');
    }
  };

  const { activeCount, suspendedCount } = useMemo(() => {
    let active = 0;
    let suspended = 0;
    for (let i = 0; i < organizations.length; i++) {
      const s = organizations[i].status;
      if (s === 'ACTIVE') active++;
      else if (s === 'SUSPENDED') suspended++;
    }
    return { activeCount: active, suspendedCount: suspended };
  }, [organizations]);

  const total = organizations.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrganizations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return organizations.slice(start, start + pageSize);
  }, [organizations, currentPage, pageSize]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
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
            <Building2 size={24} />
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
              Quản Lý Doanh Nghiệp
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Quản lý tập trung toàn bộ doanh nghiệp đăng ký sử dụng SelfAI, kích hoạt/tạm ngưng, theo dõi thành viên, tác tử và cụm máy chủ.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchOrganizationsData}
            disabled={isLoading}
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
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
            <span>Làm Mới</span>
          </button>
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

      {/* Summary KPI Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>
            TỔNG DOANH NGHIỆP
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>
            {organizations.length}
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #A7F3D0',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> ĐANG HOẠT ĐỘNG (ACTIVE)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
            {activeCount}
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #FECACA',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#991B1B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} /> TẠM DỪNG (SUSPENDED)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {suspendedCount}
          </div>
        </div>
      </div>

      {/* Filter Bar - Service/Plan filter removed */}
      <OrganizationFilters
        search={searchQuery}
        onSearchChange={setSearchQuery}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        totalCount={organizations.length}
      />

      {/* Error state if fetch failed */}
      {error && (
        <AdminErrorState
          title="Không thể tải danh sách tổ chức"
          message={error}
          onRetry={fetchOrganizationsData}
          isRetrying={isLoading}
        />
      )}

      {/* Organizations Table */}
      <OrganizationTable
        organizations={paginatedOrganizations}
        isLoading={isLoading}
        onSelectOrganization={handleSelectOrg}
        onToggleStatus={handleToggleOrgStatus}
        totalCount={total}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
      />
    </div>
  );
};

export default OrganizationsListPage;
