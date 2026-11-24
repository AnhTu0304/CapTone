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
      if (normalizedWebsite) {
        if (/^(javascript|data|vbscript):/i.test(normalizedWebsite)) {
          throw new Error('URL website không hợp lệ');
        }
        if (!/^https?:\/\//i.test(normalizedWebsite)) {
          normalizedWebsite = `https://${normalizedWebsite}`;
        }
        const parsedUrl = new URL(normalizedWebsite);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          throw new Error('URL website chỉ hỗ trợ giao thức http hoặc https');
        }
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
    <div className="dashboard-organization-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Header & Nút Sửa thông tin */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
            }}
          >
            <Building2 size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Thông Tin Tổ Chức
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Quản lý thông tin định danh doanh nghiệp, tên miền &amp; liên hệ của tổ chức
            </p>
          </div>
        </div>

        {/* Nút Sửa thông tin */}
        <div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 14px',
              backgroundColor: '#059669',
              border: '1px solid #059669',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
              transition: 'all 0.15s ease',
            }}
          >
            <Edit3 size={14} />
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
            borderRadius: '12px',
            color: '#047857',
            fontSize: '0.825rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <CheckCircle2 size={17} color="#059669" />
          <span>Thông tin tổ chức doanh nghiệp đã được cập nhật đồng bộ vào cơ sở dữ liệu!</span>
        </div>
      )}

      {/* Hàng 4 Thẻ KPI Tóm Tắt Tổ Chức */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: '2.5px solid #059669', borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>MÃ ĐỊNH DANH SLUG</span>
            <Building2 size={14} color="#059669" />
          </div>
          <div style={{ marginTop: '5px', fontSize: '0.96rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentSlug}
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: '2.5px solid #3B82F6', borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>THÀNH VIÊN</span>
            <Users size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {orgData?.members_count ?? 2}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Đang hoạt động</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: '2.5px solid #F59E0B', borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>VAI TRÒ CỦA BẠN</span>
            <Shield size={14} color="#F59E0B" />
          </div>
          <div style={{ marginTop: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: '2px 9px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
              {orgData?.role_in_org || currentOrg?.role_in_org || 'SME_OWNER'}
            </span>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: '2.5px solid #8B5CF6', borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>MÚI GIỜ VẬN HÀNH</span>
            <Clock size={14} color="#8B5CF6" />
          </div>
          <div style={{ marginTop: '5px', fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formData.timezone || 'Asia/Ho_Chi_Minh'}
          </div>
        </div>
      </div>

      {/* 2. CHẾ ĐỘ XEM THÔNG TIN (VIEW MODE) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Card: Thông tin cơ bản tổ chức */}
        <div className="dash-card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                Tên Doanh Nghiệp / Tổ Chức
              </span>
              <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0F172A' }}>
                {currentName}
              </span>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                Mã Định Danh Slug (Duy nhất)
              </span>
              <code
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '7px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#0F172A',
                  fontWeight: 700,
                }}
              >
                {currentSlug}
              </code>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                Loại Hình Tổ Chức
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} color="#059669" />
                {orgData?.type || formData.type || 'Engineering Org'}
              </span>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                Vai Trò Của Bạn Trong Tổ Chức
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: '2px 9px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={12} />
                {orgData?.role_in_org || currentOrg?.role_in_org || 'SME_OWNER'}
              </span>
            </div>
          </div>

          {/* Mô tả doanh nghiệp */}
          <div style={{ paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
              Mô Tả Doanh Nghiệp
            </span>
            <p style={{ fontSize: '0.84rem', color: '#475569', margin: 0, lineHeight: 1.6 }}>
              {orgData?.description || 'Hạ tầng giám sát viễn trắc và tự phục hồi Kubernetes Proactive Self-Healing.'}
            </p>
          </div>
        </div>

        {/* Card: Thông Tin Chi Tiết & Hồ Sơ Mở Rộng */}
        <div className="dash-card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Globe size={16} color="#059669" />
            </div>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Thông Tin Chi Tiết &amp; Liên Hệ Quản Trị
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Hồ sơ chi tiết dùng để xác thực hệ thống, gửi thông báo khẩn cấp và báo cáo vận hành định kỳ.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ padding: '11px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                <Globe size={12} /> Tên Miền (Website / Domain)
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: formData.website ? '#059669' : '#94A3B8' }}>
                {formData.website && /^https?:\/\//i.test(formData.website.trim()) ? (
                  <a href={formData.website.trim()} target="_blank" rel="noopener noreferrer" style={{ color: '#059669', textDecoration: 'none' }}>
                    {formData.website}
                  </a>
                ) : (
                  '-- Chưa thiết lập website --'
                )}
              </span>
            </div>

            <div style={{ padding: '11px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                <Mail size={12} /> Email Liên Hệ Quản Trị
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: formData.email ? '#0F172A' : '#94A3B8' }}>
                {formData.email || '-- Chưa thiết lập email --'}
              </span>
            </div>

            <div style={{ padding: '11px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                <Phone size={12} /> Số Điện Thoại
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: formData.phone ? '#0F172A' : '#94A3B8' }}>
                {formData.phone || '-- Chưa thiết lập --'}
              </span>
            </div>

            <div style={{ padding: '11px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                <MapPin size={12} /> Khu Vực / Thành Phố
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0F172A' }}>
                {formData.city || 'Hồ Chí Minh'}, {formData.country || 'Việt Nam'}
              </span>
            </div>

            <div style={{ padding: '11px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                <Clock size={12} /> Múi Giờ Vận Hành
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                {formData.timezone || 'Asia/Ho_Chi_Minh'} (GMT+7)
              </span>
            </div>

            <div style={{ padding: '11px 14px', borderRadius: '11px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                <Users size={12} /> Thành Viên Trong Tổ Chức
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#059669' }}>
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
