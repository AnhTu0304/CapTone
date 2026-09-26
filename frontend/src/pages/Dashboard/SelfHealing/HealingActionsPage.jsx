import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Zap,
  RefreshCw
} from 'lucide-react';

export const HealingActionsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();

  // 5 stages of the MAPE-K Autonomous Loop
  const mapekStages = [
    { step: '1. MONITOR', name: 'Giám Sát Viễn Trắc', desc: 'Thu thập tín hiệu eBPF và Kubelet mỗi 500ms', active: true, color: '#0284C7' },
    { step: '2. ANALYZE', name: 'Phân Tích Bất Thường', desc: 'AI lọc nhiễu và đối chiếu đường cơ sở 30 ngày', active: true, color: '#2563EB' },
    { step: '3. PLAN', name: 'Lập Kế Hoạch Vá Lỗi', desc: 'Kiểm tra dung lượng node và tính toán blast radius', active: true, color: '#7C3AED' },
    { step: '4. EXECUTE', name: 'Thực Thi Tự Động', desc: 'Điều phối API Kubernetes qua ServiceAccount an toàn', active: true, color: '#059669' },
    { step: '5. KNOWLEDGE', name: 'Cập Nhật Tri Thức', desc: 'Ghi nhận MTTR và tối ưu hóa trọng số mô hình', active: true, color: '#0D9488' },
  ];

  // Active executing actions in the cluster
  const [actions] = useState([
    {
      id: 'ACT-9021',
      title: 'Tự động Scale Replicas từ 2 lên 3 cho payment-service',
      service: 'payment-service',
      namespace: 'production',
      stage: '4. EXECUTE',
      progress: 85,
      elapsed: '2.1s',
      policy: 'POL-AUTO-SCALE-P90',
      status: 'running',
    },
    {
      id: 'ACT-9022',
      title: 'Giải phóng cache kết nối tạm thời trên redis-cluster-leader-0',
      service: 'redis-cluster-leader-0',
      namespace: 'redis',
      stage: '4. EXECUTE',
      progress: 60,
      elapsed: '1.2s',
      policy: 'POL-FLUSH-CACHE-LAZY',
      status: 'running',
    },
    {
      id: 'ACT-9019',
      title: 'Khởi động lại Pod crash do rò rỉ bộ nhớ (Rolling Patch)',
      service: 'order-processor-66bf-aa18x',
      namespace: 'production',
      stage: '5. KNOWLEDGE',
      progress: 100,
      elapsed: '1.4s',
      policy: 'POL-RESTART-OOM',
      status: 'completed',
    },
  ]);

  return (
    <div className="dashboard-healing-actions-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Hành Động Tự Phục Hồi Đang Thực Thi (MAPE-K Closed Loop)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Vòng lặp tự trị liên tục: Giám sát &rarr; Phân tích &rarr; Lập kế hoạch &rarr; Thực thi &rarr; Tri thức
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
            <span>Đồng bộ tiến trình</span>
          </button>
        </div>
      </div>

      {/* 5-Stage MAPE-K Interactive Loop Visualization */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Tiến Trình 5 Giai Đoạn Của Vòng Lặp MAPE-K
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Chu trình phản hồi khép kín tự khắc phục sự cố không làm gián đoạn người dùng cuối
            </p>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              padding: '2px 8px',
              backgroundColor: 'rgba(5, 150, 105, 0.1)',
              color: '#059669',
              border: '1px solid #34D399',
            }}
          >
            AUTONOMOUS LOOP: HOẠT ĐỘNG
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
          }}
        >
          {mapekStages.map((st, idx) => (
            <div
              key={idx}
              style={{
                padding: '14px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderTop: `3px solid ${st.color}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: st.color }}>
                {st.step}
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                {st.name}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', lineHeight: 1.35 }}>
                {st.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Currently Running Actions List */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Hành Động Đang Chạy Trong Cụm ({actions.filter((a) => a.status === 'running').length} Đang thực thi)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Các can thiệp tự động đang được áp dụng trực tiếp lên Pods và Kubelet API
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {actions.map((act) => {
            const isCompleted = act.status === 'completed';

            return (
              <div
                key={act.id}
                style={{
                  padding: '16px 20px',
                  backgroundColor: isCompleted ? 'rgba(5, 150, 105, 0.03)' : '#FFFFFF',
                  border: isCompleted ? '1px solid #34D399' : '1px solid var(--dash-border)',
                  borderLeft: isCompleted ? '4px solid #059669' : '4px solid #2563EB',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-primary)' }}>
                        {act.id}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                        &bull; Mục tiêu: <strong>{act.service}</strong> ({act.namespace})
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          backgroundColor: isCompleted ? '#ECFDF5' : '#EFF6FF',
                          color: isCompleted ? '#059669' : '#2563EB',
                          border: `1px solid ${isCompleted ? '#A7F3D0' : '#BFDBFE'}`,
                        }}
                      >
                        {act.stage}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '4px 0 0 0' }}>
                      {act.title}
                    </h4>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 800, color: isCompleted ? '#059669' : '#2563EB' }}>
                      {isCompleted ? 'HOÀN THÀNH (100%)' : `TIẾN ĐỘ: ${act.progress}%`}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                      Thời gian chạy: {act.elapsed} &bull; Chính sách: {act.policy}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${act.progress}%`,
                      height: '100%',
                      backgroundColor: isCompleted ? '#059669' : '#2563EB',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HealingActionsPage;
