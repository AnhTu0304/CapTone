import React, { useState } from 'react';
import {
  Settings,
  BrainCircuit,
  ShieldCheck,
  Radio,
  Clock,
  Database,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sliders,
  Server,
  Lock,
  HardDrive,
  RefreshCw,
  Calendar,
} from 'lucide-react';

export const AdminSystemSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('ai-config'); // 'ai-config' | 'self-healing' | 'platform' | 'maintenance' | 'data-retention'
  const [toastMessage, setToastMessage] = useState(null);

  // State 1: AI Model & Configuration
  const [aiConfig, setAiConfig] = useState({
    activeModelVersion: 'v2.4.0 (BiGRU 2-Layer)',
    confidenceThreshold: 0.85,
    maxInferenceLatencyMs: 30,
    timeseriesWindowSeconds: 60,
    enforceSignedWeights: true,
    autoDriftDetection: true,
    rcaGraphEngine: 'NetworkX + DGL Graph Attention',
  });

  // State 2: Self-Healing Safety Policy
  const [healingPolicy, setHealingPolicy] = useState({
    maxRetriesPerIncident: 3,
    cooldownPeriodSeconds: 300,
    requireHitlForCritical: true,
    requireHitlForHigh: true,
    defaultMode: 'SUPERVISED_AUTONOMOUS',
    safeRollbackEnabled: true,
  });

  // State 3: Platform Settings
  const [platformConfig, setPlatformConfig] = useState({
    wsHeartbeatIntervalSec: 15,
    agentKeepAliveTimeoutSec: 45,
    massDisconnectThreshold: 5,
    enableMaintenanceMode: false,
    rateLimitPerMinute: 600,
  });

  // State 4: Data Management & Retention
  const [dataConfig, setDataConfig] = useState({
    auditLogRetentionDays: 365,
    telemetryRetentionDays: 30,
    metricsResolutionSec: 5,
    enableAutoVacuum: true,
    maxDatabaseQuotaGB: 100,
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveSettings = (tabName) => {
    showToast(`Đã lưu cấu hình phân hệ [${tabName}] thành công!`);
  };

  return (
    <div
      className="admin-settings-page"
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
            <Settings size={26} style={{ color: '#059669' }} />
            Cấu Hình Hệ Thống Nâng Cao (System Settings)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Quản trị các tham số sống còn của nền tảng SelfAI: Cấu hình AI Engine, chính sách an toàn tự phục hồi, chu kỳ nhịp tim và lưu trữ dữ liệu.
          </p>
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

      {/* 2. Settings Nav Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--dash-border)', overflowX: 'auto', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('ai-config')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'ai-config' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'ai-config' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'ai-config' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <BrainCircuit size={16} />
          <span>AI Model & Configuration</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('self-healing')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'self-healing' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'self-healing' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'self-healing' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldCheck size={16} />
          <span>Self-Healing Policy</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('platform')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'platform' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'platform' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'platform' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <Radio size={16} />
          <span>Platform Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'maintenance' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'maintenance' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'maintenance' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <Server size={16} />
          <span>Maintenance & Updates</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('data-retention')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'data-retention' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'data-retention' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'data-retention' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <Database size={16} />
          <span>Data Management & Storage</span>
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: AI Model & Configuration */}
      {activeTab === 'ai-config' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            padding: '24px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Cấu Hình Động Cơ Trí Tuệ Nhân Tạo & RCA
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Quản lý phiên bản nạp trọng số mô hình, ngưỡng dự báo sự cố và thiết lập các giới hạn an toàn ngăn chặn thay đổi nguy hiểm.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Phiên Bản Mô Hình Đang Kích Hoạt
              </label>
              <input
                type="text"
                disabled
                value={aiConfig.activeModelVersion}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#F8FAFC',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#0F172A',
                  fontWeight: 600,
                }}
              />
              <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                Được huấn luyện trên 4.2M mẫu viễn trắc eBPF.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Ngưỡng Độ Tin Cậy Tự Động Kích Hoạt (Confidence Threshold)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="0.99"
                value={aiConfig.confidenceThreshold}
                onChange={(e) => setAiConfig({ ...aiConfig, confidenceThreshold: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
              <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                Chỉ thực thi hành động tự lành khi độ tin cậy mô hình &gt;= {aiConfig.confidenceThreshold}.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Độ Trễ Suy Luận Tối Đa Cho Phép (ms)
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={aiConfig.maxInferenceLatencyMs}
                onChange={(e) => setAiConfig({ ...aiConfig, maxInferenceLatencyMs: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Cửa Sổ Dữ Liệu Chuỗi Thời Gian (Giây)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={aiConfig.timeseriesWindowSeconds}
                onChange={(e) => setAiConfig({ ...aiConfig, timeseriesWindowSeconds: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={aiConfig.enforceSignedWeights}
                onChange={(e) => setAiConfig({ ...aiConfig, enforceSignedWeights: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#059669' }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Bắt buộc ký số trọng số mô hình (Enforce Cryptographically Signed Weights - Ngăn chặn tải mô hình lạ)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={aiConfig.autoDriftDetection}
                onChange={(e) => setAiConfig({ ...aiConfig, autoDriftDetection: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#059669' }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Tự động kiểm tra độ trôi dữ liệu (Auto Data Drift Detection) mỗi 60 phút
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => handleSaveSettings('AI Model & Configuration')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Save size={15} />
              <span>Lưu Cấu Hình AI</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Self-Healing Safety Policy */}
      {activeTab === 'self-healing' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            padding: '24px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Chính Sách An Toàn Tự Phục Hồi Nền Tảng (Platform Safety Guardrails)
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Quy định các giới hạn tối cao để bảo vệ ứng dụng công ty khỏi vòng lặp tự sửa lỗi vô hạn (Flapping loop) hoặc hành động nguy hại.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Số Lần Thử Lại Tối Đa Cho Mỗi Sự Cố (Max Retries)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={healingPolicy.maxRetriesPerIncident}
                onChange={(e) => setHealingPolicy({ ...healingPolicy, maxRetriesPerIncident: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
              <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                Nếu vượt quá {healingPolicy.maxRetriesPerIncident} lần thử mà sự cố không hết, hệ thống sẽ dừng tự lành và báo động đỏ.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Thời Gian Giãn Cách Giữa Các Lần Sửa Lỗi (Cooldown - Giây)
              </label>
              <input
                type="number"
                min="30"
                max="1800"
                value={healingPolicy.cooldownPeriodSeconds}
                onChange={(e) => setHealingPolicy({ ...healingPolicy, cooldownPeriodSeconds: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
              <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                Thời gian chờ để ứng dụng ổn định trước khi đánh giá lại tình trạng.
              </span>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={healingPolicy.requireHitlForCritical}
                onChange={(e) => setHealingPolicy({ ...healingPolicy, requireHitlForCritical: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#059669' }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Bắt buộc con người phê duyệt (HITL Mandatory) đối với sự cố mức Nghiêm Trọng (CRITICAL)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={healingPolicy.safeRollbackEnabled}
                onChange={(e) => setHealingPolicy({ ...healingPolicy, safeRollbackEnabled: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#059669' }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Tự động kích hoạt cơ chế Rollback an toàn nếu hành động tự phục hồi làm tăng tỷ lệ lỗi HTTP 5xx
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => handleSaveSettings('Self-Healing Policy')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Save size={15} />
              <span>Lưu Chính Sách An Toàn</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Platform Settings */}
      {activeTab === 'platform' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            padding: '24px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Cấu Hình Mạng & Tham Số Nền Tảng (Platform Settings)
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Quản lý thời gian nhịp tim WebSocket, giới hạn tần suất yêu cầu và chế độ bảo trì toàn mạng.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Chu Kỳ Ping WebSocket (Giây)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={platformConfig.wsHeartbeatIntervalSec}
                onChange={(e) => setPlatformConfig({ ...platformConfig, wsHeartbeatIntervalSec: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Thời Gian Chờ Mất Kết Nối Tác Tử (Keep-Alive Timeout - Giây)
              </label>
              <input
                type="number"
                min="15"
                max="180"
                value={platformConfig.agentKeepAliveTimeoutSec}
                onChange={(e) => setPlatformConfig({ ...platformConfig, agentKeepAliveTimeoutSec: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Giới Hạn Tần Suất API Rate Limit (Req/phút/IP)
              </label>
              <input
                type="number"
                min="60"
                max="6000"
                value={platformConfig.rateLimitPerMinute}
                onChange={(e) => setPlatformConfig({ ...platformConfig, rateLimitPerMinute: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--dash-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={platformConfig.enableMaintenanceMode}
                onChange={(e) => setPlatformConfig({ ...platformConfig, enableMaintenanceMode: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#DC2626' }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: platformConfig.enableMaintenanceMode ? '#DC2626' : 'var(--dash-text-primary)' }}>
                Bật Chế Độ Bảo Trì Toàn Nền Tảng (Maintenance Mode - Chỉ Super Admin được truy cập)
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => handleSaveSettings('Platform Settings')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Save size={15} />
              <span>Lưu Cấu Hình Mạng</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Maintenance & Updates */}
      {activeTab === 'maintenance' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            padding: '24px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Phiên Bản Nền Tảng & Lịch Bảo Trì (Maintenance & Updates)
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Theo dõi phiên bản các vi dịch vụ lõi và lên lịch cửa sổ bảo trì định kỳ cho toàn hệ thống.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>Main Backend Release</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>v2.4.0-stable</div>
              <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>Cập nhật lần cuối: 2 ngày trước</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>AI Backend Engine</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>v2.1.0-prod</div>
              <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>PyTorch 2.3 + CUDA 12.1</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>eBPF DaemonSet Agent</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>v1.4.2-ebpf</div>
              <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>CO-RE libbpf v1.2</div>
            </div>
          </div>

          <div style={{ padding: '18px', borderRadius: '10px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Calendar size={16} color="#15803D" />
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#166534' }}>
                Cửa Sổ Bảo Trì Định Kỳ (Scheduled Maintenance Window)
              </div>
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#14532D', lineHeight: 1.5 }}>
              Lịch bảo trì tiếp theo: <strong>Chủ Nhật, 25/10/2026 từ 02:00 đến 04:00 (UTC+7)</strong>. Hệ thống sẽ tự động chuyển sang chế độ dự phòng Hot-Standby nhằm đảm bảo 100% thời gian hoạt động của các cụm máy chủ công ty.
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Data Management & Retention */}
      {activeTab === 'data-retention' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid var(--dash-border)',
            padding: '24px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Quản Trị Dữ Liệu & Chính Sách Lưu Giữ (Data Management & Retention)
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Kiểm soát dung lượng lưu trữ PostgreSQL, hạn mức nhật ký kiểm toán và kích hoạt quy trình dọn dẹp phân vùng tự động.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Thời Gian Lưu Trữ Nhật Ký Kiểm Toán (Audit Logs - Ngày)
              </label>
              <input
                type="number"
                min="30"
                max="730"
                value={dataConfig.auditLogRetentionDays}
                onChange={(e) => setDataConfig({ ...dataConfig, auditLogRetentionDays: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
              <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                Đáp ứng tiêu chuẩn kiểm toán an ninh SOC2 và ISO 27001 (khuyến nghị: 365 ngày).
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Thời Gian Lưu Trữ Dữ Liệu Viễn Trắc eBPF (Telemetry Time-Series - Ngày)
              </label>
              <input
                type="number"
                min="7"
                max="90"
                value={dataConfig.telemetryRetentionDays}
                onChange={(e) => setDataConfig({ ...dataConfig, telemetryRetentionDays: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              />
              <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                Dữ liệu sau {dataConfig.telemetryRetentionDays} ngày sẽ được tổng hợp nén theo chu kỳ 1 giờ.
              </span>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                Dung Lượng PostgreSQL Đang Sử Dụng: 14.2 GB / 100 GB (14.2%)
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>Khỏe Mạnh</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ width: '14.2%', height: '100%', backgroundColor: '#059669', borderRadius: '9999px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => handleSaveSettings('Data Management & Retention')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Save size={15} />
              <span>Lưu Cấu Hình Lưu Trữ</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystemSettingsPage;
