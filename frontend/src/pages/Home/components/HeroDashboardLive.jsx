import React, { useState } from 'react';
import {
  Activity,
  Layers,
  Cpu,
  AlertTriangle,
  Zap,
  Settings,
  ShieldCheck,
  Server,
  Building2,
  FileCode,
  CheckCircle2,
  Check,
  X,
  Radio
} from 'lucide-react';

export const HeroDashboardLive = ({ glarePos = { x: 50, y: 50 }, onApprove }) => {
  const [approved, setApproved] = useState(false);
  const [showModal, setShowModal] = useState(true);

  const handleConfirmApproval = (e) => {
    e.stopPropagation();
    setApproved(true);
    if (onApprove) onApprove();
  };

  const handleResetApproval = (e) => {
    e.stopPropagation();
    setApproved(false);
  };

  return (
    <div
      className="hero-dashboard-live"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '860px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.04)',
        overflow: 'hidden',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        userSelect: 'none',
      }}
    >
      {/* Dynamic Specular Glare Reflection Layer */}
      <div
        className="specular-glare-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle 420px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.55), transparent 75%)`,
          pointerEvents: 'none',
          zIndex: 35,
          mixBlendMode: 'overlay',
          transition: 'background 0.1s ease',
        }}
      />

      {/* TOP HEADER (White-First Calm Operations) */}
      <div
        style={{
          height: '52px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        {/* Left: Brand + Context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Logo Mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                backgroundColor: '#ECFDF5',
                border: '1.5px solid #059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
              }}
            >
              <ShieldCheck size={16} strokeWidth={2.4} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#0F172A', letterSpacing: '-0.02em' }}>
              Self<span style={{ color: '#059669' }}>Heal</span>
            </span>
          </div>

          <div style={{ height: '16px', width: '1px', backgroundColor: '#E2E8F0' }} />

          {/* Org & Cluster Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', fontWeight: 600, padding: '3px 8px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <Building2 size={13} color="#059669" />
              <span>Acme Corp</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#0F172A', fontWeight: 600, padding: '3px 8px', backgroundColor: '#F1F5F9', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
              <Server size={13} color="#059669" />
              <span style={{ fontFamily: 'var(--font-mono)' }}>k8s-prod-cluster-01</span>
            </div>
          </div>
        </div>

        {/* Right: Role & Agent status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Agent Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 9px', backgroundColor: '#ECFDF5', borderRadius: '999px', border: '1px solid #A7F3D0' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669' }}>Tác tử eBPF: 1.2ms</span>
          </div>

          {/* Role badge */}
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
            SME Owner
          </span>
        </div>
      </div>

      {/* DASHBOARD BODY LAYOUT: SIDEBAR + MAIN CONTENT */}
      <div style={{ display: 'flex', height: '440px', backgroundColor: '#F8FAFC' }}>
        {/* Compact Sidebar */}
        <div
          style={{
            width: '175px',
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E2E8F0',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', padding: '4px 8px', textTransform: 'uppercase' }}>
            Menu Vận Hành
          </div>

          {[
            { label: 'Tổng quan cụm', icon: Activity, active: true },
            { label: 'Hạ tầng & Pods', icon: Server, active: false },
            { label: 'Giám sát viễn trắc', icon: Cpu, active: false },
            { label: 'Dự báo rủi ro AI', icon: Zap, active: false },
            { label: 'Tự phục hồi MAPE-K', icon: ShieldCheck, active: false },
            { label: 'Sự cố & Phân tích RCA', icon: AlertTriangle, active: false },
            { label: 'Cài đặt nền tảng', icon: Settings, active: false },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: item.active ? 700 : 500,
                  backgroundColor: item.active ? '#ECFDF5' : 'transparent',
                  color: item.active ? '#059669' : '#64748B',
                  border: item.active ? '1px solid #A7F3D0' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} color={item.active ? '#059669' : '#94A3B8'} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Main Operational Area */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          {/* Health Status Ribbon */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)' }} />
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A' }}>
                  Cụm Kubernetes: Bình Thường (Healthy 100%)
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                  Độ khả dụng 98,7% &bull; Uptime 99.98% &bull; MTTR 1.4s &bull; 0 sự cố gián đoạn dịch vụ
                </div>
              </div>
            </div>

            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669', backgroundColor: '#ECFDF5', padding: '3px 8px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
              MAPE-K Hoạt Động
            </span>
          </div>

          {/* 4 Telemetry Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { label: 'Tải CPU Cụm', val: '42%', sub: '↓ 6.2% so với đỉnh', color: '#059669' },
              { label: 'Bộ Nhớ RAM', val: '68%', sub: '16.4 / 24.0 GB', color: '#059669' },
              { label: 'Mạng I/O', val: '1.2 GB/s', sub: 'Không nghẽn gói', color: '#2563EB' },
              { label: 'Pods Đang Chạy', val: '84 / 84', sub: '3 Nodes vật lý', color: '#059669' },
            ].map((m, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{m.val}</div>
                <div style={{ fontSize: '0.625rem', color: m.color, fontWeight: 700, marginTop: '2px' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Mini Real-time Telemetry Trend Graph */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A' }}>
                Viễn Trắc Tải Đa Biến & Vòng Lặp Tự Trị (MAPE-K Live Stream)
              </span>
              <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 700 }}>
                ● Real-time (1.2s ping)
              </span>
            </div>

            {/* Sparkline Curve */}
            <div style={{ width: '100%', height: '70px', marginTop: '6px' }}>
              <svg viewBox="0 0 500 80" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="heroMetricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 55 Q 50 35 100 48 T 200 40 T 300 25 T 380 50 T 440 28 T 500 32 L 500 80 L 0 80 Z"
                  fill="url(#heroMetricGrad)"
                />
                <path
                  d="M 0 55 Q 50 35 100 48 T 200 40 T 300 25 T 380 50 T 440 28 T 500 32"
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Real-time head pulse dot */}
                <circle cx="500" cy="32" r="4" fill="#059669" />
                <circle cx="500" cy="32" r="8" fill="none" stroke="#059669" strokeWidth="1.5" opacity="0.6">
                  <animate attributeName="r" values="4;12;4" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE FLOATING YAML DIFF CARD (HITL APPROVAL GATE)
          Specifically requested and matched to the user's screenshot!
          Positions in the foreground with distinct layer depth.
      ========================================================================== */}
      {showModal && (
        <div
          className="hero-yaml-diff-card"
          style={{
            position: 'absolute',
            bottom: '18px',
            right: '20px',
            width: '92%',
            maxWidth: '560px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 25px 45px -8px rgba(6, 95, 70, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.15)',
            zIndex: 30,
            overflow: 'hidden',
            animation: 'fadeInSlide 0.3s ease-out',
            transform: 'translateZ(45px)',
          }}
        >
          {/* Modal Header - Soft Glossy Emerald */}
          <div
            style={{
              background: 'linear-gradient(135deg, #065F46 0%, #047857 55%, #059669 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(6, 95, 70, 0.15)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCode size={16} color="#10B981" />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Xem Trước Thay Đổi Cấu Hình Kubernetes YAML Diff
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              aria-label="Đóng xem trước"
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', padding: 2 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Content */}
          <div style={{ padding: '12px 14px', backgroundColor: '#FFFFFF' }}>
            <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '8px' }}>
              Tệp cấu hình: <strong style={{ fontFamily: 'var(--font-mono)', color: '#0F172A' }}>node-maintenance-cordon.yaml</strong>
            </div>

            {/* Side-by-Side Diff Panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '10px', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
              {/* Left: BEFORE (Red) */}
              <div>
                <div style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.6875rem', marginBottom: '4px' }}>
                  &bull; HIỆN TẠI TRONG CỤM (BEFORE)
                </div>
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#991B1B',
                    lineHeight: '1.45',
                    minHeight: '135px',
                  }}
                >
                  <div># worker-03 Current Status</div>
                  <div>spec:</div>
                  <div style={{ paddingLeft: '12px' }}>unschedulable: false</div>
                  <div>status:</div>
                  <div style={{ paddingLeft: '12px' }}>conditions:</div>
                  <div style={{ paddingLeft: '24px' }}>- type: Ready</div>
                  <div style={{ paddingLeft: '32px' }}>status: "True"</div>
                </div>
              </div>

              {/* Right: AFTER (Green) */}
              <div>
                <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.6875rem', marginBottom: '4px' }}>
                  &bull; SAU KHI PHÊ DUYỆT (AFTER)
                </div>
                <div
                  style={{
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#065F46',
                    lineHeight: '1.45',
                    minHeight: '135px',
                  }}
                >
                  <div># worker-03 After HITL Approval</div>
                  <div>spec:</div>
                  <div style={{ paddingLeft: '12px', color: '#047857', fontWeight: 700 }}>
                    unschedulable: true # Cordoned
                  </div>
                  <div>status:</div>
                  <div style={{ paddingLeft: '12px' }}>conditions:</div>
                  <div style={{ paddingLeft: '24px' }}>- type: Ready</div>
                  <div style={{ paddingLeft: '32px' }}>status: "True"</div>
                  <div>metadata:</div>
                  <div style={{ paddingLeft: '12px' }}>annotations:</div>
                  <div style={{ paddingLeft: '24px', color: '#047857', fontWeight: 700 }}>
                    selfheal.systems/drain-in-progress: "true"
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons with Interactive Feedback */}
            <div
              style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  color: '#334155',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>

              {approved ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 14px',
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #10B981',
                      borderRadius: '6px',
                      color: '#065F46',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    <Check size={14} color="#059669" />
                    <span>Đã Ký Duyệt & Đang Tự Phục Hồi</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetApproval}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.6875rem',
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Đặt lại
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmApproval}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    backgroundColor: '#059669',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Check size={14} />
                  <span>Xác Nhận Ký Duyệt & Thực Thi</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroDashboardLive;
