import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import AIPredictionForecastChart from '../../../components/dashboard/AIPredictionForecastChart';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Zap,
  Check
} from 'lucide-react';

export const PredictionsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [activePredictions] = useState([
    {
      id: 'AI-PRED-01',
      title: 'Nguy cơ Tràn bộ nhớ RAM (Memory Exhaustion) tại dịch vụ Thanh Toán',
      service: 'payment-service',
      namespace: 'production',
      metric: 'RAM',
      currentUsage: '74%',
      projectedPeak: '94% trong 18 phút tới',
      confidence: 87,
      severity: 'high',
      timeToImpact: '~18 phút',
      status: 'active',
      cause: 'Độ dốc rò rỉ bộ nhớ (Memory Leak slope) ổn định +2.4 MB/phút trong worker process sau đợt deploy v2.4.1.',
      recommendedAction: 'Tự động khởi động lại Pod dạng Rolling Patch và giải phóng cache',
      actionType: 'Rolling Patch Pods',
    },
    {
      id: 'AI-PRED-02',
      title: 'Bão hòa CPU (CPU Saturation) trên máy chủ Node worker-03',
      service: 'worker-03',
      namespace: 'cluster-wide',
      metric: 'CPU',
      currentUsage: '88%',
      projectedPeak: '98% trong 28 phút tới',
      confidence: 92,
      severity: 'critical',
      timeToImpact: '~28 phút',
      status: 'active',
      cause: '3 batch jobs xử lý ảnh nặng được lập lịch đồng thời trên cùng một node vật lý, vượt ngưỡng 80% allocatable.',
      recommendedAction: 'Kích hoạt Cổng HITL để tháo tải (Drain & Cordon) máy chủ worker-03',
      actionType: 'Drain Node (Cần duyệt HITL)',
    },
    {
      id: 'AI-PRED-03',
      title: 'Nguy cơ cạn kiệt Connection Pool cơ sở dữ liệu trên order-processor',
      service: 'order-processor',
      namespace: 'production',
      metric: 'Connections',
      currentUsage: '85%',
      projectedPeak: '100% trong 42 phút tới',
      confidence: 79,
      severity: 'medium',
      timeToImpact: '~42 phút',
      status: 'active',
      cause: 'Tốc độ giải phóng kết nối DB chậm hơn tốc độ đơn hàng phát sinh, lag Kafka partition #4.',
      recommendedAction: 'Tăng kích thước connection pool tạm thời từ 20 lên 40 và gắn proxy',
      actionType: 'Expand Pool',
    },
    {
      id: 'AI-PRED-04',
      title: 'Đột biến lưu lượng truy cập bất thường tại Cổng Ingress NGINX',
      service: 'ingress-nginx',
      namespace: 'ingress-nginx',
      metric: 'Network RPS',
      currentUsage: '62%',
      projectedPeak: '86% trong 55 phút tới',
      confidence: 84,
      severity: 'low',
      timeToImpact: '~55 phút',
      status: 'active',
      cause: 'Tỷ lệ yêu cầu tăng vọt từ dải IP lạ, có dấu hiệu chiến dịch cào dữ liệu scraping.',
      recommendedAction: 'Kích hoạt hạn chế tần suất (Rate Limiting) trên ingress controller',
      actionType: 'Enable Rate-Limit',
    },
  ]);

  const [appliedActions, setAppliedActions] = useState([]);
  const [dismissedActions, setDismissedActions] = useState([]);

  const handleMitigate = (id) => {
    setAppliedActions((prev) => [...prev, id]);
  };

  const handleDismiss = (id) => {
    setDismissedActions((prev) => [...prev, id]);
  };

  const filteredPredictions = useMemo(() => {
    return activePredictions.filter((p) => {
      if (dismissedActions.includes(p.id)) return false;
      if (selectedSeverity === 'all') return true;
      return p.severity === selectedSeverity;
    });
  }, [activePredictions, dismissedActions, selectedSeverity]);

  return (
    <div className="dashboard-predictions-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              AI Dự Báo Sự Cố Sớm & Phòng Ngừa Chủ Động
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Thuật toán học máy chuỗi thời gian đa biến phát hiện nguy cơ trước từ 15 đến 60 phút
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={triggerRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Chạy suy diễn mới</span>
          </button>
        </div>
      </div>

      {/* Honest AI Calibration & Readiness Notice */}
      <div
        style={{
          padding: '14px 18px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #3B82F6',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <ShieldCheck size={20} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1E3A8A', marginBottom: '2px' }}>
            Nguyên Tắc Minh Bạch Của AI Dự Báo SelfHeal
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#3B82F6', lineHeight: 1.45, margin: 0 }}>
            <strong>Cảnh báo xác suất, không phải sự cố đã xảy ra:</strong> Mô hình AI phân tích 42 biến số viễn trắc (eBPF telemetry, TCP retransmits, Kubelet metrics) để đưa ra dự báo sớm. Mọi hành động phòng ngừa có tác động lớn đến cụm máy chủ đều phải qua cổng phê duyệt của Con người (HITL Gate) trừ khi có chính sách ủy quyền hoàn toàn.
          </p>
        </div>
      </div>

      {/* Main Interactive Forecast Chart */}
      <AIPredictionForecastChart
        targetService="payment-service (Cluster Production)"
        metricType="RAM"
        totalCapacity={64}
        unit="GB RSS"
      />

      {/* Predictions List Section */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Danh Sách Rủi Ro Tiềm Ẩn Đang Được Theo Dõi ({filteredPredictions.length})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Xếp hạng theo mức độ khẩn cấp và thời gian còn lại trước khi chạm ngưỡng nguy hiểm
            </p>
          </div>

          {/* Severity Filter */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(61, 59, 79, 0.05)', padding: '2px', border: '1px solid var(--dash-border)' }}>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'critical', label: 'Khẩn cấp (Critical)' },
              { id: 'high', label: 'Cao (High)' },
              { id: 'medium', label: 'Trung bình (Medium)' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedSeverity(f.id)}
                style={{
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: selectedSeverity === f.id ? '#FFFFFF' : 'transparent',
                  color: selectedSeverity === f.id ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                  border: 'none',
                  boxShadow: selectedSeverity === f.id ? 'var(--dash-shadow-xs)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prediction Cards Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredPredictions.map((pred) => {
            const isMitigated = appliedActions.includes(pred.id);
            const isCritical = pred.severity === 'critical';
            const isHigh = pred.severity === 'high';

            return (
              <div
                key={pred.id}
                style={{
                  padding: '18px',
                  backgroundColor: isMitigated ? 'rgba(5, 150, 105, 0.03)' : '#FFFFFF',
                  border: isMitigated
                    ? '1px solid #34D399'
                    : isCritical
                    ? '1px solid #FDA4AF'
                    : isHigh
                    ? '1px solid #FDE68A'
                    : '1px solid var(--dash-border)',
                  borderLeft: isMitigated
                    ? '4px solid #059669'
                    : isCritical
                    ? '4px solid #E11D48'
                    : isHigh
                    ? '4px solid #F59E0B'
                    : '4px solid #3B82F6',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          backgroundColor: isCritical ? '#FFF1F2' : isHigh ? '#FFFBEB' : '#EFF6FF',
                          color: isCritical ? '#E11D48' : isHigh ? '#D97706' : '#2563EB',
                          border: `1px solid ${isCritical ? '#FDA4AF' : isHigh ? '#FDE68A' : '#BFDBFE'}`,
                        }}
                      >
                        {pred.severity.toUpperCase()}
                      </span>

                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                        {pred.id}
                      </span>

                      <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                        &bull; Mục tiêu: <strong>{pred.service}</strong> ({pred.namespace})
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 6px 0' }}>
                      {pred.title}
                    </h4>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                      <strong>Nguyên nhân nhận định:</strong> {pred.cause}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      <div>
                        <span style={{ color: 'var(--dash-text-muted)' }}>Hiện tại: </span>
                        <strong>{pred.currentUsage}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--dash-text-muted)' }}>Dự báo đỉnh: </span>
                        <strong style={{ color: isCritical ? '#E11D48' : '#D97706' }}>{pred.projectedPeak}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--dash-text-muted)' }}>Thời gian tới nguy hiểm: </span>
                        <strong style={{ color: '#E11D48' }}>{pred.timeToImpact}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--dash-text-muted)' }}>Độ tin cậy AI: </span>
                        <strong style={{ color: '#059669' }}>{pred.confidence}%</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions Right Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', justifyContent: 'center' }}>
                    {isMitigated ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          backgroundColor: 'rgba(5, 150, 105, 0.1)',
                          color: '#059669',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        <Check size={14} />
                        <span>ĐÃ KÍCH HOẠT PHÒNG NGỪA</span>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleMitigate(pred.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            backgroundColor: 'var(--dash-primary)',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Zap size={14} />
                          <span>Áp Dụng Phòng Ngừa Ngay</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDismiss(pred.id)}
                          style={{
                            padding: '4px 8px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--dash-text-muted)',
                            fontSize: '0.6875rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Bỏ qua cảnh báo này
                        </button>
                      </>
                    )}

                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Hành động: {pred.actionType}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PredictionsPage;
