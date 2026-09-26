import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import SelfHealingTrendChart from '../../../components/dashboard/SelfHealingTrendChart';
import {
  History,
  CheckCircle2,
  Search,
  RefreshCw
} from 'lucide-react';

const HISTORY_RECORDS = [
  {
    id: 'HIST-4091',
    title: 'Tự động khởi động lại Pod order-processor sau lỗi OOMKilled',
    target: 'Pod/order-processor-66bf-aa18x',
    namespace: 'production',
    policy: 'POL-RESTART-OOM',
    mttr: '1.4 giây',
    result: 'Thành công (100%)',
    timestamp: '28 phút trước',
    verifiedBy: 'MAPE-K Health Probe',
  },
  {
    id: 'HIST-4088',
    title: 'Xóa bộ nhớ đệm cache và giải phóng kết nối Redis',
    target: 'StatefulSet/redis-cluster-leader-0',
    namespace: 'redis',
    policy: 'POL-FLUSH-CACHE-LAZY',
    mttr: '1.1 giây',
    result: 'Thành công (100%)',
    timestamp: '1 giờ trước',
    verifiedBy: 'TCP Ping Probe',
  },
  {
    id: 'HIST-4085',
    title: 'Scale Replicas từ 2 lên 4 do nghẽn hàng đợi thanh toán',
    target: 'Deployment/payment-service',
    namespace: 'production',
    policy: 'POL-AUTO-SCALE-P90',
    mttr: '2.3 giây',
    result: 'Thành công (100%)',
    timestamp: '3 giờ trước',
    verifiedBy: 'Kubelet Metrics',
  },
  {
    id: 'HIST-4080',
    title: 'Khôi phục kết nối Gateway và làm mới cấu hình Envoy',
    target: 'Deployment/api-gateway',
    namespace: 'production',
    policy: 'POL-ENVOY-RELOAD',
    mttr: '1.8 giây',
    result: 'Thành công (100%)',
    timestamp: '5 giờ trước',
    verifiedBy: 'HTTP 200 Probe',
  },
  {
    id: 'HIST-4074',
    title: 'Cân bằng lại lưu lượng Ingress sau sự cố mạng đột biến',
    target: 'Ingress/production-ingress',
    namespace: 'ingress-nginx',
    policy: 'POL-INGRESS-REBALANCE',
    mttr: '1.6 giây',
    result: 'Thành công (100%)',
    timestamp: '8 giờ trước',
    verifiedBy: 'P99 Latency Monitor',
  },
];

export const ActionHistoryPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = useMemo(() => {
    return HISTORY_RECORDS.filter((rec) => {
      return (
        !searchTerm ||
        rec.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.target.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [searchTerm]);

  return (
    <div className="dashboard-action-history-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Lịch Sử Tự Phục Hồi & Báo Cáo Hiệu Quả MTTR
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Bản ghi bất biến về mọi hành động can thiệp tự động đã được kiểm chứng thành công
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
            <span>Làm mới lịch sử</span>
          </button>
        </div>
      </div>

      {/* Embedded Self-Healing Trend Chart */}
      <SelfHealingTrendChart />

      {/* History Records Table */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Nhật Ký Hành Động Đã Hoàn Tất ({filteredHistory.length})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Thời gian hồi phục trung bình đạt 1.62s &bull; Đạt cam kết chuẩn SLA cho SME
            </p>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Tìm kiếm hành động, đối tượng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                height: '32px',
                width: '260px',
                padding: '0 10px 0 28px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                outline: 'none',
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--dash-text-muted)' }} />
          </div>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>MÃ BẢN GHI</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>HÀNH ĐỘNG & NỘI DUNG</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>ĐỐI TƯỢNG (TARGET)</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>THỜI GIAN MTTR</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>KẾT QUẢ KIỂM TRA</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>THỜI ĐIỂM</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((rec) => (
                <tr key={rec.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    {rec.id}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{rec.title}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Chính sách: {rec.policy}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--dash-primary)' }}>
                    <div>{rec.target}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>ns: {rec.namespace}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>
                    {rec.mttr}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 600 }}>
                      <CheckCircle2 size={13} />
                      <span>{rec.result}</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{rec.verifiedBy}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                    {rec.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ActionHistoryPage;
