import React from 'react';
import { 
  Activity, 
  Layers, 
  Cpu, 
  AlertCircle, 
  Zap, 
  Settings, 
  Search, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

export const DashboardPreview = ({ className = '' }) => {
  const sidebarItems = [
    { label: 'Tổng quan', icon: Activity, active: true },
    { label: 'Môi trường', icon: Layers, active: false },
    { label: 'Giám sát', icon: Cpu, active: false },
    { label: 'Sự cố', icon: AlertCircle, active: false },
    { label: 'Dự đoán AI', icon: Sparkles, active: false },
    { label: 'Tự phục hồi', icon: Zap, active: false },
    { label: 'Cài đặt', icon: Settings, active: false },
  ];

  const metrics = [
    { label: 'Độ khả dụng', value: '98,7%', change: '↑ 2,4%', isGood: true },
    { label: 'Mức sử dụng CPU', value: '42%', change: '↓ 6,2%', isGood: true },
    { label: 'Mức sử dụng bộ nhớ', value: '68%', change: '↓ 4,1%', isGood: true },
    { label: 'Số Pod đang chạy', value: '24', change: '↑ 2,0%', isGood: true },
    { label: 'Sự cố đang diễn ra', value: '0', change: '↓ 100%', isGood: true },
  ];

  const activities = [
    { title: 'Tự phục hồi hoàn tất', time: '2m trước', type: 'healing' },
    { title: 'Phát hiện dự đoán AI', time: '12m trước', type: 'ai' },
    { title: 'Sự cố mới đã giải quyết', time: '45m trước', type: 'resolved' },
    { title: 'Agent trực tuyến', time: '1h trước', type: 'online' },
  ];

  return (
    <div
      className={`dashboard-preview-card ${className}`}
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '0px',
        border: '1px solid var(--border-default)',
        boxShadow: 'none',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '820px',
        fontSize: '0.875rem',
        userSelect: 'none',
      }}
    >
      {/* Top Application Bar - Greptile Navy Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--color-primary)',
          color: '#FFFFFF',
        }}
      >
        {/* Brand in App */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '0px',
              backgroundColor: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: '10px', height: '10px', backgroundColor: '#000000' }}></div>
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#FFFFFF', fontFamily: 'var(--font-display)' }}>
            Self<span style={{ color: 'var(--color-accent)' }}>Heal</span>
          </span>
          <span style={{ fontSize: '0.75rem', color: '#A5A3B4', marginLeft: '6px', fontFamily: 'var(--font-mono)' }}>
            v1.2.0 • k8s-prod-cluster
          </span>
        </div>

        {/* Right Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              backgroundColor: '#2A2838',
              borderRadius: '0px',
              border: '1px solid #555368',
              color: '#A5A3B4',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Search size={14} />
            <span>Tìm kiếm Pod, namespace...</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '0px',
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-accent)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ width: '6px', height: '6px', backgroundColor: '#000000' }}></span>
            <span>Trực tuyến (Bình thường)</span>
          </div>

          <div style={{ width: '28px', height: '28px', borderRadius: '0px', backgroundColor: '#2A2838', border: '1px solid #555368', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
            SH
          </div>
        </div>
      </div>

      {/* Main Body with Sidebar + Dashboard Content */}
      <div style={{ display: 'flex', minHeight: '430px' }}>
        {/* Compact Sidebar */}
        <div
          style={{
            width: '150px',
            borderRight: '1px solid var(--border-default)',
            backgroundColor: 'var(--color-canvas)',
            padding: '16px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {sidebarItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '0px',
                  backgroundColor: item.active ? 'var(--color-primary)' : 'transparent',
                  color: item.active ? '#FFFFFF' : 'var(--color-link)',
                  fontWeight: item.active ? 600 : 400,
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <Icon size={16} color={item.active ? 'var(--color-accent)' : 'var(--color-link)'} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Content Pane */}
        <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-secondary)' }}>
          
          {/* Header row in dashboard content */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Tổng quan hệ thống
              </h3>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  backgroundColor: 'rgba(40, 233, 159, 0.15)',
                  color: 'var(--color-primary)',
                  padding: '3px 8px',
                  borderRadius: '0px',
                  border: '1px solid var(--border-default)',
                }}
              >
                Agent trực tuyến
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Cập nhật: 10s trước
            </span>
          </div>

          {/* 5 Metric Tiles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '10px',
            }}
          >
            {metrics.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-canvas)',
                  borderRadius: '0px',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: 'none',
                }}
              >
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.label}
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.025em' }}>
                  {m.value}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  {m.change}
                </span>
              </div>
            ))}
          </div>

          {/* Split: Chart (Left) and Recent Activity (Right) */}
          <div style={{ display: 'flex', gap: '14px', flex: 1 }}>
            
            {/* Chart Container */}
            <div
              style={{
                flex: 1.55,
                padding: '12px 14px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '0px',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  Mức sử dụng tài nguyên
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-primary)', fontWeight: 600 }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '0px', backgroundColor: 'var(--color-primary)' }}></span>
                    CPU
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-primary)', fontWeight: 600 }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '0px', backgroundColor: 'var(--color-accent)' }}></span>
                    Bộ nhớ
                  </span>
                </div>
              </div>

              {/* Vector SVG Dual Wave Chart */}
              <div style={{ width: '100%', height: '95px', position: 'relative' }}>
                <svg
                  viewBox="0 0 320 95"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}
                >
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3D3B4F" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3D3B4F" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#28E99F" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#28E99F" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="0" y1="25" x2="320" y2="25" stroke="#E7E7E7" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1="60" x2="320" y2="60" stroke="#E7E7E7" strokeWidth="1" strokeDasharray="3 3" />

                  {/* CPU Area & Line */}
                  <path
                    d="M0 75 Q45 50, 90 58 T180 32 T260 40 T320 28 L320 95 L0 95 Z"
                    fill="url(#cpuGradient)"
                  />
                  <path
                    d="M0 75 Q45 50, 90 58 T180 32 T260 40 T320 28"
                    stroke="#3D3B4F"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Memory Area & Line */}
                  <path
                    d="M0 84 Q55 78, 100 68 T190 60 T270 52 T320 48 L320 95 L0 95 Z"
                    fill="url(#memGradient)"
                  />
                  <path
                    d="M0 84 Q55 78, 100 68 T190 60 T270 52 T320 48"
                    stroke="#28E99F"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Time axis */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--text-muted)',
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)',
                  paddingTop: '6px',
                }}
              >
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>24:00</span>
              </div>
            </div>

            {/* Recent Activity */}
            <div
              style={{
                flex: 1,
                padding: '12px 14px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '0px',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Hoạt động gần đây
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activities.map((act, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '0px',
                          backgroundColor: act.type === 'healing' ? 'var(--color-accent)' : act.type === 'ai' ? 'var(--color-primary)' : act.type === 'resolved' ? '#059669' : 'var(--color-accent)',
                        }}
                      ></span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
                        {act.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {act.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom AI Prediction Warning Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#FFFBEB',
              border: '1px solid var(--border-default)',
              borderRadius: '0px',
              fontSize: '0.78125rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '0px',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={14} />
              </div>
              <div>
                <span style={{ fontWeight: 700, color: '#92400E', fontFamily: 'var(--font-display)' }}>Dự đoán AI: </span>
                <span style={{ color: '#78350F', fontFamily: 'var(--font-body)' }}>Mức sử dụng bộ nhớ có thể vượt ngưỡng an toàn trong ~18 phút</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '0px',
                  backgroundColor: '#FDE68A',
                  color: '#92400E',
                  fontWeight: 700,
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                }}
              >
                Rủi ro: Trung bình
              </span>
              <ChevronRight size={16} color="#B45309" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DashboardPreview;
