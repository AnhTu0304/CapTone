import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import FormField from './FormField';

export const ClusterRegistrationCard = ({
  clusterName,
  onChangeClusterName,
  isRegistered = false,
  className = '',
}) => {
  return (
    <div
      className={`onboarding-cluster-reg-card ${className}`}
      style={{
        padding: '20px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        marginBottom: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: 'var(--color-primary)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          1
        </div>
        <div>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--color-ink)',
              margin: 0,
            }}
          >
            Đăng ký Cụm máy chủ
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            Cung cấp tên định danh cho phiên Kubernetes này để định tuyến các tín hiệu viễn trắc.
          </p>
        </div>
      </div>

      <FormField
        label="Tên Định Danh Cụm Máy Chủ"
        required
        htmlFor="cluster-name-input"
        description="Phải tương thích chuẩn DNS (chữ cái, số, dấu gạch ngang). Hỗ trợ EKS, GKE, AKS, K3s và K8s tiêu chuẩn."
      >
        <div style={{ position: 'relative' }}>
          <input
            id="cluster-name-input"
            type="text"
            value={clusterName}
            onChange={(e) => onChangeClusterName(e.target.value)}
            placeholder="ví dụ: k8s-prod-east-01"
            style={{
              width: '100%',
              height: '44px',
              padding: '0 120px 0 14px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '0px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              color: 'var(--color-ink)',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-default)')}
          />
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              color: '#059669',
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={13} color="#059669" />
            <span>TÊN HỢP LỆ</span>
          </div>
        </div>
      </FormField>
    </div>
  );
};

export default ClusterRegistrationCard;
