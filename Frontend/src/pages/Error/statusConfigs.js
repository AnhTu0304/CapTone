import status401Img from '../../assets/pixel-status/status-401.png';
import status403Img from '../../assets/pixel-status/status-403.png';
import status404Img from '../../assets/pixel-status/status-404.png';
import status500Img from '../../assets/pixel-status/status-500.png';
import status503Img from '../../assets/pixel-status/status-503.png';
import status429Img from '../../assets/pixel-status/status-429.png';
import statusAgentOfflineImg from '../../assets/pixel-status/status-agent-offline.png';
import statusClusterLostImg from '../../assets/pixel-status/status-cluster-lost.png';
import statusMonitoringImg from '../../assets/pixel-status/status-monitoring.png';
import statusMaintenanceImg from '../../assets/pixel-status/status-maintenance.png';
import bgDaylightImg from '../../assets/pixel-status/bg-daylight.png';
import bgSunsetImg from '../../assets/pixel-status/bg-sunset.png';
import bgTwilightImg from '../../assets/pixel-status/bg-twilight.png';

export const STATUS_PAGE_CONFIGS = {
  '401': {
    code: '401',
    statusLabel: '401',
    isTextStatus: false,
    title: 'Phiên đăng nhập đã hết hạn.',
    message:
      'Thẻ xác thực không còn hiệu lực. Vui lòng đăng nhập lại bằng tài khoản của bạn để tiếp tục.',
    imageSrc: status401Img,
    imageAlt: 'Robot SelfHeal quét thẻ đăng nhập hết hạn',
    backgroundSrc: bgSunsetImg,
    testId: 'status-page-401',
  },
  '403': {
    code: '403',
    statusLabel: '403',
    isTextStatus: false,
    title: 'Không có quyền truy cập.',
    message:
      'Tài khoản của bạn không có quyền truy cập trang hoặc tài nguyên này theo chính sách phân quyền (RBAC).',
    imageSrc: status403Img,
    imageAlt: 'Robot SelfHeal đứng trước cánh cửa bảo mật bị khóa',
    backgroundSrc: bgTwilightImg,
    testId: 'status-page-403',
  },
  '404': {
    code: '404',
    statusLabel: '404',
    isTextStatus: false,
    title: 'Đây không phải trang bạn đang tìm kiếm.',
    message:
      'Tài nguyên hoặc đường dẫn này không tồn tại trên hệ thống hoặc đã được di chuyển sang vị trí khác.',
    imageSrc: status404Img,
    imageAlt: 'Robot SelfHeal cầm kính lúp tìm kiếm trang bị thất lạc',
    backgroundSrc: bgDaylightImg,
    testId: 'status-page-404',
  },
  '500': {
    code: '500',
    statusLabel: '500',
    isTextStatus: false,
    title: 'Máy chủ đang gặp trục trặc nội bộ.',
    message:
      'Hệ thống vừa phát sinh sự cố bất thường. Tác tử AI SelfHeal đang thu thập log để tự động chẩn đoán.',
    imageSrc: status500Img,
    imageAlt: 'Robot SelfHeal kiểm tra tủ máy chủ gặp trục trặc',
    backgroundSrc: bgTwilightImg,
    testId: 'status-page-500',
  },
  '503': {
    code: '503',
    statusLabel: '503',
    isTextStatus: false,
    title: 'Dịch vụ tạm thời gián đoạn.',
    message:
      'Cụm máy chủ đang được phục hồi tự hành hoặc tạm quá tải. Vui lòng quay lại sau ít phút.',
    imageSrc: status503Img,
    imageAlt: 'Robot SelfHeal cầm cờ lê sửa chữa máy chủ',
    backgroundSrc: bgSunsetImg,
    testId: 'status-page-503',
  },
  '429': {
    code: '429',
    statusLabel: '429',
    isTextStatus: false,
    title: 'Quá nhiều yêu cầu cùng lúc.',
    message:
      'Hệ thống đang tạm giới hạn tần suất truy cập (Rate Limit) để bảo vệ độ ổn định cho cụm dịch vụ.',
    imageSrc: status429Img,
    imageAlt: 'Robot SelfHeal bị bao quanh bởi quá nhiều gói tin request',
    backgroundSrc: bgSunsetImg,
    testId: 'status-page-429',
  },
  'agent-offline': {
    code: 'AGENT_OFFLINE',
    statusLabel: 'AGENT OFFLINE',
    isTextStatus: true,
    title: 'Đang cố gắng kết nối lại với Agent.',
    message:
      'Chưa nhận được tín hiệu heartbeat từ SelfHeal Agent trên cụm Kubernetes. Vui lòng kiểm tra Pod hoặc kết nối mạng.',
    imageSrc: statusAgentOfflineImg,
    imageAlt: 'Robot SelfHeal cố gắng kết nối lại dây tín hiệu Agent',
    backgroundSrc: bgTwilightImg,
    testId: 'status-page-agent-offline',
  },
  'cluster-lost': {
    code: 'CLUSTER_LOST',
    statusLabel: 'CLUSTER LOST',
    isTextStatus: true,
    title: 'Mất đồng bộ kết nối tới các Node.',
    message:
      'Cụm Kubernetes tạm thời không phản hồi. Hệ thống đang tìm cách liên kết lại tới API Server.',
    imageSrc: statusClusterLostImg,
    imageAlt: 'Robot SelfHeal tìm cách kết nối lại các node Kubernetes rời rạc',
    backgroundSrc: bgSunsetImg,
    testId: 'status-page-cluster-lost',
  },
  monitoring: {
    code: 'MONITORING',
    statusLabel: 'MONITORING',
    isTextStatus: true,
    title: 'Đang kiểm tra luồng telemetry trực tiếp.',
    message:
      'SelfHeal Bot đang giám sát liên tục chỉ số CPU, RAM và độ trễ cụm Kubernetes theo thời gian thực.',
    imageSrc: statusMonitoringImg,
    imageAlt: 'Robot SelfHeal kiểm tra màn hình sóng telemetry',
    backgroundSrc: bgDaylightImg,
    testId: 'status-page-monitoring',
  },
  maintenance: {
    code: 'MAINTENANCE',
    statusLabel: 'MAINTENANCE',
    isTextStatus: true,
    title: 'Hệ thống đang được bảo trì định kỳ.',
    message:
      'Đội ngũ kỹ thuật và SelfHeal Bot đang nâng cấp hạ tầng. Dịch vụ sẽ hoạt động trở lại ngay sau ít phút.',
    imageSrc: statusMaintenanceImg,
    imageAlt: 'Robot SelfHeal đội mũ kỹ sư đang bảo trì hệ thống',
    backgroundSrc: bgDaylightImg,
    testId: 'status-page-maintenance',
  },
};
