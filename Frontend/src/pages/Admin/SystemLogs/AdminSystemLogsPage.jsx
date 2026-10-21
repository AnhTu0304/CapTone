import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileCode,
  Search,
  RefreshCw,
  Play,
  Pause,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Terminal,
  Filter,
  X,
  Copy,
} from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';

const INITIAL_LOGS = [
  {
    id: 'log-01',
    timestamp: '2026-10-21 23:58:12.482',
    service: 'MAIN_BACKEND',
    level: 'INFO',
    tenant: 'SYSTEM',
    message: 'REST API GET /api/v1/admin/overview 200 OK - 14ms (ip=10.244.0.1)',
  },
  {
    id: 'log-02',
    timestamp: '2026-10-21 23:58:10.129',
    service: 'AI_ENGINE',
    level: 'INFO',
    tenant: 'org-acme-01',
    message: 'BiGRU inference completed: 24 timeseries nodes evaluated. Risk score: 0.04 (Normal) - 1.2ms',
  },
  {
    id: 'log-03',
    timestamp: '2026-10-21 23:57:48.882',
    service: 'WEBSOCKET',
    level: 'INFO',
    tenant: 'SYSTEM',
    message: 'Client connected: session_id=ws-client-9921b cluster=acme-production-us-east',
  },
  {
    id: 'log-04',
    timestamp: '2026-10-21 23:57:32.610',
    service: 'TELEMETRY_INGEST',
    level: 'WARN',
    tenant: 'org-finflow-02',
    message: 'Heartbeat delay detected from agent-finflow-01 (latency=8.4ms, last_seen=48s ago)',
  },
  {
    id: 'log-05',
    timestamp: '2026-10-21 23:56:55.104',
    service: 'POSTGRES_POOL',
    level: 'INFO',
    tenant: 'SYSTEM',
    message: 'Connection pool active: 32/200. Query stats: avg_execution_time=18.2ms, slow_queries=0',
  },
  {
    id: 'log-06',
    timestamp: '2026-10-21 23:55:12.339',
    service: 'AI_ENGINE',
    level: 'WARN',
    tenant: 'org-finflow-02',
    message: 'Data drift monitor: Feature [memory_rss_bytes] shifted +3.8% from baseline. Status: SAFE',
  },
  {
    id: 'log-07',
    timestamp: '2026-10-21 23:54:02.912',
    service: 'MAIN_BACKEND',
    level: 'ERROR',
    tenant: 'org-viettel-04',
    message: 'Failed to verify agent JWT token for node vt-cloud-worker-03: Token expired at 2026-10-21T23:40:00Z',
    stackTrace: `Error: TokenExpiredError: jwt expired
    at /app/node_modules/jsonwebtoken/verify.js:152:21
    at getSecret (/app/src/middlewares/auth.js:42:12)
    at verifyToken (/app/src/controllers/agentIngestController.js:88:5)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`,
  },
  {
    id: 'log-08',
    timestamp: '2026-10-21 23:53:14.004',
    service: 'TELEMETRY_INGEST',
    level: 'INFO',
    tenant: 'org-nexus-03',
    message: 'eBPF probe sync batch accepted: 142 metric points recorded from nexus-logistics-node-a',
  },
  {
    id: 'log-09',
    timestamp: '2026-10-21 23:52:00.812',
    service: 'MAIN_BACKEND',
    level: 'INFO',
    tenant: 'SYSTEM',
    message: 'Super Admin authentication success: actor=admin@selfheal.systems role=SUPER_ADMIN ip=192.168.1.5',
  },
];

export const AdminSystemLogsPage = () => {
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const debouncedSearch = useDebounce(search, 250);
  const logContainerRef = useRef(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      const matchSearch =
        !debouncedSearch ||
        item.message.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        item.service.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        item.tenant.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchService = serviceFilter === 'ALL' || item.service === serviceFilter;
      const matchLevel = levelFilter === 'ALL' || item.level === levelFilter;
      return matchSearch && matchService && matchLevel;
    });
  }, [logs, debouncedSearch, serviceFilter, levelFilter]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportLogs = () => {
    const textContent = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.service}] [${l.tenant}] ${l.message}`)
      .join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selfai_system_logs_${Date.now()}.log`;
    link.click();
    showToast('Đã tải xuống file nhật ký hệ thống (.log)!');
  };

  const handleClearLogs = () => {
    setLogs([]);
    showToast('Đã dọn sạch bộ nhớ đệm nhật ký trên giao diện!');
  };

  const handleCopyLog = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép nội dung dòng log!');
  };

  return (
    <div
      className="admin-system-logs-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '48px',
      }}
    >
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--dash-text-primary)',
              margin: '0 0 4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <FileCode size={26} style={{ color: '#059669' }} />
            Nhật Ký Hệ Thống Trực Tiếp (System Logs Streamer)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Xem luồng ghi nhật ký thời gian thực của Main Backend, AI Engine, PostgreSQL Connection Pool và eBPF Telemetry Ingestion.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Pause / Resume Live Stream */}
          <button
            type="button"
            onClick={() => setIsStreaming(!isStreaming)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: isStreaming ? '#F0FDF4' : '#FFFBEB',
              color: isStreaming ? '#15803D' : '#B45309',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isStreaming ? <Pause size={14} /> : <Play size={14} />}
            <span>{isStreaming ? 'Đang Phát Sóng (Tạm Dừng)' : 'Tiếp Tục Phát'}</span>
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={handleExportLogs}
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
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            <span>Xuất File .log</span>
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={handleClearLogs}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-muted)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
            <span>Xóa Màn Hình</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '10px 14px',
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
          <CheckCircle2 size={15} color="#059669" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. Filters Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          padding: '14px 18px',
          borderRadius: '12px',
          border: '1px solid var(--dash-border)',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '280px' }}>
            <Search size={14} color="var(--dash-text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung log, mã lỗi, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                fontSize: '0.8125rem',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-primary)',
              }}
            />
          </div>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              fontSize: '0.8125rem',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontWeight: 600,
            }}
          >
            <option value="ALL">Tất Cả Vi Dịch Vụ</option>
            <option value="MAIN_BACKEND">Main Backend (Port 5000)</option>
            <option value="AI_ENGINE">AI Engine (Port 8000)</option>
            <option value="POSTGRES_POOL">Postgres DB Pool</option>
            <option value="WEBSOCKET">WebSocket Server</option>
            <option value="TELEMETRY_INGEST">eBPF Telemetry Ingest</option>
          </select>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              fontSize: '0.8125rem',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontWeight: 600,
            }}
          >
            <option value="ALL">Mọi Mức Độ (All Levels)</option>
            <option value="INFO">INFO (Thông tin)</option>
            <option value="WARN">WARN (Cảnh báo)</option>
            <option value="ERROR">ERROR (Lỗi)</option>
          </select>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
          Đang hiển thị <strong>{filteredLogs.length}</strong> dòng log
        </div>
      </div>

      {/* 3. Log Stream Console */}
      <div
        ref={logContainerRef}
        style={{
          backgroundColor: '#0F172A',
          color: '#E2E8F0',
          borderRadius: '12px',
          padding: '16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          lineHeight: 1.6,
          maxHeight: '600px',
          overflowY: 'auto',
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)',
          border: '1px solid #334155',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
            Không có dòng log nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredLogs.map((log) => {
              const levelColor =
                log.level === 'ERROR'
                  ? '#EF4444'
                  : log.level === 'WARN'
                  ? '#F59E0B'
                  : '#10B981';

              const serviceBadgeColor =
                log.service === 'AI_ENGINE'
                  ? '#C084FC'
                  : log.service === 'MAIN_BACKEND'
                  ? '#60A5FA'
                  : log.service === 'POSTGRES_POOL'
                  ? '#34D399'
                  : '#94A3B8';

              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    backgroundColor: log.level === 'ERROR' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    borderLeft: log.level === 'ERROR' ? '3px solid #EF4444' : '3px solid transparent',
                    cursor: log.stackTrace ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (log.stackTrace) setSelectedLog(log);
                  }}
                >
                  <span style={{ color: '#64748B', flexShrink: 0 }}>{log.timestamp}</span>

                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: levelColor,
                      fontWeight: 700,
                      fontSize: '0.6875rem',
                      flexShrink: 0,
                    }}
                  >
                    {log.level}
                  </span>

                  <span
                    style={{
                      color: serviceBadgeColor,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    [{log.service}]
                  </span>

                  <span style={{ color: '#94A3B8', flexShrink: 0 }}>
                    ({log.tenant})
                  </span>

                  <span style={{ color: log.level === 'ERROR' ? '#FCA5A5' : '#F1F5F9', flex: 1, wordBreak: 'break-all' }}>
                    {log.message}
                  </span>

                  {log.stackTrace && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#DC2626',
                        color: '#FFFFFF',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      Stack Trace
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Modal Chi Tiết Stack Trace */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '720px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} color="#DC2626" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Chi Tiết Vết Lỗi Hệ Thống (Error Stack Trace)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '0.8125rem', color: '#475569' }}>
              <div><strong>Thời gian:</strong> {selectedLog.timestamp}</div>
              <div><strong>Dịch vụ:</strong> {selectedLog.service} • Tenant: {selectedLog.tenant}</div>
              <div style={{ marginTop: '4px', color: '#DC2626', fontWeight: 600 }}>{selectedLog.message}</div>
            </div>

            <div
              style={{
                backgroundColor: '#0F172A',
                color: '#FCA5A5',
                padding: '16px',
                borderRadius: '8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                lineHeight: 1.5,
              }}
            >
              {selectedLog.stackTrace}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => handleCopyLog(selectedLog.stackTrace)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Copy size={14} />
                <span>Sao Chép Stack Trace</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystemLogsPage;
