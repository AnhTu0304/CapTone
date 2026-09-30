import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { exportToCsv, exportToJson } from '../../../utils/exportUtils';
import AuditDistributionChart from '../../../components/dashboard/AuditDistributionChart';
import {
  ScrollText,
  Search,
  RefreshCw,
  CheckCircle2,
  Lock,
  Copy,
  Check,
  FileJson,
  FileSpreadsheet
} from 'lucide-react';

const INITIAL_AUDIT_LOGS = [
  {
    id: 'AUD-2026-9041',
    timestamp: '19/09/2026 16:42:10',
    actor: 'Lê Minh Quân (SME Owner)',
    role: 'SME_OWNER',
    event: 'HITL_APPROVAL_GRANTED',
    description: 'Phê duyệt khẩn cấp tháo tải và cô lập máy chủ Node/worker-03 (Cordon & Drain)',
    target: 'Node/worker-03',
    ip: '113.161.72.45',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-2026-9040',
    timestamp: '19/09/2026 16:28:45',
    actor: 'MAPE-K Autonomous Engine',
    role: 'SYSTEM_AI',
    event: 'AUTONOMOUS_SCALE_UP',
    description: 'Tự động mở rộng số lượng Replicas từ 2 lên 3 cho payment-service theo dự báo tải',
    target: 'Deployment/payment-service',
    ip: '10.244.0.1 (Internal Cluster)',
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-2026-9039',
    timestamp: '19/09/2026 15:50:12',
    actor: 'Trần Đình Tuấn (DevOps Lead)',
    role: 'DEVOPS',
    event: 'POLICY_THRESHOLD_MODIFIED',
    description: 'Cập nhật ngưỡng kích hoạt cổng HITL từ 25% lên 30% bán kính ảnh hưởng Pods',
    target: 'Policy/POL-02',
    ip: '14.162.180.92',
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-2026-9038',
    timestamp: '19/09/2026 14:15:30',
    actor: 'MAPE-K Autonomous Engine',
    role: 'SYSTEM_AI',
    event: 'POD_MEMORY_RESTART',
    description: 'Khởi động lại Pod order-processor-66bf-aa18x sau tín hiệu cảnh báo rò rỉ RAM',
    target: 'Pod/order-processor-66bf',
    ip: '10.244.0.1 (Internal Cluster)',
    sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-2026-9037',
    timestamp: '19/09/2026 11:04:18',
    actor: 'Nguyễn Văn Hoàng (Security Auditor)',
    role: 'VIEWER',
    event: 'AUDIT_EXPORT_CSV',
    description: 'Xuất toàn bộ bản ghi kiểm toán tuân thủ định kỳ phục vụ đánh giá ISO 27001',
    target: 'Compliance/SOC2_Report',
    ip: '118.69.182.3',
    sha256: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-2026-9036',
    timestamp: '19/09/2026 09:30:00',
    actor: 'Lê Minh Quân (SME Owner)',
    role: 'SME_OWNER',
    event: 'AUTH_LOGIN_SUCCESS_2FA',
    description: 'Đăng nhập thành công vào bảng điều khiển qua cơ chế xác thực đa yếu tố 2FA',
    target: 'Identity/SSO',
    ip: '113.161.72.45',
    sha256: '04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb',
    status: 'VERIFIED',
  },
];

export const AuditLogsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const { success: toastSuccess } = useToast();
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState(null);
  const [exportNotice, setExportNotice] = useState(false);

  const handleCopyHash = (hash) => {
    navigator.clipboard?.writeText(hash);
    setCopiedHash(hash);
    toastSuccess('Đã sao chép mã băm SHA-256 vào clipboard!', 'Sao Chép Thành Công');
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleExportCsv = () => {
    const headers = ['Mã Bản Ghi', 'Thời Gian', 'Tác Tử / Người Dùng', 'Vai Trò', 'Sự Kiện', 'Mô Tả Chi Tiết', 'Đối Tượng Mục Tiêu', 'Địa Chỉ IP / Cụm', 'Mã Băm SHA-256', 'Trạng Thái'];
    const rows = filteredLogs.map((log) => [
      log.id,
      log.timestamp,
      log.actor,
      log.role,
      log.event,
      log.description,
      log.target,
      log.ip,
      log.sha256,
      log.status,
    ]);
    exportToCsv('so-cai-kiem-toan-sha256.csv', headers, rows);
    setExportNotice(true);
    toastSuccess('Đã xuất và tải xuống sổ cái kiểm toán định dạng CSV!', 'Xuất Dữ Liệu');
    setTimeout(() => setExportNotice(false), 3000);
  };

  const handleExportJson = () => {
    exportToJson('so-cai-kiem-toan-sha256.json', filteredLogs);
    setExportNotice(true);
    toastSuccess('Đã xuất và tải xuống sổ cái kiểm toán định dạng JSON!', 'Xuất Dữ Liệu');
    setTimeout(() => setExportNotice(false), 3000);
  };

  const filteredLogs = useMemo(() => {
    return INITIAL_AUDIT_LOGS.filter((log) => {
      const matchRole = selectedRole === 'ALL' || log.role === selectedRole;
      const matchSearch =
        !searchQuery ||
        log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.sha256.toLowerCase().includes(searchQuery.toLowerCase());

      return matchRole && matchSearch;
    });
  }, [selectedRole, searchQuery]);

  return (
    <div className="dashboard-audit-logs-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScrollText size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Nhật Ký Kiểm Toán Bất Biến (Immutable Audit Logs)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Bản ghi chuỗi khối SHA-256 chống chỉnh sửa theo chuẩn tuân thủ SOC2 và ISO 27001 cho SME
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
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Xác thực sổ cái</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet size={14} color="#059669" />
            <span>Xuất CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--dash-primary)',
              border: 'none',
              borderRadius: 'var(--dash-radius-md)',
              color: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <FileJson size={14} />
            <span>Xuất JSON</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--dash-radius-md)',
            color: '#065F46',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>Toàn bộ 1,248 bản ghi kiểm toán kèm chữ ký số SHA-256 đã được đóng gói và xuất thành công!</span>
        </div>
      )}

      {/* Distribution Chart */}
      <AuditDistributionChart height={220} />

      {/* Filter and Search Bar */}
      <div
        className="dash-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '260px' }}>
          <Search size={16} color="var(--dash-text-muted)" />
          <input
            type="text"
            placeholder="Tìm theo Mã bản ghi, Người thực hiện, Sự kiện hoặc SHA-256..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '0.8125rem',
              color: 'var(--dash-text-primary)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Diễn Viên:</span>
          {['ALL', 'SYSTEM_AI', 'SME_OWNER', 'DEVOPS', 'VIEWER'].map((roleKey) => (
            <button
              key={roleKey}
              type="button"
              onClick={() => setSelectedRole(roleKey)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--dash-radius-full)',
                border: '1px solid var(--dash-border)',
                backgroundColor: selectedRole === roleKey ? 'var(--dash-primary)' : '#FFFFFF',
                color: selectedRole === roleKey ? '#FFFFFF' : 'var(--dash-text-secondary)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {roleKey === 'ALL'
                ? 'Tất cả'
                : roleKey === 'SYSTEM_AI'
                ? 'AI MAPE-K'
                : roleKey === 'SME_OWNER'
                ? 'SME Owner'
                : roleKey === 'DEVOPS'
                ? 'DevOps Lead'
                : 'Viewer'}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Sổ Cái Nhật Ký Kiểm Toán ({filteredLogs.length} Bản ghi)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Mỗi bản ghi được ký mã hóa và ghi chép bất biến theo thứ tự thời gian tuyến tính
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
            <Lock size={14} />
            <span>Toàn vẹn mật mã: 100% Khớp</span>
          </div>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Mã & Thời Điểm</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Người Thực Hiện (Actor)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Loại Sự Kiện & Mục Tiêu</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Nội Dung Chi Tiết</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Chữ Ký SHA-256</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const isSystem = log.role === 'SYSTEM_AI';
                const isOwner = log.role === 'SME_OWNER';

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--dash-primary)', fontFamily: 'var(--font-mono)' }}>{log.id}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>{log.timestamp}</div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{log.actor}</div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--dash-radius-full)',
                          backgroundColor: isSystem ? '#ECFDF5' : isOwner ? '#EFF6FF' : '#F1F5F9',
                          color: isSystem ? '#059669' : isOwner ? '#2563EB' : '#64748B',
                          marginTop: '3px',
                        }}
                      >
                        {log.role}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>{log.event}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        &bull; {log.target}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', maxWidth: '300px', color: 'var(--dash-text-secondary)', lineHeight: 1.4 }}>
                      {log.description}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <button
                        type="button"
                        onClick={() => handleCopyHash(log.sha256)}
                        title="Bấm để sao chép toàn bộ mã SHA-256"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid var(--dash-border)',
                          borderRadius: 'var(--dash-radius-sm)',
                          cursor: 'pointer',
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--dash-text-secondary)',
                        }}
                      >
                        <span>{log.sha256.substring(0, 10)}...{log.sha256.substring(log.sha256.length - 6)}</span>
                        {copiedHash === log.sha256 ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                      </button>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          backgroundColor: '#ECFDF5',
                          color: '#059669',
                          border: '1px solid #A7F3D0',
                          borderRadius: 'var(--dash-radius-full)',
                        }}
                      >
                        ● BẤT BIẾN
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;
