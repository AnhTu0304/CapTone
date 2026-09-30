# SelfHeal Frontend - Architectural Specification & Development Log

**Dự án**: SelfHeal - Nền tảng tự phục hồi cơ sở hạ tầng chủ động điều khiển bởi AI dành cho doanh nghiệp vừa và nhỏ (SMEs) chạy trên Kubernetes.  
**Phiên bản**: 1.0.0-release  
**Ngày hoàn tất**: 16/09/2026  

---

## 1. Mục tiêu & Nguyên tắc thiết kế (Design Principles)

1. **Thẩm mỹ White-first & Điểm nhấn Xanh ngọc lục bảo (Soft Emerald & Mint Green)**:
   - Nền sáng trắng (`#FFFFFF`) và off-white tinh tế (`#F8FAFC`).
   - Điểm nhấn xanh lục dịu (`#10B981` / `#059669`) và mint pastel (`#ECFDF5`).
   - Typography màu than sẫm (`#0F172A`) với độ tương phản cao, dễ đọc theo tiêu chuẩn tài liệu kỹ thuật DevOps.
   - Cảnh báo: Hổ phách dịu (`#F59E0B`). Lỗi: Đỏ dịu (`#EF4444`).
   - **Tuyệt đối tránh**: Dark mode mặc định, phong cách cyberpunk, hiệu ứng neon chói, đổ bóng quá đà, hiệu ứng kính mờ (glassmorphism) lạm dụng, ảnh stock sáo rỗng hoặc số liệu khách hàng giả mạo.

2. **Hero Section bảo toàn**:
   - Phần Hero của Trang chủ (Homepage) được bảo toàn tuyệt đối thông qua component `<HeroSectionSlot />` tại `src/pages/Home/HeroSectionSlot.jsx`. Khi có Hero Section riêng từ bên ngoài, chỉ cần truyền vào prop `customHeroComponent` hoặc thay thế component con bên trong mà không làm ảnh hưởng đến bất kỳ phần nào khác của trang chủ.

3. **Cấu trúc layout chuẩn mực**:
   - `PublicLayout`: Dùng cho Home, Features, About, Guide, Get Started.
   - `DocsLayout`: Dành riêng cho cổng tài liệu kỹ thuật (/docs) với thanh bên trái sticky, bài viết ở giữa và mục lục On-This-Page bên phải.
   - `AuthLayout`: Dành riêng cho màn hình đăng nhập tối giản (/login) với phong cách split screen.

---

## 2. Cấu trúc thư mục mã nguồn hoàn chỉnh (Completed Architecture)

```
frontend/src/
├── assets/
│   └── logos/
├── components/
│   ├── common/
│   │   ├── Accordion.jsx        # Accordion, Modal, Tooltip
│   │   ├── AlertCard.jsx        # AlertCard (info, tip, warning, error) & InfoCard
│   │   ├── Badge.jsx            # Badge (6 variants), StatusBadge, IconButton
│   │   ├── Breadcrumb.jsx       # Breadcrumb điều hướng
│   │   ├── Button.jsx           # Button (6 variants: primary, secondary, ghost, success, warning, danger; 3 sizes)
│   │   ├── CodeBlock.jsx        # CodeBlock hiển thị bash/yaml với CopyButton clipboard
│   │   ├── Logo.jsx             # SVG Logo Kubernetes hexagon + healing beacon
│   │   └── SectionHeader.jsx    # SectionHeader với badge, responsive typography
│   ├── layout/
│   │   ├── Header.jsx           # Sticky glassmorphism header với logo, desktop nav, mobile hamburger
│   │   ├── Footer.jsx           # 4 cột: Brand, Product, Resources, Project & bottom legal links
│   │   └── MobileNavigation.jsx # Drawer navigation trên thiết bị di động
│   ├── navigation/
│   │   ├── DocumentationSidebar.jsx # Sidebar tài liệu 3 chuyên mục, 11 chủ đề
│   │   ├── Pagination.jsx           # Nút Previous / Next article
│   │   ├── Sidebar.jsx              # Sidebar điều hướng tổng quát
│   │   └── TableOfContents.jsx      # Sticky TOC với scrollspy
│   └── marketing/
│       ├── CapabilityCard.jsx   # Card 5 năng lực cốt lõi
│       ├── CTASection.jsx       # Khung kêu gọi hành động cuối trang
│       ├── FeatureCard.jsx      # Card thông số kỹ thuật chi tiết
│       ├── IncidentCard.jsx     # Card mô phỏng tiến trình sự cố (signal to recovery)
│       └── ProcessStep.jsx      # Quy trình ngang trên desktop / dọc trên mobile
├── layouts/
│   ├── PublicLayout.jsx         # Header + Main (1200-1280px) + Footer
│   ├── DocsLayout.jsx           # Header + DocsSidebar + Content + OnThisPage + DocsFooter
│   └── AuthLayout.jsx           # Split minimal auth layout
├── pages/
│   ├── Home/                    # HeroSlot + 5 Sections (Capabilities, Workflow, Incident, Human Control, CTA)
│   ├── Guide/                   # User Guide 11 chương kỹ thuật với TOC scrollspy
│   ├── Features/                # 6 nhóm tính năng lớn với bảng kiểm chi tiết
│   ├── About/                   # Dự án định hướng nghiên cứu & học thuật
│   ├── Docs/                    # Cổng tài liệu kỹ thuật đầy đủ code, YAML, RBAC, API
│   ├── Login/                   # Đăng nhập tối giản
│   └── GetStarted/              # Quy trình onboarding 7 bước kết nối Kubernetes cluster
├── routes/
│   └── index.jsx                # Router điều hướng client-side không tải lại trang
├── hooks/
│   ├── useScrollHeader.js       # Hook phát hiện scroll để kích hoạt viền mờ header
│   └── useScrollSpy.js          # Hook bám sát mục đang đọc cho TOC
├── lib/
│   └── animations.js            # GSAP micro-animations (page fade-in, card hover)
└── styles/
    ├── design-tokens.css        # Hệ thống CSS Variables màu sắc, bóng mờ, border radius
    └── globals.css              # Reset & style tổng quát
```

---

## 3. Danh sách Routes & Trang (Pages & Routes)

| Đường dẫn (Route) | Trang (Page) | Layout áp dụng | Mô tả chức năng |
|---|---|---|---|
| `/` | `HomePage` | `PublicLayout` | Bảo tồn Hero Slot; 5 sections: Core Capabilities, How SelfHeal Works, From Signal to Recovery, Human Control, Final CTA. |
| `/guide` | `GuidePage` | `PublicLayout` | Hướng dẫn vận hành 11 chương kỹ thuật, TOC sticky bên trái, callout Tips/Notes/Warnings. |
| `/features` | `FeaturesPage` | `PublicLayout` | Chi tiết 6 trụ cột kỹ thuật: Monitoring, AI Prediction, RCA, Self-Healing, HITL, Security. |
| `/about` | `AboutPage` | `PublicLayout` | Giới thiệu dự án học thuật/nghiên cứu: Sứ mệnh, Bài toán của SMEs, Mô hình MAPE-K, Phạm vi & Hướng đi. |
| `/docs` | `DocsPage` | `DocsLayout` | Cổng tài liệu chuyên sâu: 11 chuyên đề, YAML manifest, lệnh kubectl, Protobuf specs, API curl. |
| `/login` | `LoginPage` | `AuthLayout` | Giao diện đăng nhập tinh giản: Email, Password, Forgot Password, Create Account. |
| `/get-started` | `GetStartedPage` | `PublicLayout` | Quy trình onboarding 7 bước kết nối cluster, lấy token và cài đặt Helm agent. |

---

## 4. Hướng dẫn tích hợp Hero Section ngoài (Hero Integration Guide)

Khi Hero Section được bàn giao riêng, bạn có thể tích hợp theo một trong 2 cách:

1. **Cách 1 (Khuyên dùng - Sử dụng Slot Prop)**:
   Mở file `src/pages/Home/index.jsx`, truyền component Hero vào prop `customHeroComponent`:
   ```jsx
   import YourProvidedHero from './YourProvidedHero';

   // Bên trong HomePage component:
   <HeroSectionSlot customHeroComponent={<YourProvidedHero />} />
   ```

2. **Cách 2 (Thay thế nội dung file Slot)**:
   Chỉnh sửa trực tiếp file `src/pages/Home/HeroSectionSlot.jsx` để render component Hero bạn mong muốn. Toàn bộ phần còn lại của ứng dụng và các section bên dưới sẽ tự động khớp hoàn hảo.

---

## 5. Nhật ký các bước triển khai (Implementation Changelog)

| Bước | Hạng mục | Trạng thái | Chi tiết |
|---|---|---|---|
| **01** | Kế hoạch & Kiến trúc | [HOÀN TẤT] | Đã thiết lập kế hoạch chi tiết trong `implementation_plan.md` và tài liệu kiến trúc. |
| **02** | Design Tokens & Global CSS | [HOÀN TẤT] | Thiết lập bộ biến CSS `design-tokens.css` và `globals.css` chuẩn White-first & Emerald. |
| **03** | Hệ thống Reusable Components | [HOÀN TẤT] | Xây dựng đầy đủ Header, Footer, Button (6 variants), Badge, IncidentCard, CodeBlock, TOC, v.v. |
| **04** | Layouts (Public, Docs, Auth) | [HOÀN TẤT] | Xây dựng `PublicLayout`, `DocsLayout` (3 cột), `AuthLayout` (split screen). |
| **05** | Xây dựng các trang chức năng | [HOÀN TẤT] | Hoàn thiện cả 7 trang: Home, Guide, Features, About, Docs, Login, Get Started. |
| **06** | Kiểm thử & Tối ưu Responsive | [HOÀN TẤT] | `npm run build` xuất bản bundle thành công 0 cảnh báo; `npm test` vượt qua 100% test cases. |
| **07** | Thiết kế 3D Hero Section & Dashboard | [HOÀN TẤT] | Hoàn thành theo thiết kế tham chiếu: Tiêu đề bám sát yêu cầu (đã bỏ badge theo chỉ đạo), 3D Infrastructure Dashboard, 4 Floating Cards glassmorphic, Mouse tracking parallax, và Feature Strip 5 tính năng SME Kubernetes. |
| **08** | Nâng cấp Dashboard Size & Thẻ Nổi 3D Orbit-Dissolve | [HOÀN TẤT] | Dashboard phóng to 820px với góc nghiêng nhẹ nhàng; 4 thẻ nổi bố trí ở các góc ngoài tuyệt đối không che số liệu; chu kỳ 3D Nổi lên → Lơ lửng → Tan biến tuần hoàn mượt mà; hỗ trợ dừng hiệu ứng khi hover để xem chi tiết. |
| **09** | Full-Bleed Canvas, Unified Header & 3D Ambient Visuals | [HOÀN TẤT] | Bỏ giới hạn width bó hẹp ở Hero; mở rộng cột trái tự nhiên; đồng bộ Header mượt mà với Hero; bổ sung biểu tượng Kubernetes 3D với vành đai quỹ đạo phát sáng và các khối lập phương isometric 3D lơ lửng. |
| **10** | Header Seamless Color, Login Animation & Đăng ký CTA | [HOÀN TẤT] | Đồng bộ tuyệt đối màu Header với Hero nền #FAFCFA; bổ sung animation mềm mại cho nút Login; đổi CTA thành "Đăng ký" với gradient xanh lá dịu nhẹ (soft emerald/mint). |
| **11** | Bản địa hóa toàn bộ giao diện sang tiếng Việt | [HOÀN TẤT] | Dịch toàn diện 100% nội dung (Header, Footer, Navigation, Home, Features, Guide, About, Docs, Login, GetStarted, CodeBlock, TOC) sang tiếng Việt kỹ thuật chuyên nghiệp, bảo tồn thuật ngữ chuẩn Cloud-Native / DevOps (Pod, Node, Cluster, Namespace, eBPF, v.v.). |

---

## 9. Đặc tả Kỹ thuật Phase 5 - Bản địa hóa toàn diện tiếng Việt (Full Vietnamese Localization)

- **Nguyên tắc dịch thuật kỹ thuật**:
  - Giữ nguyên các thuật ngữ chuẩn công nghiệp Cloud-Native / DevOps không dịch gượng gạo: *Pod, Node, Cluster, Namespace, Deployment, ReplicaSet, Ingress, eBPF, Prometheus, cgroups, OOM, CrashLoopBackOff, YAML, Helm, RBAC, API, WebSocket, TLS*.
  - Toàn bộ nhãn nút bấm, tiêu đề, hướng dẫn sử dụng, giải thích kiến trúc, thông điệp lỗi và các bài viết tài liệu được chuyển đổi sang tiếng Việt tự nhiên, chuẩn mực và trang trọng.
- **Phạm vi hoàn tất 100%**:
  - **Điều hướng & Khung sườn**: Header (`Hướng dẫn`, `Tính năng`, `Giới thiệu`, `Tài liệu`, `Đăng nhập`, `Đăng ký`), Footer (4 chuyên mục, liên kết pháp lý), Mobile Navigation, Breadcrumbs, Pagination (`Bài trước` / `Bài tiếp theo`), Table of Contents (`Mục lục bài viết`), CodeBlock (`Sao chép mã`, `Đã sao chép!`).
  - **Trang chủ (Home)**: Toàn bộ Hero Section, 5 Năng lực cốt lõi, Quy trình vận hành 4 bước, Kịch bản mô phỏng sự cố, Kiểm soát con người (Human-in-the-loop), Khung CTA cuối trang.
  - **Trang Hướng dẫn (Guide)**: 11 chương kỹ thuật hoàn chỉnh với đầy đủ mục tiêu, điều kiện tiên quyết và các bước thực hành.
  - **Trang Tính năng (Features)**: Toàn bộ 6 nhóm tính năng lớn cùng 24 thông số kỹ thuật chi tiết.
  - **Trang Giới thiệu (About)**: Sứ mệnh học thuật/nghiên cứu, bài toán vận hành của SMEs, mô hình IBM MAPE-K, ranh giới thiết kế và định hướng tương lai.
  - **Trang Cổng Tài liệu (Docs)**: Toàn bộ 11 chuyên đề chuyên sâu (Tổng quan, Kiến trúc, Agent K8s, Cài đặt, Cấu hình, Giám sát, Dự báo AI, Tự phục hồi, RBAC, API Reference, Xử lý sự cố).
  - **Trang Đăng nhập (Login) & Bắt đầu (Get Started)**: Form đăng nhập chuẩn và lộ trình 7 bước kết nối Kubernetes cluster.
  - **Kiểm thử**: Toàn bộ unit tests tại `App.test.js` đã được cập nhật tương ứng và vượt qua 100% kiểm thử (`PASS`).

## 8. Đặc tả Kỹ thuật Phase 4 - Full-Bleed Canvas, Unified Header & 3D Ambient Visuals

- **Full-Bleed Canvas Layout**: Mở rộng chiều ngang toàn màn hình (padding lề linh hoạt `4.5vw`, max-width mở rộng đến `1600px`), giải phóng không gian để cột trái thở tự nhiên, chữ và các nút dàn trải khoáng đạt như ảnh tham chiếu.
- **Unified Header**: Header trong suốt / hòa nhập trực tiếp với màu nền và ánh sáng gradient của Hero Section; căn lề đồng bộ với Hero; nút CTA dạng pill mềm mại.
- **3D Ambient Decorative Visuals**:
  - **Kubernetes 3D Isometric Logo & Orbital Halo**: Đặt ở góc dưới bên phải Dashboard với vành đai phát sáng ngọc lam (cyan/emerald halo ring).
  - **Floating Isometric Data Cubes**: Các khối lập phương 3D vector trong suốt lơ lửng ở khoảng trống giữa cột trái - dashboard và phía dưới cụm K8s.
  - **Mạng lưới hào quang ánh sáng**: Vòng tỏa sáng dịu mát kết nối toàn bộ khu vực Right Side.

---

## 7. Đặc tả Kỹ thuật Phase 3 - Dashboard Enlargement & Orbit-Dissolve Cards

- **Dashboard Scaling**: Tăng kích thước maxWidth lên **820px**, mở rộng tỷ lệ cột desktop thành **1fr : 1.35fr**; tăng kích thước và độ rõ nét của 5 ô chỉ số (98,7%, 42%, 68%, 24 Pods, 0 Incidents), biểu đồ Resource Usage kép SVG, Recent Activity và thanh cảnh báo AI.
- **Độ nghiêng 3D nhẹ nhàng (Gentle Tilt)**: Thiết lập góc nghiêng cơ sở nhẹ nhàng `perspective(1400px) rotateY(-5.5deg) rotateX(2.5deg)`, kết hợp tương tác thị sai theo chuột êm ái (+/- 2 độ) không gây méo hình.
- **Tọa độ Thẻ Nổi (Tuyệt đối không che dữ liệu Dashboard)**:
  - Thẻ 1 (Giám sát): Góc trên bên trái ngoài dashboard (`top: -36px, left: -15px`).
  - Thẻ 2 (Dự đoán AI): Góc trên bên phải ngoài dashboard (`top: -45px, right: -25px`).
  - Thẻ 3 (Tự phục hồi): Góc dưới bên trái ngoài dashboard (`bottom: 24px, left: -75px`).
  - Thẻ 4 (Kubernetes): Bên phải ngoài dashboard gần khối K8s (`top: 28%, right: -75px`).
- **Chu kỳ Chuyển động 3D**:
  - Tích hợp 4 keyframes độc lập: `emergeOrbitDissolveTL`, `emergeOrbitDissolveTR`, `emergeOrbitDissolveBL`, `emergeOrbitDissolveMR`.
  - Luồng chuyển động: Nổi lên từ chiều sâu 3D (`opacity: 0 -> 1, scale: 0.88 -> 1, translateZ`) &rarr; Lơ lửng quanh quỹ đạo rìa ngoài &rarr; Tan biến mềm mại vào không gian (`opacity: 1 -> 0, scale: 1.05`) &rarr; Lặp lại tuần hoàn với độ trễ so le (0s, 2.8s, 5.5s, 8.2s).
  - Tương tác Hover Pause: Khi rê chuột vào thẻ, animation tự động tạm dừng (`animationPlayState: paused`), giữ nguyên độ hiển thị 100% để người dùng thoải mái đọc thông tin.

---

## 6. Đặc tả Kỹ thuật Phase 2 - High-Fidelity 3D Hero Section

- **Layout**: 2 cột rộng rãi trên nền xám ấm rất nhạt (`#FAFCFA`) với hiệu ứng gradient chuyển màu xanh lá tinh tế.
- **Cột Trái**:
  - Tiêu đề chính to bản: `"Quan sát. Dự đoán. Khôi phục."` với từ `"Khôi phục."` mang gradient xanh ngọc lục bảo. *(Đã bỏ nhãn badge bên trái theo yêu cầu).*
  - Văn bản bổ trợ: *"SelfHeal giúp các doanh nghiệp vừa và nhỏ giám sát môi trường Kubernetes, dự đoán các sự cố tiềm ẩn và tự động khôi phục dịch vụ — với sự giám sát của con người khi cần thiết."*
  - 2 CTA: `"Bắt đầu ngay →"` (Xanh ngọc lục bảo) & `"Xem hướng dẫn"` (Outline trắng).
  - 3 chỉ số tin cậy: Native Kubernetes, Ứng dụng AI, Con người kiểm soát.
- **Cột Phải**:
  - 3D Angled Infrastructure Dashboard với sidebar thu nhỏ, 5 metric tiles (Độ khả dụng 98,7%, CPU 42%, Memory 68%, Pods 24, Incidents 0), biểu đồ Resource Usage kép SVG, Recent Activity, và AI prediction banner.
  - 4 Floating Glassmorphic Cards: Giám sát (CPU 42%), Dự đoán AI (Bất thường bộ nhớ), Tự phục hồi (Pod restarted 4,2s), Kubernetes (24 Pods, 8 Services).
  - Tương tác chuột thị sai (mouse parallax) và hiệu ứng lơ lửng nhấp nhô nhẹ nhàng.
- **Feature Strip**:
  - Tiêu đề: *“Được xây dựng cho hạ tầng doanh nghiệp vừa và nhỏ (SME) dựa trên Kubernetes”*.
  - 5 tính năng cốt lõi: Giám sát thời gian thực, Dự báo bằng AI, Phân tích nguyên nhân gốc rễ, Tự động khắc phục sự cố, Con người tham gia kiểm soát.
