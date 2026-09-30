import React from 'react';
import CodeBlock from '../../components/common/CodeBlock';
import AlertCard from '../../components/common/AlertCard';
import Breadcrumb from '../../components/common/Breadcrumb';
import Pagination from '../../components/navigation/Pagination';

export const DocsPage = ({ activeDocId = 'overview', onSelectDoc }) => {
  // Documentation content dictionary for all required technical topics
  const docsData = {
    overview: {
      title: "Tổng quan nền tảng",
      category: "Bắt đầu",
      description: "Giới thiệu kỹ thuật toàn diện về kiến trúc nền tảng tự phục hồi chủ động SelfHeal dành cho Kubernetes.",
      toc: [
        { id: "core-concept", title: "Khái niệm cốt lõi", level: 2 },
        { id: "autonomic-loop", title: "Vòng lặp tự hành MAPE-K", level: 2 },
        { id: "supported-environments", title: "Môi trường hỗ trợ", level: 2 }
      ],
      prev: null,
      next: { id: "architecture", title: "Kiến trúc hệ thống" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            SelfHeal cung cấp giải pháp kỹ thuật phục hồi khép kín cho các khối lượng công việc (workloads) trên Kubernetes. Thay vì xem sự cố là mất điện/ngừng trệ không thể tránh khỏi và chỉ xử lý sau khi xảy ra, SelfHeal liên tục mô hình hóa quỹ đạo suy giảm hiệu năng của workload và thực thi các biện pháp vi xử lý phục hồi xác định.
          </p>
          <h3 id="core-concept" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
            Khái niệm cốt lõi
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Trong các hệ thống cloud-native, hơn 80% sự cố (OOM kills, deadlock thread pool, rò rỉ kết nối connection pool cơ sở dữ liệu) đều bộc lộ các tín hiệu cảnh báo báo trước vài phút trước khi dẫn đến sập hoàn toàn. Agent biên của SelfHeal chuyển đổi telemetry cgroup thô thành các tín hiệu bất thường, đối chiếu chéo với các sự kiện Kubernetes control plane, và khớp chúng với các chính sách phục hồi đã được kiểm định an toàn.
          </p>
          <h3 id="autonomic-loop" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
            Vòng lặp tự hành MAPE-K
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Mọi cụm cluster dưới sự giám sát của SelfHeal đều được điều hành qua bốn giai đoạn đồng bộ:
          </p>
          <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><strong>Monitor (Giám sát):</strong> Theo dõi socket qua eBPF, áp lực bộ nhớ cgroups v2 và trạng thái các pod.</li>
            <li><strong>Analyze &amp; Plan (Phân tích &amp; Lập kế hoạch):</strong> Ngoại suy thời gian xảy ra lỗi (TTF), lập bản đồ nguyên nhân gốc rễ (RCA) và tính toán bán kính ảnh hưởng.</li>
            <li><strong>Execute (Thực thi):</strong> Thực thi các lệnh điều chỉnh Kubernetes API (rollout, restart, scaling) hoặc chuyển quyền phê duyệt sang con người.</li>
            <li><strong>Verify (Kiểm tra):</strong> Cửa sổ khẳng định trạng thái sức khỏe trong 300 giây để xác nhận các chỉ số đã ổn định.</li>
          </ul>
        </div>
      )
    },
    architecture: {
      title: "Kiến trúc hệ thống",
      category: "Bắt đầu",
      description: "Chi tiết về các thành phần hệ thống, cơ chế truyền telemetry, bắt tay mật mã và ranh giới vận hành.",
      toc: [
        { id: "data-flow", title: "Luồng dữ liệu & Control Plane", level: 2 },
        { id: "component-boundaries", title: "Ranh giới thành phần", level: 2 }
      ],
      prev: { id: "overview", title: "Tổng quan nền tảng" },
      next: { id: "k8s-agent", title: "Agent Kubernetes" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            SelfHeal được chia thành một agent nội bộ trong cluster (chạy dưới dạng Deployment 1 bản sao trên mỗi cụm) và Control Plane multi-tenant độc lập. Toàn bộ giao tiếp diễn ra qua kết nối gửi ra ngoài (outbound) WebSocket TLS 1.3.
          </p>
          <h3 id="data-flow" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
            Luồng dữ liệu &amp; Control Plane
          </h3>
          <CodeBlock
            language="yaml"
            title="Luồng kiến trúc Telemetry của Cluster"
            code={`[Kubernetes Worker Nodes] \n      │ (cgroups, metrics, events)\n      ▼\n[SelfHeal In-Cluster Agent] (Namespace: selfheal-system)\n      │\n      │ (Outbound TLS 1.3 WebSocket :443)\n      ▼\n[SelfHeal Control Plane Gateway]\n      ├─► [Time-Series Anomaly Detector]\n      ├─► [Root Cause Inference Graph]\n      └─► [Deterministic Policy Engine]\n            │\n            ▼ (Action Dispatch)\n      [Cluster Agent Mutator] ──► Kubernetes API Server`}
          />
          <AlertCard type="info" title="Không mở cổng Ingress (Zero Ingress Ports)">
            Agent chỉ chủ động khởi tạo các kết nối ra ngoài (outbound). Không yêu cầu IP công khai hay Ingress controller để agent kết nối với SelfHeal cloud.
          </AlertCard>
        </div>
      )
    },
    "k8s-agent": {
      title: "Agent Kubernetes",
      category: "Bắt đầu",
      description: "Thông số kỹ thuật, giới hạn tài nguyên và cấu trúc dữ liệu đo từ xa (telemetry) của SelfHeal agent.",
      toc: [
        { id: "agent-specs", title: "Mức tiêu thụ tài nguyên Agent", level: 2 },
        { id: "telemetry-payload", title: "Cấu trúc gói tin Telemetry", level: 2 }
      ],
      prev: { id: "architecture", title: "Kiến trúc hệ thống" },
      next: { id: "installation", title: "Cài đặt & Triển khai" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Agent được viết bằng Go và đóng gói thành scratch container image siêu nhẹ &lt; 35MB. Agent áp đặt các giới hạn tài nguyên nghiêm ngặt để đảm bảo không bao giờ cạnh tranh tài nguyên với các ứng dụng của bạn.
          </p>
          <CodeBlock
            language="yaml"
            title="Cấu hình tài nguyên Pod của Agent"
            code={`resources:\n  limits:\n    cpu: 250m\n    memory: 256Mi\n  requests:\n    cpu: 50m\n    memory: 64Mi`}
          />
          <h3 id="telemetry-payload" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
            Cấu trúc gói tin Telemetry
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Cứ mỗi 10 giây, agent truyền một gói Protobuf nén chứa các vector tài nguyên pod, số lần khởi động lại và các sự kiện Cảnh báo (Warning) gần nhất.
          </p>
        </div>
      )
    },
    installation: {
      title: "Cài đặt & Triển khai",
      category: "Bắt đầu",
      description: "Hướng dẫn cài đặt sử dụng Helm v3 hoặc các file manifest YAML Kubernetes thuần.",
      toc: [
        { id: "helm-install", title: "Cài đặt qua Helm", level: 2 },
        { id: "manifest-install", title: "Cài đặt qua Manifest", level: 2 },
        { id: "verify-install", title: "Kiểm tra xác thực", level: 2 }
      ],
      prev: { id: "k8s-agent", title: "Agent Kubernetes" },
      next: { id: "configuration", title: "Cấu hình vận hành" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Triển khai agent vào cluster của bạn bằng Helm (khuyến nghị) hoặc các file manifest YAML tĩnh.
          </p>
          <h3 id="helm-install" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '24px', marginBottom: '12px' }}>
            Cài đặt qua Helm v3
          </h3>
          <CodeBlock
            language="bash"
            title="Terminal"
            code={`helm repo add selfheal https://charts.selfheal.infra\nhelm repo update\nhelm install selfheal-agent selfheal/k8s-agent \\\n  --namespace selfheal-system \\\n  --create-namespace \\\n  --set clusterToken="YOUR_AGENT_TOKEN" \\\n  --set clusterName="production-cluster"`}
          />
          <h3 id="verify-install" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
            Kiểm tra xác thực
          </h3>
          <CodeBlock
            language="bash"
            title="Kiểm tra Pod của Agent"
            code={`kubectl get pods -n selfheal-system -l app.kubernetes.io/name=selfheal-agent\nkubectl logs -n selfheal-system -l app.kubernetes.io/name=selfheal-agent --tail=20`}
          />
          <AlertCard type="tip" title="Xác nhận nhịp tim (Heartbeat)">
            Trong vòng 15 giây sau khi container khởi động, bảng điều khiển SelfHeal sẽ chuyển trạng thái cluster từ <code>Đang chờ (Pending)</code> sang <code>Đã kết nối &amp; Khỏe mạnh (Connected &amp; Healthy)</code>.
          </AlertCard>
        </div>
      )
    },
    configuration: {
      title: "Cấu hình vận hành",
      category: "Bắt đầu",
      description: "Cấu hình các namespace loại trừ, tần suất thu thập chỉ số và kích thước bộ đệm log cục bộ.",
      toc: [
        { id: "configmap-ref", title: "Tham chiếu ConfigMap", level: 2 }
      ],
      prev: { id: "installation", title: "Cài đặt & Triển khai" },
      next: { id: "monitoring", title: "Giám sát thời gian thực" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Agent đọc cấu hình từ ConfigMap <code>selfheal-agent-config</code>. Các tham số chính có thể được điều chỉnh động mà không cần khởi động lại pod của agent.
          </p>
          <CodeBlock
            language="yaml"
            title="File YAML ConfigMap"
            code={`apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: selfheal-agent-config\n  namespace: selfheal-system\ndata:\n  config.yaml: |\n    cluster:\n      name: prod-k8s-east\n      environment: production\n    scrape:\n      interval_seconds: 10\n      include_namespaces: ["default", "production", "payments"]\n      exclude_namespaces: ["kube-system", "monitoring", "logging"]\n    features:\n      ebpf_metrics: true\n      event_watcher: true\n      auto_remediation: true`}
          />
        </div>
      )
    },
    monitoring: {
      title: "Giám sát thời gian thực",
      category: "Lõi tự hành",
      description: "Danh mục chi tiết các tín hiệu hạ tầng được thu thập từ Linux cgroups và Kubernetes APIs.",
      toc: [
        { id: "cgroups-metrics", title: "Telemetry từ Cgroups v2", level: 2 },
        { id: "k8s-events", title: "Luồng sự kiện Kubernetes", level: 2 }
      ],
      prev: { id: "configuration", title: "Cấu hình vận hành" },
      next: { id: "ai-prediction", title: "Dự báo bằng AI" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            SelfHeal giám sát các tín hiệu hệ thống chi tiết để nắm bắt thông tin áp lực bộ nhớ (PSI - Pressure Stall Information) và hiện tượng CPU throttling trước khi các chỉ số CPU trung bình tiêu chuẩn kịp phản ánh sự cố.
          </p>
          <h3 id="cgroups-metrics" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '24px', marginBottom: '12px' }}>
            Vector Telemetry từ Cgroups v2
          </h3>
          <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li><code>memory.current</code>: Kích thước tập dữ liệu thường trú (RSS) + cache trang đang hoạt động.</li>
            <li><code>memory.pressure</code>: Thời gian trễ PSI một phần/toàn phần tính bằng micro giây.</li>
            <li><code>cpu.stat</code>: Chu kỳ bị điều tiết (throttled) và tỷ lệ phần trăm thời gian bị nghẽn.</li>
            <li><code>io.pressure</code>: Thời gian chờ I/O lưu trữ ảnh hưởng đến việc ghi WAL của cơ sở dữ liệu.</li>
          </ul>
        </div>
      )
    },
    "ai-prediction": {
      title: "Dự báo bằng AI",
      category: "Lõi tự hành",
      description: "Các mô hình phát hiện bất thường chuỗi thời gian, tính điểm tin cậy và ước lượng thời điểm xảy ra sự cố.",
      toc: [
        { id: "model-architecture", title: "Kiến trúc mô hình", level: 2 },
        { id: "confidence-bands", title: "Độ tin cậy dự báo", level: 2 }
      ],
      prev: { id: "monitoring", title: "Giám sát thời gian thực" },
      next: { id: "self-healing", title: "Tự phục hồi sự cố" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Công cụ dự đoán AI xử lý các cửa sổ trượt 60 phút của các vector chỉ số đã chuẩn hóa. Hệ thống phân tách các mẫu chu kỳ lưu lượng truy cập hàng ngày khỏi các rò rỉ bộ nhớ dai dẳng bằng cách kết hợp ngưỡng độ dốc hồi quy tuyến tính với mô hình sai số tự hồi quy.
          </p>
          <CodeBlock
            language="bash"
            title="Mẫu kết quả suy luận sự cố bằng AI định dạng JSON"
            code={`{\n  "incident_id": "inc_98f12a",\n  "workload": "deployment/auth-service",\n  "namespace": "production",\n  "anomaly_type": "UNBOUNDED_MEMORY_GRADIENT",\n  "current_rss_mb": 840,\n  "limit_mb": 1024,\n  "projected_oom_seconds": 380,\n  "confidence": 0.974,\n  "recommended_action": "ROLLOUT_RESTART"\n}`}
          />
        </div>
      )
    },
    "self-healing": {
      title: "Tự phục hồi sự cố",
      category: "Lõi tự hành",
      description: "Các nguyên hàm khắc phục Kubernetes tất định, kiểm soát an toàn khi rollout và quy tắc thời gian chờ (cooldown).",
      toc: [
        { id: "action-primitives", title: "Các nguyên hàm hành động", level: 2 },
        { id: "safety-matrix", title: "Ma trận an toàn & Cooldown", level: 2 }
      ],
      prev: { id: "ai-prediction", title: "Dự báo bằng AI" },
      next: { id: "rbac-security", title: "Bảo mật & Phân quyền RBAC" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Các hành động khắc phục hoàn toàn có tính tất định. SelfHeal hỗ trợ các nguyên hàm phục hồi gốc của Kubernetes sau:
          </p>
          <h3 id="action-primitives" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '24px', marginBottom: '12px' }}>
            Các nguyên hàm hành động
          </h3>
          <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><strong>Khởi động lại Pod (Restart Pod):</strong> Gửi tín hiệu SIGTERM đến từng bản sao pod riêng lẻ, kích hoạt cơ chế thay thế tự động qua bộ điều khiển ReplicaSet.</li>
            <li><strong>Khởi động lại Rollout (Rollout Restart):</strong> Kích hoạt quá trình cập nhật cuốn chiếu (rolling update) cho <code>apps/v1 Deployment</code>, tuân thủ nghiêm ngặt các ràng buộc <code>maxUnavailable</code> và <code>maxSurge</code>.</li>
            <li><strong>Mở rộng bản sao (Scale Replicas):</strong> Tạm thời điều chỉnh số lượng bản sao Deployment khi hàng đợi thread vượt quá ngưỡng an toàn.</li>
            <li><strong>Quay lui phiên bản (Rollback Revision):</strong> Hoàn nguyên mẫu pod Deployment về thế hệ ReplicaSet ổn định trước đó.</li>
          </ul>
          <AlertCard type="warning" title="Đảm bảo khoảng thời gian chờ (Cooldown)">
            Khi một hành động tự phục hồi được thực thi trên deployment, hệ thống áp đặt thời gian chờ bắt buộc 15 phút để ngăn chặn hiện tượng dao động liên tục (flapping) hoặc khởi động lại dây chuyền.
          </AlertCard>
        </div>
      )
    },
    "rbac-security": {
      title: "Bảo mật & Phân quyền RBAC",
      category: "Bảo mật & Vận hành",
      description: "File cấu hình ClusterRole RBAC tuân thủ đặc quyền tối thiểu và ranh giới bảo mật.",
      toc: [
        { id: "rbac-manifest", title: "Định nghĩa ClusterRole", level: 2 }
      ],
      prev: { id: "self-healing", title: "Tự phục hồi sự cố" },
      next: { id: "api-reference", title: "Tài liệu API & CLI" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            SelfHeal tuân thủ nghiêm ngặt nguyên tắc đặc quyền tối thiểu. Agent hoàn toàn không thể đọc Kubernetes Secrets, ConfigMaps (nằm ngoài namespace của chính nó), hoặc mount các đường dẫn hệ thống tệp của host.
          </p>
          <CodeBlock
            language="yaml"
            title="Cấu hình Manifest ClusterRole"
            code={`apiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRole\nmetadata:\n  name: selfheal-agent-role\nrules:\n  # Read workloads and telemetry\n  - apiGroups: [""]\n    resources: ["pods", "nodes", "events", "services"]\n    verbs: ["get", "list", "watch"]\n  - apiGroups: ["apps"]\n    resources: ["deployments", "replicasets", "statefulsets"]\n    verbs: ["get", "list", "watch", "patch", "update"]\n  - apiGroups: ["metrics.k8s.io"]\n    resources: ["pods", "nodes"]\n    verbs: ["get", "list"]`}
          />
        </div>
      )
    },
    "api-reference": {
      title: "Tài liệu API & CLI",
      category: "Bảo mật & Vận hành",
      description: "Đặc tả API REST & WebSocket phục vụ việc đăng ký cluster, theo dõi sự cố và tích hợp phê duyệt webhook tự động.",
      toc: [
        { id: "auth-headers", title: "Headers xác thực", level: 2 },
        { id: "incidents-api", title: "Endpoint danh sách sự cố", level: 2 }
      ],
      prev: { id: "rbac-security", title: "Bảo mật & Phân quyền RBAC" },
      next: { id: "troubleshooting", title: "Xử lý sự cố thường gặp" },
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Mọi yêu cầu gửi tới <code>https://api.selfheal.infra/v1</code> đều yêu cầu Bearer token trong header <code>Authorization</code>.
          </p>
          <CodeBlock
            language="bash"
            title="Lấy danh sách sự cố đang diễn ra trên Cluster"
            code={`curl -X GET "https://api.selfheal.infra/v1/clusters/k8s-prod-east/incidents?status=active" \\\n  -H "Authorization: Bearer sh_user_8912ba0c89"`}
          />
        </div>
      )
    },
    troubleshooting: {
      title: "Xử lý sự cố thường gặp",
      category: "Bảo mật & Vận hành",
      description: "Chẩn đoán mất kết nối, lỗi phân quyền và độ trễ thu nạp dữ liệu telemetry.",
      toc: [
        { id: "common-issues", title: "Các sự cố phổ biến & Cách giải quyết", level: 2 }
      ],
      prev: { id: "api-reference", title: "Tài liệu API & CLI" },
      next: null,
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Thực hiện theo các bước chẩn đoán sau nếu pod agent báo lỗi kết nối hoặc không thể đăng ký thành công.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px 20px', border: '1px solid var(--border-default)', borderRadius: '0px', backgroundColor: 'var(--color-surface)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                1. Trạng thái Agent báo CrashLoopBackOff với lỗi `Invalid Token`
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                Kiểm tra giá trị <code>clusterToken</code> trong Secret của bạn có khớp với token hiển thị trong bảng điều khiển SelfHeal tại Cài đặt Cluster hay không. Tạo lại token nếu đã hết hạn.
              </p>
            </div>
            <div style={{ padding: '16px 20px', border: '1px solid var(--border-default)', borderRadius: '0px', backgroundColor: 'var(--color-surface)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                2. Hết thời gian chờ bắt tay TLS gửi đi (Outbound TLS handshake timeout)
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                Đảm bảo Security Group của node worker Kubernetes cho phép lưu lượng TCP cổng 443 gửi ra ngoài tới <code>api.selfheal.infra</code>. Kiểm tra xem có NetworkPolicy cục bộ nào đang chặn kết nối ra ngoài từ namespace <code>selfheal-system</code> hay không.
              </p>
            </div>
          </div>
        </div>
      )
    }
  };

  const currentDoc = docsData[activeDocId] || docsData.overview;

  return (
    <article className="docs-article" style={{ maxWidth: '820px' }}>
      <Breadcrumb
        items={[
          { label: 'Tài liệu', href: '/docs' },
          { label: currentDoc.category },
          { label: currentDoc.title }
        ]}
      />

      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem, 3.5vw, 2.375rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
            marginBottom: '12px',
          }}
        >
          {currentDoc.title}
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {currentDoc.description}
        </p>
      </div>

      <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '24px' }}>
        {currentDoc.content}
      </div>

      {/* Prev / Next Pagination */}
      <Pagination
        prev={currentDoc.prev}
        next={currentDoc.next}
        onNavigate={(id) => onSelectDoc && onSelectDoc(id)}
      />
    </article>
  );
};

export default DocsPage;
