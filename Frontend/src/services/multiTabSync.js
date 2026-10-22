/**
 * @file multiTabSync.js
 * @description Enterprise Cross-Tab State & Auth Synchronization via BroadcastChannel with StorageEvent Fallback.
 * 
 * Đồng bộ an toàn giữa các Tab trình duyệt cùng origin:
 * 1. AUTH_LOGOUT: Đăng xuất tại Tab A -> Tất cả các Tab khác lập tức chuyển về unauthenticated, xóa token & dữ liệu cache.
 * 2. AUTH_LOGIN: Đăng nhập tại Tab A -> Thông báo các Tab khác đồng bộ session.
 * 3. SESSION_REVOKED: Khi backend trả về 401 hoặc session bị thu hồi -> Thoát đồng loạt các Tab.
 * 4. ORG_SWITCHED: Chuyển Organization tại Tab A -> Tab B nhận thông điệp, xác minh với danh sách hợp lệ và cập nhật context.
 * 
 * BẢO MẬT: Tuyệt đối KHÔNG phát tán token, refresh token, mật khẩu hoặc secret qua bus.
 */

const CHANNEL_NAME = 'selfheal_multitab_bus';
const STORAGE_FALLBACK_KEY = 'selfheal_tab_sync_ping';

export const SYNC_EVENTS = {
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_LOGIN: 'AUTH_LOGIN',
  SESSION_REVOKED: 'SESSION_REVOKED',
  ORG_SWITCHED: 'ORG_SWITCHED',
};

// Định danh duy nhất cho từng Tab trong phiên làm việc
const tabId = typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

let broadcastChannel = null;
if (typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function') {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    broadcastChannel = null;
  }
}

const listeners = new Set();

// Handler khi nhận message từ BroadcastChannel
if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    const data = event.data;
    if (!data || data.senderId === tabId) return; // Bỏ qua thông điệp từ chính tab này
    notifyListeners(data);
  };
}

// Handler fallback khi dùng storage event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_FALLBACK_KEY || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      if (!data || data.senderId === tabId) return;
      notifyListeners(data);
    } catch {
      // Ignore JSON parse errors
    }
  });
}

function notifyListeners(message) {
  listeners.forEach((listener) => {
    try {
      listener(message);
    } catch (err) {
      console.warn('[multiTabSync] Error in listener execution:', err);
    }
  });
}

/**
 * Phát thông điệp sự kiện tới tất cả các tab khác
 * @param {string} type - Một trong các SYNC_EVENTS
 * @param {Record<string, any>} [payload] - Dữ liệu không nhạy cảm kèm theo
 */
export const broadcastSyncEvent = (type, payload = {}) => {
  const message = {
    type,
    payload,
    senderId: tabId,
    timestamp: Date.now(),
  };

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(message);
    } catch (err) {
      console.warn('[multiTabSync] BroadcastChannel postMessage error:', err);
    }
  }

  // Luôn kích hoạt storage event fallback để hỗ trợ trình duyệt hoặc test runner không có BroadcastChannel
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(message));
      // Xóa ngay sau đó để không để lại rác trong localStorage
      setTimeout(() => {
        try {
          window.localStorage.removeItem(STORAGE_FALLBACK_KEY);
        } catch {}
      }, 100);
    } catch {}
  }
};

/**
 * Đăng ký lắng nghe sự kiện đồng bộ từ các tab khác
 * @param {string|Function} typeOrHandler - Loại event muốn lọc hoặc callback nhận toàn bộ
 * @param {Function} [maybeHandler] - Callback khi có lọc type
 * @returns {Function} Hàm hủy đăng ký listener (unsubscribe)
 */
export const subscribeSyncEvent = (typeOrHandler, maybeHandler) => {
  const isFiltered = typeof typeOrHandler === 'string' && typeof maybeHandler === 'function';
  const targetType = isFiltered ? typeOrHandler : null;
  const callback = isFiltered ? maybeHandler : typeOrHandler;

  const wrapper = (message) => {
    if (!targetType || message.type === targetType) {
      callback(message.payload, message);
    }
  };

  listeners.add(wrapper);

  return () => {
    listeners.delete(wrapper);
  };
};

export const getTabId = () => tabId;

const multiTabSync = {
  EVENTS: SYNC_EVENTS,
  broadcast: broadcastSyncEvent,
  subscribe: subscribeSyncEvent,
  getTabId,
};

export default multiTabSync;
