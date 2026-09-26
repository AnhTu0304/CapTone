import React from 'react';
import SectionHeader from '../../components/common/SectionHeader';
import FeatureCard from '../../components/marketing/FeatureCard';
import Breadcrumb from '../../components/common/Breadcrumb';
import CTASection from '../../components/marketing/CTASection';
import TelemetryProbe3D from './components/TelemetryProbe3D';
import AIPredictionCore3D from './components/AIPredictionCore3D';
import RootCauseAnalysis3D from './components/RootCauseAnalysis3D';
import SelfHealingDrone3D from './components/SelfHealingDrone3D';
import SecurityShield3D from './components/SecurityShield3D';
import HumanInTheLoop3D from './components/HumanInTheLoop3D';
import { 
  Activity, 
  Cpu, 
  Search, 
  Zap, 
  UserCheck, 
  ShieldCheck 
} from 'lucide-react';

export const FeaturesPage = ({ onNavigate }) => {
  // 1. Giám sát hạ tầng (Đã rút gọn tối đa, tập trung vào 3D Tàu vũ trụ quét Radar)
  const monitoringItems = [
    "Độ trễ cực thấp < 1.2ms với cơ chế kernel eBPF hook",
    "Quét radar phát hiện tức thì sự cố Pods, Nodes & Network",
    "Theo dõi 100% chỉ số bão hòa CPU, RAM (RSS) & Disk I/O",
  ];

  // 2. Dự báo bằng AI (Rút gọn)
  const aiItems = [
    "Dự báo chuỗi thời gian đa biến chu kỳ 10 giây",
    "Phát hiện bất thường phi tuyến tính trước 5 đến 30 phút",
    "Tự động triệt tiêu cảnh báo giả từ dao động mạng tạm thời",
  ];

  // 3. Phân tích nguyên nhân gốc rễ (RCA) (Rút gọn)
  const rcaItems = [
    "Tương quan chéo sự kiện Kubernetes với nhật ký lỗi stderr",
    "So sánh diff trạng thái workload với commit GitOps gần nhất",
    "Truy vết đồ thị phụ thuộc dịch vụ qua Ingress & CoreDNS",
  ];

  // 4. Tự động phục hồi sự cố (Rút gọn)
  const selfHealingItems = [
    "Tự phục hồi rolling êm dịu không gián đoạn dịch vụ",
    "Tự động hoàn nguyên (rollback) về ReplicaSet ổn định trước đó",
    "Dọn dẹp tài nguyên từ pod mồ côi & bộ nhớ đệm rò rỉ",
  ];

  // 5. Con người tham gia kiểm soát (HITL) (Rút gọn)
  const hitlItems = [
    "Phê duyệt 1 cú nhấp qua Web UI hoặc tích hợp Slack/Teams",
    "Xem trước bản diff tác động và bán kính rủi ro trước khi chạy",
    "Nhật ký kiểm toán bất biến gắn liền định danh kỹ sư vận hành",
  ];

  // 6. Bảo mật doanh nghiệp & RBAC (Rút gọn)
  const securityItems = [
    "Nguyên tắc đặc quyền tối thiểu: Không cần cluster-admin",
    "Xác thực token Agent ký số, hỗ trợ thu hồi tức thì",
    "0 mở cổng kết nối inbound — Chỉ truyền luồng outbound TLS",
  ];

  return (
    <div className="features-page" style={{ backgroundColor: 'var(--color-canvas)', paddingBottom: '80px' }}>
      {/* Header Banner */}
      <div
        style={{
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--color-surface)',
          padding: '48px 0 36px 0',
        }}
      >
        <div className="container-custom">
          <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Tính năng' }]} />
          <SectionHeader
            align="left"
            badge="Kiến Trúc Kỹ Thuật"
            title="Năng Lực Tính Năng Toàn Diện"
            description="Tổng quan trực quan về 6 trụ cột cốt lõi của SelfHeal, được thiết kế tối ưu hóa độ sẵn sàng cao cho hạ tầng Kubernetes của doanh nghiệp vừa và nhỏ (SMEs)."
          />
        </div>
      </div>

      <div className="container-custom" style={{ paddingTop: '56px' }}>
        {/* ================= 3 HÀNG × 2 CỘT (6 Ô TÍNH NĂNG ĐỐI XỨNG) ================= */}
        <div
          className="features-grid-3x2"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '32px',
            marginBottom: '64px',
          }}
        >
          {/* ================= HÀNG 1 - Ô 1: GIÁM SÁT HẠ TẦNG (TÍCH HỢP 3D TÀU VŨ TRỤ RADAR) ================= */}
          <div className="feature-grid-item">
            <FeatureCard
              icon={Activity}
              title="Giám sát hạ tầng"
              description="Bộ thu thập dữ liệu đo từ xa độ trễ thấp qua tầng eBPF kernel, liên tục quét radar phát hiện tắc nghẽn và đo lường sức khỏe toàn bộ cụm Kubernetes theo thời gian thực."
              technicalTag="Thu thập Telemetry"
              media={<TelemetryProbe3D />}
              items={monitoringItems}
            />
          </div>

          {/* ================= HÀNG 1 - Ô 2: DỰ BÁO BẰNG AI ================= */}
          <div className="feature-grid-item">
            <FeatureCard
              icon={Cpu}
              title="Dự báo bằng AI"
              description="Các thuật toán Machine Learning liên tục phân tích chuỗi thời gian telemetry, nhận diện sớm quỹ đạo suy giảm chất lượng dịch vụ trước khi sự cố xảy ra."
              technicalTag="Công cụ Dự báo"
              media={<AIPredictionCore3D />}
              items={aiItems}
            />
          </div>

          {/* ================= HÀNG 2 - Ô 3: PHÂN TÍCH NGUYÊN NHÂN GỐC RỄ (RCA) ================= */}
          <div className="feature-grid-item">
            <FeatureCard
              icon={Search}
              title="Phân tích nguyên nhân gốc rễ (RCA)"
              description="Cô lập nguyên nhân cốt lõi bằng cách tương quan đa chiều sự kiện cụm, mã thoát pod, độ lệch cấu hình GitOps thành một chẩn đoán chính xác duy nhất."
              technicalTag="Suy luận & RCA"
              media={<RootCauseAnalysis3D />}
              items={rcaItems}
            />
          </div>

          {/* ================= HÀNG 2 - Ô 4: TỰ ĐỘNG PHỤC HỒI SỰ CỐ ================= */}
          <div className="feature-grid-item">
            <FeatureCard
              icon={Zap}
              title="Tự động phục hồi sự cố"
              description="Hệ thống điều khiển tự hành MAPE-K tự động thực thi các hành động khôi phục Kubernetes an toàn, tái thiết lập SLA dịch vụ chỉ trong vòng dưới 2 giây."
              technicalTag="Bộ điều khiển Tự hành"
              media={<SelfHealingDrone3D />}
              items={selfHealingItems}
            />
          </div>

          {/* ================= HÀNG 3 - Ô 5: CON NGƯỜI THAM GIA KIỂM SOÁT (HITL) ================= */}
          <div className="feature-grid-item">
            <FeatureCard
              icon={UserCheck}
              title="Con người tham gia kiểm soát (HITL)"
              description="Duy trì quyền kiểm soát tối cao cho kỹ sư đối với các quyết định rủi ro cao. Cung cấp bản xem trước diff và xác thực trực quan trước khi kích hoạt khắc phục."
              technicalTag="Cổng Quản trị"
              items={hitlItems}
              media={<HumanInTheLoop3D />}
            />
          </div>

          {/* ================= HÀNG 3 - Ô 6: BẢO MẬT DOANH NGHIỆP & RBAC ================= */}
          <div className="feature-grid-item">
            <FeatureCard
              icon={ShieldCheck}
              title="Bảo mật doanh nghiệp & RBAC"
              description="Chuẩn bảo mật cấp cao: Không yêu cầu cluster-admin, đặc quyền tối thiểu ServiceAccount, mã hóa mTLS và nhật ký kiểm toán bất biến."
              technicalTag="Tuân thủ & Tin cậy"
              items={securityItems}
              media={<SecurityShield3D />}
            />
          </div>
        </div>

        {/* Final CTA */}
        <CTASection
          title="Khám phá toàn bộ tài liệu kỹ thuật Kubernetes"
          description="Đọc các tài liệu hướng dẫn triển khai chuyên sâu, cấu hình RBAC manifest và tài liệu API chi tiết."
          primaryButtonText="Xem tài liệu kỹ thuật"
          secondaryButtonText="Xem hướng dẫn vận hành"
          onPrimaryClick={() => onNavigate && onNavigate('/docs')}
          onSecondaryClick={() => onNavigate && onNavigate('/guide')}
        />
      </div>

      <style>{`
        @media (max-width: 960px) {
          .features-grid-3x2 {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default FeaturesPage;
