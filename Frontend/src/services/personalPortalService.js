import { request } from './apiClient';
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

// Dữ liệu mẫu danh sách Company tham gia
export const INITIAL_COMPANIES = [
  {
    id: 'org-acme-01',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    plan: 'Enterprise Cloud',
    status: 'ACTIVE',
    role: 'SME_OWNER',
    roleTitle: 'Chủ Doanh Nghiệp (Owner)',
    joinedAt: '15/01/2026',
    clustersCount: 4,
    membersCount: 18,
    activeWorkloads: 32,
    domain: 'acmecorp.vn',
    isPrimary: true,
    lastAccessedAt: '10 phút trước',
    healthStatus: 'HEALTHY',
  },
  {
    id: 'org-vng-fintech',
    name: 'VNG Fintech Gateway',
    slug: 'vng-fintech',
    plan: 'SME Pro',
    status: 'ACTIVE',
    role: 'DEVOPS',
    roleTitle: 'Kỹ Sư Vận Hành Hạ Tầng (DevOps)',
    joinedAt: '02/03/2026',
    clustersCount: 2,
    membersCount: 8,
    activeWorkloads: 14,
    domain: 'fintech.vng.vn',
    isPrimary: false,
    lastAccessedAt: '2 giờ trước',
    healthStatus: 'WARNING',
  },
  {
    id: 'org-retail-asia',
    name: 'Smart Retail Logistics',
    slug: 'smart-retail',
    plan: 'SME Starter',
    status: 'ACTIVE',
    role: 'VIEWER',
    roleTitle: 'Người Giám Sát (Viewer)',
    joinedAt: '12/04/2026',
    clustersCount: 1,
    membersCount: 5,
    activeWorkloads: 6,
    domain: 'smartretail.asia',
    isPrimary: false,
    lastAccessedAt: 'Hôm qua',
    healthStatus: 'HEALTHY',
  },
];

// Lời mời tham gia Company đang chờ
export const INITIAL_INVITATIONS = [
  {
    id: 'inv-2026-901',
    organizationId: 'org-data-stream',
    organizationName: 'DataStream AI Analytics',
    inviterName: 'Trần Minh Đức (CTO)',
    inviterEmail: 'duc.tran@datastream.ai',
    invitedRole: 'DEVOPS',
    invitedRoleTitle: 'Kỹ Sư DevOps / SRE',
    createdAt: '20/10/2026',
    expiresAt: '27/10/2026',
    status: 'PENDING',
    clustersCount: 3,
  },
  {
    id: 'inv-2026-902',
    organizationId: 'org-nexus-cloud',
    organizationName: 'Nexus Global Cloud',
    inviterName: 'Lê Hoàng Yến (HR Manager)',
    inviterEmail: 'yen.le@nexuscloud.io',
    invitedRole: 'VIEWER',
    invitedRoleTitle: 'Người Quan Sát Báo Cáo',
    createdAt: '21/10/2026',
    expiresAt: '28/10/2026',
    status: 'PENDING',
    clustersCount: 1,
  },
];

// Các phiên đăng nhập đang hoạt động
export const INITIAL_SESSIONS = [
  {
    id: 'sess-current',
    deviceName: 'Chrome trên Windows 11',
    deviceType: 'DESKTOP',
    ipAddress: '118.70.12.84 (Hà Nội, Việt Nam)',
    lastActive: 'Đang hoạt động (Phiên hiện tại)',
    isCurrent: true,
    browser: 'Chrome 128.0',
    os: 'Windows 11 Pro 64-bit',
  },
  {
    id: 'sess-mobile-ios',
    deviceName: 'Safari trên iPhone 15 Pro',
    deviceType: 'MOBILE',
    ipAddress: '14.162.144.12 (TP. Hồ Chí Minh, Việt Nam)',
    lastActive: '45 phút trước',
    isCurrent: false,
    browser: 'Mobile Safari 17.4',
    os: 'iOS 17.4',
  },
  {
    id: 'sess-laptop-ubuntu',
    deviceName: 'Firefox trên Ubuntu 24.04 LTS',
    deviceType: 'DESKTOP',
    ipAddress: '27.72.63.190 (Đà Nẵng, Việt Nam)',
    lastActive: 'Hôm qua lúc 18:20',
    isCurrent: false,
    browser: 'Firefox 126.0',
    os: 'Ubuntu Linux 24.04',
  },
];

// Lịch sử đăng nhập
export const INITIAL_LOGIN_HISTORY = [
  {
    id: 'log-hist-1',
    timestamp: '22/10/2026 03:00:15',
    method: 'Email & Mật khẩu',
    ipAddress: '118.70.12.84',
    location: 'Hà Nội, Việt Nam',
    device: 'Chrome / Windows 11',
    status: 'SUCCESS',
  },
  {
    id: 'log-hist-2',
    timestamp: '21/10/2026 21:15:40',
    method: 'Email & Mật khẩu',
    ipAddress: '14.162.144.12',
    location: 'TP. Hồ Chí Minh, Việt Nam',
    device: 'Safari / iOS 17.4',
    status: 'SUCCESS',
  },
  {
    id: 'log-hist-3',
    timestamp: '21/10/2026 14:02:11',
    method: 'Google OAuth Single Sign-On',
    ipAddress: '118.70.12.84',
    location: 'Hà Nội, Việt Nam',
    device: 'Chrome / Windows 11',
    status: 'SUCCESS',
  },
  {
    id: 'log-hist-4',
    timestamp: '20/10/2026 08:45:22',
    method: 'Email & Mật khẩu',
    ipAddress: '42.114.88.99',
    location: 'Cần Thơ, Việt Nam',
    device: 'Chrome / Android',
    status: 'FAILED',
    failReason: 'Sai mật khẩu lần 1',
  },
  {
    id: 'log-hist-5',
    timestamp: '19/10/2026 19:30:00',
    method: 'Email & Mật khẩu',
    ipAddress: '27.72.63.190',
    location: 'Đà Nẵng, Việt Nam',
    device: 'Firefox / Linux',
    status: 'SUCCESS',
  },
];

// Thông báo cá nhân
export const INITIAL_PERSONAL_NOTIFS = [
  {
    id: 'pnotif-1',
    type: 'INVITATION',
    title: 'Lời mời tham gia Company: DataStream AI Analytics',
    message: 'Trần Minh Đức (CTO) đã mời bạn tham gia tổ chức với vai trò Kỹ Sư DevOps / SRE.',
    createdAt: '22/10/2026 02:15',
    read: false,
    severity: 'INFO',
    actionType: 'INVITATION',
    invitationId: 'inv-2026-901',
  },
  {
    id: 'pnotif-2',
    type: 'SECURITY',
    title: 'Cảnh báo đăng nhập mới từ thiết bị lạ',
    message: 'Tài khoản vừa đăng nhập thành công từ IP 118.70.12.84 (Hà Nội, Chrome Windows).',
    createdAt: '22/10/2026 03:00',
    read: false,
    severity: 'WARNING',
    actionType: 'SECURITY',
  },
  {
    id: 'pnotif-3',
    type: 'ROLE',
    title: 'Quyền hạn thành viên được nâng cấp',
    message: 'Bạn đã được chỉ định vai trò Kỹ sư DevOps Lead tại công ty VNG Fintech Gateway.',
    createdAt: '21/10/2026 16:40',
    read: true,
    severity: 'SUCCESS',
    actionType: 'ROLE_UPDATE',
  },
  {
    id: 'pnotif-4',
    type: 'SYSTEM',
    title: 'Hệ thống AI Self-Healing cập nhật bản vá v2.4',
    message: 'Động cơ dự báo RCA và cơ chế tự động drain pod đã được nâng cấp độ chính xác lên 98.4%.',
    createdAt: '20/10/2026 09:00',
    read: true,
    severity: 'INFO',
    actionType: 'SYSTEM',
  },
];

// Lịch sử hoạt động cá nhân
export const INITIAL_ACTIVITIES = [
  {
    id: 'act-1',
    actionType: 'LOGIN',
    title: 'Đăng nhập vào hệ thống',
    description: 'Đăng nhập thành công từ trình duyệt Chrome trên Windows 11',
    timestamp: '22/10/2026 03:00:15',
    ipAddress: '118.70.12.84',
    category: 'AUTH',
    status: 'SUCCESS',
  },
  {
    id: 'act-2',
    actionType: 'PROFILE_UPDATE',
    title: 'Cập nhật hồ sơ cá nhân',
    description: 'Chỉnh sửa chức danh chuyên môn và cập nhật số điện thoại liên hệ',
    timestamp: '21/10/2026 19:42:00',
    ipAddress: '118.70.12.84',
    category: 'PROFILE',
    status: 'SUCCESS',
  },
  {
    id: 'act-3',
    actionType: 'COMPANY_SWITCH',
    title: 'Truy cập Workspace Doanh nghiệp',
    description: 'Chuyển sang làm việc tại công ty Acme Corporation (K8s Cluster #1)',
    timestamp: '21/10/2026 15:10:30',
    ipAddress: '118.70.12.84',
    category: 'COMPANY',
    status: 'SUCCESS',
  },
  {
    id: 'act-4',
    actionType: 'SECURITY_2FA',
    title: 'Bật xác thực hai yếu tố (2FA)',
    description: 'Kích hoạt thành công mã xác thực TOTP Authenticator cho tài khoản',
    timestamp: '20/10/2026 11:25:10',
    ipAddress: '118.70.12.84',
    category: 'SECURITY',
    status: 'SUCCESS',
  },
  {
    id: 'act-5',
    actionType: 'PASSWORD_CHANGE',
    title: 'Đổi mật khẩu tài khoản',
    description: 'Thay đổi mật khẩu đăng nhập định kỳ bảo mật',
    timestamp: '18/10/2026 14:05:00',
    ipAddress: '27.72.63.190',
    category: 'SECURITY',
    status: 'SUCCESS',
  },
  {
    id: 'act-6',
    actionType: 'COMPANY_JOIN',
    title: 'Tham gia công ty VNG Fintech Gateway',
    description: 'Chấp nhận lời mời và được cấp quyền vai trò Kỹ sư DevOps',
    timestamp: '15/10/2026 10:00:00',
    ipAddress: '14.162.144.12',
    category: 'COMPANY',
    status: 'SUCCESS',
  },
];


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

  // ================= 2. MY COMPANIES =================
  getMyCompanies() {
    try {
      const raw = localStorage.getItem(STORAGE_COMPANIES_KEY);
      if (!raw) return INITIAL_COMPANIES;
      return JSON.parse(raw);
    } catch {
      return INITIAL_COMPANIES;
    }
  },

  saveCompanies(list) {
    try {
      localStorage.setItem(STORAGE_COMPANIES_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  },

  createCompany({ name, slug, plan = 'SME Starter', domain, description }) {
    const current = this.getMyCompanies();
    const newOrg = {
      id: `org-${Date.now().toString(36)}`,
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      plan,
      status: 'ACTIVE',
      role: 'SME_OWNER',
      roleTitle: 'Chủ Doanh Nghiệp (Owner)',
      joinedAt: formatVnDate(new Date()),
      clustersCount: 0,
      membersCount: 1,
      activeWorkloads: 0,
      domain: domain ? domain.trim() : `${slug.trim().toLowerCase()}.com`,
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
    try {
      const token =
        localStorage.getItem('selfheal_auth_token') ||
        sessionStorage.getItem('admin_access_token');
      if (!token) {
        return this.getInvitations();
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
            clustersCount: 1,
          };
        });

        localStorage.setItem(STORAGE_INVITATIONS_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('[personalPortalService] fetchMyInvitations failed, using local cache:', err.message);
    }
    return this.getInvitations();
  },

  async fetchMyCompanies() {
    try {
      const token =
        localStorage.getItem('selfheal_auth_token') ||
        sessionStorage.getItem('admin_access_token');
      if (!token) {
        return this.getMyCompanies();
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
            joinedAt: org.created_at ? formatVnDate(new Date(org.created_at)) : '15/01/2026',
            clustersCount: 2,
            membersCount: 5,
            activeWorkloads: 10,
            domain: `${org.slug}.com`,
            isPrimary: index === 0,
            lastAccessedAt: 'Vừa xong',
            healthStatus: 'HEALTHY',
          };
        });

        if (mapped.length > 0) {
          this.saveCompanies(mapped);
          return mapped;
        }
      }
    } catch (err) {
      console.warn('[personalPortalService] fetchMyCompanies failed, using local cache:', err.message);
    }
    return this.getMyCompanies();
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
      if (!raw) return INITIAL_INVITATIONS;
      return JSON.parse(raw);
    } catch {
      return INITIAL_INVITATIONS;
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
    try {
      const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
      if (!raw) return INITIAL_SESSIONS;
      return JSON.parse(raw);
    } catch {
      return INITIAL_SESSIONS;
    }
  },

  revokeOtherSessions() {
    const sessions = this.getActiveSessions();
    const currentOnly = sessions.filter((s) => s.isCurrent);
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(currentOnly));
    this.logActivity('SESSION_REVOKE', 'Đăng xuất khỏi các thiết bị khác', 'Đã vô hiệu hóa tất cả các phiên đăng nhập từ xa', 'SECURITY');
    return currentOnly;
  },

  getLoginHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_LOGIN_HISTORY_KEY);
      if (!raw) return INITIAL_LOGIN_HISTORY;
      return JSON.parse(raw);
    } catch {
      return INITIAL_LOGIN_HISTORY;
    }
  },

  // ================= 5. NOTIFICATIONS =================
  getNotifications() {
    try {
      const raw = localStorage.getItem(STORAGE_PERSONAL_NOTIFS_KEY);
      if (!raw) return INITIAL_PERSONAL_NOTIFS;
      return JSON.parse(raw);
    } catch {
      return INITIAL_PERSONAL_NOTIFS;
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
      ipAddress: '118.70.12.84',
      category,
      status: 'SUCCESS',
    };
    const updated = [newAct, ...list].slice(0, 50); // Giữ 50 hoạt động gần nhất
    try {
      localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Cannot write activity log:', e);
    }
    return newAct;
  },
};

export default personalPortalService;
