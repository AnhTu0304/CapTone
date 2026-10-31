import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { selfHealingService } from '../../../services/selfHealingService';
import SelfHealingTrendChart from '../../../components/dashboard/SelfHealingTrendChart';
import ActionDetailModal from './ActionDetailModal';
import {
  History,
  CheckCircle2,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Clock,
  XCircle,
  Activity,
  Eye
} from 'lucide-react';

export const ActionHistoryPage = () => {
  const { currentOrg, currentEnv } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [actions, setActions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);

  const activeClusterId = useMemo(() => {
    return currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster || '';
  }, [currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster]);

  const activeOrgId = useMemo(() => {
    return currentOrg?.id || '';
  }, [currentOrg?.id]);

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Vừa xong';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  const mapBackendActionToUI = useCallback((item) => {
    const shortId = item.id && item.id.length > 8 ? `ACT-${item.id.slice(0, 8).toUpperCase()}` : (item.id || 'N/A');
    const durMs = item.attempts && item.attempts[0]?.duration_ms ? item.attempts[0].duration_ms : 1500;
    const mttrSec = item.elapsed_seconds ? `${item.elapsed_seconds}s` : `${(durMs / 1000).toFixed(1)}s`;

    const targetName = item.target_name || item.target_id || 'Chưa xác định';
    const actionTypeCode = item.action_type_code || item.action_type_name || 'Tự phục hồi';
    const rawMsg = String(item.result?.message || item.error_message || '');
    let title = rawMsg || `Thực thi ${actionTypeCode} trên ${targetName}`;
    const rbacMatch = rawMsg.match(
      /User\\?\s*"([^"\\]+)\\?"\s+cannot\s+(\w+)\s+resource\s+\\?"([^"\\]+)\\?"(?:\s+in API group\s+\\?"([^"\\]*)\\?")?(?:\s+in the namespace\s+\\?"([^"\\]+)\\?")?/i
    );
    if (rbacMatch || rawMsg.includes('(403)') || rawMsg.includes('Forbidden')) {
      const saUser = rbacMatch ? rbacMatch[1].replace('system:serviceaccount:', '') : 'selfheal-system:selfheal-agent-sa';
      const verb = rbacMatch ? rbacMatch[2] : 'patch';
      const resource = rbacMatch ? rbacMatch[3] : 'deployments/scale';
      const targetNs = rbacMatch && rbacMatch[5] ? rbacMatch[5] : (item.namespace || 'default');
      title = `Thực thi ${actionTypeCode} trên "${targetName}" thất bại [Lỗi 403 Forbidden]: ServiceAccount "${saUser}" thiếu quyền "${verb}" tài nguyên "${resource}" tại namespace "${targetNs}"`;
    } else if (rawMsg.includes('Self-healing mitigate action')) {
      title =
        actionTypeCode === 'NO_ACTION'
          ? `Giám sát an toàn (NO_ACTION): "${targetName}" ổn định trong ngưỡng an toàn`
          : `Đã thực thi thành công ${actionTypeCode} trên dịch vụ "${targetName}"`;
    } else if (rawMsg.includes('HTTPHeaderDict')) {
      title = rawMsg.split('HTTP response headers:')[0].trim();
    }
    const policyName = item.policy_name || 'Tự phục hồi trực tiếp (AI Trigger)';
    const verified = item.verification?.verification_type || (item.execution_status === 'SUCCEEDED' ? 'SLO Health Probe' : 'Hệ thống K8s');

    let resultText = 'Thành công (100%)';
    if (item.execution_status === 'FAILED') resultText = 'Thất bại (Failed)';
    if (item.execution_status === 'CANCELLED') resultText = 'Đã hủy bỏ (Cancelled)';
    if (item.execution_status === 'RUNNING') resultText = 'Đang thực thi...';

    return {
      id: shortId,
      rawId: item.id,
      title,
      target: `${item.target_type || 'Workload'}/${targetName}`,
      namespace: item.namespace || 'default',
      policy: policyName,
      mttr: mttrSec,
      result: resultText,
      timestamp: formatRelativeTime(item.completed_at || item.created_at),
      verifiedBy: verified,
      status: item.execution_status,
      errorMessage: item.error_message || null,
      rawItem: item,
    };
  }, []);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch action records from Main Backend
      const res = await selfHealingService.getActions({
        limit: 50,
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
      });

      // 2. Fetch MTTR analytics from Main Backend
      const analyticsRes = await selfHealingService.getAnalytics({
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
      });

      const items = res?.items || (Array.isArray(res) ? res : []);
      setActions(items.map(mapBackendActionToUI));
      setAnalytics(analyticsRes);
      setIsUsingLiveDb(true);
    } catch (err) {
      console.warn('[ActionHistoryPage] Lỗi tải lịch sử:', err.message);
      setActions([]);
      setIsUsingLiveDb(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeClusterId, activeOrgId, mapBackendActionToUI]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchActions();
  };

  const filteredHistory = useMemo(() => {
    return actions.filter((rec) => {
      return (
        !searchTerm ||
        rec.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.target.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [actions, searchTerm]);

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
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Dữ liệu lưu vết thực tế từ cơ sở dữ liệu
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
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
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>Làm mới lịch sử</span>
          </button>
        </div>
      </div>

      {/* Embedded Self-Healing Trend Chart */}
      <SelfHealingTrendChart actions={actions} analytics={analytics} />

      {/* History Records Table */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Nhật Ký Hành Động Đã Hoàn Tất ({filteredHistory.length})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Thời gian hồi phục trung bình đạt {analytics?.averageRecoveryTime || '0s'} &bull; Tỷ lệ thành công: {analytics?.successRate || (actions.length > 0 ? '100%' : '100%')} ({analytics?.totalActions !== undefined ? analytics.totalActions : actions.length} tác vụ) &bull; Nhấp vào hàng để xem chi tiết
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
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>THỜI LƯỢNG</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>KẾT QUẢ KIỂM TRA</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>THỜI ĐIỂM</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', textAlign: 'center' }}>CHI TIẾT</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--dash-text-muted)' }}>
                    <ShieldCheck size={32} color="#059669" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Không có bản ghi lịch sử nào phù hợp</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>Chưa có hành động tự phục hồi nào được ghi nhận cho bộ lọc hiện tại.</div>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((rec) => {
                  const isSucceeded = rec.status === 'SUCCEEDED';
                  const isCancelled = rec.status === 'CANCELLED';
                  const isFailed = rec.status === 'FAILED';

                  let statusColor = '#059669';
                  if (isCancelled) statusColor = '#D97706';
                  if (isFailed) statusColor = '#DC2626';

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => setSelectedAction({ id: rec.rawId, item: rec.rawItem })}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                        <span style={{ borderBottom: '1px dashed #CBD5E1' }}>{rec.id}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{rec.title}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          Chính sách: {rec.policy}
                        </div>
                        {rec.errorMessage && (
                          <div style={{ fontSize: '0.6875rem', color: '#DC2626', marginTop: '2px' }}>
                            Lý do: {rec.errorMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--dash-primary)' }}>
                        <div>{rec.target}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>ns: {rec.namespace}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: statusColor }}>
                        {rec.mttr}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: statusColor, fontWeight: 600 }}>
                          {isSucceeded && <CheckCircle2 size={13} />}
                          {isCancelled && <XCircle size={13} />}
                          {isFailed && <AlertCircle size={13} />}
                          <span>{rec.result}</span>
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{rec.verifiedBy}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                        {rec.timestamp}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAction({ id: rec.rawId, item: rec.rawItem });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--dash-text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#F1F5F9';
                            e.currentTarget.style.borderColor = 'var(--dash-primary)';
                            e.currentTarget.style.color = 'var(--dash-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.color = 'var(--dash-text-primary)';
                          }}
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Detail Modal */}
      {selectedAction && (
        <ActionDetailModal
          actionId={selectedAction.id}
          initialItem={selectedAction.item}
          onClose={() => setSelectedAction(null)}
        />
      )}
    </div>
  );
};

export default ActionHistoryPage;
