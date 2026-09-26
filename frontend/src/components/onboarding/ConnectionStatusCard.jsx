import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Activity, 
  Server, 
  ShieldAlert, 
  Radio, 
  Sparkles,
  Loader2
} from 'lucide-react';
import HeartbeatIndicator from './HeartbeatIndicator';

export const ConnectionStatusCard = ({
  statusState = 'connected', // 'waiting' | 'connecting' | 'connected' | 'failed' | 'permission_denied' | 'token_expired' | 'offline'
  agentData,
  className = '',
}) => {
  const getStatusBadge = () => {
    switch (statusState) {
      case 'connected':
        return {
          label: 'ĐÃ KẾT NỐI',
          bg: 'rgba(40, 233, 159, 0.15)',
          color: '#059669',
          border: 'var(--color-accent)',
          icon: CheckCircle2,
        };
      case 'connecting':
        return {
          label: 'ĐANG KẾT NỐI...',
          bg: '#EFF6FF',
          color: '#2563EB',
          border: '#BFDBFE',
          icon: Loader2,
        };
      case 'waiting':
        return {
          label: 'ĐANG CHỜ POD',
          bg: '#F8FAFC',
          color: '#475569',
          border: '#CBD5E1',
          icon: Clock,
        };
      case 'failed':
        return {
          label: 'KẾT NỐI THẤT BẠI',
          bg: '#FFF1F2',
          color: '#E11D48',
          border: '#FDA4AF',
          icon: AlertCircle,
        };
      case 'permission_denied':
        return {
          label: 'BỊ TỪ CHỐI QUYỀN',
          bg: '#FFFBEB',
          color: '#D97706',
          border: '#FDE68A',
          icon: ShieldAlert,
        };
      case 'token_expired':
        return {
          label: 'TOKEN HẾT HẠN',
          bg: '#FFF1F2',
          color: '#E11D48',
          border: '#FDA4AF',
          icon: AlertCircle,
        };
      case 'offline':
      default:
        return {
          label: 'TÁC TỬ NGOẠI TUYẾN',
          bg: '#F1F5F9',
          color: '#64748B',
          border: '#CBD5E1',
          icon: Radio,
        };
    }
  };

  const badge = getStatusBadge();
  const BadgeIcon = badge.icon;

  const isConnected = statusState === 'connected';

  return (
    <div
      className={`onboarding-connection-status-card ${className}`}
      style={{
        padding: '24px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        marginBottom: '24px',
      }}
    >
      {/* Top Header with Status Badge & Heartbeat */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px dashed var(--border-default)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.border}`,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <BadgeIcon size={14} className={statusState === 'connecting' ? 'animate-spin' : ''} />
            <span>{badge.label}</span>
          </div>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            Tác tử Cụm v1.2.4
          </span>
        </div>

        {isConnected && (
          <HeartbeatIndicator
            status="active"
            lastSeen={agentData?.lastHeartbeat || '2s ago'}
            latencyMs={agentData?.latencyMs || 14}
          />
        )}
      </div>

      {/* 4 Status Indicator Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        {/* Card 1: Agent Connection */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'rgba(61, 59, 79, 0.03)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              1. CỔNG KẾT NỐI SOCKET
            </span>
            {isConnected ? (
              <CheckCircle2 size={14} color="#059669" />
            ) : (
              <AlertCircle size={14} color="#E11D48" />
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-ink)' }}>
            {isConnected ? 'Bảo mật TLS v1.3' : 'Đang chờ bắt tay'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isConnected ? 'DaemonSet hoạt động trên tất cả nodes' : 'Pod chưa được lập lịch'}
          </div>
        </div>

        {/* Card 2: Heartbeat */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'rgba(61, 59, 79, 0.03)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              2. NHỊP TIM HEARTBEAT
            </span>
            {isConnected ? (
              <Activity size={14} color="#059669" />
            ) : (
              <Clock size={14} color="#94A3B8" />
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-ink)' }}>
            {isConnected ? agentData?.lastHeartbeat || '3s trước' : 'Không có tín hiệu'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isConnected ? 'Tần suất: mỗi 5s' : 'Đang chờ ping khởi tạo'}
          </div>
        </div>

        {/* Card 3: Kubernetes Access */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'rgba(61, 59, 79, 0.03)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              3. TRUY CẬP K8S
            </span>
            {isConnected ? (
              <Server size={14} color="#059669" />
            ) : (
              <AlertCircle size={14} color="#94A3B8" />
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-ink)' }}>
            {isConnected ? `${agentData?.k8sVersion || 'v1.29.4'} (${agentData?.nodeCount || 4} Nodes)` : 'Chưa xác thực'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isConnected ? 'Đã xác thực quyền RBAC hẹp' : 'Kiểm tra ClusterRoleBinding'}
          </div>
        </div>

        {/* Card 4: Monitoring Readiness */}
        <div
          style={{
            padding: '14px',
            backgroundColor: 'rgba(61, 59, 79, 0.03)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              4. MỨC ĐỘ SẴN SÀNG GIÁM SÁT
            </span>
            {isConnected ? (
              <CheckCircle2 size={14} color="#059669" />
            ) : (
              <Clock size={14} color="#94A3B8" />
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-ink)' }}>
            {isConnected ? `${agentData?.podsMonitored || 38} Pods Trong Phạm Vi` : 'Không hoạt động'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isConnected ? 'Đang truyền dữ liệu viễn trắc' : 'Đang chờ đường ống số liệu'}
          </div>
        </div>
      </div>

      {/* Clear Distinction: Agent Connection vs Monitoring Readiness vs AI Data Readiness */}
      <div
        style={{
          padding: '14px 16px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #3B82F6',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <Sparkles size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8125rem', fontWeight: 700, color: '#1E3A8A', marginBottom: '2px' }}>
            Thông báo Hiệu chuẩn Dữ liệu AI
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#3B82F6', lineHeight: 1.45, margin: 0 }}>
            <strong>Lưu ý về Mức độ Sẵn sàng của AI Tự phục hồi:</strong> Kết nối Tác tử sẽ khởi chạy giám sát thời gian thực ngay lập tức. Tuy nhiên, tính năng AI dự đoán sự cố chủ động yêu cầu từ 24-48 giờ dữ liệu lưu lượng thông thường ({agentData?.telemetrySamples || 1420} / {agentData?.requiredSamples || 3000} mẫu đường cơ sở) trước khi chính sách tự động khắc phục có thể kích hoạt mà không cần phê duyệt thủ công.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatusCard;
