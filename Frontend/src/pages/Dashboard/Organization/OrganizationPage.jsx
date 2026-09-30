import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import {
  Building2,
  CheckCircle2,
  Server,
  Save,
  Check
} from 'lucide-react';

export const OrganizationPage = () => {
  const { currentOrg } = useDashboard();
  const { success: toastSuccess } = useToast();
  const [orgName, setOrgName] = useState(currentOrg?.name || 'Acme Corporation');
  const [slug, setSlug] = useState(currentOrg?.slug || 'acme-corp');
  const [domain, setDomain] = useState('acmecorp.vn');
  const [billingContact, setBillingContact] = useState('contact@acmecorp.vn');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e) => {
    e?.preventDefault();
    setSaveSuccess(true);
    toastSuccess('Hồ sơ tổ chức doanh nghiệp đã được cập nhật đồng bộ!', 'Cài Đặt Tổ Chức');
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="dashboard-organization-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Cài Đặt Hồ Sơ Tổ Chức
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 'var(--dash-radius-full)',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                border: '1px solid #A7F3D0',
              }}
            >
              Đang Hoạt Động
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Quản lý thông tin định danh doanh nghiệp, tên miền và các cụm Kubernetes trực thuộc tổ chức
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: 'var(--dash-primary)',
            border: 'none',
            borderRadius: 'var(--dash-radius-md)',
            color: '#FFFFFF',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {saveSuccess ? <Check size={16} /> : <Save size={16} />}
          <span>{saveSuccess ? 'Đã Cập Nhật' : 'Lưu Hồ Sơ Công Ty'}</span>
        </button>
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
          <span>Hồ sơ tổ chức doanh nghiệp đã được cập nhật đồng bộ!</span>
        </div>
      )}

      {/* Profile Form Card */}
      <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Thông Tin Doanh Nghiệp
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Thông tin định danh và liên hệ quản trị được áp dụng cho toàn bộ cụm máy chủ và nhật ký kiểm toán.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
              Tên Doanh Nghiệp / Tổ Chức
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
              Mã Định Danh Slug (Duy nhất)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
              Tên Miền Doanh Nghiệp (Domain)
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
              Email Liên Hệ Quản Trị
            </label>
            <input
              type="email"
              value={billingContact}
              onChange={(e) => setBillingContact(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
            />
          </div>
        </div>
      </div>

      {/* Linked Clusters List */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Cụm Kubernetes Đã Liên Kết
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Các môi trường máy chủ đang gửi dữ liệu viễn trắc về tổ chức
            </p>
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Server size={20} color="var(--dash-primary)" />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>k8s-prod-cluster-01</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                3 Nodes &bull; 84 Pods &bull; API: https://api.k8s-prod.acmecorp.vn:6443
              </div>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: 'var(--dash-radius-full)', border: '1px solid #A7F3D0' }}>
            KẾT NỐI HOẠT ĐỘNG
          </span>
        </div>
      </div>
    </div>
  );
};

export default OrganizationPage;
