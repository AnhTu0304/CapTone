import { request, getAuthToken } from './apiClient';
import multiTabSync, { SYNC_EVENTS } from './multiTabSync';
/**
 * @file personalPortalService.js
 * @description Dịch vụ quản lý dữ liệu Tầng Cá Nhân (Personal Space / User Portal)
 * Quản lý:
 * 1. Dashboard cá nhân (KPIs, Company gần đây, hoạt động gần đây)
 * 2. My Companies (Danh sách tham gia, lời mời, tạo công ty, chuyển đổi, rời công ty)
 * 3. My Profile (Họ tên, SĐT, email, avatar, chức vụ)
 * 4. Security (Đổi mật khẩu, 2FA, phiên đăng nhập, lịch sử đăng nhập)
 * 5. Notifications (Thông báo cá nhân, đánh dấu đọc, cài đặt nhận tin)
 * 6. Activity History (Lịch sử hoạt động, lọc theo loại & thời gian)
 */

import { getStoredProfile, saveStoredProfile } from '../mocks/profileMockData';
import { formatVnDate, formatVnDateTime } from './profileService';

const STORAGE_COMPANIES_KEY = 'selfheal_personal_companies_v1';
const STORAGE_INVITATIONS_KEY = 'selfheal_personal_invitations_v1';
const STORAGE_SESSIONS_KEY = 'selfheal_personal_sessions_v1';
const STORAGE_LOGIN_HISTORY_KEY = 'selfheal_personal_login_history_v1';
const STORAGE_ACTIVITIES_KEY = 'selfheal_personal_activities_v1';
const STORAGE_NOTIF_SETTINGS_KEY = 'selfheal_personal_notif_settings_v1';
const STORAGE_PERSONAL_NOTIFS_KEY = 'selfheal_personal_notifications_v1';

// Danh sách Company tham gia mặc định (Rỗng khi database chưa có dữ liệu)
export const INITIAL_COMPANIES = [];

// Lời mời tham gia Company đang chờ mặc định
export const INITIAL_INVITATIONS = [];

// Hàm phân tích User-Agent thành tên thiết bị và trình duyệt trực quan
export function parseDeviceFromUserAgent(ua, fallbackDevice) {
  if (!ua || typeof ua !== 'string') {
    return fallbackDevice?.deviceName || 'Google Chrome trên Windows 10 / 11';
  }

  let os = 'Hệ điều hành khác';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10 / 11';
  else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Trình duyệt Web';
  if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/OPR\//i.test(ua)) {
    browser = 'Opera';
  }

  return `${browser} trên ${os}`;
}

// Hàm nhận diện thiết bị và trình duyệt thực tế của phiên hiện tại
export function detectCurrentDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      id: 'sess-current',
      deviceName: 'Google Chrome trên Windows 11',
      deviceType: 'DESKTOP',
      ipAddress: '127.0.0.1 (Localhost / Mạng nội bộ)',
      lastActive: 'Đang hoạt động (Phiên hiện tại)',
      isCurrent: true,
      browser: 'Google Chrome',
      os: 'Windows 11',
    };
  }

  const ua = navigator.userAgent || '';

  // Nhận diện Hệ điều hành thực tế
  let os = 'Hệ điều hành khác';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10 / 11';
  else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Nhận diện Loại thiết bị (Desktop hoặc Mobile)
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const deviceType = isMobile ? 'MOBILE' : 'DESKTOP';

  // Nhận diện Trình duyệt & Phiên bản thực tế
  let browserName = 'Trình duyệt Web';
  let browserVersion = '';

  if (/Edg\/([0-9.]+)/i.test(ua)) {
    browserName = 'Microsoft Edge';
    browserVersion = RegExp.$1.split('.')[0];
  } else if (/Chrome\/([0-9.]+)/i.test(ua) && !/Edg/i.test(ua)) {
    browserName = 'Google Chrome';
    browserVersion = RegExp.$1.split('.')[0];
  } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
    browserName = 'Mozilla Firefox';
    browserVersion = RegExp.$1.split('.')[0];
  } else if (/Safari\/([0-9.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    browserName = 'Apple Safari';
    browserVersion = RegExp.$1.split('.')[0];
  } else if (/OPR\/([0-9.]+)/i.test(ua)) {
    browserName = 'Opera';
    browserVersion = RegExp.$1.split('.')[0];
  }

  const browserDisplay = browserVersion ? `${browserName} ${browserVersion}` : browserName;
  const deviceName = `${browserName} trên ${os}`;

  // Địa chỉ Host / IP thực tế kết nối
  const host = window.location.hostname || 'localhost';
  const ipDisplay = (host === 'localhost' || host === '127.0.0.1')
    ? '127.0.0.1 (Localhost / Mạng nội bộ)'
    : `${host} (Trực tuyến)`;

  return {
    id: 'sess-current',
    deviceName,
    deviceType,
    ipAddress: ipDisplay,
    lastActive: 'Đang hoạt động (Phiên hiện tại)',
    isCurrent: true,
    browser: browserDisplay,
    os,
  };
}

// Các phiên đăng nhập đang hoạt động (Mặc định chỉ chứa phiên thực tế từ thiết bị này)
export const INITIAL_SESSIONS = [detectCurrentDevice()];

// Lịch sử đăng nhập mặc định (Rỗng khi database chưa có bản ghi, sẽ đồng bộ qua API)
export const INITIAL_LOGIN_HISTORY = [];

// Thông báo cá nhân mặc định
export const INITIAL_PERSONAL_NOTIFS = [];

// Lịch sử hoạt động cá nhân mặc định (Rỗng khi database chưa có dữ liệu)
export const INITIAL_ACTIVITIES = [];


const STORAGE_PREFERENCES_KEY = 'selfheal_personal_preferences_v1';
const STORAGE_TICKETS_KEY = 'selfheal_personal_tickets_v1';
const STORAGE_BUGS_KEY = 'selfheal_personal_bugs_v1';

export const INITIAL_PREFERENCES = {
  language: 'vi', // 'vi' | 'en'
  appearance: 'light', // 'light' | 'dark' | 'system'
  timezone: 'Asia/Ho_Chi_Minh',
  dateFormat: 'DD/MM/YYYY', // 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  timeFormat: '24h', // '24h' | '12h'
  numberFormat: 'comma_decimal', // 'comma_decimal' (1.234,56) | 'dot_decimal' (1,234.56)
  notifications: {
    inApp: true,
    email: true,
    companyInvites: true,
    roleChanges: true,
    securityAlerts: true,
    systemMaintenance: true,
  },
};

export const INITIAL_TICKETS = [
  {
    id: 'SUP-000123',
    title: 'Cụm Kubernetes k8s-prod-cluster-01 không thu thập được eBPF metrics',
    category: 'Agent',
    impact: 'High',
    companyId: 'org-acme-01',
    companyName: 'Acme Corporation',
    description: 'Sau khi nâng cấp worker node lên v1.30, DaemonSet selfheal-agent báo lỗi CrashLoopBackOff do thiếu quyền CAP_SYS_ADMIN.',
    status: 'IN_PROGRESS',
    statusLabel: 'Đang Xử Lý',
    createdAt: '21/10/2026 14:20',
    updatedAt: '21/10/2026 16:45',
    messages: [
      {
        id: 'msg-1',
        sender: 'Nguyễn Văn An (Bạn)',
        senderRole: 'USER',
        time: '21/10/2026 14:20',
        content: 'Chào đội ngũ kỹ thuật, DaemonSet selfheal-agent trên cụm k8s-prod-cluster-01 gặp sự cố sau khi node worker-03 khởi động lại. Đính kèm log eBPF probe.',
      },
      {
        id: 'msg-2',
        sender: 'Lê Tuấn Hưng (Kỹ Sư Hỗ Trợ SelfAI Tier-2)',
        senderRole: 'SUPPORT',
        time: '21/10/2026 16:45',
        content: 'Chào anh An, chúng tôi đã kiểm tra log. Kernel v6.8 yêu cầu cgroup2 mount path mới. Anh vui lòng cập nhật Helm Chart selfheal-agent lên v2.4.1 bằng lệnh `helm upgrade` đính kèm bên dưới.',
      },
    ],
  },
  {
    id: 'SUP-000118',
    title: 'Hỏi về việc tích hợp SSO SAML 2.0 cho tổ chức VNG Fintech',
    category: 'Account',
    impact: 'Medium',
    companyId: 'org-vng-fintech',
    companyName: 'VNG Fintech Gateway',
    description: 'Cần hỗ trợ cấu hình Azure AD Single Sign-On cho 8 thành viên kỹ sư.',
    status: 'RESOLVED',
    statusLabel: 'Đã Giải Quyết',
    createdAt: '18/10/2026 09:15',
    updatedAt: '19/10/2026 11:30',
    messages: [
      {
        id: 'msg-10',
        sender: 'Nguyễn Văn An (Bạn)',
        senderRole: 'USER',
        time: '18/10/2026 09:15',
        content: 'Nhờ đội ngũ hướng dẫn tích hợp Azure AD Identity Provider vào cổng SME.',
      },
      {
        id: 'msg-11',
        sender: 'SelfAI Support Specialist',
        senderRole: 'SUPPORT',
        time: '19/10/2026 11:30',
        content: 'Đã kích hoạt tính năng Enterprise SSO cho tổ chức VNG Fintech. Anh có thể truy cập Cài đặt hệ thống để tải file Metadata XML.',
      },
    ],
  },
];

export const INITIAL_BUGS = [
  {
    id: 'BUG-00084',
    title: 'Biểu đồ Dự Báo AI Forecast bị tràn viền khi xem trên Safari Mobile',
    type: 'UI',
    typeLabel: 'Giao Diện Người Dùng (UI)',
    description: 'Biểu đồ xychart-beta bị lệch trục Y trên màn hình iPhone 15 Pro.',
    expectedBehavior: 'Biểu đồ co giãn vừa vặn với kích thước màn hình điện thoại di động.',
    actualBehavior: 'Trục Y bị che khuất và xuất hiện thanh cuộn ngang không mong muốn.',
    browser: 'Mobile Safari 17.4 (iOS 17.4)',
    appVersion: 'v2.4.0-selfheal-prod',
    status: 'INVESTIGATING',
    statusLabel: 'Đang Điều Tra',
    createdAt: '20/10/2026 18:30',
  },
];

export const DOCUMENTATION_DATA = [
  {
    id: 'doc-org-invite',
    title: '1. Tạo Company và Mời Thành Viên',
    category: 'Doanh Nghiệp & Tổ Chức',
    summary: 'Hướng dẫn khởi tạo Company, phân quyền vai trò (Owner, DevOps, Viewer) và gửi email lời mời.',
    steps: [
      'Bước 1: Truy cập mục "Company Của Tôi" trong Cổng Cá Nhân hoặc vào Bàn điều khiển Doanh Nghiệp.',
      'Bước 2: Bấm nút "+ Tạo Company Mới", điền tên công ty, định danh slug URL và chọn gói dịch vụ.',
      'Bước 3: Tại tab "Thành Viên & Phân Quyền", chọn "+ Mời Thành Viên", nhập email công vụ và chỉ định vai trò (SME_OWNER, DEVOPS hoặc VIEWER).',
      'Bước 4: Thành viên nhận email thông báo và có thể bấm "Chấp Nhận" trực tiếp tại Trung tâm thông báo.',
    ],
    tips: 'Lưu ý: Chỉ tài khoản nắm giữ vai trò SME_OWNER hoặc Quản trị viên mới có quyền mời hoặc thu hồi quyền của thành viên.',
  },
  {
    id: 'doc-agent-k8s',
    title: '2. Đăng Ký Agent và Kết Nối Kubernetes Cluster',
    category: 'Hạ Tầng & Kubernetes',
    summary: 'Cách cài đặt Helm chart selfheal-agent trên cụm K8s (AWS EKS, GKE hoặc On-Premise bare-metal).',
    steps: [
      'Bước 1: Truy cập trang "Cụm K8s" (/dashboard/clusters) $\to$ bấm "Đăng Ký Cụm Mới".',
      'Bước 2: Đặt tên cụm (ví dụ: `k8s-prod-hn-01`) và chọn nhà cung cấp hạ tầng.',
      'Bước 3: Sao chép lệnh cài đặt Helm tự động do hệ thống sinh ra kèm Agent Token bí mật.',
      'Bước 4: Chạy lệnh `helm install selfheal-agent ./charts/selfheal-agent --set clusterId=...` trên máy tính quản trị viên.',
    ],
    codeSnippet: 'helm repo add selfheal https://charts.selfheal.ai/stable\nhelm install selfheal-agent selfheal/agent \\n  --namespace selfheal-system --create-namespace \\n  --set clusterToken="eyJhbGciOiJIUzI1NiIsInR5c..."',
    tips: 'Yêu cầu nhân Linux kernel $\\ge 5.8$ với tính năng BPF CO-RE (Compile Once - Run Everywhere) được kích hoạt.',
  },
  {
    id: 'doc-agent-health',
    title: '3. Kiểm Tra Agent Đã Kết Nối Thành Công Chưa',
    category: 'Hạ Tầng & Kubernetes',
    summary: 'Xác thực trạng thái eBPF Telemetry Probe, heartbeat WebSocket và luồng dữ liệu thời gian thực.',
    steps: [
      'Bước 1: Mở danh sách Cụm K8s hoặc trang Quản Lý Tác Tử (/dashboard/agents).',
      'Bước 2: Tìm tên Agent tương ứng, kiểm tra badge trạng thái màu xanh lá "100% ONLINE".',
      'Bước 3: Xem chỉ số Heartbeat gần nhất (phải có độ trễ dưới 5 giây).',
      'Bước 4: Nếu trạng thái hiển thị "DEGRADED" hoặc "DISCONNECTED", kiểm tra firewall egress port 443 và 5000.',
    ],
    tips: 'Có thể chạy lệnh `kubectl logs -n selfheal-system daemonset/selfheal-agent` để xem log khởi động trực tiếp.',
  },
  {
    id: 'doc-metrics-ai',
    title: '4. Xem Metrics, Logs, Events và Dự Đoán AI',
    category: 'AI & Giám Sát',
    summary: 'Khai thác động cơ AI chuỗi thời gian để phát hiện sớm quá tải CPU, rò rỉ RAM và xung đột Pod.',
    steps: [
      'Bước 1: Vào trang "Chỉ Số Tài Nguyên" (/dashboard/monitoring/metrics) để xem biểu đồ CPU, RAM, Network I/O.',
      'Bước 2: Mở trang "Dự Báo Rủi Ro AI" (/dashboard/ai/predictions) để xem các cảnh báo rủi ro bão hòa sớm.',
      'Bước 3: Xem độ dốc tăng trưởng (Slope rate) và thời gian còn lại trước khi xảy ra OOM (Out Of Memory).',
    ],
    tips: 'Mô hình AI dự báo trước nguy cơ sự cố từ 15 đến 45 phút, giúp kỹ sư có đủ thời gian chuẩn bị phương án dự phòng.',
  },
  {
    id: 'doc-rca',
    title: '5. Xem Phân Tích Nguyên Nhân Gốc Rễ (RCA)',
    category: 'AI & Sự Cố',
    summary: 'Sử dụng mô hình AI đồ thị nhân quả để xác định chính xác Pod hoặc service gây lỗi dây chuyền.',
    steps: [
      'Bước 1: Khi một sự cố được kích hoạt, truy cập trang "Quản Lý Sự Cố" $\to$ chọn tab "Phân Tích Nguyên Nhân (RCA)".',
      'Bước 2: Xem sơ đồ cây phân tích liên kết (Dependency Call Graph) và điểm số độ tin cậy Confidence Score (ví dụ: 94.2%).',
      'Bước 3: Xem tóm tắt đề xuất hành động: ví dụ "Tăng memory limit từ 512Mi lên 1Gi" hoặc "Restart Pod payment-gw-7b9".',
    ],
    tips: 'RCA tự động liên kết các bản ghi Kubernetes Events (Evicted, Unhealthy, BackOff) với dữ liệu viễn trắc để đưa ra kết luận.',
  },
  {
    id: 'doc-self-healing',
    title: '6. Thực Hiện và Theo Dõi Tự Phục Hồi (Self-Healing)',
    category: 'Tự Phục Hồi (Self-Healing)',
    summary: 'Thiết lập chính sách tự sửa chữa (Auto) và quy trình phê duyệt khẩn cấp (Human-in-the-Loop).',
    steps: [
      'Bước 1: Tại trang "Chính Sách Tự Động" (/dashboard/self-healing/policies), kích hoạt các luật như Restart Pod, Scale Up Replica.',
      'Bước 2: Đối với các hành động rủi ro cao (Drain Node, Rollback Deployment), hệ thống sẽ tạo yêu cầu tại "Cổng Phê Duyệt (HITL)".',
      'Bước 3: SME Owner hoặc DevOps Lead kiểm tra lý do và bấm "Chấp Thuận Hành Động".',
      'Bước 4: Theo dõi kết quả tại "Lịch Sử Phục Hồi" để đảm bảo hệ thống đã trở lại trạng thái lành mạnh (Healthy).',
    ],
    tips: 'Cơ chế Safe Remediation Rate-Limiter sẽ tự động tạm dừng nếu cùng một hành động thất bại quá 3 lần liên tiếp.',
  },
  {
    id: 'doc-rbac-security',
    title: '7. Cấu Hình Quyền và Chính Sách An Toàn',
    category: 'Bảo Mật & Phân Quyền',
    summary: 'Nguyên tắc đặc quyền tối thiểu (Least Privilege) giữa Super Admin, Admin, SME Owner, DevOps và Viewer.',
    steps: [
      'Bước 1: Quản trị viên Tối cao thiết lập ma trận vai trò tại Cổng Quản Trị Hệ Thống (/admin/roles).',
      'Bước 2: Phân tách rõ ràng quyền nền tảng (Platform) và quyền trong nội bộ doanh nghiệp (Tenant).',
      'Bước 3: Kiểm toán tất cả các lượt gán quyền qua "Nhật Ký Kiểm Toán SHA-256" (/admin/audit-logs).',
    ],
    tips: 'Không cấp quyền SUPER_ADMIN cho các kỹ sư chỉ phụ trách một tổ chức doanh nghiệp đơn lẻ.',
  },
];

export const FAQ_DATA = [
  {
    id: 'faq-1',
    category: 'Agent & Kết Nối',
    question: 'Vì sao Agent không kết nối được Backend?',
    answer: 'Nguyên nhân thường gặp nhất là do firewall chặn cổng WebSocket (/api/v1/telemetry/ws) hoặc Agent Token bị hết hạn. Hãy kiểm tra lại outbound kết nối HTTPS/WSS từ cụm K8s tới domain Backend và tạo lại Token mới tại trang Quản Lý Tác Tử.',
    actionPath: '/dashboard/agents',
    actionText: 'Kiểm Tra Danh Sách Tác Tử',
  },
  {
    id: 'faq-2',
    category: 'Hạ Tầng & Metrics',
    question: 'Vì sao Cluster không hiển thị Metrics?',
    answer: 'Hệ thống yêu cầu DaemonSet selfheal-agent chạy ít nhất trên 1 worker node và kubelet cAdvisor hoạt động bình thường. Nếu cụm dùng OpenShift hoặc Bottlerocket, vui lòng kiểm tra SELinux policy cho eBPF socket.',
    actionPath: '/dashboard/clusters',
    actionText: 'Xem Chi Tiết Cụm K8s',
  },
  {
    id: 'faq-3',
    category: 'AI & Tự Phục Hồi',
    question: 'Tại sao AI dự đoán bất thường nhưng không tự phục hồi?',
    answer: 'Hành động tự phục hồi chỉ được kích hoạt tự động nếu chính sách tương ứng được đặt ở chế độ "AUTOMATIC" và điểm tin cậy AI vượt ngưỡng threshold (mặc định > 85%). Nếu chính sách đặt ở chế độ "HITL_REQUIRED", hành động sẽ chờ bạn bấm phê duyệt.',
    actionPath: '/dashboard/self-healing/approvals',
    actionText: 'Tới Cổng Phê Duyệt (HITL)',
  },
  {
    id: 'faq-4',
    category: 'Tự Phục Hồi (Self-Healing)',
    question: 'Vì sao hành động Restart Pod bị từ chối?',
    answer: 'Hệ thống áp dụng cơ chế tự vệ (Circuit Breaker): Nếu số lượng Pod lành mạnh còn lại trong Deployment thấp hơn cấu hình PodDisruptionBudget (PDB) hoặc đã restart quá 5 lần trong 1 giờ qua, hành động tự động sẽ bị chặn để tránh gián đoạn dịch vụ toàn diện.',
    actionPath: '/dashboard/self-healing/policies',
    actionText: 'Xem Chính Sách Tự Động',
  },
  {
    id: 'faq-5',
    category: 'Tổ Chức & Thành Viên',
    question: 'Làm thế nào để mời thành viên vào Company?',
    answer: 'Bạn vào Bàn điều khiển Doanh Nghiệp $\to$ mục "Tổ Chức Doanh Nghiệp" $\to$ chọn tab "Thành Viên & Phân Quyền" $\to$ bấm nút "+ Mời Thành Viên". Nhập email và chọn vai trò mong muốn. Người được mời sẽ nhận thông báo tại Cổng Cá Nhân để chấp nhận.',
    actionPath: '/dashboard/organization/members',
    actionText: 'Quản Lý Thành Viên Company',
  },
  {
    id: 'faq-6',
    category: 'Phân Quyền & Bảo Mật',
    question: 'Làm thế nào để thu hồi quyền của một thành viên?',
    answer: 'Tại danh sách thành viên của Company, tìm người cần thu hồi, bấm nút menu dấu ba chấm $\to$ chọn "Xóa Khỏi Tổ Chức" hoặc "Đổi Vai Trò" về Viewer. Quyền truy cập hạ tầng và tài nguyên sẽ bị vô hiệu hóa ngay lập tức.',
    actionPath: '/dashboard/organization/members',
    actionText: 'Xem Danh Sách Thành Viên',
  },
];

export const personalPortalService = {
  // ================= 1. DASHBOARD & GENERAL =================
  getDashboardSummary() {
    const companies = this.getMyCompanies();
    const activeCompanies = companies.filter((c) => c.status === 'ACTIVE').length;
    const notifs = this.getNotifications();
    const unreadNotifs = notifs.filter((n) => !n.read).length;
    const invitations = this.getInvitations();
    const pendingInvitations = invitations.filter((i) => i.status === 'PENDING').length;

    const recentCompany = companies[0] || null;
    const recentActivities = this.getActivityHistory().slice(0, 5);

    return {
      totalCompanies: companies.length,
      activeCompanies,
      unreadNotifs,
      pendingInvitations,
      recentCompany,
      recentActivities,
    };
  },

  async fetchDashboardSummary() {
    let companies = [];
    let invitations = [];
    let recentActivities = [];

    const [companiesRes, invitationsRes, activitiesRes] = await Promise.allSettled([
      this.fetchMyCompanies(),
      this.fetchMyInvitations(),
      this.fetchActivityHistory({ limit: 5 }),
    ]);

    if (companiesRes.status === 'fulfilled') {
      companies = companiesRes.value || [];
    } else {
      console.warn('[personalPortalService] fetchMyCompanies lỗi:', companiesRes.reason);
      companies = this.getMyCompanies();
    }

    if (invitationsRes.status === 'fulfilled') {
      invitations = invitationsRes.value || [];
    } else {
      console.warn('[personalPortalService] fetchMyInvitations lỗi:', invitationsRes.reason);
      invitations = this.getMyInvitations();
    }

    if (activitiesRes.status === 'fulfilled') {
      recentActivities = (activitiesRes.value || []).slice(0, 5);
    } else {
      recentActivities = this.getActivityHistory().slice(0, 5);
    }

    const activeCompanies = companies.filter((c) => c.status === 'ACTIVE').length;
    const notifs = this.getNotifications();
    const unreadNotifs = notifs.filter((n) => !n.read).length;
    const pendingInvitations = invitations.filter((i) => i.status === 'PENDING').length;

    const recentCompany = companies[0] || null;

    return {
      companies,
      invitations,
      summary: {
        totalCompanies: companies.length,
        activeCompanies,
        unreadNotifs,
        pendingInvitations,
        recentCompany,
        recentActivities,
      },
    };
  },

  // ================= 2. MY COMPANIES =================
  getMyCompanies() {
    try {
      const raw = localStorage.getItem(STORAGE_COMPANIES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (c) =>
            !['org-acme-01', 'org-vng-fintech', 'org-retail-asia', 'org-acme'].includes(c.id) &&
            !c.name?.includes('Acme Corporation')
        );
      }
      return [];
    } catch {
      return [];
    }
  },

  saveCompanies(list) {
    try {
      localStorage.setItem(STORAGE_COMPANIES_KEY, JSON.stringify(list));
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('selfheal_companies_changed', { detail: list }));
      }
      try {
        multiTabSync.broadcast(SYNC_EVENTS.ORG_SWITCHED, { count: (list || []).length });
      } catch {
        // Safe fallback in test or non-browser environments
      }
      return true;
    } catch {
      return false;
    }
  },

  async createCompany({ name, slug, plan = 'SME Starter', domain, description }) {
    const token = getAuthToken();
    if (token) {
      const res = await request('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug ? slug.trim().toLowerCase() : undefined,
          description: description || '',
          website: domain || undefined,
        }),
      });
      await this.fetchMyCompanies();
      this.logActivity('COMPANY_CREATE', 'Tạo mới Company', `Đã tạo công ty ${name} thành công`, 'COMPANY');
      return res?.data;
    }

    const current = this.getMyCompanies();
    const newOrg = {
      id: `org-${Date.now().toString(36)}`,
      name: name.trim(),
      slug: (slug || name).trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
      plan,
      status: 'ACTIVE',
      role: 'SME_OWNER',
      roleTitle: 'Chủ Doanh Nghiệp (Owner)',
      joinedAt: formatVnDate(new Date()),
      clustersCount: 0,
      membersCount: 1,
      activeWorkloads: 0,
      domain: domain ? domain.trim() : `${slug || 'company'}.com`,
      isPrimary: false,
      lastAccessedAt: 'Vừa xong',
      healthStatus: 'HEALTHY',
      description: description || '',
    };
    const updated = [newOrg, ...current];
    this.saveCompanies(updated);
    this.logActivity('COMPANY_CREATE', 'Tạo mới Company', `Đã tạo công ty ${name} thành công`, 'COMPANY');
    return newOrg;
  },

  leaveCompany(orgId) {
    const current = this.getMyCompanies();
    const target = current.find((c) => c.id === orgId);
    if (!target) throw new Error('Không tìm thấy công ty để rời');

    const updated = current.filter((c) => c.id !== orgId);
    this.saveCompanies(updated);
    this.logActivity('COMPANY_LEAVE', 'Rời Company', `Đã rời khỏi tổ chức ${target.name}`, 'COMPANY');
    return true;
  },

  async fetchMyInvitations() {
    const token = getAuthToken();
    if (!token) {
      return [];
    }
    const response = await request('/organizations/me/invitations');
    if (response && Array.isArray(response.data)) {
      const mapped = response.data.map((inv) => {
        const orgId = inv.organization?.id || inv.organization_id;
        const orgName = inv.organization?.name || inv.organization_name || 'Tổ chức';
        const roleCode = inv.role?.code || inv.invitedRole || 'DEVOPS';
        const roleTitle =
          inv.role?.name ||
          (roleCode === 'SME_OWNER'
            ? 'Chủ Doanh Nghiệp (Owner)'
            : roleCode === 'DEVOPS'
            ? 'Kỹ Sư DevOps / SRE'
            : 'Người Quan Sát (Viewer)');

        return {
          id: inv.id,
          organizationId: orgId,
          organizationName: orgName,
          inviterName: inv.inviter?.full_name || 'Quản trị viên',
          inviterEmail: inv.inviter?.email || '',
          invitedRole: roleCode,
          invitedRoleTitle: roleTitle,
          createdAt: inv.created_at ? formatVnDate(new Date(inv.created_at)) : 'Gần đây',
          expiresAt: inv.expires_at ? formatVnDate(new Date(inv.expires_at)) : '7 ngày sau',
          status: 'PENDING',
          clustersCount: 0,
        };
      });

      // Loại bỏ bản ghi trùng lặp nếu cùng organizationId hoặc cùng id
      const uniqueMapped = mapped.filter((item, index, self) =>
        index === self.findIndex((t) => t.id === item.id || (t.organizationId && t.organizationId === item.organizationId))
      );

      localStorage.setItem(STORAGE_INVITATIONS_KEY, JSON.stringify(uniqueMapped));
      return uniqueMapped;
    }
    throw new Error(response?.message || 'Không thể tải danh sách lời mời');
  },

  async fetchMyCompanies() {
    const token = getAuthToken();
    if (!token) {
      return [];
    }
    const response = await request('/organizations/me/list');
    if (response && Array.isArray(response.data)) {
      const mapped = response.data.map((org, index) => {
        const roleCode = org.role_in_org || 'SME_OWNER';
        const roleTitle =
          roleCode === 'SME_OWNER'
            ? 'Chủ Doanh Nghiệp (Owner)'
            : roleCode === 'DEVOPS'
            ? 'Kỹ Sư Vận Hành Hạ Tầng (DevOps)'
            : 'Người Giám Sát (Viewer)';

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: 'Enterprise Cloud',
          status: org.status || 'ACTIVE',
          role: roleCode,
          roleTitle: roleTitle,
          joinedAt: org.created_at ? formatVnDate(new Date(org.created_at)) : 'Vừa xong',
          clustersCount: typeof org.clusters_count === 'number' ? org.clusters_count : 0,
          membersCount: typeof org.members_count === 'number' ? org.members_count : 1,
          activeWorkloads: typeof org.workloads_count === 'number' ? org.workloads_count : (typeof org.active_workloads === 'number' ? org.active_workloads : (org.clusters_count ? 6 : 0)),
          domain: org.profile?.website || (org.slug ? `${org.slug}.com` : ''),
          isPrimary: index === 0,
          lastAccessedAt: 'Vừa xong',
          healthStatus: org.status === 'ACTIVE' ? 'HEALTHY' : 'INACTIVE',
          description: org.description || '',
        };
      });

      this.saveCompanies(mapped);
      return mapped;
    }
    throw new Error(response?.message || 'Phản hồi từ máy chủ không hợp lệ');
  },

  async acceptBackendInvitation(invitationId, orgId) {
    if (orgId && !orgId.startsWith('org-data') && !orgId.startsWith('org-nexus')) {
      try {
        await request(`/organizations/${encodeURIComponent(orgId)}/members/accept`, {
          method: 'POST',
        });
      } catch (err) {
        console.warn('[personalPortalService] acceptBackendInvitation API failed:', err.message);
        throw err;
      }
    }

    this.respondInvitation(invitationId, true);
    await this.fetchMyCompanies();
    return true;
  },

  getInvitations() {
    try {
      const raw = localStorage.getItem(STORAGE_INVITATIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((i) => !['inv-2026-901', 'inv-2026-902'].includes(i.id));
        return filtered.filter((item, index, self) =>
          index === self.findIndex((t) => t.id === item.id || (t.organizationId && t.organizationId === item.organizationId))
        );
      }
      return [];
    } catch {
      return [];
    }
  },

  respondInvitation(invitationId, accept = true) {
    const invitations = this.getInvitations();
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) throw new Error('Lời mời không tồn tại hoặc đã hết hạn');

    const updatedInv = invitations.filter((i) => i.id !== invitationId);
    localStorage.setItem(STORAGE_INVITATIONS_KEY, JSON.stringify(updatedInv));

    if (accept) {
      // Add to companies
      const currentCompanies = this.getMyCompanies();
      const newCompany = {
        id: inv.organizationId,
        name: inv.organizationName,
        slug: inv.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        plan: 'SME Starter',
        status: 'ACTIVE',
        role: inv.invitedRole,
        roleTitle: inv.invitedRoleTitle,
        joinedAt: formatVnDate(new Date()),
        clustersCount: inv.clustersCount || 1,
        membersCount: 4,
        activeWorkloads: 5,
        domain: `${inv.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        isPrimary: false,
        lastAccessedAt: 'Vừa tham gia',
        healthStatus: 'HEALTHY',
      };
      this.saveCompanies([...currentCompanies, newCompany]);
      this.logActivity('COMPANY_JOIN', 'Chấp nhận lời mời tham gia', `Đã tham gia vào ${inv.organizationName}`, 'COMPANY');
    } else {
      this.logActivity('COMPANY_REJECT', 'Từ chối lời mời', `Đã từ chối lời mời từ ${inv.organizationName}`, 'COMPANY');
    }
    return true;
  },

  // ================= 3. PROFILE =================
  getProfile() {
    return getStoredProfile();
  },

  updateProfile(newData) {
    const current = getStoredProfile();
    const updated = {
      ...current,
      ...newData,
      updatedAt: formatVnDateTime(new Date()),
    };
    saveStoredProfile(updated);
    this.logActivity('PROFILE_UPDATE', 'Cập nhật thông tin cá nhân', 'Đã lưu thay đổi hồ sơ người dùng', 'PROFILE');
    return updated;
  },

  // ================= 4. SECURITY =================
  changePassword({ oldPassword, newPassword }) {
    if (!oldPassword || !newPassword) {
      throw new Error('Vui lòng điền đầy đủ mật khẩu cũ và mới');
    }
    if (newPassword.length < 8) {
      throw new Error('Mật khẩu mới phải có tối thiểu 8 ký tự');
    }
    this.logActivity('PASSWORD_CHANGE', 'Đổi mật khẩu', 'Đã đổi mật khẩu đăng nhập thành công', 'SECURITY');
    return true;
  },

  async get2FAStatus() {
    try {
      const res = await request('/auth/2fa/status');
      if (res && res.success && res.data) {
        const profile = getStoredProfile();
        saveStoredProfile({ ...profile, twoFactorEnabled: Boolean(res.data.is_enabled) });
        return res.data;
      }
    } catch (err) {
      console.warn('Không thể lấy trạng thái 2FA từ server, sử dụng local profile:', err?.message);
    }
    const profile = getStoredProfile();
    return {
      is_enabled: Boolean(profile?.twoFactorEnabled),
      confirmed_at: null,
      remaining_backup_codes: 0,
    };
  },

  async setup2FA() {
    const res = await request('/auth/2fa/setup', {
      method: 'POST',
    });
    if (!res || !res.success) {
      throw new Error(res?.message || 'Không thể khởi tạo cấu hình 2FA');
    }
    return res.data;
  },

  async enable2FA(code) {
    const res = await request('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code: code?.trim() }),
    });
    if (!res || !res.success) {
      throw new Error(res?.message || 'Mã OTP xác thực không chính xác');
    }
    const profile = getStoredProfile();
    const updated = { ...profile, twoFactorEnabled: true };
    saveStoredProfile(updated);
    this.logActivity(
      'SECURITY_2FA',
      'Bật xác thực 2 bước (2FA)',
      'Đã kích hoạt bảo mật 2 lớp qua ứng dụng OTP',
      'SECURITY'
    );
    return res.data;
  },

  async disable2FA(password = '') {
    const res = await request('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (!res || !res.success) {
      throw new Error(res?.message || 'Không thể vô hiệu hóa 2FA');
    }
    const profile = getStoredProfile();
    const updated = { ...profile, twoFactorEnabled: false };
    saveStoredProfile(updated);
    this.logActivity(
      'SECURITY_2FA',
      'Tắt xác thực 2 bước (2FA)',
      'Đã vô hiệu hóa bảo mật 2 lớp',
      'SECURITY'
    );
    return res.data;
  },

  toggle2FA(enabled) {
    const profile = getStoredProfile();
    const updated = { ...profile, twoFactorEnabled: Boolean(enabled) };
    saveStoredProfile(updated);
    this.logActivity(
      'SECURITY_2FA',
      enabled ? 'Bật xác thực 2 bước (2FA)' : 'Tắt xác thực 2 bước (2FA)',
      enabled ? 'Đã kích hoạt bảo mật 2 lớp qua ứng dụng OTP' : 'Đã vô hiệu hóa bảo mật 2 lớp',
      'SECURITY'
    );
    return updated;
  },

  getActiveSessions() {
    const currentDevice = detectCurrentDevice();
    try {
      const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
      if (!raw) return [currentDevice];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Loại bỏ các session giả cũ (sess-mobile-ios, sess-laptop-ubuntu)
        const validOtherSessions = parsed.filter(
          (s) => !s.isCurrent && !['sess-mobile-ios', 'sess-laptop-ubuntu', 'sess-current'].includes(s.id)
        );
        return [currentDevice, ...validOtherSessions];
      }
      return [currentDevice];
    } catch {
      return [currentDevice];
    }
  },

  revokeOtherSessions() {
    const currentDevice = detectCurrentDevice();
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify([currentDevice]));
    this.logActivity('SESSION_REVOKE', 'Đăng xuất khỏi các thiết bị khác', 'Đã vô hiệu hóa tất cả các phiên đăng nhập từ xa', 'SECURITY');
    return [currentDevice];
  },

  async fetchLoginHistory(options = {}) {
    const token = getAuthToken();
    if (!token) {
      return this.getLoginHistory();
    }
    const page = typeof options === 'number' ? options : (options?.page || 1);
    const limit = typeof options === 'object' && options?.limit ? options.limit : (typeof options === 'number' ? 10 : (options?.limit || 10));
    try {
      const response = await request(`/users/me/activities?category=AUTH&page=${page}&limit=${limit}`);
      if (response && response.success) {
        const items = response.data?.items || (Array.isArray(response.data) ? response.data : []);
        const total = typeof response.data?.total === 'number' ? response.data.total : items.length;
        const currentDevice = detectCurrentDevice();
        const mapped = items.map((r, index) => {
          let location = 'Mạng nội bộ / Localhost';
          if (r.ipAddress && r.ipAddress !== '127.0.0.1' && !r.ipAddress.startsWith('172.') && !r.ipAddress.startsWith('192.168.')) {
            location = 'Trực tuyến (Việt Nam)';
          }
          return {
            id: r.id || `login-${index}`,
            timestamp: r.timestamp,
            method: r.title?.includes('Google') ? 'Google OAuth SSO' : 'Email & Mật khẩu',
            ipAddress: r.ipAddress || '127.0.0.1',
            location,
            device: r.userAgent ? parseDeviceFromUserAgent(r.userAgent, currentDevice) : currentDevice.deviceName,
            status: r.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
          };
        });
        localStorage.setItem(STORAGE_LOGIN_HISTORY_KEY, JSON.stringify(mapped));
        mapped.total = total;
        mapped.page = page;
        mapped.limit = limit;
        mapped.items = mapped;
        return mapped;
      }
      return this.getLoginHistory();
    } catch (err) {
      console.warn('Lỗi khi tải lịch sử đăng nhập từ server:', err);
      return this.getLoginHistory();
    }
  },

  getLoginHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_LOGIN_HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => !item.id?.startsWith('log-hist-'));
      }
      return [];
    } catch {
      return [];
    }
  },

  // ================= 5. NOTIFICATIONS =================
  getNotifications() {
    try {
      const raw = localStorage.getItem(STORAGE_PERSONAL_NOTIFS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (n) => !['pnotif-1', 'pnotif-2'].includes(n.id) && !n.title?.includes('DataStream')
        );
      }
      return [];
    } catch {
      return [];
    }
  },

  markAsRead(notifId) {
    const notifs = this.getNotifications();
    const updated = notifs.map((n) => (n.id === notifId ? { ...n, read: true } : n));
    localStorage.setItem(STORAGE_PERSONAL_NOTIFS_KEY, JSON.stringify(updated));
    return updated;
  },

  markAllAsRead() {
    const notifs = this.getNotifications();
    const updated = notifs.map((n) => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_PERSONAL_NOTIFS_KEY, JSON.stringify(updated));
    return updated;
  },

  deleteNotification(notifId) {
    const notifs = this.getNotifications();
    const updated = notifs.filter((n) => n.id !== notifId);
    localStorage.setItem(STORAGE_PERSONAL_NOTIFS_KEY, JSON.stringify(updated));
    return updated;
  },

  getNotificationSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_NOTIF_SETTINGS_KEY);
      if (!raw) {
        return {
          emailNotify: true,
          webNotify: true,
          criticalAlerts: true,
          companyInvitations: true,
          securityAlerts: true,
          weeklyDigest: false,
        };
      }
      return JSON.parse(raw);
    } catch {
      return {
        emailNotify: true,
        webNotify: true,
        criticalAlerts: true,
        companyInvitations: true,
        securityAlerts: true,
        weeklyDigest: false,
      };
    }
  },

  saveNotificationSettings(settings) {
    localStorage.setItem(STORAGE_NOTIF_SETTINGS_KEY, JSON.stringify(settings));
    this.logActivity('NOTIF_SETTINGS', 'Cập nhật cài đặt nhận thông báo', 'Lưu tùy chọn nhận tin qua website và email', 'PROFILE');
    return settings;
  },

  // ================= 6. ACTIVITY HISTORY =================
  async fetchActivityHistory(params = {}) {
    const token = getAuthToken();
    if (!token) {
      return this.getActivityHistory();
    }
    try {
      const queryParams = new URLSearchParams();
      if (params.category && params.category !== 'ALL') {
        queryParams.set('category', params.category);
      }
      if (params.search && params.search.trim()) {
        queryParams.set('search', params.search.trim());
      }
      if (params.limit) {
        queryParams.set('limit', String(params.limit));
      }
      if (params.page) {
        queryParams.set('page', String(params.page));
      }

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await request(`/users/me/activities${queryStr}`);
      if (response && response.success) {
        const items = response.data?.items || (Array.isArray(response.data) ? response.data : []);
        if (!params.category || params.category === 'ALL') {
          if (!params.search) {
            localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(items));
          }
        }
        return items;
      }
      return this.getActivityHistory();
    } catch (err) {
      console.warn('Failed to fetch activity history from server:', err);
      return this.getActivityHistory();
    }
  },
  getActivityHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_ACTIVITIES_KEY);
      if (!raw) return INITIAL_ACTIVITIES;
      return JSON.parse(raw);
    } catch {
      return INITIAL_ACTIVITIES;
    }
  },

  // ================= 7. PREFERENCES =================
  getPreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_PREFERENCES_KEY);
      if (!raw) return INITIAL_PREFERENCES;
      return { ...INITIAL_PREFERENCES, ...JSON.parse(raw) };
    } catch {
      return INITIAL_PREFERENCES;
    }
  },

  savePreferences(prefs) {
    try {
      const updated = { ...this.getPreferences(), ...prefs };
      localStorage.setItem(STORAGE_PREFERENCES_KEY, JSON.stringify(updated));
      this.applyTheme(updated.appearance);
      this.logActivity('PREFERENCES_UPDATE', 'Cập nhật tùy chỉnh cá nhân', 'Đã lưu ngôn ngữ, giao diện và cài đặt vùng', 'PROFILE');
      return updated;
    } catch {
      return prefs;
    }
  },

  applyTheme(appearance) {
    const isDark =
      appearance === 'dark' ||
      (appearance === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  },

  // ================= 8. SUPPORT TICKETS =================
  getTickets() {
    try {
      const raw = localStorage.getItem(STORAGE_TICKETS_KEY);
      if (!raw) return INITIAL_TICKETS;
      return JSON.parse(raw);
    } catch {
      return INITIAL_TICKETS;
    }
  },

  createTicket({ title, category, impact, companyId, companyName, description }) {
    const tickets = this.getTickets();
    const newTicket = {
      id: `SUP-${Math.floor(100000 + Math.random() * 900000)}`,
      title: title.trim(),
      category: category || 'Other',
      impact: impact || 'Medium',
      companyId: companyId || 'org-acme-01',
      companyName: companyName || 'Acme Corporation',
      description: description.trim(),
      status: 'OPEN',
      statusLabel: 'Chờ Tiếp Nhận',
      createdAt: formatVnDateTime(new Date()),
      updatedAt: formatVnDateTime(new Date()),
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'Bạn',
          senderRole: 'USER',
          time: formatVnDateTime(new Date()),
          content: description.trim(),
        },
      ],
    };
    const updated = [newTicket, ...tickets];
    localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(updated));
    this.logActivity('TICKET_CREATE', `Tạo phiếu hỗ trợ #${newTicket.id}`, title, 'GENERAL');
    return newTicket;
  },

  addTicketMessage(ticketId, content) {
    const tickets = this.getTickets();
    const updated = tickets.map((t) => {
      if (t.id === ticketId) {
        const newMsg = {
          id: `msg-${Date.now()}`,
          sender: 'Bạn',
          senderRole: 'USER',
          time: formatVnDateTime(new Date()),
          content: content.trim(),
        };
        return {
          ...t,
          updatedAt: formatVnDateTime(new Date()),
          messages: [...t.messages, newMsg],
        };
      }
      return t;
    });
    localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(updated));
    return updated;
  },

  // ================= 9. BUG REPORTS =================
  getBugReports() {
    try {
      const raw = localStorage.getItem(STORAGE_BUGS_KEY);
      if (!raw) return INITIAL_BUGS;
      return JSON.parse(raw);
    } catch {
      return INITIAL_BUGS;
    }
  },

  createBugReport({ title, type, description, expectedBehavior, actualBehavior, browser, appVersion }) {
    const bugs = this.getBugReports();
    const newBug = {
      id: `BUG-${Math.floor(10000 + Math.random() * 90000)}`,
      title: title.trim(),
      type: type || 'UI',
      typeLabel: type === 'UI' ? 'Giao Diện (UI)' : type === 'API' ? 'API / Backend' : type === 'Agent' ? 'Agent eBPF' : 'Bảo Mật',
      description: description.trim(),
      expectedBehavior: expectedBehavior ? expectedBehavior.trim() : '',
      actualBehavior: actualBehavior ? actualBehavior.trim() : '',
      browser: browser || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Chrome/128.0 Windows'),
      appVersion: appVersion || 'v2.4.0-selfheal-prod',
      status: 'SUBMITTED',
      statusLabel: 'Đã Tiếp Nhận',
      createdAt: formatVnDateTime(new Date()),
    };
    const updated = [newBug, ...bugs];
    localStorage.setItem(STORAGE_BUGS_KEY, JSON.stringify(updated));
    this.logActivity('BUG_REPORT', `Báo cáo lỗi #${newBug.id}`, title, 'GENERAL');
    return newBug;
  },

  logActivity(actionType, title, description, category = 'GENERAL') {
    const list = this.getActivityHistory();
    const newAct = {
      id: `act-${Date.now().toString(36)}`,
      actionType,
      title,
      description,
      timestamp: formatVnDateTime(new Date()),
      ipAddress: detectCurrentDevice()?.ipAddress?.split(' ')[0] || '127.0.0.1',
      category,
      status: 'SUCCESS',
    };
    const updated = [newAct, ...list].slice(0, 50);
    try {
      localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Cannot write activity log:', e);
    }

    try {
      const token = getAuthToken();
      if (token) {
        request('/users/me/activities', {
          method: 'POST',
          body: JSON.stringify({
            action: actionType,
            title,
            description,
            category,
          }),
        }).catch((err) => {
          console.warn('[personalPortalService] Không thể đồng bộ activity lên server:', err?.message || err);
        });
      }
    } catch (e) {}

    return newAct;
  },
};

export default personalPortalService;
