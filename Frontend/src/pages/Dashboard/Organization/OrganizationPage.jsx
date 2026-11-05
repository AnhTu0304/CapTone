import React, { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { request } from '../../../services/apiClient';
import {
  Building2,
  CheckCircle2,
  Save,
  Loader2,
  Edit3,
  X,
  Globe,
  Mail,
  Phone,
  MapPin,
  Clock,
  Users,
  Shield,
  Layers
} from 'lucide-react';

export const OrganizationPage = () => {
  const { currentOrg, setCurrentOrg, fetchUserOrgs } = useDashboard();
  const { success: toastSuccess, error: toastError } = useToast();

  const [orgData, setOrgData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state phục vụ chỉnh sửa trong modal
  const [formData, setFormData] = useState({
    name: currentOrg?.name || '',
    type: 'Engineering Org',
    description: '',
    website: '',
    email: '',
    phone: '',
    address: '',
    city: 'Hồ Chí Minh',
    country: 'Việt Nam',
    timezone: 'Asia/Ho_Chi_Minh',
  });

  // Tải chi tiết hồ sơ tổ chức từ Backend Database
  const loadOrganizationData = useCallback(async () => {
    if (!currentOrg?.id || currentOrg.id.startsWith('sandbox-') || currentOrg.id === 'org-empty') {
      return;
    }

    try {
      const res = await request(`/organizations/${currentOrg.id}`);
      const data = res?.data || res;
      if (data) {
        setOrgData(data);
        setFormData({
          name: data.name || currentOrg?.name || '',
          type: data.type || 'Engineering Org',
          description: data.description || '',
          website: data.profile?.website || '',
          email: data.profile?.email || '',
          phone: data.profile?.phone || '',
          address: data.profile?.address || '',
          city: data.profile?.city || 'Hồ Chí Minh',
          country: data.profile?.country || 'Việt Nam',
          timezone: data.profile?.timezone || 'Asia/Ho_Chi_Minh',
        });
      }
    } catch (err) {
      console.warn('[OrganizationPage] Lỗi khi tải chi tiết tổ chức:', err.message);
    }
  }, [currentOrg?.id, currentOrg?.name]);

  useEffect(() => {
    loadOrganizationData();
  }, [loadOrganizationData]);

  // Cập nhật hồ sơ công ty xuống CSDL PostgreSQL qua API PUT /organizations/:id
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!currentOrg?.id) return;

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      if (toastError) toastError('Tên doanh nghiệp phải có ít nhất 2 ký tự');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      let normalizedWebsite = formData.website.trim();
      if (normalizedWebsite && !normalizedWebsite.startsWith('http://') && !normalizedWebsite.startsWith('https://')) {
        normalizedWebsite = `https://${normalizedWebsite}`;
      }

      const payload = {
        name: formData.name.trim(),
        type: formData.type.trim() || undefined,
        description: formData.description.trim() || undefined,
        email: formData.email.trim() || '',
        website: normalizedWebsite || '',
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        country: formData.country.trim() || undefined,
        timezone: formData.timezone.trim() || 'Asia/Ho_Chi_Minh',
      };

      const res = await request(`/organizations/${currentOrg.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res?.success || res?.data) {
        setSaveSuccess(true);
        setIsModalOpen(false);
        if (toastSuccess) {
          toastSuccess('Thông tin tổ chức doanh nghiệp đã được cập nhật đồng bộ!', 'Thông Tin Tổ Chức');
        }

        // Cập nhật lại state context và localStorage để TopHeader & Sidebar hiển thị tên mới ngay lập tức
        localStorage.setItem('selfheal_active_org_name', formData.name.trim());
        if (setCurrentOrg) {
          setCurrentOrg((prev) => ({ ...prev, name: formData.name.trim() }));
        }
        if (fetchUserOrgs) {
          fetchUserOrgs();
        }

        // Tải lại dữ liệu chi tiết mới nhất
        loadOrganizationData();

        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch (err) {
      console.error('[OrganizationPage] Lỗi khi cập nhật tổ chức:', err);
      if (toastError) {
        toastError(err?.message || 'Không thể lưu thông tin tổ chức. Vui lòng kiểm tra quyền hạn.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Hoàn tác form về dữ liệu ban đầu
    if (orgData) {
      setFormData({
        name: orgData.name || '',
        type: orgData.type || 'Engineering Org',
        description: orgData.description || '',
        website: orgData.profile?.website || '',
        email: orgData.profile?.email || '',
        phone: orgData.profile?.phone || '',
        address: orgData.profile?.address || '',
        city: orgData.profile?.city || 'Hồ Chí Minh',
        country: orgData.profile?.country || 'Việt Nam',
        timezone: orgData.profile?.timezone || 'Asia/Ho_Chi_Minh',
      });
    }
    setIsModalOpen(false);
  };

  const currentName = orgData?.name || currentOrg?.name || 'SME Retail Enterprise';
  const currentSlug = orgData?.slug || currentOrg?.slug || 'sme-retail';

  return (
    <div className="dashboard-organization-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Nút Sửa thông tin */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={24} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Thông Tin Tổ Chức
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Quản lý thông tin định danh doanh nghiệp, tên miền và thông tin liên hệ của tổ chức
          </p>
        </div>

        {/* Nút Sửa thông tin (Mở cửa sổ nhỏ) */}
        <div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              backgroundColor: 'var(--dash-primary)',
              border: 'none',
              borderRadius: 'var(--dash-radius-md)',
              color: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            <Edit3 size={15} />
            <span>Sửa thông tin</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
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
            gap: '10px',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>Thông tin tổ chức doanh nghiệp đã được cập nhật đồng bộ vào cơ sở dữ liệu!</span>
        </div>
      )}

      {/* 2. CHẾ ĐỘ XEM THÔNG TIN (VIEW MODE) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Card: Thông tin cơ bản tổ chức (Đã bỏ tiêu đề lặp lại 'Thông Tin Doanh Nghiệp') */}
        <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Tên Doanh Nghiệp / Tổ Chức
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
                {currentName}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Mã Định Danh Slug (Duy nhất)
              </span>
              <code
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--dash-bg-canvas)',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#334155',
                  fontWeight: 600,
                }}
              >
                {currentSlug}
              </code>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Loại Hình Tổ Chức
              </span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--dash-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={15} color="#64748B" />
                {orgData?.type || formData.type || 'Engineering Org'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Vai Trò Của Bạn Trong Tổ Chức
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D97706', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={12} />
                {orgData?.role_in_org || currentOrg?.role_in_org || 'SME_OWNER'}
              </span>
            </div>
          </div>

          {/* Mô tả doanh nghiệp */}
          <div style={{ paddingTop: '16px', borderTop: '1px dashed var(--dash-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Mô Tả Doanh Nghiệp
            </span>
            <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.6 }}>
              {orgData?.description || 'Hạ tầng giám sát viễn trắc và tự phục hồi Kubernetes Proactive Self-Healing.'}
            </p>
          </div>
        </div>

        {/* Card: Thông Tin Chi Tiết & Hồ Sơ Mở Rộng */}
        <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} color="var(--dash-primary)" />
              Thông Tin Chi Tiết & Liên Hệ Quản Trị
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Hồ sơ chi tiết được dùng để xác thực hệ thống, gửi thông báo khẩn cấp và báo cáo vận hành định kỳ.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', paddingTop: '10px', borderTop: '1px solid var(--dash-border)' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                <Globe size={13} /> Tên Miền (Website / Domain)
              </span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: formData.website ? 'var(--dash-primary)' : 'var(--dash-text-muted)' }}>
                {formData.website ? (
                  <a href={formData.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--dash-primary)', textDecoration: 'none' }}>
                    {formData.website}
                  </a>
                ) : (
                  '-- Chưa thiết lập website --'
                )}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                <Mail size={13} /> Email Liên Hệ Quản Trị
              </span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: formData.email ? 'var(--dash-text-primary)' : 'var(--dash-text-muted)' }}>
                {formData.email || '-- Chưa thiết lập email --'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                <Phone size={13} /> Số Điện Thoại
              </span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: formData.phone ? 'var(--dash-text-primary)' : 'var(--dash-text-muted)' }}>
                {formData.phone || '-- Chưa thiết lập --'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                <MapPin size={13} /> Khu Vực / Thành Phố
              </span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                {formData.city || 'Hồ Chí Minh'}, {formData.country || 'Việt Nam'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                <Clock size={13} /> Múi Giờ Vận Hành
              </span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                {formData.timezone || 'Asia/Ho_Chi_Minh'} (GMT+7)
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                <Users size={13} /> Thành Viên Trong Tổ Chức
              </span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-primary)' }}>
                {orgData?.members_count ?? 2} thành viên đang hoạt động
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CỬA SỔ NHỎ (MODAL POPUP) CHỈNH SỬA THÔNG TIN TỔ CHỨC */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => !isSaving && handleCancelEdit()}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.15s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '10px',
                    backgroundColor: '#ECFDF5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#059669',
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                    Chỉnh Sửa Thông Tin Tổ Chức
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
                    Cập nhật thông tin định danh, tên miền và liên hệ của tổ chức
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSaving && handleCancelEdit()}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94A3B8',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                      Tên Doanh Nghiệp / Tổ Chức <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="VD: SME Retail Enterprise"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.875rem' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                      Mã Định Danh Slug (Cố định duy nhất)
                    </label>
                    <input
                      type="text"
                      value={currentSlug}
                      readOnly
                      disabled
                      title="Mã định danh slug được gán cố định khi tạo tổ chức để đảm bảo an toàn"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        backgroundColor: '#F8FAFC',
                        color: '#64748B',
                        cursor: 'not-allowed',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                      Loại Hình Tổ Chức
                    </label>
                    <input
                      type="text"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      placeholder="VD: Engineering Org, Fintech, SME Retail"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                      Tên Miền Doanh Nghiệp (Website / Domain)
                    </label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="VD: https://smeretail.com hoặc company.vn"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                      Email Liên Hệ Quản Trị
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="VD: contact@smeretail.com"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                      Số Điện Thoại Liên Hệ
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="VD: +84 901 234 567"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                      Thành Phố / Khu Vực
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="VD: Hồ Chí Minh, Hà Nội"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                      Múi Giờ Vận Hành
                    </label>
                    <input
                      type="text"
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      placeholder="Asia/Ho_Chi_Minh"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                    Mô Tả Doanh Nghiệp & Hạ Tầng
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mô tả tóm tắt về lĩnh vực hoạt động và quy mô hạ tầng..."
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #F1F5F9',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  borderBottomLeftRadius: '16px',
                  borderBottomRightRadius: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={() => !isSaving && handleCancelEdit()}
                  disabled={isSaving}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    color: '#64748B',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    backgroundColor: isSaving ? '#94A3B8' : 'var(--dash-primary)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isSaving ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationPage;
