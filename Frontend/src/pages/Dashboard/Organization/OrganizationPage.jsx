import React, { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { request } from '../../../services/apiClient';
import { clusterService } from '../../../services/clusterService';
import {
  Building2,
  CheckCircle2,
  Server,
  Save,
  Check,
  Loader2,
  AlertCircle,
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
  const [clusters, setClusters] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state phục vụ chỉnh sửa
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

  // Tải chi tiết hồ sơ tổ chức và danh sách cụm thực tế từ Backend Database
  const loadOrganizationData = useCallback(async () => {
    if (!currentOrg?.id || currentOrg.id.startsWith('sandbox-') || currentOrg.id === 'org-empty') {
      return;
    }

    setIsLoadingClusters(true);

    try {
      // 1. Tải chi tiết tổ chức & profile từ /organizations/:id
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

    try {
      // 2. Tải danh sách cụm K8s thực tế thuộc tổ chức từ database
      const clusterList = await clusterService.getClustersByOrg(currentOrg.id);
      setClusters(Array.isArray(clusterList) ? clusterList : []);
    } catch (err) {
      console.warn('[OrganizationPage] Lỗi khi tải cụm K8s của tổ chức:', err.message);
      setClusters([]);
    } finally {
      setIsLoadingClusters(false);
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
        setIsEditing(false);
        if (toastSuccess) {
          toastSuccess('Hồ sơ tổ chức doanh nghiệp đã được cập nhật đồng bộ!', 'Cài Đặt Tổ Chức');
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
        toastError(err?.message || 'Không thể lưu hồ sơ tổ chức. Vui lòng kiểm tra quyền hạn.');
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
    setIsEditing(false);
  };

  const currentName = orgData?.name || currentOrg?.name || 'Cloud DevOps Engineering Hub';
  const currentSlug = orgData?.slug || currentOrg?.slug || 'devops-hub-test';
  const isActive = (orgData?.status || currentOrg?.status) === 'ACTIVE';

  return (
    <div className="dashboard-organization-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={24} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Cài Đặt Hồ Sơ Tổ Chức
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 'var(--dash-radius-full)',
                backgroundColor: isActive ? '#ECFDF5' : '#FEF2F2',
                color: isActive ? '#059669' : '#DC2626',
                border: `1px solid ${isActive ? '#A7F3D0' : '#FECACA'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#10B981' : '#EF4444' }} />
              {isActive ? 'Đang Hoạt Động' : 'Tạm Khóa'}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Quản lý thông tin định danh doanh nghiệp, tên miền và các cụm Kubernetes trực thuộc tổ chức
          </p>
        </div>

        {/* Nút thao tác: Chỉnh Sửa / Lưu / Hủy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
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
              <span>Chỉnh Sửa Hồ Sơ</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  color: 'var(--dash-text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                }}
              >
                <X size={15} />
                <span>Hủy Bỏ</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  backgroundColor: isSaving ? 'var(--dash-text-muted)' : 'var(--dash-primary)',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-md)',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : saveSuccess ? (
                  <Check size={16} />
                ) : (
                  <Save size={16} />
                )}
                <span>{isSaving ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
              </button>
            </>
          )}
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
          <span>Hồ sơ tổ chức doanh nghiệp đã được cập nhật đồng bộ vào cơ sở dữ liệu!</span>
        </div>
      )}

      {/* 2. CHẾ ĐỘ XEM CHI TIẾT (VIEW MODE) */}
      {!isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card: Thông Tin Doanh Nghiệp */}
          <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} color="var(--dash-primary)" />
                  Thông Tin Doanh Nghiệp
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
                  Thông tin định danh và liên hệ quản trị được áp dụng cho toàn bộ cụm máy chủ và nhật ký kiểm toán.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  backgroundColor: 'var(--dash-bg-canvas)',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  color: 'var(--dash-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Edit3 size={13} />
                <span>Sửa thông tin</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', paddingTop: '10px', borderTop: '1px solid var(--dash-border)' }}>
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
            <div style={{ paddingTop: '10px', borderTop: '1px dashed var(--dash-border)' }}>
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
      ) : (
        /* 3. CHẾ ĐỘ CHỈNH SỬA (EDIT MODE) */
        <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={18} color="var(--dash-primary)" />
              Chỉnh Sửa Thông Tin Doanh Nghiệp & Hồ Sơ
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Chỉnh sửa thông tin định danh và hồ sơ vận hành. Dữ liệu sẽ được lưu đồng bộ vào cơ sở dữ liệu PostgreSQL.
            </p>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Tên Doanh Nghiệp / Tổ Chức <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Cloud DevOps Engineering Hub"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Mã Định Danh Slug (Cố định duy nhất)
                </label>
                <input
                  type="text"
                  value={currentSlug}
                  readOnly
                  disabled
                  title="Mã định danh slug được gán cố định khi tạo tổ chức để đảm bảo tính an toàn"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 'var(--dash-radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--dash-bg-canvas)',
                    color: 'var(--dash-text-muted)',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Loại Hình Tổ Chức
                </label>
                <input
                  type="text"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="VD: Engineering Org, Fintech, SaaS Platform"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Tên Miền Doanh Nghiệp (Website / Domain)
                </label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="VD: https://company.com hoặc company.vn"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Email Liên Hệ Quản Trị
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="VD: contact@company.com"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Số Điện Thoại Liên Hệ
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="VD: +84 901 234 567"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Thành Phố / Khu Vực
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="VD: Hồ Chí Minh, Hà Nội"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Múi Giờ Vận Hành
                </label>
                <input
                  type="text"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  placeholder="Asia/Ho_Chi_Minh"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Mô Tả Doanh Nghiệp & Hạ Tầng
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả tóm tắt về lĩnh vực hoạt động và quy mô hạ tầng..."
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--dash-border)' }}>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  color: 'var(--dash-text-secondary)',
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
                  padding: '9px 22px',
                  backgroundColor: isSaving ? 'var(--dash-text-muted)' : 'var(--dash-primary)',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-md)',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>{isSaving ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Cụm Kubernetes Đã Liên Kết */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} color="var(--dash-primary)" />
              Cụm Kubernetes Đã Liên Kết
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Các môi trường máy chủ đang gửi dữ liệu viễn trắc về tổ chức
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>
            {clusters.length} Cụm được ghi nhận
          </span>
        </div>

        {isLoadingClusters ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Loader2 size={18} className="animate-spin" />
            <span style={{ fontSize: '0.875rem' }}>Đang tải danh sách cụm Kubernetes...</span>
          </div>
        ) : clusters.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
            <AlertCircle size={28} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Tổ chức chưa liên kết cụm Kubernetes nào</div>
            <p style={{ fontSize: '0.75rem', marginTop: '4px', margin: 0 }}>
              Hãy vào mục "Cụm Kubernetes" để đăng ký cụm máy chủ và kết nối eBPF Agent.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {clusters.map((cluster) => {
              const isOnline = cluster.agent_status === 'ONLINE';
              const isPending = cluster.agent_status === 'PENDING' || cluster.status === 'PENDING';
              const statusText = isOnline ? 'KẾT NỐI HOẠT ĐỘNG' : (isPending ? 'CHỜ KẾT NỐI' : 'NGOẠI TUYẾN');
              const badgeBg = isOnline ? '#ECFDF5' : (isPending ? '#FEF3C7' : '#F1F5F9');
              const badgeColor = isOnline ? '#059669' : (isPending ? '#D97706' : '#64748B');
              const badgeBorder = isOnline ? '#A7F3D0' : (isPending ? '#FDE68A' : '#E2E8F0');

              return (
                <div
                  key={cluster.id}
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--dash-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        backgroundColor: isOnline ? '#ECFDF5' : '#F8FAFC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--dash-border)',
                      }}
                    >
                      <Server size={18} color={isOnline ? '#059669' : 'var(--dash-primary)'} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{cluster.name}</span>
                        {cluster.environment_name && (
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--dash-bg-canvas)',
                              border: '1px solid var(--dash-border)',
                              color: 'var(--dash-text-secondary)',
                            }}
                          >
                            {cluster.environment_name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                        {cluster.nodes_count ?? 0} Nodes &bull; {cluster.pods_count ?? 0} Pods
                        {cluster.endpoint ? ` &bull; API: ${cluster.endpoint}` : ''}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: badgeColor,
                      backgroundColor: badgeBg,
                      padding: '4px 10px',
                      borderRadius: 'var(--dash-radius-full)',
                      border: `1px solid ${badgeBorder}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusText}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationPage;
