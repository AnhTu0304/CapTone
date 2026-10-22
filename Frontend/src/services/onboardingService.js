/**
 * Dịch vụ Onboarding API Client
 * Kết nối luồng Onboarding 5 bước với Main Backend API (Node.js/Express trên cổng 5000)
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const getAuthToken = () => {
  try {
    return (
      localStorage.getItem('selfheal_auth_token') ||
      sessionStorage.getItem('admin_access_token') ||
      localStorage.getItem('admin_access_token') ||
      localStorage.getItem('token') ||
      null
    );
  } catch {
    return null;
  }
};

const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const onboardingService = {
  /**
   * BƯỚC 1: Tạo mới Không gian Tổ chức (Organization)
   * POST /api/v1/organizations
   */
  async createOrganization({ name, slug, description, type = 'SaaS Enterprise', email }) {
    const res = await fetch(`${API_BASE_URL}/organizations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name,
        slug: slug || undefined,
        description: description || undefined,
        type,
        email: email || undefined,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Không thể tạo tổ chức mới');
    }
    return json.data;
  },

  /**
   * Lấy danh sách tổ chức của user hiện tại (nếu user đã có tổ chức)
   * GET /api/v1/organizations
   */
  async getMyOrganizations() {
    const res = await fetch(`${API_BASE_URL}/organizations?page=1&limit=10`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const json = await res.json();
    if (!res.ok) {
      return [];
    }
    return json.data?.items || [];
  },

  /**
   * Lấy danh sách Môi trường (Environment) của Tổ chức
   * GET /api/v1/organizations/:orgId/environments
   */
  async getEnvironments(orgId) {
    const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/environments`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const json = await res.json();
    if (!res.ok) {
      return [];
    }
    return json.data?.environments || json.data?.items || (Array.isArray(json.data) ? json.data : []);
  },

  /**
   * Lấy danh sách Agent của Tổ chức
   * GET /api/v1/organizations/:orgId/agents
   */
  async getAgents(orgId) {
    const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/agents`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const json = await res.json();
    if (!res.ok) {
      return [];
    }
    return json.data?.items || json.data || [];
  },

  /**
   * BƯỚC 2: Tạo Môi trường (Environment) trong Tổ chức (DEV hoặc STAGING)
   * POST /api/v1/organizations/:orgId/environments
   */
  async createEnvironment(orgId, { name, code, environment_type, description }) {
    // Chuẩn hóa type về DEV hoặc STAGING
    const rawType = (environment_type || '').toUpperCase();
    const normalizedType = rawType.includes('STAGING') ? 'STAGING' : 'DEV';

    // Sinh code tự động nếu chưa có
    const normalizedCode = (code || name || 'env')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/environments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name,
        code: normalizedCode,
        environment_type: normalizedType,
        description: description || undefined,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Không thể tạo môi trường');
    }
    return json.data;
  },

  /**
   * BƯỚC 3: Tạo Agent cho Cụm K8s & Sinh Token Bí Mật Ban Đầu
   * POST /api/v1/organizations/:orgId/agents
   */
  async createAgent(orgId, { name, environment_id, version = 'v1.0.0' }) {
    const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/agents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name,
        environment_id,
        version,
        token_expires_in_days: 90,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Không thể đăng ký Agent cho cụm máy chủ');
    }
    return json.data; // { agent, token: { id, raw_token, token_prefix, expires_at }, install_command }
  },

  /**
   * BƯỚC 3.1: Xoay vòng Token / Cấp Token mới cho Agent
   * POST /api/v1/organizations/:orgId/agents/:agentId/tokens
   */
  async generateNewToken(orgId, agentId, expiresInDays = 90) {
    const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/agents/${agentId}/tokens`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        expires_in_days: expiresInDays,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Không thể cấp lại token mới');
    }
    return json.data; // { token_id, raw_token, token_prefix, expires_at }
  },

  /**
   * BƯỚC 4: Xác thực trạng thái Agent và kiểm tra tín hiệu Heartbeat
   * GET /api/v1/organizations/:orgId/agents/:agentId
   */
  async checkAgentStatus(orgId, agentId) {
    const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/agents/${agentId}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Không thể tải trạng thái Agent');
    }
    return json.data; // { id, name, status, last_seen_at, active_tokens_count, last_latency_ms, tokens, recent_heartbeats }
  },

  /**
   * Lấy lịch sử Heartbeat của Agent
   * GET /api/v1/organizations/:orgId/agents/:agentId/heartbeats
   */
  async getAgentHeartbeats(orgId, agentId, limit = 10) {
    const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/agents/${agentId}/heartbeats?limit=${limit}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const json = await res.json();
    if (!res.ok) {
      return [];
    }
    return json.data || [];
  },
};

export default onboardingService;
