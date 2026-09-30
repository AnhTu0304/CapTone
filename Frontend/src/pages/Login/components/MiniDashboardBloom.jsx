import React from 'react';
import { Activity, CheckCircle2, Shield, Cpu, RefreshCw } from 'lucide-react';

/**
 * MiniDashboardBloom
 * 
 * Bảng điều khiển Kubernetes 3D bung nở ra sau khi 7 bước tiếp cận hoàn tất.
 * Tái hiện phiên bản tối ưu của 3D Dashboard ở Hero section:
 * - Thanh tiêu đề Navy #3D3B4F với đèn trạng thái nhấp nháy
 * - Chỉ số sức khỏe cluster thời gian thực (99.98% Healthy)
 * - Danh sách Pods và tiến trình tự phục hồi MAPE-K
 */
export const MiniDashboardBloom = ({ isVisible, onReplay }) => {
  if (!isVisible) return null;

  return (
    <div
      className="dashboard-bloom-container"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        pointerEvents: 'auto',
        animation: 'bloomExpand 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div
        className="mini-dashboard-card"
        style={{
          width: '94%',
          maxWidth: '460px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '0px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(61, 59, 79, 0.08)',
          overflow: 'hidden',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Window Titlebar (Navy #3D3B4F) */}
        <div
          style={{
            backgroundColor: 'var(--color-primary)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FF5F56', display: 'inline-block' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FFBD2E', display: 'inline-block' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#27C93F', display: 'inline-block' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                color: '#FFFFFF',
                fontWeight: 700,
                letterSpacing: '0.04em',
                marginLeft: '6px',
              }}
            >
              k8s-prod-cluster-01 [CONNECTED]
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-accent)',
                animation: 'pulseDot 1.4s infinite',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-accent)', fontWeight: 700 }}>
              LIVE
            </span>
          </div>
        </div>

        {/* Dashboard Body */}
        <div style={{ padding: '16px' }}>
          {/* Top Status Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              backgroundColor: 'rgba(40, 233, 159, 0.12)',
              border: '1px solid var(--color-accent)',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#059669" />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
                  HẠ TẦNG KẾT NỐI HOÀN TẤT
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                  MAPE-K Autonomic Loop Đang Hoạt Động
                </div>
              </div>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--color-primary)',
              }}
            >
              99.98%
            </span>
          </div>

          {/* 3 Telemetry Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            <div style={{ padding: '8px', backgroundColor: 'var(--color-canvas)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <Activity size={12} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', fontWeight: 600 }}>TELEMETRY</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                10s Poll
              </div>
            </div>

            <div style={{ padding: '8px', backgroundColor: 'var(--color-canvas)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <Cpu size={12} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', fontWeight: 600 }}>PODS</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: '#059669' }}>
                48/48 OK
              </div>
            </div>

            <div style={{ padding: '8px', backgroundColor: 'var(--color-canvas)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <Shield size={12} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', fontWeight: 600 }}>TỰ PHỤC HỒI</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                Sẵn sàng
              </div>
            </div>
          </div>

          {/* Active Workload List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                backgroundColor: 'var(--color-canvas)',
                border: '1px solid var(--border-default)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: '#28E99F', display: 'inline-block' }} />
                <span>order-processor-7b8f</span>
              </div>
              <span style={{ color: '#059669', fontWeight: 600 }}>Ready (200 OK)</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                backgroundColor: 'var(--color-canvas)',
                border: '1px solid var(--border-default)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: '#28E99F', display: 'inline-block' }} />
                <span>auth-service-v2</span>
              </div>
              <span style={{ color: '#059669', fontWeight: 600 }}>12ms Latency</span>
            </div>
          </div>

          {/* Replay Control Bar */}
          <div
            style={{
              marginTop: '14px',
              paddingTop: '10px',
              borderTop: '1px dashed var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Tự động lặp chu trình onboarding...
            </span>
            <button
              type="button"
              onClick={onReplay}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                background: 'none',
                border: '1px solid var(--border-default)',
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={10} />
              <span>Xem lại 7 bước</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiniDashboardBloom;
