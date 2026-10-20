import React from 'react';
import { Activity, ExternalLink } from 'lucide-react';

export const RealtimeMonitorPage = () => {
  return (
    <div className="dashboard-realtime-monitor" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Live Monitor Thời Gian Thực (AI Self-Healing)
            </h1>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              ● STREAMING LIVE
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Kết nối trực tiếp đường truyền WebSocket của Kubernetes Agent & AI Backend
          </p>
        </div>

        <a
          href="http://localhost:5000/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: '#0284c7',
            color: '#FFFFFF',
            borderRadius: 'var(--dash-radius-md)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <span>Mở Cửa Sổ Riêng</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Embedded Live Dashboard */}
      <div
        style={{
          flex: 1,
          minHeight: '700px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--dash-border)',
          backgroundColor: '#0f172a',
          boxShadow: 'var(--dash-shadow-card)',
        }}
      >
        <iframe
          src="http://localhost:5000/dashboard"
          title="SelfHeal Realtime Monitor"
          style={{ width: '100%', height: '100%', minHeight: '700px', border: 'none' }}
        />
      </div>
    </div>
  );
};

export default RealtimeMonitorPage;
