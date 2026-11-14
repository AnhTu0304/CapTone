import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import GuideNotebookCanvas from './components/GuideNotebookCanvas';
import SectionTitleCanvas from './components/SectionTitleCanvas';
import NotebookIndexNav from './components/NotebookIndexNav';
import CodeBlock from '../../components/common/CodeBlock';
import AlertCard from '../../components/common/AlertCard';
import Breadcrumb from '../../components/common/Breadcrumb';
import useScrollSpy from '../../hooks/useScrollSpy';
import './GuidePage.css';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export const GuidePage = () => {
  const guideSections = [
    { id: "sec-01", title: "01 Bắt đầu nhanh" },
    { id: "sec-02", title: "02 Tạo tổ chức của bạn" },
    { id: "sec-03", title: "03 Thiết lập môi trường" },
    { id: "sec-04", title: "04 Kết nối Kubernetes Cluster" },
    { id: "sec-05", title: "05 Cài đặt SelfHeal Agent" },
    { id: "sec-06", title: "06 Giám sát hạ tầng" },
    { id: "sec-07", title: "07 Hiểu về dự báo AI" },
    { id: "sec-08", title: "08 Xử lý sự cố hạ tầng" },
    { id: "sec-09", title: "09 Tự phục hồi và khôi phục" },
    { id: "sec-10", title: "10 Phê duyệt và kiểm soát" },
    { id: "sec-11", title: "11 Kiểm tra kết quả khôi phục" },
  ];

  const sectionIds = guideSections.map((s) => s.id);
  const activeId = useScrollSpy(sectionIds, 120);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const containerRef = useRef(null);

  // GSAP ScrollTrigger for smooth section glide on scroll
  useGSAP(() => {
    if (typeof window === 'undefined') return;
    const sections = gsap.utils.toArray('.guide-section');
    sections.forEach((sec) => {
      gsap.from(sec, {
        opacity: 0,
        y: 24,
        duration: 0.5,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: sec,
          start: 'top 88%',
          toggleActions: 'play none none none',
          once: true,
        },
      });
    });
  }, { scope: containerRef });

  const handleScrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div
      ref={containerRef}
      className="guide-page-container"
      data-testid="guide-page-container"
    >
      {/* ================= 1. HERO BANNER WITH INTERACTIVE CANVAS ================= */}
      <section className="guide-hero-banner" data-testid="guide-hero-banner">
        <GuideNotebookCanvas height={230} />
        <div className="container-custom guide-hero-content">
          <Breadcrumb
            items={[
              { label: 'Trang chủ', href: '/' },
              { label: 'Sổ tay Vận hành Kỹ sư' },
            ]}
          />
          <h1 className="guide-hero-title">
            Sổ Tay Vận Hành Hạ Tầng SelfHeal
          </h1>
          <p className="guide-hero-subtitle">
            Tài liệu thực địa dành cho kỹ sư SRE và DevOps: Hướng dẫn cấu hình tổ chức,
            kết nối Kubernetes telemetry, thiết lập chính sách tự phục hồi sự cố tự hành.
          </p>
        </div>
      </section>

      {/* ================= 2. MOBILE COLLAPSIBLE DRAWER ================= */}
      <div className="guide-mobile-toc-bar">
        <button
          type="button"
          onClick={() => setMobileTocOpen(!mobileTocOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            backgroundColor: '#F9FAFB',
            border: '1px solid rgba(61, 59, 79, 0.25)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-primary)',
            cursor: 'pointer',
          }}
        >
          <span>Mục lục sổ tay ({guideSections.length} chương)</span>
          <span>{mobileTocOpen ? '▲' : '▼'}</span>
        </button>

        {mobileTocOpen && (
          <div style={{ marginTop: '10px' }}>
            <NotebookIndexNav
              items={guideSections}
              activeId={activeId}
              onItemClick={(id) => {
                setMobileTocOpen(false);
                handleScrollToSection(id);
              }}
            />
          </div>
        )}
      </div>

      {/* ================= 3. MULTI-COLUMN NOTEBOOK LAYOUT ================= */}
      <div className="container-custom guide-notebook-layout">
        {/* Left Sticky Column: Notebook Index Bookmark Tabs */}
        <div className="guide-left-toc-col">
          <NotebookIndexNav
            items={guideSections}
            activeId={activeId}
            onItemClick={handleScrollToSection}
          />
        </div>

        {/* Center/Right Column: SRE Engineering Notebook Paper */}
        <main className="guide-notebook-paper" role="main">
          {/* Metallic Spiral Binder Rings Spine */}
          <div className="notebook-spine" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="spiral-ring" />
            ))}
          </div>

          {/* Ruled Notebook Paper Body */}
          <div className="notebook-page-body">
            {/* CHAPTER 01 */}
            <section id="sec-01" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="01" />
                <h2 className="guide-section-title">01 Bắt đầu nhanh</h2>
              </header>
              <p className="guide-section-desc">
                SelfHeal được thiết kế để mang đến khả năng phục hồi hạ tầng tự hành cho các đội ngũ kỹ thuật doanh nghiệp SME mà không gặp phải sự phức tạp hay chi phí đắt đỏ của các nền tảng APM truyền thống. Trước khi kết nối các workload môi trường production, hãy đảm bảo bạn có quyền quản trị cơ bản đối với Kubernetes cluster mục tiêu.
              </p>
              <div className="notebook-prereq-box">
                <div className="notebook-prereq-title">Điều kiện tiên quyết của hệ thống</div>
                <ul className="notebook-prereq-list">
                  <li>Kubernetes cluster phiên bản 1.25+ (EKS, GKE, AKS, K3s hoặc máy chủ vật lý kubeadm).</li>
                  <li>Công cụ dòng lệnh <code>kubectl</code> đã được cài đặt và cấu hình quyền cluster-admin.</li>
                  <li>Kết nối mạng chiều ra (outbound) tới <code>api.selfheal.infra</code> qua cổng 443.</li>
                </ul>
              </div>
              <div className="notebook-postit">
                <div className="notebook-postit-washi" aria-hidden="true" />
                <div className="notebook-postit-title">Lưu ý: Không yêu cầu mở cổng Inbound</div>
                <p className="notebook-postit-text">
                  SelfHeal agent vận hành hoàn toàn thông qua luồng WebSocket TLS chiều ra. Bạn tuyệt đối không cần mở bất kỳ cổng tường lửa nào hoặc công khai các endpoint ingress ra bên ngoài.
                </p>
              </div>
            </section>

            {/* CHAPTER 02 */}
            <section id="sec-02" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="02" />
                <h2 className="guide-section-title">02 Tạo tổ chức của bạn</h2>
              </header>
              <p className="guide-section-desc">
                Tổ chức (Organization) là đơn vị cô lập người thuê cấp cao nhất trong SelfHeal. Toàn bộ thành viên đội ngũ, nhật ký kiểm toán và các cluster đều được cách ly nghiêm ngặt trong ranh giới tổ chức của bạn.
              </p>
              <ol className="notebook-steps-list">
                <li>
                  <strong>Đăng ký hoặc Đăng nhập:</strong> Truy cập Cổng Xác thực SelfHeal bằng email doanh nghiệp của bạn.
                </li>
                <li>
                  <strong>Đặt tên Tổ chức:</strong> Cung cấp định danh công ty hoặc nhóm kỹ thuật (ví dụ: <code>acme-fintech</code>).
                </li>
                <li>
                  <strong>Thiết lập Vùng dữ liệu Tuân thủ:</strong> Chọn khu vực lưu trữ dữ liệu theo quy định (EU, US-East hoặc AP-Southeast).
                </li>
              </ol>
              <AlertCard type="tip" title="Kiểm soát truy cập dựa trên vai trò (RBAC)">
                Tổ chức hỗ trợ các vai trò định sẵn: <em>Owner</em> (Chủ sở hữu), <em>SRE Operator</em> (Có quyền phê duyệt khắc phục sự cố), và <em>Auditor</em> (Chỉ đọc nhật ký kiểm toán).
              </AlertCard>
            </section>

            {/* CHAPTER 03 */}
            <section id="sec-03" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="03" />
                <h2 className="guide-section-title">03 Thiết lập môi trường</h2>
              </header>
              <p className="guide-section-desc">
                Môi trường thiết lập sự phân tách giữa các giai đoạn vận hành như <code>Production</code>, <code>Staging</code>, và <code>Development</code>. Quy tắc tự phục hồi và ngưỡng phê duyệt của con người được cấu hình riêng cho từng môi trường.
              </p>
              <div className="notebook-prereq-box">
                <div className="notebook-prereq-title">Khuyến nghị Chính sách Môi trường</div>
                <p style={{ fontSize: '0.875rem', color: '#555368', margin: 0, lineHeight: 1.6 }}>
                  Đối với <strong>Staging</strong>, hãy bật <em>Khắc phục tự hành toàn phần</em> để AI tự động thử nghiệm rollout, khởi động lại pod và co giãn replica mà không cần can thiệp. Đối với <strong>Production</strong>, hãy bật <em>Con người phê duyệt</em> cho các hành động nhạy cảm.
                </p>
              </div>
            </section>

            {/* CHAPTER 04 */}
            <section id="sec-04" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="04" />
                <h2 className="guide-section-title">04 Kết nối Kubernetes Cluster</h2>
              </header>
              <p className="guide-section-desc">
                Trên bảng điều khiển SelfHeal, điều hướng tới <strong>Clusters &rarr; Đăng ký Cluster Mới</strong>. Nhập định danh duy nhất (ví dụ: <code>k8s-prod-us-east-1</code>) và chọn Môi trường tương ứng.
              </p>
              <p className="guide-section-desc">
                Sau khi đăng ký, hệ thống sẽ tạo một <strong>Agent Token</strong> mật mã duy nhất dùng để ký số và xác thực toàn bộ dữ liệu đo từ xa của cụm cluster.
              </p>
            </section>

            {/* CHAPTER 05 */}
            <section id="sec-05" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="05" />
                <h2 className="guide-section-title">05 Cài đặt SelfHeal Agent</h2>
              </header>
              <p className="guide-section-desc">
                Agent được triển khai thông qua Helm hoặc file Kubernetes manifest tiêu chuẩn vào namespace riêng biệt <code>selfheal-system</code>.
              </p>
              <CodeBlock
                language="bash"
                title="Cài đặt qua Helm v3"
                code={`# 1. Thêm kho lưu trữ SelfHeal Helm\nhelm repo add selfheal https://charts.selfheal.infra\nhelm repo update\n\n# 2. Triển khai agent với token cluster\nhelm install selfheal-agent selfheal/k8s-agent \\\n  --namespace selfheal-system \\\n  --create-namespace \\\n  --set clusterToken="sh_live_89f02c91a7e4b" \\\n  --set clusterName="k8s-prod-us-east-1"`}
              />
              <div className="notebook-postit" style={{ marginTop: '20px' }}>
                <div className="notebook-postit-washi" aria-hidden="true" />
                <div className="notebook-postit-title">Phạm vi Phân quyền RBAC Tối Thiểu</div>
                <p className="notebook-postit-text">
                  Agent chỉ áp dụng ClusterRole có phạm vi giới hạn quyền ghi nghiêm ngặt vào các nhóm API được định nghĩa trước (Pods, Deployments, ReplicaSets). Agent tuyệt đối không có quyền truy cập vào Secrets hay các ConfigMap chứa dữ liệu nhạy cảm.
                </p>
              </div>
            </section>

            {/* CHAPTER 06 */}
            <section id="sec-06" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="06" />
                <h2 className="guide-section-title">06 Giám sát hạ tầng</h2>
              </header>
              <p className="guide-section-desc">
                Ngay khi kết nối thành công, agent sẽ bắt đầu truyền tải các chỉ số tài nguyên tần suất cao (CPU, bộ nhớ thường trú, disk I/O, rớt gói mạng) và các sự kiện Kubernetes control-plane theo chu kỳ mỗi 10 giây.
              </p>
              <p className="guide-section-desc">
                Kiểm tra tín hiệu nhịp tim (heartbeat) của agent trực tiếp từ terminal:
              </p>
              <CodeBlock
                language="bash"
                title="Kiểm tra trạng thái Pod của Agent"
                code={`kubectl get pods -n selfheal-system\n# NAME                              READY   STATUS    RESTARTS   AGE\n# selfheal-agent-5b98f79cd4-v8m4k   1/1     Running   0          2m14s`}
              />
            </section>

            {/* CHAPTER 07 */}
            <section id="sec-07" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="07" />
                <h2 className="guide-section-title">07 Hiểu về dự báo AI</h2>
              </header>
              <p className="guide-section-desc">
                SelfHeal ứng dụng mô hình dự báo chuỗi thời gian đa biến liên tục nhằm phân biệt các đột biến tải tạm thời với các đường cong suy giảm nghiêm trọng có nguy cơ gây sự cố.
              </p>
              <ul className="notebook-prereq-list" style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                <li><strong>Thời gian đến khi hỏng hóc (TTF):</strong> Ước tính số phút còn lại trước khi xảy ra sự cố OOMKilled hoặc nghẽn luồng xử lý.</li>
                <li><strong>Điểm tin cậy (Confidence Score):</strong> Xác suất thống kê của nguy cơ sự cố (ví dụ: 96,2%).</li>
                <li><strong>Bán kính ảnh hưởng (Blast Radius):</strong> Các microservice phụ thuộc ở hạ nguồn sẽ bị ảnh hưởng nếu không được khắc phục kịp thời.</li>
              </ul>
            </section>

            {/* CHAPTER 08 */}
            <section id="sec-08" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="08" />
                <h2 className="guide-section-title">08 Xử lý sự cố hạ tầng</h2>
              </header>
              <p className="guide-section-desc">
                Khi quỹ đạo tiền sự cố được xác nhận, SelfHeal sẽ mở hồ sơ sự cố có cấu trúc. Thay vì làm ngập kênh thông báo bằng hàng trăm cảnh báo thô, nền tảng cung cấp một bản tóm lược toàn diện gồm:
              </p>
              <div className="notebook-prereq-box">
                <ol className="notebook-steps-list" style={{ margin: 0, gap: '10px' }}>
                  <li>Tín hiệu nguyên nhân gốc rễ tương quan (ví dụ: Rò rỉ bộ nhớ trong container <code>worker</code> bắt đầu từ commit <code>7b91a</code>).</li>
                  <li>Xếp hạng các chiến lược khắc phục kèm bán kính ảnh hưởng được tính toán trước.</li>
                  <li>Kết quả mô phỏng giả lập trước khi áp dụng (dry-run).</li>
                </ol>
              </div>
            </section>

            {/* CHAPTER 09 */}
            <section id="sec-09" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="09" />
                <h2 className="guide-section-title">09 Tự phục hồi và khôi phục</h2>
              </header>
              <p className="guide-section-desc">
                Các hành động tự động phục hồi mang tính tất định tuyệt đối và tuân thủ các bộ điều khiển nguyên thủy của Kubernetes:
              </p>
              <ul className="notebook-prereq-list" style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                <li><strong>Khởi động lại Pod Rolling:</strong> Drain êm dịu và khởi động lại từng pod riêng lẻ mà không làm rớt các kết nối TCP đang hoạt động.</li>
                <li><strong>Co giãn ngang ReplicaSet:</strong> Tạm thời tăng số lượng replica của deployment để hấp thụ các đợt tăng vọt lưu lượng truy cập bất thường.</li>
                <li><strong>Tự động Hoàn nguyên (Rollback):</strong> Trở về phiên bản ReplicaSet ổn định gần nhất nếu tỷ lệ crash vượt quá giới hạn chính sách.</li>
              </ul>
            </section>

            {/* CHAPTER 10 */}
            <section id="sec-10" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="10" />
                <h2 className="guide-section-title">10 Phê duyệt và kiểm soát</h2>
              </header>
              <p className="guide-section-desc">
                Khi một hành động yêu cầu phê duyệt từ con người, thông báo tương tác sẽ được gửi ngay tới kỹ sư chỉ định qua Web UI và webhook Slack/Teams. Kỹ sư có thể xem xét toàn bộ diff, bấm Phê duyệt, Từ chối hoặc Tinh chỉnh kế hoạch chỉ với một cú nhấp chuột xác thực.
              </p>
              <AlertCard type="tip" title="Rào chắn Phê duyệt Kép">
                Đối với cơ sở dữ liệu môi trường Production hoặc cổng Ingress Gateway cấp 1, bạn có thể thiết lập <em>Phê duyệt kép (Dual Operator Sign-Off)</em> yêu cầu hai kỹ sư độc lập cùng xác nhận trước khi thực thi.
              </AlertCard>
            </section>

            {/* CHAPTER 11 */}
            <section id="sec-11" className="guide-section">
              <header className="guide-section-header">
                <SectionTitleCanvas chapterNumber="11" />
                <h2 className="guide-section-title">11 Kiểm tra kết quả khôi phục</h2>
              </header>
              <p className="guide-section-desc">
                Sau khi thực thi hành động tự phục hồi, SelfHeal kích hoạt <strong>Vòng lặp Kiểm chứng Hậu Khắc phục</strong> liên tục trong 5 phút:
              </p>
              <ol className="notebook-steps-list">
                <li>Kiểm tra đầu dò readiness của container và trạng thái endpoint (HTTP 200).</li>
                <li>Xác nhận tốc độ tăng bộ nhớ và CPU đã trở về đường cơ sở an toàn.</li>
                <li>Xuất bản bản tóm lược sự cố (post-mortem) bất biến trực tiếp vào nhật ký kiểm toán phục vụ báo cáo tuân thủ.</li>
              </ol>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default GuidePage;
