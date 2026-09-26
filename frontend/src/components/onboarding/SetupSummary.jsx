import React from 'react';
import { 
  Building2, 
  Layers, 
  Server, 
  Activity, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

export const SetupSummary = ({
  organization,
  environment,
  cluster,
  agentStatus,
  onGoToDashboard,
  onReadGuide,
  className = '',
}) => {
  return (
    <div className={`onboarding-setup-summary ${className}`} style={{ width: '100%' }}>
      {/* Polished Technical Success Banner */}
      <div
        style={{
          padding: '28px 24px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--border-default)',
          borderTop: '4px solid var(--color-accent)',
          borderRadius: '0px',
          marginBottom: '24px',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            backgroundColor: 'rgba(40, 233, 159, 0.15)',
            color: '#059669',
            border: '2px solid var(--color-accent)',
            borderRadius: '0px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <CheckCircle2 size={28} />
        </div>

        <div
          style={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            color: '#059669',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '6px',
          }}
        >
          ONBOARDING HOÀN TẤT THÀNH CÔNG
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--color-ink)',
            letterSpacing: '-0.025em',
            marginBottom: '8px',
          }}
        >
          Môi trường của bạn đã sẵn sàng
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            maxWidth: '520px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          Không gian làm việc SelfHeal đã được cấu hình thành công. Dữ liệu viễn trắc thời gian thực đang truyền trực tiếp từ cụm Kubernetes và tính năng AI học đường cơ sở tự phục hồi đã kích hoạt.
        </p>
      </div>

      {/* Summary Grid Breakdown */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '0px',
          padding: '20px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '1px dashed var(--border-default)',
          }}
        >
          Cấu hình hạ tầng mục tiêu
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Organization */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'rgba(61, 59, 79, 0.05)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Building2 size={18} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                TỔ CHỨC
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                {organization?.name || 'Acme Cloud Corp'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                slug: {organization?.slug || 'acme-cloud-corp'}
              </div>
            </div>
          </div>

          {/* Environment */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'rgba(61, 59, 79, 0.05)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={18} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                MÔI TRƯỜNG
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                {environment?.name || 'Staging'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                phân vùng: {environment?.type || 'staging'}
              </div>
            </div>
          </div>

          {/* Kubernetes Cluster */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'rgba(61, 59, 79, 0.05)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Server size={18} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                CỤM KUBERNETES
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                {cluster?.name || 'k8s-prod-east-01'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {agentStatus?.k8sVersion || 'v1.29.4'} ({agentStatus?.nodeCount || 4} Nodes)
              </div>
            </div>
          </div>

          {/* Agent & Monitoring Status */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'rgba(40, 233, 159, 0.12)',
                border: '1px solid var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Activity size={18} color="#059669" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                TÁC TỬ & GIÁM SÁT
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: '#059669' }}>
                HOẠT ĐỘNG & TRUYỀN DỮ LIỆU
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {agentStatus?.podsMonitored || 38} Pods • Vòng lặp MAPE-K sẵn sàng
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary and Secondary Action Buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          paddingTop: '8px',
        }}
      >
        <PrimaryButton
          onClick={onGoToDashboard}
          style={{
            padding: '14px 32px',
            backgroundColor: 'var(--color-accent)',
            color: '#000000',
            borderColor: 'var(--color-accent)',
          }}
        >
          Đi tới Bảng điều khiển
        </PrimaryButton>

        <SecondaryButton
          onClick={onReadGuide}
          icon={ExternalLink}
          style={{
            padding: '14px 24px',
          }}
        >
          Đọc Tài liệu Hướng dẫn
        </SecondaryButton>
      </div>
    </div>
  );
};

export default SetupSummary;
