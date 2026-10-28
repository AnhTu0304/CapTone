import React from 'react';
import {
  Building2,
  Users,
  Cpu,
  Server,
  Activity,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import WidgetContainer from '../../../../components/admin/WidgetContainer';

export const KPISection = ({ kpiData, status, errorMessage, onRetry, onNavigate }) => {
  return (
    <WidgetContainer
      title="Chỉ Số Hoạt Động Cốt Lõi Nền Tảng (Core Platform Pillars)"
      subtitle="Theo dõi tình trạng hoạt động tổng thể của toàn bộ nền tảng SelfAI: Company, User, Agent và Cluster"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
      style={{ padding: '20px' }}
    >
      {kpiData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <style>{`
            .admin-kpi-pillars-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 16px;
            }
            .admin-kpi-metrics-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            @media (max-width: 992px) {
              .admin-kpi-pillars-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
              .admin-kpi-metrics-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }
            @media (max-width: 540px) {
              .admin-kpi-pillars-grid {
                grid-template-columns: 1fr;
              }
              .admin-kpi-metrics-grid {
                grid-template-columns: 1fr;
              }
            }
          `}</style>

          {/* TOP ROW: 4 CORE PILLARS (4 CARDS PER ROW) */}
          <div className="admin-kpi-pillars-grid">
            {/* Card 1: Companies */}
            <div
              onClick={() => onNavigate && onNavigate('/admin/companies')}
              style={{
                padding: '16px 18px',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                boxShadow: 'var(--dash-shadow-xs)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#059669';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--dash-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={16} color="#059669" />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tổng Số Company
                    </span>
                  </div>
                  <ArrowRight size={14} color="var(--dash-text-muted)" />
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                  {kpiData.companies?.total ?? 86}
                </div>
              </div>
              <div style={{ marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#059669', fontWeight: 700 }}>
                      <CheckCircle2 size={11} color="#059669" />
                      {kpiData.companies?.active ?? 82} Active
                    </span>
                    <span style={{ color: '#94A3B8' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#D97706', fontWeight: 700 }}>
                      <AlertTriangle size={11} color="#D97706" />
                      {kpiData.companies?.incident ?? 0} Sự cố/Treo
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                    {kpiData.companies?.diff || '+4 mới'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Users */}
            <div
              onClick={() => onNavigate && onNavigate('/admin/users')}
              style={{
                padding: '16px 18px',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                boxShadow: 'var(--dash-shadow-xs)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#059669';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--dash-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={16} color="#2563EB" />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tổng Số User
                    </span>
                  </div>
                  <ArrowRight size={14} color="var(--dash-text-muted)" />
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                  {(kpiData.users?.total ?? 0).toLocaleString()}
                </div>
              </div>
              <div style={{ marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#059669', fontWeight: 700 }}>
                      <CheckCircle2 size={11} color="#059669" />
                      {(kpiData.users?.active ?? 0).toLocaleString()} Active
                    </span>
                    <span style={{ color: '#94A3B8' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#DC2626', fontWeight: 700 }}>
                      <XCircle size={11} color="#DC2626" />
                      {kpiData.users?.locked ?? 0} Bị khóa
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#2563EB', backgroundColor: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>
                    {kpiData.users?.diff || '+128 mới'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Agents */}
            <div
              onClick={() => onNavigate && onNavigate('/admin/agents')}
              style={{
                padding: '16px 18px',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                boxShadow: 'var(--dash-shadow-xs)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#059669';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--dash-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Cpu size={16} color="#059669" />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tổng Số Agent Toàn Mạng
                    </span>
                  </div>
                  <ArrowRight size={14} color="var(--dash-text-muted)" />
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                  {kpiData.agents?.total ?? 0}
                </div>
              </div>
              <div style={{ marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#059669', fontWeight: 700 }}>
                      <CheckCircle2 size={11} color="#059669" />
                      {kpiData.agents?.online ?? 0} Online
                    </span>
                    <span style={{ color: '#94A3B8' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#64748B', fontWeight: 700 }}>
                      <XCircle size={11} color="#64748B" />
                      {kpiData.agents?.offline ?? 0} Offline
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                    {kpiData.agents?.diff || '95.3%'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Clusters */}
            <div
              onClick={() => onNavigate && onNavigate('/admin/clusters')}
              style={{
                padding: '16px 18px',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                boxShadow: 'var(--dash-shadow-xs)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#059669';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--dash-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Server size={16} color="#475569" />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tổng Số Cụm K8s
                    </span>
                  </div>
                  <ArrowRight size={14} color="var(--dash-text-muted)" />
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                  {kpiData.clusters?.total ?? 0}
                </div>
              </div>
              <div style={{ marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#059669', fontWeight: 700 }}>
                      <CheckCircle2 size={11} color="#059669" />
                      {kpiData.clusters?.healthy ?? 0} Ổn định
                    </span>
                    <span style={{ color: '#94A3B8' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#D97706', fontWeight: 700 }}>
                      <AlertTriangle size={11} color="#D97706" />
                      {kpiData.clusters?.degraded ?? 0} Cần chú ý
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                    {kpiData.clusters?.diff || '6 Vùng'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECONDARY ROW: SLA & ENGINE PERFORMANCE METRICS (4 CARDS PER ROW) */}
          <div
            className="admin-kpi-metrics-grid"
            style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--dash-border)',
              borderRadius: '10px',
              padding: '12px 16px',
            }}
          >
            {/* Metric 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={14} color="#15803D" />
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>ĐỘ KHẢ DỤNG SLA</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#15803D', fontFamily: 'var(--font-mono)' }}>
                  {kpiData.uptime?.value || '99.98%'} <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#166534' }}>({kpiData.uptime?.diff || '+0.08%'})</span>
                </div>
              </div>
            </div>

            {/* Metric 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={14} color="#059669" />
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TỰ PHỤC HỒI MAPE-K</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#065F46', fontFamily: 'var(--font-mono)' }}>
                  {kpiData.selfHealingRate?.value || '94.2%'} <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#047857' }}>(MTTR 1.4s)</span>
                </div>
              </div>
            </div>

            {/* Metric 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={14} color="#DC2626" />
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>SỰ CỐ TOÀN NỀN TẢNG</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#DC2626', fontFamily: 'var(--font-mono)' }}>
                  {kpiData.activeIncidents?.value || '1 Khẩn Cấp'} <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#991B1B' }}>(Đang xử lý)</span>
                </div>
              </div>
            </div>

            {/* Metric 4 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Server size={14} color="#475569" />
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TÀI NGUYÊN QUẢN LÝ</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {kpiData.managedResources?.value || '12 Nodes / 186 Pods'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
};

export default KPISection;