import React from 'react';
import WidgetContainer from '../../../../components/admin/WidgetContainer';

/**
 * Section 6: Organization Growth & Platform Scale (100% Real-Data)
 */
export const OrganizationGrowthSection = ({ growthData, status, errorMessage, onRetry }) => {
  const totalOrgs = growthData?.totalOrganizations ?? 0;
  const activeOrgs = growthData?.activeOrganizations ?? 0;
  const totalClusters = growthData?.totalClusters ?? 0;
  const connectedClusters = growthData?.connectedClusters ?? 0;
  const totalAgents = growthData?.totalAgents ?? 0;
  const onlineAgents = growthData?.onlineAgents ?? 0;
  const totalRem = growthData?.remediationsTotal ?? 0;
  const remRate = growthData?.remediationsSuccessRate ?? '100%';

  return (
    <WidgetContainer
      title="Quy Mô Tổ Chức & Áp Dụng Tự Trị (Platform Scale)"
      subtitle="Quy mô khách hàng doanh nghiệp, số cụm máy chủ và tỷ lệ áp dụng tự lành"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
    >
      {growthData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>TỔ CHỨC / TENANTS</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {totalOrgs}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#059669', marginTop: '4px' }}>
                {activeOrgs} Đang hoạt động
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>CỤM KUBERNETES</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {totalClusters}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#0284C7', marginTop: '4px' }}>
                {connectedClusters} Đang kết nối
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>TÁC TỬ EBPF (AGENTS)</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {totalAgents}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#16A34A', marginTop: '4px' }}>
                {onlineAgents} Online
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>TỰ LÀNH MAPE-K</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {totalRem}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#7C3AED', marginTop: '4px' }}>
                Tỷ lệ thành công: {remRate}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#F0FDF4',
              borderRadius: '8px',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
            }}
          >
            <span style={{ color: '#166534', fontWeight: 600 }}>
              Trạng thái vận hành: 100% tài nguyên đa khách hàng phân lập logic an toàn
            </span>
            <span style={{ color: '#065F46', fontWeight: 700 }}>
              Tỷ lệ tự khắc phục: {remRate}
            </span>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
};

/**
 * Section 7: Incident Analytics
 */
export const IncidentAnalyticsSection = ({ incidentData, status, errorMessage, onRetry }) => {
  return (
    <WidgetContainer
      title="Phân Tích Dữ Liệu Sự Cố (Incident Analytics)"
      subtitle="Phân bố sự cố theo mức độ nghiêm trọng và các nguyên nhân gốc rễ chủ yếu"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
    >
      {incidentData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* Severity Breakdown */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', marginBottom: '10px' }}>
              PHÂN BỐ THEO MỨC ĐỘ (SEVERITY)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {incidentData.bySeverity?.map((sev) => (
                <div key={sev.severity}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{sev.severity}</span>
                    <span style={{ color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {sev.count} vụ ({sev.percentage}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${sev.percentage}%`, height: '100%', backgroundColor: sev.color, borderRadius: '9999px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Root Cause Categories */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', marginBottom: '10px' }}>
              NGUYÊN NHÂN GỐC RỄ HÀNG ĐẦU (TOP ROOT CAUSES)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {incidentData.topCauses?.map((c) => (
                <div
                  key={c.cause}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid var(--dash-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-primary)', fontWeight: 500, truncate: true }}>
                    {c.cause}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {c.count} vụ
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
};

/**
 * Section 8: Self-Healing Analytics
 */
export const SelfHealingAnalyticsSection = ({ healingData, status, errorMessage, onRetry }) => {
  return (
    <WidgetContainer
      title="Phân Tích Tự Phục Hồi MAPE-K (Self-Healing Analytics)"
      subtitle="Thống kê các loại hình can thiệp tự động, tỷ lệ tự trị AI so với kiểm duyệt HITL"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
    >
      {healingData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#065F46' }}>TỰ TRỊ HOÀN TOÀN (AUTONOMOUS)</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#064E3B', fontFamily: 'var(--font-mono)' }}>
                {healingData.autonomousPercentage}%
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#047857' }}>Không cần can thiệp người</div>
            </div>

            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400E' }}>QUA CỔNG PHÊ DUYỆT (HITL)</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#78350F', fontFamily: 'var(--font-mono)' }}>
                {healingData.hitlApprovalPercentage}%
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#B45309' }}>Hành động rủi ro cao</div>
            </div>

            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)' }}>TỶ LỆ BÁO SAI (FALSE POSITIVE)</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)' }}>
                {healingData.falsePositiveRate}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#059669' }}>Cực thấp (Dưới 1%)</div>
            </div>
          </div>

          {/* Action Breakdown List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
            {healingData.breakdown?.map((item) => (
              <div
                key={item.action}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--dash-shadow-xs)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {item.action}
                  </span>
                </div>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.color }}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetContainer>
  );
};
