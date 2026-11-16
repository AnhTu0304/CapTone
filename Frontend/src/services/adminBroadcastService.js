import { request } from './apiClient';

/**
 * Lấy danh sách thông báo toàn mạng và cảnh báo hệ thống từ PostgreSQL
 */
export async function fetchAdminBroadcasts() {
  try {
    const res = await request('/admin/broadcasts');
    if (res && res.success && res.data) {
      return res.data;
    }
    return { broadcasts: [], systemAlerts: [] };
  } catch (err) {
    console.warn('[adminBroadcastService] Lỗi khi nạp danh sách thông báo:', err);
    throw err;
  }
}

/**
 * Phát sóng thông báo mới toàn mạng
 * @param {Object} payload - { title, content, priority, audience, showStickyBanner }
 */
export async function createAdminBroadcast(payload) {
  try {
    const res = await request('/admin/broadcasts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res && res.success) {
      return res.data;
    }
    throw new Error(res?.message || 'Không thể phát sóng thông báo');
  } catch (err) {
    console.error('[adminBroadcastService] Lỗi khi phát sóng thông báo:', err);
    throw err;
  }
}

/**
 * Gỡ bỏ một thông báo toàn mạng
 * @param {string} id
 */
export async function deleteAdminBroadcast(id) {
  try {
    const res = await request(`/admin/broadcasts/${id}`, {
      method: 'DELETE',
    });
    return res && res.success;
  } catch (err) {
    console.error('[adminBroadcastService] Lỗi khi gỡ bỏ thông báo:', err);
    throw err;
  }
}
