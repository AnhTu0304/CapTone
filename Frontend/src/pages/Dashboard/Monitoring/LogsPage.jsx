import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Terminal,
  Search,
  Play,
  Pause,
  Download,
  Copy,
  Check,
} from 'lucide-react';

export const LogsPage = () => {
  const { currentOrg, currentEnv } = useDashboard();
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef(null);

  // Realistic Kubernetes container logs
  const initialLogs = [
    { id: 1, timestamp: '14:24:01.120', level: 'INFO', ns: 'production', pod: 'payment-service-7f8d-x9b2q', msg: 'gRPC stream initialized with payment gateway cluster (TLS v1.3)' },
    { id: 2, timestamp: '14:24:02.450', level: 'INFO', ns: 'production', pod: 'api-gateway-55c8b-mk42p', msg: 'GET /api/v1/healthz returned HTTP 200 OK (latency: 1.2ms)' },
    { id: 3, timestamp: '14:24:04.810', level: 'WARN', ns: 'production', pod: 'order-processor-66bf-aa18x', msg: 'Database connection pool usage above 75% (15/20 connections in use)' },
    { id: 4, timestamp: '14:24:05.105', level: 'INFO', ns: 'selfheal-system', pod: 'selfheal-agent-daemon-tk98', msg: 'eBPF kprobe: TCP retransmit rate normal across all worker interfaces' },
    { id: 5, timestamp: '14:24:07.920', level: 'ERROR', ns: 'production', pod: 'payment-service-7f8d-x9b2q', msg: 'Webhook dispatch failed to endpoint https://merchant.webhook.io (timeout after 5000ms)' },
    { id: 6, timestamp: '14:24:09.300', level: 'INFO', ns: 'redis', pod: 'redis-cluster-leader-0', msg: 'DB 0: 42,105 keys (10.42 MB hash tables), 14,200 clients connected' },
    { id: 7, timestamp: '14:24:11.450', level: 'INFO', ns: 'ingress-nginx', pod: 'ingress-nginx-controller-abcde', msg: '10.244.1.1 - - [19/Sep/2026:14:24:11 +0700] "POST /api/v1/checkout HTTP/2.0" 200 482' },
    { id: 8, timestamp: '14:24:14.210', level: 'WARN', ns: 'production', pod: 'order-processor-66bf-aa18x', msg: 'Slow consumer detected on Kafka partition #4 (lag: 184 messages)' },
    { id: 9, timestamp: '14:24:16.890', level: 'FATAL', ns: 'production', pod: 'worker-node-oom-simulator', msg: 'Kernel invoked oom-killer: gfp_mask=0x100cca(GFP_HIGHUSER_MOVABLE), order=0, oom_score_adj=950' },
    { id: 10, timestamp: '14:24:18.010', level: 'INFO', ns: 'selfheal-system', pod: 'selfheal-agent-daemon-tk98', msg: 'MAPE-K Analyser: Detected transient memory pressure on node worker-03, scaling recommendation triggered' },
    { id: 11, timestamp: '14:24:20.550', level: 'INFO', ns: 'production', pod: 'payment-service-7f8d-x9b2q', msg: 'Retry webhook dispatch attempt #1 succeeded with HTTP 200' },
    { id: 12, timestamp: '14:24:22.180', level: 'INFO', ns: 'production', pod: 'api-gateway-55c8b-mk42p', msg: 'SSL session resumption verified: 99.4% session cache hit rate' },
  ];

  const [logs, setLogs] = useState(initialLogs);

  // Auto-scroll to bottom when new logs arrive or toggle enabled
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Simulated live log ticker
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + Math.floor(Math.random() * 900 + 100);
      const newLog = {
        id: Date.now(),
        timestamp: timeStr,
        level: Math.random() > 0.85 ? 'WARN' : 'INFO',
        ns: 'production',
        pod: 'api-gateway-55c8b-mk42p',
        msg: `Telemetry heartbeat sync: latency ${Math.floor(Math.random() * 8 + 2)}ms & processed batch of 48 requests`,
      };

      setLogs((prev) => [...prev.slice(-40), newLog]);
    }, 4000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchNs = selectedNamespace === 'all' || log.ns === selectedNamespace;
      const matchLevel = selectedLevel === 'all' || log.level === selectedLevel;
      const matchQuery =
        !searchQuery ||
        log.msg.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.pod.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.ns.toLowerCase().includes(searchQuery.toLowerCase());

      return matchNs && matchLevel && matchQuery;
    });
  }, [logs, selectedNamespace, selectedLevel, searchQuery]);

  const handleCopyLogs = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level}] [${l.ns}/${l.pod}] ${l.msg}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level}] [${l.ns}/${l.pod}] ${l.msg}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selfheal-k8s-logs-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'FATAL':
      case 'ERROR':
        return { bg: '#FFF1F2', text: '#E11D48', border: '#FDA4AF' };
      case 'WARN':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      case 'INFO':
      default:
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
    }
  };

  return (
    <div className="dashboard-logs-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Trình Khám Phá Nhật Ký Container (Log Stream Explorer)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Thu thập nhật ký container từ DaemonSet thời gian thực
          </p>
        </div>

        {/* Live Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setIsLive(!isLive)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: isLive ? 'rgba(5, 150, 105, 0.1)' : '#FFFFFF',
              border: isLive ? '1px solid #059669' : '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: isLive ? '#059669' : 'var(--dash-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {isLive ? <Pause size={14} /> : <Play size={14} />}
            <span>{isLive ? 'Tạm dừng Live' : 'Tiếp tục Live'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLogs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            <span>{copied ? 'Đã sao chép!' : 'Sao chép'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadLogs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            <span>Tải Log (.log)</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="dash-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Namespace select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Namespace:</span>
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="all">Tất cả namespaces</option>
              <option value="production">production</option>
              <option value="redis">redis</option>
              <option value="ingress-nginx">ingress-nginx</option>
              <option value="selfheal-system">selfheal-system</option>
            </select>
          </div>

          {/* Level select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Cấp độ:</span>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="all">Tất cả cấp độ</option>
              <option value="INFO">INFO (Thông tin)</option>
              <option value="WARN">WARN (Cảnh báo)</option>
              <option value="ERROR">ERROR (Lỗi)</option>
              <option value="FATAL">FATAL (Nghiêm trọng)</option>
            </select>
          </div>

          {/* Search Query Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Tìm kiếm regex hoặc từ khóa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

        {/* Auto Scroll Checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--dash-text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          <span>Tự cuộn xuống dưới cùng</span>
        </label>
      </div>

      {/* Terminal Display Window */}
      <div
        style={{
          backgroundColor: '#1E1E1E',
          border: '1px solid #334155',
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}
      >
        {/* Terminal Title Bar */}
        <div
          style={{
            backgroundColor: '#0F172A',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ marginLeft: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94A3B8' }}>
              k8s-pod-stream &bull; {filteredLogs.length} dòng nhật ký được lọc
            </span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: isLive ? '#34D399' : '#94A3B8' }}>
            {isLive ? '● ĐANG TRUYỀN DỮ LIỆU TRỰC TIẾP' : '○ TẠM DỪNG'}
          </div>
        </div>

        {/* Log Lines Content */}
        <div
          ref={logContainerRef}
          style={{
            height: '460px',
            overflowY: 'auto',
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: 1.6,
            color: '#E2E8F0',
          }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
              Không tìm thấy nhật ký phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            filteredLogs.map((item, idx) => {
              const badge = getLevelColor(item.level);
              return (
                <div
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '3px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                  }}
                >
                  <span style={{ color: '#64748B', width: '24px', textAlign: 'right', flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  <span style={{ color: '#94A3B8', flexShrink: 0 }}>
                    [{item.timestamp}]
                  </span>
                  <span
                    style={{
                      padding: '0 5px',
                      borderRadius: '2px',
                      fontSize: '0.625rem',
                      fontWeight: 800,
                      backgroundColor: badge.bg,
                      color: badge.text,
                      border: `1px solid ${badge.border}`,
                      flexShrink: 0,
                    }}
                  >
                    {item.level}
                  </span>
                  <span style={{ color: '#38BDF8', flexShrink: 0 }}>
                    [{item.ns}/{item.pod}]
                  </span>
                  <span style={{ color: item.level === 'FATAL' || item.level === 'ERROR' ? '#FCA5A5' : item.level === 'WARN' ? '#FDE68A' : '#F1F5F9', wordBreak: 'break-all' }}>
                    {item.msg}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsPage;
