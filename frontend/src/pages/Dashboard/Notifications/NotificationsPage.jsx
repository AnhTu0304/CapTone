import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Bell,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Check,
  ArrowRight
} from 'lucide-react';

const INITIAL_NOTIFICATIONS = [
  {
    id: 'NOTIF-101',
    category: 'HITL',
    title: 'Yêu cầu phê duyệt khẩn cấp: Tháo tải máy chủ worker-03 (Drain Node)',
    message: 'Hạ tầng phát hiện tải CPU 88% và rò rỉ nhiệt. Cần sự phê duyệt của SME Owner để di dời an toàn 12 Pods.',
    timestamp: '14 phút trước',
    read: false,
    severity: 'HIGH',
    actionPath: '/dashboard/self-healing/approvals',
    actionText: 'Tới Cổng Phê Duyệt',
  },
  {
    id: 'NOTIF-102',
    category: 'AI_PREDICTION',
    title: 'AI Dự báo sớm: Nguy cơ tràn RAM (Memory Leak) tại payment-service',
    message: 'Mô hình chuỗi thời gian phát hiện độ dốc +2.4MB/phút, dự báo bão hòa bộ nhớ trong 18 phút tới.',
    timestamp: '32 phút trước',
    read: false,
    severity: 'MEDIUM',
    actionPath: '/dashboard/ai/predictions',
    actionText: 'Xem Dự Báo AI',
  },
  {
    id: 'NOTIF-103',
    category: 'SELF_HEAL',
    title: 'Tự phục hồi thành công: Khởi động lại Pod order-processor',
    message: 'Sự cố OOMKilled được MAPE-K giải quyết tự động hoàn tất trong 1.4 giây. Trạng thái Pod trở về Healthy 100%.',
    timestamp: '2 giờ trước',
    read: true,
    severity: 'LOW',
    actionPath: '/dashboard/self-healing/history',
    actionText: 'Xem Nhật Ký MTTR',
  },
  {
    id: 'NOTIF-104',
    category: 'SYSTEM',
    title: 'Đồng bộ hóa tác tử eBPF Agent thành công trên cụm',
    message: 'Tác tử selfheal-agent-worker-02 đã tự động nâng cấp cấu hình giám sát kernel v1.4.2 không gián đoạn.',
    timestamp: '5 giờ trước',
    read: true,
    severity: 'INFO',
    actionPath: '/dashboard/agents',
    actionText: 'Xem Tác Tử Agent',
  },
  {
    id: 'NOTIF-105',
    category: 'INCIDENT',
    title: 'Phát hiện sự cố Liveness Probe timeout trên api-gateway',
    message: 'Độ trễ phản hồi vượt ngưỡng 3000ms kích hoạt quy trình phân tích nguyên nhân gốc rễ RCA tự động.',
    timestamp: '1 ngày trước',
    read: true,
    severity: 'HIGH',
    actionPath: '/dashboard/incidents',
    actionText: 'Xem Phân Tích RCA',
  },
];

export const NotificationsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh, onNavigate } = useDashboard();
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleToggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (selectedCategory === 'ALL') return true;
      if (selectedCategory === 'UNREAD') return !n.read;
      return n.category === selectedCategory;
    });
  }, [notifications, selectedCategory]);

  return (
    <div className="dashboard-notifications-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Trung Tâm Thông Báo & Điều Phối Cảnh Báo
            </h1>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: '#FFF1F2',
                  color: '#E11D48',
                  border: '1px solid #FDA4AF',
                }}
              >
                {unreadCount} chưa đọc
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Quản trị kênh truyền thông báo, cảnh báo khẩn cấp và các yêu cầu can thiệp HITL
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
            <span>Làm mới thông báo</span>
          </button>

          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: unreadCount > 0 ? '#FFFFFF' : '#F1F5F9',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: unreadCount > 0 ? 'var(--dash-primary)' : 'var(--dash-text-muted)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: unreadCount > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <Check size={14} />
            <span>Đánh Dấu Tất Cả Đã Đọc</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'ALL', label: 'Tất Cả' },
          { key: 'UNREAD', label: `Chưa Đọc (${unreadCount})` },
          { key: 'HITL', label: 'Cổng Phê Duyệt (HITL)' },
          { key: 'AI_PREDICTION', label: 'Dự Báo AI' },
          { key: 'INCIDENT', label: 'Sự Cố & RCA' },
          { key: 'SELF_HEAL', label: 'Tự Phục Hồi' },
          { key: 'SYSTEM', label: 'Hệ Thống' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedCategory(tab.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--dash-radius-full)',
              border: '1px solid var(--dash-border)',
              backgroundColor: selectedCategory === tab.key ? 'var(--dash-primary)' : '#FFFFFF',
              color: selectedCategory === tab.key ? '#FFFFFF' : 'var(--dash-text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification Items List */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredNotifications.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
              Không có thông báo nào trong phân mục này.
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isHitl = n.category === 'HITL';
              const isAi = n.category === 'AI_PREDICTION';

              return (
                <div
                  key={n.id}
                  style={{
                    padding: '18px 22px',
                    borderBottom: '1px solid var(--dash-border)',
                    backgroundColor: n.read ? '#FFFFFF' : 'rgba(16, 185, 129, 0.03)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--dash-radius-md)',
                        backgroundColor: isHitl ? '#FFFBEB' : isAi ? '#EFF6FF' : '#ECFDF5',
                        color: isHitl ? '#D97706' : isAi ? '#2563EB' : '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isHitl ? <ShieldCheck size={18} /> : isAi ? <Sparkles size={18} /> : <CheckCircle2 size={18} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: isHitl ? '#FFFBEB' : isAi ? '#EFF6FF' : '#F1F5F9',
                            color: isHitl ? '#D97706' : isAi ? '#2563EB' : '#64748B',
                            border: `1px solid ${isHitl ? '#FDE68A' : isAi ? '#BFDBFE' : '#CBD5E1'}`,
                          }}
                        >
                          {n.category}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>{n.timestamp}</span>
                        {!n.read && (
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }} />
                        )}
                      </div>

                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 4px 0' }}>
                        {n.title}
                      </h4>

                      <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.45 }}>
                        {n.message}
                      </p>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {n.actionPath && (
                      <button
                        type="button"
                        onClick={() => onNavigate && onNavigate(n.actionPath)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--dash-border)',
                          borderRadius: 'var(--dash-radius-md)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--dash-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{n.actionText}</span>
                        <ArrowRight size={12} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleRead(n.id)}
                      title={n.read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                      style={{
                        padding: '6px',
                        background: 'none',
                        border: 'none',
                        color: n.read ? 'var(--dash-text-muted)' : 'var(--dash-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
