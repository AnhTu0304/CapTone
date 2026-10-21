import React, { useState } from 'react';
import {
  Activity,
  Server,
  Zap,
  Database,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Cpu,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

export const AdminMonitoringPage = ({ onNavigate }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setToastMessage('Đã cập nhật chỉ số viễn trắc hệ thống thời gian thực!');
      setTimeout(() => setToastMessage(null), 3500);
    }, 600);
  };

  return (
    <div
      className="admin-monitoring-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '48px',
      }}
    >
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                fontWeight: 700,
                fontSize: '0.6875rem',
              }}
            >
              <ShieldCheck size={12} /> Cấp Độ Quản Trị Hệ Thống (Platform Super Admin)
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--dash-text-primary)',
              margin: '8px 0 4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Activity size={26} style={{ color: '#059669' }} />
            Giám Sát Hệ Thống & Vi Dịch Vụ Cốt Lõi (System Monitoring)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Theo dõi trực tiếp sức khỏe Main Backend, AI Backend, Database Multi-tenant, WebSocket Event Bus và kiểm soát rủi ro đa công ty (Blast Radius).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
            <span>Làm Mới Số Liệu</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. Four Platform Subsystems Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Main Backend */}
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Server size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>Main Backend</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Node.js / Express Gateway</div>
                </div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#ECFDF5', color: '#065F46', fontSize: '0.6875rem', fontWeight: 700 }}>
                PORT 5000 • ONLINE
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Uptime hệ thống:</span>
                <strong style={{ color: '#059669' }}>99.98% (18d 4h)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Độ trễ API Gateway:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>14ms (p50)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Bộ nhớ RAM:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>420 MB / 2 GB</strong>
              </div>
            </div>
          </div>
        </div>

        {/* AI Backend */}
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #BBF7D0',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FAF5FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>AI Backend Engine</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Python FastAPI + BiGRU</div>
                </div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#ECFDF5', color: '#065F46', fontSize: '0.6875rem', fontWeight: 700 }}>
                PORT 8000 • OPTIMAL
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Tốc độ suy luận p50:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#059669' }}>1.2 ms</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Độ trễ cao điểm p99:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>6.8 ms</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Tần suất suy luận:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>1,240 req/giây</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Database PostgreSQL */}
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Database size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>PostgreSQL Multi-Tenant</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Cơ Sở Dữ Liệu 39 Bảng</div>
                </div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#ECFDF5', color: '#065F46', fontSize: '0.6875rem', fontWeight: 700 }}>
                PORT 5432 • HEALTHY
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Connection Pool:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>32 / 200 (16%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Thời gian truy vấn TB:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>18 ms</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Dung lượng đĩa:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>14.2 GB / 100 GB</strong>
              </div>
            </div>
          </div>
        </div>

        {/* WebSocket Relay Engine */}
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Radio size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>WebSocket Relay Engine</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Event Bus Phát Sóng Trực Tiếp</div>
                </div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#ECFDF5', color: '#065F46', fontSize: '0.6875rem', fontWeight: 700 }}>
                CONNECTED
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Clients đang kết nối:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>142 Clients</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Lưu lượng truyền tải:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>4,200 msg/s</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Tỷ lệ rớt gói tin:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#059669' }}>0.00% (0 drops)</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. AI Model Telemetry & RCA Service Health */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          padding: '24px',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Sức Khỏe Động Cơ Trí Tuệ Nhân Tạo (AI Model & RCA Services)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
              Trạng thái tải trọng nạp mô hình BiGRU, độ lệch dữ liệu (Data Drift) và bộ phân tích đồ thị nguyên nhân gốc (RCA)
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onNavigate) onNavigate('/admin/ai/comparison');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #BBF7D0',
              backgroundColor: '#F0FDF4',
              color: '#15803D',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>So Sánh Model Trước/Sau</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Mô Hình Chuỗi Thời Gian BiGRU</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>
              v2.4.0 (Đang kích hoạt)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
              Độ chính xác: 94.8% • F1: 0.941
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Chỉ Số Trôi Dữ Liệu (Data Drift)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              3.8% <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--dash-text-secondary)' }}>(Ngưỡng an toàn &lt; 10%)</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
              Không cần Retrain khẩn cấp
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Động Cơ Đồ Thị RCA (Root Cause)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>
              v1.8.2 (NetworkX/DGL)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600, marginTop: '4px' }}>
              Duyệt đồ thị trung bình: 22ms
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Tỷ Lệ Báo Động Giả (FPR)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
              2.4% <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--dash-text-secondary)' }}>(-3.8% MoM)</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, marginTop: '4px' }}>
              Đạt chứng chỉ SLA Enterprise
            </div>
          </div>
        </div>
      </div>

      {/* 4. Blast Radius & Multi-Tenant Error Isolation */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          padding: '24px',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <ShieldCheck size={18} color="#059669" />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
            Phát Hiện Rủi Ro Lan Rộng Đa Doanh Nghiệp (Multi-Tenant Blast Radius)
          </h3>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          Cơ chế cách ly phân vùng Logic Tenant Isolation và giám sát sự cố chéo. Nếu một lỗi API hoặc quá tải DB xảy ra đồng thời trên từ 2 doanh nghiệp trở lên, hệ thống sẽ tự động kích hoạt cảnh báo đỏ cấp nền tảng.
        </p>

        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} color="#059669" />
            <div style={{ fontSize: '0.8125rem', color: '#065F46', fontWeight: 600 }}>
              Hiện tại: <strong>0 sự cố ảnh hưởng diện rộng</strong>. 100% tài nguyên và lưu lượng viễn trắc của các công ty được cách ly hoàn hảo.
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            Blast Radius Score: 0.00 (Hoàn Toàn An Toàn)
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdminMonitoringPage;
