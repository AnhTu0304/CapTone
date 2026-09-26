import React, { useState } from 'react';
import TableOfContents from '../../components/navigation/TableOfContents';
import CodeBlock from '../../components/common/CodeBlock';
import AlertCard from '../../components/common/AlertCard';
import Breadcrumb from '../../components/common/Breadcrumb';
import useScrollSpy from '../../hooks/useScrollSpy';

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

  const sectionIds = guideSections.map(s => s.id);
  const activeId = useScrollSpy(sectionIds, 120);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  return (
    <div className="guide-page-container" style={{ backgroundColor: 'var(--color-canvas)', paddingBottom: '80px' }}>
      {/* Sub-header Banner */}
      <div
        style={{
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--color-surface)',
          padding: '40px 0 32px 0',
        }}
      >
        <div className="container-custom">
          <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Hướng dẫn vận hành' }]} />
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 3.5vw, 2.5rem)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
              marginBottom: '10px',
            }}
          >
            Hướng dẫn Vận hành Nền tảng SelfHeal
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '780px', lineHeight: 1.6 }}>
            Tài liệu hướng dẫn từng bước chi tiết để cấu hình tổ chức, đăng ký cụm cluster, cài đặt telemetry agent và quản lý các chính sách tự động phục hồi sự cố.
          </p>
        </div>
      </div>

      {/* Mobile Collapsible TOC */}
      <div
        className="guide-mobile-toc-bar"
        style={{
          display: 'none',
          padding: '12px 16px',
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <button
          type="button"
          onClick={() => setMobileTocOpen(!mobileTocOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'var(--color-canvas)',
            border: '1px solid var(--border-default)',
            borderRadius: '0px',
            fontSize: '0.8125rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <span>Mục lục hướng dẫn ({guideSections.length} phần)</span>
          <span>{mobileTocOpen ? '▲' : '▼'}</span>
        </button>

        {mobileTocOpen && (
          <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'var(--color-surface)', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
            <TableOfContents
              title=""
              items={guideSections}
              activeId={activeId}
              onItemClick={(id) => {
                setMobileTocOpen(false);
                const el = document.getElementById(id);
                if (el) {
                  const top = el.offsetTop - 80;
                  window.scrollTo({ top, behavior: 'smooth' });
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Main Multi-column Layout */}
      <div className="container-custom" style={{ display: 'flex', gap: '48px', paddingTop: '40px', position: 'relative' }}>
        
        {/* Left Sticky Table of Contents (Desktop) */}
        <div className="guide-left-toc" style={{ width: '260px', flexShrink: 0 }}>
          <TableOfContents
            title="Mục lục hướng dẫn"
            items={guideSections}
            activeId={activeId}
            onItemClick={(id) => {
              const el = document.getElementById(id);
              if (el) {
                const top = el.offsetTop - 80;
                window.scrollTo({ top, behavior: 'smooth' });
              }
            }}
          />
        </div>

        {/* Center Guide Content */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: '820px' }}>

          {/* SECTION 01 */}
          <section id="sec-01" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              01 Bắt đầu nhanh
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              SelfHeal được thiết kế để mang đến khả năng phục hồi hạ tầng tự hành cho các đội ngũ kỹ thuật doanh nghiệp SME mà không gặp phải sự phức tạp hay chi phí đắt đỏ của các nền tảng APM truyền thống. Trước khi kết nối các workload môi trường production, hãy đảm bảo bạn có quyền quản trị cơ bản đối với Kubernetes cluster mục tiêu.
            </p>
            <div style={{ backgroundColor: 'var(--color-surface)', padding: '16px 20px', borderRadius: '0px', border: '1px solid var(--border-default)', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Điều kiện tiên quyết</div>
              <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Kubernetes cluster phiên bản 1.25+ (EKS, GKE, AKS, K3s hoặc máy chủ vật lý kubeadm).</li>
                <li>Công cụ dòng lệnh <code>kubectl</code> đã được cài đặt và cấu hình quyền cluster-admin.</li>
                <li>Kết nối mạng chiều ra (outbound) tới <code>api.selfheal.infra</code> qua cổng 443.</li>
              </ul>
            </div>
            <AlertCard type="info" title="Không yêu cầu mở cổng kết nối Inbound">
              SelfHeal agent vận hành hoàn toàn thông qua luồng WebSocket TLS chiều ra. Bạn tuyệt đối không cần mở bất kỳ cổng tường lửa nào hoặc công khai các endpoint ingress ra bên ngoài.
            </AlertCard>
          </section>

          {/* SECTION 02 */}
          <section id="sec-02" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              02 Tạo tổ chức của bạn
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Tổ chức (Organization) là đơn vị cô lập người thuê cấp cao nhất trong SelfHeal. Toàn bộ thành viên đội ngũ, nhật ký kiểm toán và các cluster đều được cách ly nghiêm ngặt trong ranh giới tổ chức của bạn.
            </p>
            <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li>
                <strong>Đăng ký hoặc Đăng nhập:</strong> Truy cập <a href="/login" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Cổng Xác thực SelfHeal</a> bằng email doanh nghiệp của bạn.
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

          {/* SECTION 03 */}
          <section id="sec-03" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              03 Thiết lập môi trường
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Môi trường thiết lập sự phân tách giữa các giai đoạn vận hành như <code>Production</code>, <code>Staging</code>, và <code>Development</code>. Quy tắc tự phục hồi và ngưỡng phê duyệt của con người được cấu hình riêng cho từng môi trường.
            </p>
            <div style={{ backgroundColor: 'var(--color-surface)', padding: '16px', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', marginBottom: '8px' }}>Khuyến nghị Chính sách Môi trường</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                Đối với <strong>Staging</strong>, hãy bật <em>Khắc phục tự hành toàn phần</em> để AI tự động thử nghiệm rollout, khởi động lại pod và co giãn replica mà không cần can thiệp. Đối với <strong>Production</strong>, hãy bật <em>Con người phê duyệt</em> cho các hành động nhạy cảm.
              </p>
            </div>
          </section>

          {/* SECTION 04 */}
          <section id="sec-04" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              04 Kết nối Kubernetes Cluster
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Trên bảng điều khiển SelfHeal, điều hướng tới <strong>Clusters &rarr; Đăng ký Cluster Mới</strong>. Nhập định danh duy nhất (ví dụ: <code>k8s-prod-us-east-1</code>) và chọn Môi trường tương ứng.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Sau khi đăng ký, hệ thống sẽ tạo một <strong>Agent Token</strong> mật mã duy nhất dùng để ký số và xác thực toàn bộ dữ liệu đo từ xa của cụm cluster.
            </p>
          </section>

          {/* SECTION 05 */}
          <section id="sec-05" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              05 Cài đặt SelfHeal Agent
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Agent được triển khai thông qua Helm hoặc file Kubernetes manifest tiêu chuẩn vào namespace riêng biệt <code>selfheal-system</code>.
            </p>
            <CodeBlock
              language="bash"
              title="Cài đặt qua Helm v3"
              code={`# 1. Thêm kho lưu trữ SelfHeal Helm\nhelm repo add selfheal https://charts.selfheal.infra\nhelm repo update\n\n# 2. Triển khai agent với token cluster\nhelm install selfheal-agent selfheal/k8s-agent \\\n  --namespace selfheal-system \\\n  --create-namespace \\\n  --set clusterToken="sh_live_89f02c91a7e4b" \\\n  --set clusterName="k8s-prod-us-east-1"`}
            />
            <AlertCard type="warning" title="Phạm vi Phân quyền RBAC">
              Agent chỉ áp dụng ClusterRole có phạm vi giới hạn quyền ghi nghiêm ngặt vào các nhóm API được định nghĩa trước (Pods, Deployments, ReplicaSets). Agent tuyệt đối không có quyền truy cập vào Secrets hay các ConfigMap chứa dữ liệu nhạy cảm.
            </AlertCard>
          </section>

          {/* SECTION 06 */}
          <section id="sec-06" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              06 Giám sát hạ tầng
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Ngay khi kết nối thành công, agent sẽ bắt đầu truyền tải các chỉ số tài nguyên tần suất cao (CPU, bộ nhớ thường trú, disk I/O, rớt gói mạng) và các sự kiện Kubernetes control-plane theo chu kỳ mỗi 10 giây.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Kiểm tra tín hiệu nhịp tim (heartbeat) của agent trực tiếp từ terminal:
            </p>
            <CodeBlock
              language="bash"
              title="Kiểm tra trạng thái Pod của Agent"
              code={`kubectl get pods -n selfheal-system\n# NAME                              READY   STATUS    RESTARTS   AGE\n# selfheal-agent-5b98f79cd4-v8m4k   1/1     Running   0          2m14s`}
            />
          </section>

          {/* SECTION 07 */}
          <section id="sec-07" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              07 Hiểu về dự báo AI
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              SelfHeal ứng dụng mô hình dự báo chuỗi thời gian đa biến liên tục nhằm phân biệt các đột biến tải tạm thời với các đường cong suy giảm nghiêm trọng có nguy cơ gây sự cố.
            </p>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Thời gian đến khi hỏng hóc (TTF):</strong> Ước tính số phút còn lại trước khi xảy ra sự cố OOMKilled hoặc nghẽn luồng xử lý.</li>
              <li><strong>Điểm tin cậy (Confidence Score):</strong> Xác suất thống kê của nguy cơ sự cố (ví dụ: 96,2%).</li>
              <li><strong>Bán kính ảnh hưởng (Blast Radius):</strong> Các microservice phụ thuộc ở hạ nguồn sẽ bị ảnh hưởng nếu không được khắc phục kịp thời.</li>
            </ul>
          </section>

          {/* SECTION 08 */}
          <section id="sec-08" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              08 Xử lý sự cố hạ tầng
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Khi quỹ đạo tiền sự cố được xác nhận, SelfHeal sẽ mở hồ sơ sự cố có cấu trúc. Thay vì làm ngập kênh thông báo bằng hàng trăm cảnh báo thô, nền tảng cung cấp một bản tóm lược toàn diện gồm:
            </p>
            <div style={{ backgroundColor: 'var(--color-surface)', padding: '16px', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
              <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Tín hiệu nguyên nhân gốc rễ tương quan (ví dụ: Rò rỉ bộ nhớ trong container <code>worker</code> bắt đầu từ commit <code>7b91a</code>).</li>
                <li>Xếp hạng các chiến lược khắc phục kèm bán kính ảnh hưởng được tính toán trước.</li>
                <li>Kết quả mô phỏng giả lập trước khi áp dụng (dry-run).</li>
              </ol>
            </div>
          </section>

          {/* SECTION 09 */}
          <section id="sec-09" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              09 Tự phục hồi và khôi phục
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Các hành động tự động phục hồi mang tính tất định tuyệt đối và tuân thủ các bộ điều khiển nguyên thủy của Kubernetes:
            </p>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Khởi động lại Pod Rolling:</strong> Drain êm dịu và khởi động lại từng pod riêng lẻ mà không làm rớt các kết nối TCP đang hoạt động.</li>
              <li><strong>Co giãn ngang ReplicaSet:</strong> Tạm thời tăng số lượng replica của deployment để hấp thụ các đợt tăng vọt lưu lượng truy cập bất thường.</li>
              <li><strong>Tự động Hoàn nguyên (Rollback):</strong> Trở về phiên bản ReplicaSet ổn định gần nhất nếu tỷ lệ crash vượt quá giới hạn chính sách.</li>
            </ul>
          </section>

          {/* SECTION 10 */}
          <section id="sec-10" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              10 Phê duyệt và kiểm soát
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Khi một hành động yêu cầu phê duyệt từ con người, thông báo tương tác sẽ được gửi ngay tới kỹ sư chỉ định qua Web UI và webhook Slack/Teams. Kỹ sư có thể xem xét toàn bộ diff, bấm Phê duyệt, Từ chối hoặc Tinh chỉnh kế hoạch chỉ với một cú nhấp chuột xác thực.
            </p>
            <AlertCard type="tip" title="Rào chắn Phê duyệt Kép">
              Đối với cơ sở dữ liệu môi trường Production hoặc cổng Ingress Gateway cấp 1, bạn có thể thiết lập <em>Phê duyệt kép (Dual Operator Sign-Off)</em> yêu cầu hai kỹ sư độc lập cùng xác nhận trước khi thực thi.
            </AlertCard>
          </section>

          {/* SECTION 11 */}
          <section id="sec-11" style={{ marginBottom: '64px', scrollMarginTop: '100px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              11 Kiểm tra kết quả khôi phục
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Sau khi thực thi hành động tự phục hồi, SelfHeal kích hoạt <strong>Vòng lặp Kiểm chứng Hậu Khắc phục</strong> liên tục trong 5 phút:
            </p>
            <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Kiểm tra đầu dò readiness của container và trạng thái endpoint (HTTP 200).</li>
              <li>Xác nhận tốc độ tăng bộ nhớ và CPU đã trở về đường cơ sở an toàn.</li>
              <li>Xuất bản bản tóm lược sự cố (post-mortem) bất biến trực tiếp vào nhật ký kiểm toán phục vụ báo cáo tuân thủ.</li>
            </ol>
          </section>

        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .guide-left-toc {
            display: none !important;
          }
          .guide-mobile-toc-bar {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GuidePage;
