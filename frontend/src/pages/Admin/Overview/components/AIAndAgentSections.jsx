import React from 'react';
import { Radio, Sparkles, CheckCircle2 } from 'lucide-react';
import WidgetContainer from '../../../../components/admin/WidgetContainer';

/**
 * Section 9: AI Overview
 */
export const AIOverviewSection = ({ aiData, status, errorMessage, onRetry }) => {
  return (
    <WidgetContainer
      title="Tổng Quan Trí Tuệ Nhân Tạo & Suy Diễn (AI & MAPE-K Engine)"
      subtitle="Hiệu năng mô hình học máy viễn trắc, độ chính xác phát hiện dị thường sớm"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
    >
      {aiData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Engine Header Box */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#F0FDF4',
              borderRadius: '10px',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#059669" />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#065F46' }}>
                {aiData.engineVersion}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857' }}>
              Độ chính xác dự báo: <span style={{ color: '#059669', fontSize: '0.875rem' }}>{aiData.predictionAccuracy}</span>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', lineHeight: 1.4 }}>
            {aiData.earlyCatchRate} • Đang duy trì <strong>{aiData.activeCausalGraphs}</strong> đồ thị nhân quả thời gian thực.
          </div>

          {/* Pending Policy Recommendations */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', marginBottom: '8px' }}>
              KHUYẾN NGHỊ TỐI ƯU HÓA TỰ ĐỘNG CHỜ XÁC NHẬN ({aiData.pendingRecommendations})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {aiData.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid var(--dash-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                      {rec.title}
                    </span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Độ tin cậy: {rec.confidence}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                    Lý do suy diễn: {rec.rationale}
                  </div>
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
 * Section 10: Agent Health
 */
export const AgentHealthSection = ({ agentData, status, errorMessage, onRetry }) => {
  return (
    <WidgetContainer
      title="Sức Khỏe Tác Tử eBPF (Agent Health & Kernel Probes)"
      subtitle="Tình trạng DaemonSet giám sát viễn trắc trên nhân Linux tại các Nodes máy chủ"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
    >
      {agentData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Header Stats */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              fontSize: '0.75rem',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={14} color="#059669" />
              <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{agentData.daemonSetStatus}</span>
            </div>
            <div style={{ color: 'var(--dash-text-muted)' }}>
              Độ trễ trung bình: <strong style={{ color: '#059669' }}>{agentData.averageLatency}</strong>
            </div>
            <div style={{ color: '#047857', fontWeight: 600 }}>{agentData.compatibility}</div>
          </div>

          {/* Probes Table */}
          <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '10px', overflow: 'hidden' }}>
            <table className="dash-table" style={{ width: '100%', fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Node Máy Chủ</th>
                  <th>Phiên Bản Agent</th>
                  <th>Nhân Linux Kernel</th>
                  <th>Độ Trễ</th>
                  <th style={{ textAlign: 'right' }}>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {agentData.probes.map((probe) => (
                  <tr key={probe.node}>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{probe.node}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{probe.version}</td>
                    <td style={{ color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)' }}>{probe.kernel}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#059669' }}>{probe.latency}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '1px 6px',
                          borderRadius: '9999px',
                          backgroundColor: '#ECFDF5',
                          color: '#065F46',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={10} color="#059669" />
                        <span>{probe.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
};
