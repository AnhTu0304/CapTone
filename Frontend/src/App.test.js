import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';

test('renders SelfHeal platform header and brand', () => {
  render(<App />);
  const brandElements = screen.getAllByText(/Self/i);
  expect(brandElements.length).toBeGreaterThan(0);
});

test('renders navigation routes in header and page', () => {
  render(<App />);
  const guideLinks = screen.getAllByText(/Hướng dẫn/i);
  expect(guideLinks.length).toBeGreaterThan(0);

  const featuresLinks = screen.getAllByText(/Tính năng/i);
  expect(featuresLinks.length).toBeGreaterThan(0);

  const docsLinks = screen.getAllByText(/Tài liệu/i);
  expect(docsLinks.length).toBeGreaterThan(0);
});

test('renders new 3D Hero Section heading and trust badges', () => {
  render(<App />);
  const headingObs = screen.getAllByText(/Quan sát/i);
  expect(headingObs.length).toBeGreaterThan(0);

  const headingRec = screen.getAllByText(/Khôi phục/i);
  expect(headingRec.length).toBeGreaterThan(0);

  const k8sBadges = screen.getAllByText(/Native Kubernetes/i);
  expect(k8sBadges.length).toBeGreaterThan(0);

  expect(screen.getByText(/Ứng dụng AI/i)).toBeInTheDocument();
  const controlBadges = screen.getAllByText(/Con người kiểm soát/i);
  expect(controlBadges.length).toBeGreaterThan(0);
});

test('renders 3D Infrastructure Dashboard and metrics', () => {
  render(<App />);
  expect(screen.getByText(/98,7%/i)).toBeInTheDocument();
  
  const cpuElements = screen.getAllByText(/42%/i);
  expect(cpuElements.length).toBeGreaterThan(0);

  expect(screen.getByText(/68%/i)).toBeInTheDocument();
  expect(screen.getByText(/Được xây dựng cho hạ tầng doanh nghiệp vừa và nhỏ \(SME\) dựa trên Kubernetes/i)).toBeInTheDocument();
});

test('renders Onboarding Step 1: Create Organization in Vietnamese', () => {
  window.history.pushState({}, '', '/onboarding/organization');
  render(<App />);
  expect(screen.getByText(/Tạo tổ chức của bạn/i)).toBeInTheDocument();
  expect(screen.getByText(/Tên Tổ Chức/i)).toBeInTheDocument();
  expect(screen.getByText(/Định Danh Slug Tổ Chức/i)).toBeInTheDocument();
  expect(screen.getByText(/Tiếp tục sang Môi trường/i)).toBeInTheDocument();
});

test('renders Onboarding Step 2: Create Environment in Vietnamese', () => {
  window.history.pushState({}, '', '/onboarding/environment');
  render(<App />);
  expect(screen.getByText(/Tạo môi trường giám sát/i)).toBeInTheDocument();
  expect(screen.getByText(/Tên Môi Trường/i)).toBeInTheDocument();
  expect(screen.getByText(/Loại Môi Trường/i)).toBeInTheDocument();
  expect(screen.getByText(/Tiếp tục sang Kubernetes/i)).toBeInTheDocument();
});

test('renders Onboarding Step 3: Connect Kubernetes with RBAC notice in Vietnamese', () => {
  window.history.pushState({}, '', '/onboarding/kubernetes');
  render(<App />);
  expect(screen.getByText(/Kết nối môi trường Kubernetes/i)).toBeInTheDocument();
  expect(screen.getByText(/Đăng ký Cụm máy chủ/i)).toBeInTheDocument();
  expect(screen.getByText(/Khởi tạo Token Tác tử/i)).toBeInTheDocument();
  expect(screen.getByText(/Cài đặt Tác tử SelfHeal/i)).toBeInTheDocument();
  expect(screen.getByText(/Chính sách Zero Cluster-Admin/i)).toBeInTheDocument();
});

test('renders Onboarding Step 4: Verify Agent and Diagnostics in Vietnamese', () => {
  window.history.pushState({}, '', '/onboarding/verify-agent');
  render(<App />);
  expect(screen.getByText(/Xác thực Tác tử SelfHeal/i)).toBeInTheDocument();
  expect(screen.getByText(/CỔNG KẾT NỐI SOCKET/i)).toBeInTheDocument();
  expect(screen.getByText(/Thông báo Hiệu chuẩn Dữ liệu AI/i)).toBeInTheDocument();
  expect(screen.getByText(/Xử lý sự cố kết nối Tác tử/i)).toBeInTheDocument();
});

test('renders Onboarding Step 5: Setup Complete in Vietnamese', () => {
  window.history.pushState({}, '', '/onboarding/complete');
  render(<App />);
  expect(screen.getByText(/Môi trường của bạn đã sẵn sàng/i)).toBeInTheDocument();
  expect(screen.getByText(/Đi tới Bảng điều khiển/i)).toBeInTheDocument();
  expect(screen.getByText(/Đọc Tài liệu Hướng dẫn/i)).toBeInTheDocument();
});

test('renders Register Page: Create your account', () => {
  window.history.pushState({}, '', '/register');
  render(<App />);
  expect(screen.getByText(/Create your account/i)).toBeInTheDocument();
  expect(screen.getByText(/Full name/i)).toBeInTheDocument();
  expect(screen.getByText(/Terms of Service/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
});

test('renders Forgot Password Page: Enter work email', () => {
  window.history.pushState({}, '', '/forgot-password');
  render(<App />);
  expect(screen.getByText(/Forgot your password\?/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeInTheDocument();
  expect(screen.getByText(/Back to Sign In/i)).toBeInTheDocument();
});

test('renders Reset Password Page: Requirements checklist', () => {
  window.history.pushState({}, '', '/reset-password');
  render(<App />);
  expect(screen.getByText(/Reset your password/i)).toBeInTheDocument();
  expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Reset Password/i })).toBeInTheDocument();
});

test('renders Features Page with 3x2 grid, 3D Laser Craft, 3D AI Prediction, 3D RCA and 3D Self-Healing Drone', () => {
  window.history.pushState({}, '', '/features');
  render(<App />);
  expect(screen.getByText(/Năng Lực Tính Năng Toàn Diện/i)).toBeInTheDocument();
  expect(screen.getByText(/Giám sát hạ tầng/i)).toBeInTheDocument();
  expect(screen.getByText(/TARGET: LASER SCANNING ACTIVE/i)).toBeInTheDocument();
  expect(screen.getByText(/CPU Saturation 88%/i)).toBeInTheDocument();
  expect(screen.getAllByText(/1.2ms/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Pod Eviction Prevented/i)).toBeInTheDocument();
  // AI Prediction Core assertions
  expect(screen.getByText(/AI PREDICTION CORE: INFERENCE ACTIVE/i)).toBeInTheDocument();
  expect(screen.getByText(/Memory Exhaustion/i)).toBeInTheDocument();
  expect(screen.getByText(/87% confidence/i)).toBeInTheDocument();
  expect(screen.getByText(/~18 min/i)).toBeInTheDocument();
  expect(screen.getByText(/NOW/i)).toBeInTheDocument();
  expect(screen.getByText(/\+30m/i)).toBeInTheDocument();
  // Root Cause Analysis 3D assertions
  expect(screen.getByText(/CAUSAL GRAPH INFERENCE: ROOT CAUSE LOCATED/i)).toBeInTheDocument();
  expect(screen.getByText(/Memory Leak in auth-service/i)).toBeInTheDocument();
  expect(screen.getAllByText(/94.6%/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/SỰ CỐ: HTTP 5xx/i)).toBeInTheDocument();
  // Self-Healing Drone 3D assertions
  expect(screen.getByText(/HEALING ENGINE: AUTONOMOUS REPAIR ACTIVE/i)).toBeInTheDocument();
  expect(screen.getByText(/Rolling Patch Applied/i)).toBeInTheDocument();
  expect(screen.getByText(/99.98% HEALTHY/i)).toBeInTheDocument();
  // Human In The Loop 3D assertions
  expect(screen.getByText(/Con người tham gia kiểm soát \(HITL\)/i)).toBeInTheDocument();
  expect(screen.getByText(/\[3D Human-In-The-Loop Control Simulation\]/i)).toBeInTheDocument();
  // Security Shield 3D assertions
  expect(screen.getByText(/Bảo mật doanh nghiệp & RBAC/i)).toBeInTheDocument();
  expect(screen.getByText(/\[3D Aegis Security Defense Simulation\]/i)).toBeInTheDocument();
});

test('renders Dashboard Overview with White-First Calm Operations, 7 Vietnamese Sidebar groups and Health Card', () => {
  window.history.pushState({}, '', '/dashboard');
  render(<App />);
  // Header and Org
  expect(screen.getByText(/Tổng Quan Vận Hành Hạ Tầng/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Acme Corporation/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/production-us-east-1/i).length).toBeGreaterThan(0);
  // Sidebar Groups in Vietnamese
  expect(screen.getAllByText(/TỔNG QUAN/i).length).toBeGreaterThan(0);
  expect(screen.getByText('TỔ CHỨC')).toBeInTheDocument();
  expect(screen.getByText('HẠ TẦNG & TÁC TỬ')).toBeInTheDocument();
  expect(screen.getByText('GIÁM SÁT')).toBeInTheDocument();
  expect(screen.getByText('AI & SỰ CỐ')).toBeInTheDocument();
  expect(screen.getByText('TỰ PHỤC HỒI')).toBeInTheDocument();
  expect(screen.getByText('HỆ THỐNG')).toBeInTheDocument();
  // Health and Metrics
  expect(screen.getByText(/Trạng Thái Hệ Thống: Khỏe Mạnh & Ổn Định/i)).toBeInTheDocument();
  expect(screen.getByText(/42%/i)).toBeInTheDocument();
  expect(screen.getByText(/68%/i)).toBeInTheDocument();
  expect(screen.getByText(/84 \/ 84/i)).toBeInTheDocument();
  expect(screen.getByText(/AI Dự Báo Rủi Ro Chủ Động/i)).toBeInTheDocument();
  expect(screen.getByText(/Hiệu Quả Tự Phục Hồi/i)).toBeInTheDocument();
});

test('renders Dashboard Agents Page (/dashboard/agents) with eBPF agents and install modal trigger', () => {
  window.history.pushState({}, '', '/dashboard/agents');
  render(<App />);
  expect(screen.getByText(/Quản Trị Tác Tử eBPF Agent/i)).toBeInTheDocument();
  expect(screen.getByText(/selfheal-agent-worker-01/i)).toBeInTheDocument();
  expect(screen.getByText(/selfheal-agent-worker-02/i)).toBeInTheDocument();
  expect(screen.getByText(/Cài đặt Tác tử Mới/i)).toBeInTheDocument();
  expect(screen.getByText(/Hướng Dẫn Xử Lý Sự Cố Kết Nối Tác Tử/i)).toBeInTheDocument();
});

test('renders Dashboard Infrastructure (/dashboard/infrastructure) and Workloads (/dashboard/workloads)', () => {
  window.history.pushState({}, '', '/dashboard/infrastructure');
  render(<App />);
  expect(screen.getByText(/Hạ Tầng Cụm Máy Chủ Kubernetes/i)).toBeInTheDocument();
  expect(screen.getByText(/k8s-control-plane-01/i)).toBeInTheDocument();

  window.history.pushState({}, '', '/dashboard/workloads');
  render(<App />);
  expect(screen.getByText(/Khối Lượng Công Việc & Pods/i)).toBeInTheDocument();
  expect(screen.getByText(/payment-gateway/i)).toBeInTheDocument();
});

test('Onboarding Complete Step Go to Dashboard button navigates to /dashboard', () => {
  window.history.pushState({}, '', '/onboarding/complete');
  render(<App />);
  const goToDashboardBtn = screen.getByText(/Đi tới Bảng điều khiển/i);
  expect(goToDashboardBtn).toBeInTheDocument();
  act(() => {
    fireEvent.click(goToDashboardBtn);
  });
  expect(window.location.pathname).toBe('/dashboard');
});

test('renders Monitoring Metrics Page (/dashboard/monitoring/metrics) with React chart and node table', () => {
  window.history.pushState({}, '', '/dashboard/monitoring/metrics');
  render(<App />);
  expect(screen.getByText(/Chỉ Số Viễn Trắc Hạ Tầng Thời Gian Thực/i)).toBeInTheDocument();
  expect(screen.getByText(/Phân Bổ Tải Theo Máy Chủ/i)).toBeInTheDocument();
  expect(screen.getByText(/worker-01/i)).toBeInTheDocument();
  expect(screen.getByText(/Workloads Chiếm Dụng Tài Nguyên Cao Nhất/i)).toBeInTheDocument();
});

test('renders Monitoring Logs Page (/dashboard/monitoring/logs) with log stream explorer', () => {
  window.history.pushState({}, '', '/dashboard/monitoring/logs');
  render(<App />);
  expect(screen.getByText(/Trình Khám Phá Nhật Ký Container/i)).toBeInTheDocument();
  expect(screen.getByText(/Tạm dừng Live/i)).toBeInTheDocument();
  expect(screen.getByText(/Tải Log \(\.log\)/i)).toBeInTheDocument();
  expect(screen.getByText(/k8s-pod-stream/i)).toBeInTheDocument();
});

test('renders Monitoring Events Page (/dashboard/monitoring/events) with cluster event stream', () => {
  window.history.pushState({}, '', '/dashboard/monitoring/events');
  render(<App />);
  expect(screen.getByText(/Dòng Sự Kiện Cụm Máy Chủ/i)).toBeInTheDocument();
  expect(screen.getByText(/Cảnh báo \(Warning\)/i)).toBeInTheDocument();
  expect(screen.getByText(/FailedScheduling/i)).toBeInTheDocument();
});

test('renders AI Predictions Page (/dashboard/ai/predictions) with forecast chart and recommendations', () => {
  window.history.pushState({}, '', '/dashboard/ai/predictions');
  render(<App />);
  expect(screen.getByText(/AI Dự Báo Sự Cố Sớm/i)).toBeInTheDocument();
  expect(screen.getByText(/Dự Báo Nguy Cơ Bão Hòa & Bất Thường Bằng AI/i)).toBeInTheDocument();
  expect(screen.getByText(/Nguy cơ Tràn bộ nhớ RAM/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Áp Dụng Phòng Ngừa Ngay/i).length).toBeGreaterThan(0);
});

test('renders Incidents Page (/dashboard/incidents) and opens RCA modal', () => {
  window.history.pushState({}, '', '/dashboard/incidents');
  render(<App />);
  expect(screen.getByText(/Quản Lý Sự Cố & Phân Tích Nguyên Nhân Gốc Rễ/i)).toBeInTheDocument();
  expect(screen.getByText(/Pod payment-service bị OOMKilled do rò rỉ bộ nhớ queue/i)).toBeInTheDocument();
  
  const rcaBtn = screen.getAllByText(/Xem RCA/i)[0];
  expect(rcaBtn).toBeInTheDocument();
  act(() => {
    fireEvent.click(rcaBtn);
  });
  expect(screen.getAllByText(/Phân Tích Nguyên Nhân Gốc Rễ/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Chuỗi Nhân Quả Suy Diễn/i)).toBeInTheDocument();
  expect(screen.getByText(/Chứng Cứ Nhật Ký Container/i)).toBeInTheDocument();
});

test('renders Healing Actions Page (/dashboard/self-healing/actions) with MAPE-K loop', () => {
  window.history.pushState({}, '', '/dashboard/self-healing/actions');
  render(<App />);
  expect(screen.getByText(/Hành Động Tự Phục Hồi Đang Thực Thi/i)).toBeInTheDocument();
  expect(screen.getByText(/Tiến Trình 5 Giai Đoạn Của Vòng Lặp MAPE-K/i)).toBeInTheDocument();
  expect(screen.getByText(/Giám Sát Viễn Trắc/i)).toBeInTheDocument();
  expect(screen.getByText(/Phân Tích Bất Thường/i)).toBeInTheDocument();
  expect(screen.getByText(/Lập Kế Hoạch Vá Lỗi/i)).toBeInTheDocument();
  expect(screen.getByText(/Thực Thi Tự Động/i)).toBeInTheDocument();
  expect(screen.getByText(/Cập Nhật Tri Thức/i)).toBeInTheDocument();
});

test('renders Self-Healing History Page (/dashboard/self-healing/history) with MTTR trend chart', () => {
  window.history.pushState({}, '', '/dashboard/self-healing/history');
  render(<App />);
  expect(screen.getByText(/Lịch Sử Tự Phục Hồi & Báo Cáo Hiệu Quả MTTR/i)).toBeInTheDocument();
  expect(screen.getByText(/Xu Hướng Phục Hồi Tự Động & Thời Gian MTTR/i)).toBeInTheDocument();
  expect(screen.getByText(/HIST-4091/i)).toBeInTheDocument();
  expect(screen.getByText(/Tự động khởi động lại Pod order-processor sau lỗi OOMKilled/i)).toBeInTheDocument();
});

test('renders HITL Approvals Page (/dashboard/self-healing/approvals) with YAML diff preview', () => {
  window.history.pushState({}, '', '/dashboard/self-healing/approvals');
  render(<App />);
  expect(screen.getByText(/Cổng Phê Duyệt Của Con Người/i)).toBeInTheDocument();
  expect(screen.getByText(/Tháo tải & Cô lập máy chủ worker-03/i)).toBeInTheDocument();
  
  const diffBtn = screen.getAllByText(/Xem trước Diff/i)[0];
  expect(diffBtn).toBeInTheDocument();
  act(() => {
    fireEvent.click(diffBtn);
  });
  expect(screen.getByText(/Xem Trước Thay Đổi Cấu Hình Kubernetes YAML Diff/i)).toBeInTheDocument();
  expect(screen.getByText(/HIỆN TẠI TRONG CỤM/i)).toBeInTheDocument();
  expect(screen.getByText(/SAU KHI PHÊ DUYỆT/i)).toBeInTheDocument();
});

test('renders Policies Page (/dashboard/self-healing/policies) with automation modes and rules table', () => {
  window.history.pushState({}, '', '/dashboard/self-healing/policies');
  render(<App />);
  expect(screen.getByText(/Ma Trận Chính Sách Tự Phục Hồi/i)).toBeInTheDocument();
  expect(screen.getByText(/Chế Độ Vận Hành Tự Động Hóa/i)).toBeInTheDocument();
  expect(screen.getByText(/Bán Tự Động Có Giám Sát/i)).toBeInTheDocument();
  expect(screen.getByText(/Ngưỡng An Toàn & Kích Hoạt Cổng HITL/i)).toBeInTheDocument();
  expect(screen.getByText(/Bán Kính Ảnh Hưởng Kích Hoạt HITL/i)).toBeInTheDocument();
  expect(screen.getByText(/Quy Tắc Tự Động Phục Hồi Đang Áp Dụng/i)).toBeInTheDocument();
  expect(screen.getByText(/OOMKilled Guard/i)).toBeInTheDocument();
});

test('renders Reports Page (/dashboard/reports) with SLACostSavingsChart and microservice SLA table', () => {
  window.history.pushState({}, '', '/dashboard/reports');
  render(<App />);
  expect(screen.getByText(/Báo Cáo SLA & Hiệu Quả Chi Phí Doanh Nghiệp/i)).toBeInTheDocument();
  expect(screen.getByText(/Hiệu Quả Kinh Tế & Cam Kết SLA Uptime/i)).toBeInTheDocument();
  expect(screen.getByText(/Bảng Phân Tích SLA Theo Từng Dịch Vụ Microservice/i)).toBeInTheDocument();
  expect(screen.getByText(/payment-service/i)).toBeInTheDocument();
  expect(screen.getByText(/Xuất Báo Cáo SLA/i)).toBeInTheDocument();
});

test('renders Audit Logs Page (/dashboard/audit-logs) with AuditDistributionChart and immutable SHA-256 logs', () => {
  window.history.pushState({}, '', '/dashboard/audit-logs');
  render(<App />);
  expect(screen.getByText(/Nhật Ký Kiểm Toán Bất Biến \(Immutable Audit Logs\)/i)).toBeInTheDocument();
  expect(screen.getByText(/Phân Bổ Sự Kiện Kiểm Toán 7 Ngày Qua/i)).toBeInTheDocument();
  expect(screen.getByText(/Sổ Cái Nhật Ký Kiểm Toán/i)).toBeInTheDocument();
  expect(screen.getByText(/AUD-2026-9041/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Lê Minh Quân \(SME Owner\)/i).length).toBeGreaterThan(0);
});

test('renders Notifications Page (/dashboard/notifications) with multi-channel alerts and filter tabs', () => {
  window.history.pushState({}, '', '/dashboard/notifications');
  render(<App />);
  expect(screen.getByText(/Trung Tâm Thông Báo & Điều Phối Cảnh Báo/i)).toBeInTheDocument();
  expect(screen.getByText(/Đánh Dấu Tất Cả Đã Đọc/i)).toBeInTheDocument();
  expect(screen.getByText(/Yêu cầu phê duyệt khẩn cấp: Tháo tải máy chủ worker-03/i)).toBeInTheDocument();
  expect(screen.getByText(/AI Dự báo sớm: Nguy cơ tràn RAM/i)).toBeInTheDocument();
});

test('renders Settings Page (/dashboard/settings) with tabs for Webhook, API tokens, and 2FA', () => {
  window.history.pushState({}, '', '/dashboard/settings');
  render(<App />);
  expect(screen.getByText(/Cài Đặt Nền Tảng & Tích Hợp Hệ Thống/i)).toBeInTheDocument();
  expect(screen.getByText(/Tích Hợp Webhook & Cảnh Báo/i)).toBeInTheDocument();
  expect(screen.getByText(/Khóa Truy Cập API Tokens/i)).toBeInTheDocument();
  expect(screen.getByText(/Bảo Mật & Xác Thực 2FA/i)).toBeInTheDocument();
  expect(screen.getByText(/Tùy Chọn Múi Giờ & Cụm/i)).toBeInTheDocument();
  expect(screen.getByText(/Slack Incoming Webhook URL/i)).toBeInTheDocument();
});

test('renders Organization Profile (/dashboard/organization) and Members Page (/dashboard/organization/members)', () => {
  window.history.pushState({}, '', '/dashboard/organization');
  render(<App />);
  expect(screen.getByText(/Cài Đặt Hồ Sơ Tổ Chức/i)).toBeInTheDocument();
  expect(screen.getByText(/Cụm Kubernetes Đã Liên Kết/i)).toBeInTheDocument();
  expect(screen.getByText(/Thông Tin Doanh Nghiệp/i)).toBeInTheDocument();

  window.history.pushState({}, '', '/dashboard/organization/members');
  render(<App />);
  expect(screen.getByText(/Thành Viên & Ma Trận Phân Quyền RBAC/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Chủ DN \(SME Owner\)/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Kỹ Sư DevOps Lead/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Ma Trận So Sánh Quyền Hạn RBAC Chi Tiết/i)).toBeInTheDocument();
});

test('renders Clusters Page (/dashboard/clusters) with cluster cards and registration modal', () => {
  window.history.pushState({}, '', '/dashboard/clusters');
  render(<App />);
  expect(screen.getByText(/Quản Lý Cụm Kubernetes Đa Môi Trường/i)).toBeInTheDocument();
  expect(screen.getByText(/k8s-prod-cluster-01/i)).toBeInTheDocument();
  expect(screen.getByText(/k8s-staging-cluster-01/i)).toBeInTheDocument();
  expect(screen.getByText(/Đăng Ký Cụm Mới/i)).toBeInTheDocument();
});

test('renders Export buttons for CSV and JSON on Audit Logs and Reports', () => {
  window.history.pushState({}, '', '/dashboard/audit-logs');
  render(<App />);
  expect(screen.getByText(/Xuất CSV/i)).toBeInTheDocument();
  expect(screen.getByText(/Xuất JSON/i)).toBeInTheDocument();

  window.history.pushState({}, '', '/dashboard/reports');
  render(<App />);
  expect(screen.getByText(/Xuất Báo Cáo SLA/i)).toBeInTheDocument();
});

test('renders Vietnamese Footer with localized columns and copyright', () => {
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(screen.getByText(/SẢN PHẨM/i)).toBeInTheDocument();
  expect(screen.getByText(/TÁC TỬ KUBERNETES/i)).toBeInTheDocument();
  expect(screen.getByText(/XEM TRẠNG THÁI/i)).toBeInTheDocument();
  expect(screen.getAllByText(/CÔNG TY/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/HỖ TRỢ/i)).toBeInTheDocument();
  expect(screen.getByText(/CHÍNH SÁCH BẢO MẬT/i)).toBeInTheDocument();
  expect(screen.getByText(/HẠ TẦNG TỰ TRỊ KUBERNETES CLOUD/i)).toBeInTheDocument();
});

test('renders Hero Section with Live 3D Dashboard and Interactive YAML Diff card', () => {
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(screen.getAllByText(/k8s-prod-cluster-01/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Xem Trước Thay Đổi Cấu Hình Kubernetes YAML Diff/i)).toBeInTheDocument();
  expect(screen.getByText(/node-maintenance-cordon.yaml/i)).toBeInTheDocument();
  expect(screen.getByText(/HIỆN TẠI TRONG CỤM \(BEFORE\)/i)).toBeInTheDocument();
  expect(screen.getByText(/SAU KHI PHÊ DUYỆT \(AFTER\)/i)).toBeInTheDocument();
  expect(screen.getByText(/Xác Nhận Ký Duyệt & Thực Thi/i)).toBeInTheDocument();
});



