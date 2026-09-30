import React from 'react';
import { ShieldCheck, CheckCircle2, Cpu, Database, Bell, Radio } from 'lucide-react';
import WidgetContainer from '../../../../components/admin/WidgetContainer';

const ICON_MAP = {
  'control-plane': Cpu,
  'ebpf-pipeline': Radio,
  'mape-k-engine': ShieldCheck,
  'audit-ledger': Database,
  'webhook-dispatcher': Bell,
};

export const PlatformHealthSection = ({ healthData, status, errorMessage, onRetry }) => {
  return (
    <WidgetContainer
      title="Sức Khỏe Các Phân Hệ Nền Tảng (Platform Subsystems)"
      subtitle="Trạng thái phân giải dịch vụ lõi, độ trễ phản hồi và tính toàn vẹn của hệ thống tự lành"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
    >
      {healthData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '4px' }}>
          {healthData.map((item) => {
            const SubsystemIcon = ICON_MAP[item.id] || ShieldCheck;
            return (
              <div
                key={item.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: 'var(--dash-shadow-xs)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '9px',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SubsystemIcon size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', truncate: true }}>
                      {item.name}
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#ECFDF5',
                        color: '#065F46',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <CheckCircle2 size={11} color="#059669" />
                      <span>{item.status.toUpperCase()}</span>
                    </span>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px', lineHeight: 1.35 }}>
                    {item.detail}
                  </div>

                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                    Độ trễ phản hồi: <strong style={{ color: '#059669' }}>{item.latency}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetContainer>
  );
};

export default PlatformHealthSection;
