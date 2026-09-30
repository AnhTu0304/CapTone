import React from 'react';
import { Activity, ShieldCheck, AlertTriangle, Server } from 'lucide-react';
import WidgetContainer from '../../../../components/admin/WidgetContainer';

export const KPISection = ({ kpiData, status, errorMessage, onRetry }) => {
  return (
    <WidgetContainer
      title="Chỉ Số Hiệu Suất Trọng Yếu (Platform KPIs)"
      subtitle="Chỉ số vận hành tổng thể theo phạm vi giám sát được chọn"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
      style={{ padding: '20px' }}
    >
      {kpiData && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginTop: '4px',
          }}
        >
          {/* Card 1: Uptime */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Độ Khả Dụng Uptime
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={15} color="#15803D" />
              </div>
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#14532D', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
              {kpiData.uptime.value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.6875rem' }}>
              <span style={{ color: '#166534', fontWeight: 600 }}>{kpiData.uptime.label}</span>
              <span style={{ color: '#15803D', fontWeight: 700, backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>
                {kpiData.uptime.diff}
              </span>
            </div>
          </div>

          {/* Card 2: Self-Healing Rate */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tỷ Lệ Tự Phục Hồi
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={15} color="#059669" />
              </div>
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#064E3B', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
              {kpiData.selfHealingRate.value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.6875rem' }}>
              <span style={{ color: '#047857', fontWeight: 600 }}>{kpiData.selfHealingRate.label}</span>
              <span style={{ color: '#059669', fontWeight: 700, backgroundColor: '#D1FAE5', padding: '1px 6px', borderRadius: '4px' }}>
                {kpiData.selfHealingRate.diff}
              </span>
            </div>
          </div>

          {/* Card 3: Active Incidents */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sự Cố Đang Hoạt Động
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={15} color="#DC2626" />
              </div>
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#7F1D1D', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
              {kpiData.activeIncidents.value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.6875rem' }}>
              <span style={{ color: '#991B1B', fontWeight: 600 }}>{kpiData.activeIncidents.label}</span>
              <span style={{ color: '#DC2626', fontWeight: 700, backgroundColor: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
                {kpiData.activeIncidents.diff}
              </span>
            </div>
          </div>

          {/* Card 4: Managed Resources */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--dash-border)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tài Nguyên Chịu Tải
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Server size={15} color="#475569" />
              </div>
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
              {kpiData.managedResources.value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.6875rem' }}>
              <span style={{ color: 'var(--dash-text-secondary)', fontWeight: 600 }}>{kpiData.managedResources.label}</span>
              <span style={{ color: '#059669', fontWeight: 700, backgroundColor: '#ECFDF5', padding: '1px 6px', borderRadius: '4px' }}>
                {kpiData.managedResources.diff}
              </span>
            </div>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
};

export default KPISection;
