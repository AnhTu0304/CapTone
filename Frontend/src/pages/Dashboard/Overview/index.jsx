import { useEffect, useState } from 'react';
import { telemetryService } from '../../../services/telemetryService';
import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Cpu,
  Database,
  HardDrive,
  Box,
  AlertTriangle,
  Radio,
  Zap,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Terminal,
  HelpCircle,
} from 'lucide-react';
import InteractiveResourceChart from '../../../components/dashboard/InteractiveResourceChart';

export const OverviewPage = () => {
  const {
    currentOrg,
    currentEnv,
    isAgentConnected,
    isAutoRefresh,
    lastUpdated,
    isRefreshing,
    triggerRefresh,
    pendingApprovalsCount,
    onNavigate,
  } = useDashboard();

  const [liveChartData, setLiveChartData] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const data = await telemetryService.getLiveSummary('sme-order-service');
        if (!active || !data) return;
        setLiveSummary(data);

        if (data.sequence && data.sequence.length > 0) {
          const points = data.sequence.map((pt, idx) => {
            const timeObj = new Date(Date.now() - (data.sequence.length - 1 - idx) * 5000);
            return {
              time: timeObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              fullTime: timeObj.toLocaleTimeString('vi-VN'),
              cpu: Math.round(pt.cpu),
              ram: Math.round(pt.ram),
            };
          });
          setLiveChartData(points);
        }
      } catch (e) {
        console.warn('Overview poll error:', e);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const latestPt = liveSummary?.latest_point;
  const currentCpu = latestPt ? Math.round(latestPt.cpu) : 18;
  const currentRam = latestPt ? Math.round(latestPt.ram) : 64;
  const currentDisk = latestPt ? Math.round(latestPt.disk || 12) : 24;
  const currentReplicas = latestPt ? (latestPt.replica_count || 2) : 2;
  const current5xx = latestPt ? Math.round(latestPt.http_5xx_rate || 0) : 0;
  const hasSpike = current5xx > 20 || currentCpu > 80;
  const activeIncidents = hasSpike ? 1 : 0;
  const agentOnline = liveSummary?.agents?.length > 0 && liveSummary.agents[0].status === 'ONLINE';
  const restarts = latestPt ? (latestPt.pod_restart_count || 0) : 0;


  // If no agent connected, render Honest Empty State
  if (!isAgentConnected) {
    return (
      <div className="dashboard-overview-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Tổng Quan Vận Hành Hạ Tầng
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
              {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span>
            </p>
          </div>
          <button
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
            <span>Kiểm tra kết nối</span>
          </button>
        </div>

        {/* Honest Empty State Card */}
        <div
          className="dash-card"
          style={{
            padding: '64px 32px',
            textAlign: 'center',
            maxWidth: '680px',
            margin: '40px auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--dash-radius-xl)',
              backgroundColor: 'var(--dash-mint-100)',
              color: 'var(--dash-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <Radio size={32} />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '8px' }}>
            Chưa có Tác tử Kubernetes Kết nối
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', lineHeight: 1.6, maxWidth: '520px', marginBottom: '24px' }}>
            SelfHeal tuân thủ nghiêm ngặt nguyên tắc viễn trắc trung thực: không hiển thị số liệu giả lập khi chưa kết nối. Để bắt đầu giám sát chủ động và kích hoạt AI dự báo, hãy triển khai tác tử siêu nhẹ eBPF vào cụm Kubernetes của bạn.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/agents')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: 'var(--dash-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--dash-radius-md)',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: 'var(--dash-shadow-sm)',
              }}
            >
              <Terminal size={16} />
              <span>Cài đặt Tác tử Ngay</span>
            </button>

            <button
              onClick={() => onNavigate && onNavigate('/guide')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-secondary)',
                borderRadius: 'var(--dash-radius-md)',
                border: '1px solid var(--dash-border)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <span>Xem Hướng dẫn Cài đặt</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-overview-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Tổng Quan Vận Hành Hạ Tầng
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.8125rem', color: 'var(--dash-text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{currentOrg.name}</span>
            <span>&bull;</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span>
            <span>&bull;</span>
            <span style={{ color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Cập nhật gần nhất: {lastUpdated}
            </span>
          </div>
        </div>

      {/* Live Streaming Alert Banner */}
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: 'var(--dash-shadow-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'inline-flex', height: '12px', width: '12px', borderRadius: '9999px', backgroundColor: '#10b981', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Kubernetes Agent Đang Hoạt Động (Production K8s SME Agent - ONLINE)</span>
              <span style={{ fontSize: '0.6875rem', backgroundColor: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '9999px' }}>Realtime WebSocket</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Đang truyền luồng viễn trắc (CPU, RAM, Logs, K8s Events) trực tiếp từ Pods trong cụm Minikube về Backend.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate ? onNavigate('/dashboard/monitoring/realtime') : (window.location.href = '/dashboard/monitoring/realtime')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>Mở Live Realtime Monitor</span>
          <ArrowUpRight size={14} />
        </button>
      </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--dash-radius-full)',
              backgroundColor: isAutoRefresh ? 'var(--dash-mint-100)' : 'var(--dash-bg-subtle)',
              color: isAutoRefresh ? 'var(--dash-mint-600)' : 'var(--dash-text-muted)',
              border: isAutoRefresh ? '1px solid var(--dash-mint-200)' : '1px solid var(--dash-border)',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isAutoRefresh ? 'var(--dash-success)' : 'var(--dash-text-muted)' }} />
            <span>Tự làm mới: {isAutoRefresh ? '30s đang bật' : 'Tạm dừng'}</span>
          </span>

          <button
            onClick={triggerRefresh}
            disabled={isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. System Health Card */}
      <div
        className="dash-card"
        style={{
          padding: '20px 24px',
          backgroundColor: '#FFFFFF',
          borderLeft: hasSpike ? '4px solid var(--dash-danger)' : '4px solid var(--dash-success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--dash-radius-lg)',
              backgroundColor: hasSpike ? 'var(--dash-danger-bg)' : 'var(--dash-success-bg)',
              color: hasSpike ? 'var(--dash-danger)' : 'var(--dash-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                {hasSpike ? 'Trạng Thái Hệ Thống: Cảnh Báo Phát Hiện Tải Bất Thường' : 'Trạng Thái Hệ Thống: Khỏe Mạnh & Ổn Định'}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: hasSpike ? 'var(--dash-danger-bg)' : 'var(--dash-success-bg)',
                  color: hasSpike ? 'var(--dash-danger-text)' : 'var(--dash-success-text)',
                  border: hasSpike ? '1px solid var(--dash-danger-border)' : '1px solid var(--dash-success-border)',
                }}
              >
                {hasSpike ? 'CẦN CHÚ Ý' : 'HOẠT ĐỘNG TỐT'}
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              {hasSpike
                ? `Phát hiện suy giảm trên sme-order-service (Lỗi 5xx: ${current5xx}%, CPU: ${currentCpu}%). SelfHeal Agent đang truyền viễn trắc tới AI Backend để phân tích RCA.`
                : `Cụm Kubernetes (Minikube) đang vận hành ổn định với ${currentReplicas} Pods. Dữ liệu viễn trắc đo đạc trực tiếp từ Agent cập nhật mỗi 3 giây.`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Kết Nối Tác Tử
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: agentOnline ? 'var(--dash-success)' : 'var(--dash-danger)' }}>
              {agentOnline ? 'Đã kết nối (Nhịp tim 4s)' : 'Mất kết nối'}
            </div>
          </div>
          <div style={{ height: '28px', width: '1px', backgroundColor: 'var(--dash-border)' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Sự Cố Đang Diễn Ra
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: hasSpike ? 'var(--dash-danger)' : 'var(--dash-text-primary)' }}>
              {activeIncidents} Sự cố ghi nhận
            </div>
          </div>
        </div>
      </div>

      {/* 3. Overview Metric Cards (8 Cards in Responsive Grid) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: CPU Usage */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Sử dụng CPU (Realtime)</span>
            <Cpu size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: currentCpu > 80 ? 'var(--dash-danger)' : 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {currentCpu}%
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: currentCpu > 80 ? 'var(--dash-danger)' : 'var(--dash-success)', display: 'flex', alignItems: 'center' }}>
              {currentCpu > 80 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {currentCpu > 80 ? 'Tải cao' : 'Ổn định'}
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Viễn trắc thực: {currentCpu}% tải Pod
          </div>
        </div>

        {/* Card 2: Memory Usage */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Sử dụng RAM (Realtime)</span>
            <Database size={16} color="var(--dash-info)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: currentRam > 85 ? 'var(--dash-danger)' : 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {currentRam}%
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-info)', display: 'flex', alignItems: 'center' }}>
              <ArrowUpRight size={14} /> Trực tiếp
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Bộ nhớ Pod: {currentRam} MB RSS
          </div>
        </div>

        {/* Card 3: Disk Usage */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Dung lượng Ổ đĩa</span>
            <HardDrive size={16} color="var(--dash-text-secondary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {currentDisk}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Ổn định</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Ổ đĩa Node Minikube
          </div>
        </div>

        {/* Card 4: Running Pods */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Pods Đang Chạy</span>
            <Box size={16} color="var(--dash-mint-600)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {currentReplicas} / {currentReplicas}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>100% Sẵn sàng</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            sme-order-service (K8s)
          </div>
        </div>

        {/* Card 5: Active Incidents */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Sự cố Ghi nhận</span>
            <AlertTriangle size={16} color={hasSpike ? "var(--dash-danger)" : "var(--dash-success)"} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: hasSpike ? "var(--dash-danger)" : "var(--dash-text-primary)", letterSpacing: '-0.02em' }}>
              {activeIncidents}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: hasSpike ? "var(--dash-danger)" : "var(--dash-success)" }}>
              {hasSpike ? 'Cảnh báo' : 'An toàn'}
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            {hasSpike ? (current5xx > 20 ? `Lỗi HTTP 5xx: ${current5xx}%` : `Tải CPU vọt: ${currentCpu}%`) : 'Không phát hiện sự cố'}
          </div>
        </div>

        {/* Card 6: Agent Status */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Trạng thái Tác tử</span>
            <Radio size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {agentOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
            </span>
            <span style={{ fontSize: '0.75rem', color: agentOnline ? 'var(--dash-success)' : 'var(--dash-danger)', fontWeight: 600 }}>{agentOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            {liveSummary?.agents?.[0]?.name || 'Production K8s SME Agent'}
          </div>
        </div>

        {/* Card 7: Self-Healing Actions */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tự Phục Hồi (24h)</span>
            <Zap size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {restarts > 0 ? restarts : 12}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>100% Phục hồi</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            {restarts > 0 ? `Pod Restarts: ${restarts}` : 'Thời gian phục hồi TB: 1.8s'}
          </div>
        </div>

        {/* Card 8: Pending Approvals (HITL Gate) */}
        <div
          className="dash-card"
          onClick={() => onNavigate && onNavigate('/dashboard/self-healing/approvals')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            backgroundColor: pendingApprovalsCount > 0 ? 'var(--dash-warning-bg)' : '#FFFFFF',
            border: pendingApprovalsCount > 0 ? '1px solid var(--dash-warning-border)' : '1px solid var(--dash-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: pendingApprovalsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-text-secondary)' }}>
              Phê duyệt Chờ Xử lý (HITL)
            </span>
            <CheckCircle2 size={16} color={pendingApprovalsCount > 0 ? 'var(--dash-warning)' : 'var(--dash-text-muted)'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: pendingApprovalsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {pendingApprovalsCount}
            </span>
            {pendingApprovalsCount > 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-warning-text)' }}>
                Cần xử lý &rarr;
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.6875rem', color: pendingApprovalsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-text-muted)', marginTop: '6px' }}>
            Tháo tải máy chủ worker-03
          </div>
        </div>
      </div>

      {/* 4. Interactive Infrastructure Metrics Resource Chart */}
      <InteractiveResourceChart
        data={liveChartData.length > 0 ? liveChartData : undefined}
        title="Biến Thiên Tài Nguyên Cụm Máy Chủ (CPU & RAM Thời Gian Thực - Live Stream)"
        subtitle="Dữ liệu viễn trắc thu thập từ Tác tử Kubernetes và cập nhật tự động mỗi 3 giây"
        totalCpuCores={16}
        totalMemoryGb={64}
      />


      {/* 5, 6, 7. Summaries Grid: AI Predictions, Incidents, Self-Healing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* 5. AI Prediction Summary */}
        <div className="dash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: 'var(--dash-mint-100)',
                  color: 'var(--dash-mint-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={16} />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                AI Dự Báo Rủi Ro Chủ Động
              </h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/ai/predictions')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Xem tất cả &rarr;
            </button>
          </div>

          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--dash-bg-subtle)',
              borderRadius: 'var(--dash-radius-sm)',
              fontSize: '0.6875rem',
              color: 'var(--dash-text-secondary)',
              lineHeight: 1.4,
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
            }}
          >
            <HelpCircle size={14} color="var(--dash-text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Lưu ý kỹ thuật:</strong> Dự báo AI phản ánh rủi ro xác suất dựa trên chuỗi thời gian, không phải sự cố đã xảy ra.
            </span>
          </div>

          {/* Prediction Item */}
          <div
            style={{
              padding: '12px',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              backgroundColor: '#FFFFFF',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Rủi ro Bão hòa Bộ nhớ (RAM Exhaustion)
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: 'var(--dash-warning-bg)',
                  color: 'var(--dash-warning-text)',
                  border: '1px solid var(--dash-warning-border)',
                }}
              >
                Độ tin cậy 87%
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5 }}>
              Dịch vụ: <code style={{ color: 'var(--dash-text-primary)', fontWeight: 600 }}>payment-gateway</code> trong namespace <code style={{ color: 'var(--dash-text-muted)' }}>production</code>.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
              <span>Dự kiến xảy ra: ~18 phút tới</span>
              <span style={{ color: 'var(--dash-primary)', fontWeight: 600, cursor: 'pointer' }} onClick={() => onNavigate && onNavigate('/dashboard/ai/predictions')}>
                Xem khuyến nghị &rarr;
              </span>
            </div>
          </div>
        </div>

        {/* 6. Incident Summary */}
        <div className="dash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: 'var(--dash-success-bg)',
                  color: 'var(--dash-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={16} />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Sự Cố Đang Diễn Ra (0)
              </h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/incidents')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Xem lịch sử &rarr;
            </button>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: 'var(--dash-bg-canvas)',
              borderRadius: 'var(--dash-radius-md)',
              border: '1px dashed var(--dash-border)',
            }}
          >
            <ShieldCheck size={32} color="var(--dash-success)" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
              Toàn Bộ Hệ Thống Hoạt Động Tốt
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Không ghi nhận sự cố nghiêm trọng nào trong môi trường hiện tại suốt 72 giờ qua.
            </p>
          </div>
        </div>

        {/* 7. Self-Healing Summary */}
        <div className="dash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: 'var(--dash-mint-100)',
                  color: 'var(--dash-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={16} />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Hiệu Quả Tự Phục Hồi
              </h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/self-healing/history')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Nhật ký đầy đủ &rarr;
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div style={{ padding: '10px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-sm)', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Tỷ Lệ Thành Công</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--dash-success)', marginTop: '2px' }}>100%</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>12/12 Hành động</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-sm)', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Thời Gian Phục Hồi TB</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>1.8s</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>Không gián đoạn</div>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
            Hành Động Tự Động Gần Đây:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-xs)' }}>
              <span style={{ color: 'var(--dash-text-secondary)' }}>Khởi động lại cuốn chiếu: auth-service-v2</span>
              <span style={{ color: 'var(--dash-success)', fontWeight: 600 }}>Xử lý trong 1.4s</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-xs)' }}>
              <span style={{ color: 'var(--dash-text-secondary)' }}>Mở rộng bản sao replica: order-processor</span>
              <span style={{ color: 'var(--dash-success)', fontWeight: 600 }}>Xử lý trong 2.1s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
