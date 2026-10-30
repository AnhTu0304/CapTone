import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, RefreshCw, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Plus, X, Save } from 'lucide-react';
import { getOrganizations, createOrganization, updateOrganizationStatus } from '../../../services/adminOrganizationsService';
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

  // Modal Đăng Ký / Tạo Company mới
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    domain: '',
    contactEmail: '',
    clustersLimit: 3,
  });

  const debouncedSearch = useDebounce(searchQuery, 300);

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

  const handleCreateCompanySubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.contactEmail.trim()) {
      alert('Vui lòng điền tên công ty và email liên hệ.');
      return;
    }

    try {
      const newOrg = await createOrganization({
        name: createForm.name.trim(),
        slug: createForm.slug.trim() || undefined,
        domain: createForm.domain.trim() || undefined,
        contactEmail: createForm.contactEmail.trim(),
        clustersLimit: Number(createForm.clustersLimit) || 3,
      });

      setOrganizations((prev) => [newOrg, ...prev]);
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        slug: '',
        domain: '',
        contactEmail: '',
        clustersLimit: 3,
      });
      showToast(`Đã tạo thành công doanh nghiệp mới "${newOrg.name}"!`);
    } catch (err) {
      console.error('Lỗi khi tạo doanh nghiệp mới:', err);
      alert(err.message || 'Lỗi khi tạo doanh nghiệp mới. Vui lòng thử lại.');
    }
  };

  const { activeCount, trialCount, suspendedCount } = useMemo(() => {
    let active = 0;
    let trial = 0;
    let suspended = 0;
    for (let i = 0; i < organizations.length; i++) {
      const s = organizations[i].status;
      if (s === 'ACTIVE') active++;
      else if (s === 'TRIAL') trial++;
      else if (s === 'SUSPENDED') suspended++;
    }
    return { activeCount: active, trialCount: trial, suspendedCount: suspended };
  }, [organizations]);

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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                fontWeight: 700,
                fontSize: '0.6875rem',
              }}
            >
              <ShieldCheck size={12} /> Cấp Độ Quản Trị Hệ Thống (Platform Super Admin)
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--dash-text-primary)',
              margin: '8px 0 4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Building2 size={26} style={{ color: '#059669' }} />
            Quản Lý Doanh Nghiệp (Organizations)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Quản lý tập trung toàn bộ doanh nghiệp đăng ký sử dụng SelfAI, kích hoạt/tạm ngưng, theo dõi thành viên, tác tử và cụm máy chủ.
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
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#059669',
              color: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
            }}
          >
            <Plus size={16} />
            <span>Tạo Company Mới</span>
          </button>

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
            border: '1px solid #FDE68A',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={13} /> DÙNG THỬ (TRIAL)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
            {trialCount}
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
        organizations={organizations}
        isLoading={isLoading}
        onSelectOrganization={handleSelectOrg}
        onToggleStatus={handleToggleOrgStatus}
      />

      {/* Modal Tạo Company Mới - No service selector */}
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
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} color="#059669" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Đăng Ký / Tạo Company Mới
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

            <form onSubmit={handleCreateCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Tên Doanh Nghiệp (Company Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: VNG Cloud Technology"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
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
                  Mã Slug / Định Danh
                </label>
                <input
                  type="text"
                  placeholder="vngcloud (để trống tự tạo)"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Tên Miền Doanh Nghiệp (Domain)
                </label>
                <input
                  type="text"
                  placeholder="vngcloud.vn"
                  value={createForm.domain}
                  onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })}
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
                  Email Kỹ Thuật / Quản Trị Viên Đại Diện *
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@vngcloud.vn"
                  value={createForm.contactEmail}
                  onChange={(e) => setCreateForm({ ...createForm, contactEmail: e.target.value })}
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
                  Hạn Mức Cụm K8s Cho Phép
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={createForm.clustersLimit}
                  onChange={(e) => setCreateForm({ ...createForm, clustersLimit: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
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
                  <Save size={14} />
                  <span>Tạo Công Ty</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationsListPage;
