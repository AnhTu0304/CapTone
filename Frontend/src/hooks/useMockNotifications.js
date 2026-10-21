import { useState, useMemo, useCallback } from 'react';
import {
  getStoredNotifications,
  saveStoredNotifications,
} from '../mocks/notificationMockData';
import { useToast } from '../context/ToastContext';

export const useMockNotifications = (initialPageSize = 6) => {
  const { success: toastSuccess } = useToast();
  const [notifications, setNotifications] = useState(getStoredNotifications);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'SYSTEM' | 'INFRASTRUCTURE' | 'SELF_HEALING' | 'SECURITY'
  const [visibleCount, setVisibleCount] = useState(initialPageSize);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, read: true } : item));
      saveStoredNotifications(next);
      return next;
    });
  }, []);

  const toggleRead = useCallback((id) => {
    setNotifications((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, read: !item.read } : item));
      saveStoredNotifications(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((item) => ({ ...item, read: true }));
      saveStoredNotifications(next);
      return next;
    });
    toastSuccess('Đã đánh dấu tất cả thông báo là đã đọc.', 'Thông Báo');
  }, [toastSuccess]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // 1. Status Filter
      if (statusFilter === 'UNREAD' && item.read) return false;
      if (statusFilter === 'READ' && !item.read) return false;

      // 2. Type Filter
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;

      return true;
    });
  }, [notifications, statusFilter, typeFilter]);

  const paginatedNotifications = useMemo(() => {
    return filteredNotifications.slice(0, visibleCount);
  }, [filteredNotifications, visibleCount]);

  const hasMore = visibleCount < filteredNotifications.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + initialPageSize);
  }, [initialPageSize]);

  return {
    notifications,
    filteredNotifications,
    paginatedNotifications,
    unreadCount,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    markAsRead,
    toggleRead,
    markAllAsRead,
    hasMore,
    loadMore,
    totalCount: filteredNotifications.length,
  };
};

export default useMockNotifications;
