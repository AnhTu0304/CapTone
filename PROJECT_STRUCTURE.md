# KIẾN TRÚC VÀ CẤU TRÚC CHI TIẾT HỆ THỐNG DỰ ÁN SELFHEAL
> **Tài liệu Kỹ thuật Toàn diện & Hướng dẫn Triển khai Mã nguồn**  
> *Hệ thống Giám sát & Tự phục hồi Hạ tầng Kubernetes (Greptile Blueprint Design System & 3D Interactive Telemetry)*

---

## MỤC LỤC
1. [Tổng quan Dự án & Triết lý Kiến trúc](#1-tổng-quan-dự-án--triết-lý-kiến-trúc)
2. [Cây thư mục Toàn diện (Directory Tree)](#2-cây-thư-mục-toàn-diện-directory-tree)
3. [Phân loại & Nhiệm vụ Từng Thư mục (Folder Breakdown)](#3-phân-loại--nhiệm-vụ-từng-thư-mục-folder-breakdown)
4. [Bản đồ Từng Tệp & Chức năng Kỹ thuật (File-by-File Breakdown)](#4-bản-đồ-từng-tệp--chức-năng-kỹ-thuật-file-by-file-breakdown)
5. [Kiến trúc Layouts (Khung Bố cục Toàn hệ thống)](#5-kiến-trúc-layouts-khung-bố-cục-toàn-hệ-thống)
6. [Các Section Components & Khối Giao diện Chính](#6-các-section-components--khối-giao-diện-chính)
7. [Chuyên sâu Kỹ thuật 3D & Dashboards (Cơ chế & Cách làm ra)](#7-chuyên-sâu-kỹ-thuật-3d--dashboards-cơ-chế--cách-làm-ra)
   - [7.1. Hero 3D Telemetry Dashboard (Trang Chủ)](#71-hero-3d-telemetry-dashboard-trang-chủ)
   - [7.2. Chu trình 3D 7 Bước Onboarding & Mini Dashboard Bloom (Trang Đăng Nhập)](#72-chu-trình-3d-7-bước-onboarding--mini-dashboard-bloom-trang-đăng-nhập)
8. [Hệ thống Design Tokens & Nguyên tắc Blueprint Greptile](#8-hệ-thống-design-tokens--nguyên-tắc-blueprint-greptile)

---

## 1. TỔNG QUAN DỰ ÁN & TRIẾT LÝ KIẾN TRÚC

Dự án **SelfHeal** là nền tảng giao diện web kỹ thuật cao (High-precision Technical UI) phục vụ giải pháp Tự phục hồi Hạ tầng Kubernetes dựa trên AI (AI-driven Self-Healing K8s).

### Công nghệ Cốt lõi (Tech Stack):
- **Giao diện**: React 19, JavaScript ES6+ hiện đại, Lucide Icons.
- **Tạo kiểu & Thiết kế**: Pure CSS & Modern CSS Custom Properties (CSS Tokens), không phụ thuộc Tailwind hay UI frameworks nặng nề, giúp kiểm soát tối đa 100% hiệu năng và rendering pipeline.
- **Đồ họa & Động cơ 3D**: CSS 3D Transforms (`perspective`, `rotateX/Y/Z`, `translate3d`, `preserve-3d`), SVG Parametric Math, Mouse Parallax Vector Tracking, không cần nạp thư viện Three.js cồng kềnh nhằm giữ thời gian tải dưới 0.5s và đạt chuẩn 60 FPS mượt mà.

### Triết lý Thiết kế Greptile Precision Blueprint:
- **Sharp Geometry (Góc cạnh sắc nét)**: Toàn bộ `border-radius: 0px`.
- **Bảng màu Color-Blocking**: Màu nền Canvas xi măng nhẹ (`#EEEEEE`), Màu Navy chủ đạo (`#3D3B4F`), Màu nhấn Mint điện tử (`#28E99F`), và Trắng tinh khiết (`#FFFFFF`).
- **Kẻ hướng kỹ thuật (Blueprint Guidelines)**: Đường kẻ nét đứt `1px dashed rgba(61, 59, 79, 0.16)`, 4 dấu định vị chữ thập (`+` crosshairs) tại 4 góc linh kiện, chốt định vị Datum Tab và bu-lông lục giác Bolt Anchor.
- **Tiêu chuẩn Kích thước 1400px**: Khung nội dung tối đa đồng bộ `--content-max-width: 1400px`. Hai bên ngoài lề trang bị rãnh căn chỉnh kỹ thuật (Gutter Rails) với lưới milimét ẩn hiện theo độ rộng màn hình.

---

## 2. CÂY THƯ MỤC TOÀN DIỆN (DIRECTORY TREE)

```
d:/AISelfHealing/
├── .agents/                               # Cấu hình các kỹ năng (Skills) của Agent hỗ trợ lập trình
├── agents-skills/                         # Bộ công cụ Agent CLI, quy chuẩn mã nguồn và kiểm thử
├── www.greptile.com-DESIGN.md             # Tài liệu đặc tả hệ thống thiết kế Greptile chuẩn
├── PROJECT_STRUCTURE.md                   # [TÀI LIỆU NÀY] Sơ đồ kiến trúc & hướng dẫn toàn bộ mã nguồn
└── frontend/                              # Mã nguồn ứng dụng giao diện React
    ├── package.json                       # Khai báo dependencies, scripts và cấu hình môi trường
    ├── public/                            # Tài nguyên tĩnh
    │   ├── index.html                     # HTML Entry Point
    │   ├── favicon.ico                    # Biểu tượng tab trình duyệt
    │   └── manifest.json                  # Cấu hình PWA
    └── src/                               # Toàn bộ mã nguồn React
        ├── index.js                       # Điểm khởi tạo ứng dụng React DOM
        ├── index.css                      # CSS cấp thấp nhất (font imports, CSS reset)
        ├── App.js                         # Component điều phối cấp cao nhất (State & URL sync)
        ├── App.css                        # CSS hỗ trợ chung
        ├── App.test.js                    # Bộ kiểm thử giao diện tự động (Unit / Smoke tests)
        ├── logo.svg                       # Biểu tượng React mặc định
        │
        ├── styles/                        # Hệ thống Token và Biến thiết kế toàn cục
        │   ├── design-tokens.css          # Định nghĩa màu sắc, font, spacing, borders, radius (0px)
        │   └── globals.css                # Blueprint gutters, lưới milimét, crosshairs (+), responsive
        │
        ├── layouts/                       # Các khung cấu trúc bọc trang (Page Scaffolds)
        │   ├── PublicLayout.jsx           # Layout công khai: Gutter Rails + Header co giãn + Footer
        │   ├── AuthLayout.jsx             # Layout Đăng nhập: 50% Canvas 3D + 50% Form trắng
        │   └── DocsLayout.jsx             # Layout Tài liệu: Sidebar kỹ thuật + TOC + Nội dung
        │
        ├── routes/                        # Điều hướng và Quản lý đường dẫn (Client-side Routing)
        │   └── index.jsx                  # Bảng ánh xạ Route, Switch-case hiển thị trang
        │
        ├── hooks/                         # Custom React Hooks
        │   ├── useScrollHeader.js         # Lắng nghe cuộn trang để thu nhỏ Header về 1400px
        │   └── useScrollSpy.js            # Tự động phát hiện vị trí đọc để làm sáng TOC tài liệu
        │
        ├── lib/                           # Thư viện tiện ích tính toán và tương tác
        │   └── animations.js              # Các hàm tiện ích micro-interaction, GSAP hooks
        │
        ├── components/                    # Linh kiện giao diện phân tầng
        │   ├── common/                    # Linh kiện nguyên tử cơ bản (Atoms)
        │   │   ├── Accordion.jsx          # Khối gập/mở hỏi đáp, thiết lập kỹ thuật
        │   │   ├── AlertCard.jsx          # Hộp thông báo trạng thái (Info, Warning, Critical)
        │   │   ├── Badge.jsx              # Nhãn trạng thái sắc cạnh (0px radius)
        │   │   ├── Breadcrumb.jsx         # Đường dẫn phân cấp tài liệu
        │   │   ├── Button.jsx             # Nút bấm phong cách Greptile (có dấu mũi tên/chevron)
        │   │   ├── CodeBlock.jsx          # Khối hiển thị mã nguồn có syntax highlighting & Copy
        │   │   ├── Logo.jsx               # Logo isometric 3D của SelfHeal Systems
        │   │   └── SectionHeader.jsx      # Tiêu đề phân đoạn chuẩn hóa (Overline, Title, Subtitle)
        │   │
        │   ├── layout/                    # Linh kiện dựng khung (Structural Components)
        │   │   ├── Header.jsx             # Thanh điều hướng trên cùng (100% -> 1400px + 4 crosshairs)
        │   │   ├── Footer.jsx             # Chân trang 4 cột kỹ thuật với sơ đồ Schematic
        │   │   └── MobileNavigation.jsx   # Menu trượt cho điện thoại di động
        │   │
        │   ├── marketing/                 # Các khối nội dung truyền thông, giải thích nghiệp vụ
        │   │   ├── CTASection.jsx         # Khối kêu gọi hành động (Call To Action) cuối trang
        │   │   ├── CapabilityCard.jsx     # Thẻ năng lực hệ thống (Monitor, Diagnose, Heal)
        │   │   ├── FeatureCard.jsx        # Thẻ chi tiết tính năng
        │   │   ├── IncidentCard.jsx       # Thẻ mô phỏng dòng thời gian xử lý sự cố Pods
        │   │   └── ProcessStep.jsx        # Các bước trong vòng tuần hoàn tự phục hồi MAPE-K
        │   │
        │   └── navigation/                # Linh kiện định hướng chuyên sâu
        │       ├── DocumentationSidebar.jsx # Cột cây danh mục tài liệu kỹ thuật
        │       ├── Pagination.jsx         # Điều hướng Trang trước / Trang sau
        │       ├── Sidebar.jsx            # Cột điều hướng phụ
        │       └── TableOfContents.jsx    # Mục lục cuộn thông minh bám theo trang
        │
        └── pages/                         # Các màn hình trang chính
            ├── Home/                      # Trang chủ (Landing Page)
            │   ├── index.jsx              # Điều phối các section của Trang chủ
            │   ├── HeroSection.jsx        # Khu vực Hero chính với 3D Parallax & Dashboard
            │   ├── HeroSectionSlot.jsx    # Hộp slot linh hoạt cho Hero
            │   └── components/            # Linh kiện 3D chuyên biệt của Hero
            │       ├── DashboardPreview.jsx # Mô phỏng bảng điều khiển Kubernetes K8s live
            │       ├── FloatingCard.jsx     # Các thẻ card 3D bay quanh quỹ đạo (Orbiting)
            │       ├── HeroAmbientDecor.jsx # Huy hiệu K8s 3D phát sáng & Khối lập phương
            │       └── FeatureStrip.jsx     # Băng chuyền thông số tính năng bên dưới Hero
            │
            ├── Login/                     # Trang Đăng nhập & Xác thực
            │   ├── index.jsx              # Form đăng nhập hiện đại phong cách Clean White
            │   └── components/            # Động cơ 3D tiếp cận 7 bước ở cột bên trái
            │       ├── OnboardingSequence3D.jsx # Bộ điều phối chu trình 7 bước -> gôm tụ -> nở Dashboard
            │       ├── HexagonStepNode.jsx      # Node lục giác 3D đại diện từng bước
            │       ├── ConnectingArrow.jsx      # Mũi tên dẫn hướng có xung photon truyền dẫn
            │       └── MiniDashboardBloom.jsx   # Dashboard thu nhỏ nở bừng khi hoàn thành 7 bước
            │
            ├── Register/                  # Trang Đăng ký tài khoản (AuthLayout, Strength Meter)
            │   └── index.jsx
            ├── ForgotPassword/            # Trang Quên mật khẩu & Gửi link phục hồi
            │   └── index.jsx
            ├── ResetPassword/             # Trang Đặt lại mật khẩu (Checklist tiêu chí an ninh)
            │   └── index.jsx
            │
            ├── Onboarding/                # Luồng Onboarding 5 bước hoàn chỉnh sau đăng nhập
            │   ├── index.jsx              # Bộ điều phối OnboardingPage & OnboardingProvider
            │   ├── OrganizationStep.jsx   # Bước 1: Tạo Workspace Tổ chức
            │   ├── EnvironmentStep.jsx    # Bước 2: Tạo Môi trường (Dev / Staging)
            │   ├── KubernetesStep.jsx     # Bước 3: Đăng ký Cluster, Token & Cài đặt Agent
            │   ├── VerifyAgentStep.jsx    # Bước 4: Xác minh Heartbeat, K8s & AI Readiness
            │   └── CompleteStep.jsx       # Bước 5: Hoàn tất cấu hình & Chuyển tới Dashboard
            │
            ├── Features/                  # Trang Tính năng (Bố cục 3 hàng × 2 ô = 6 tính năng)
            │   ├── index.jsx
            │   └── components/
            │       ├── TelemetryProbe3D.jsx     # [3D] Tàu vũ trụ trắng quét radar Telemetry hạ tầng K8s
            │       ├── AIPredictionCore3D.jsx   # [3D] Lõi đa diện dự báo chuỗi thời gian & cảnh báo bất thường
            │       ├── RootCauseAnalysis3D.jsx  # [3D] Mạng lưới nhân quả RCA từ Sự cố đến Lõi nguyên nhân gốc
            │       ├── SelfHealingDrone3D.jsx   # [3D] Robot trắng sứ tự sửa chữa vi mạch & dấu cộng healthy bay nổi
            │       ├── HumanInTheLoop3D.jsx     # [3D MỚI] Bàn tay vàng nhạt điều khiển sợi chỉ các thẻ tính năng AI chờ duyệt
            │       └── SecurityShield3D.jsx     # [3D] Súng trắng bắn liên tục vào khiên năng lượng & hiệu ứng văng đạn
            ├── Dashboard/                 # [MỚI] Bảng điều khiển vận hành Calm Operations (White-First)
            │   ├── index.jsx              # Bộ điều phối các trang con Dashboard
            │   ├── context/
            │   │   └── DashboardContext.jsx # Quản lý Org, Env, Role RBAC, Agent toggle, Auto-refresh
            │   └── Overview/
            │       └── index.jsx          # Trang 1: Tổng quan hạ tầng, Health card, 8 metrics & charts
            │
            ├── Guide/                     # Trang hướng dẫn cài đặt Agent vào cụm K8s
            │   └── index.jsx
            ├── About/                     # Trang giới thiệu dự án, đội ngũ & tầm nhìn
            │   └── index.jsx
            ├── Docs/                      # Trang tài liệu kỹ thuật chi tiết
            │   └── index.jsx
            └── GetStarted/                # Trang bắt đầu nhanh dành cho kỹ sư DevOps
                └── index.jsx
```

---

## 3. PHÂN LOẠI & NHIỆM VỤ TỪNG THƯ MỤC (FOLDER BREAKDOWN)

### 3.1. `frontend/src/styles/`
- **Mục đích**: Nơi chứa "linh hồn" thị giác của dự án.
- **Nhiệm vụ**:
  - `design-tokens.css`: Khởi tạo toàn bộ biến CSS (`:root`) gồm dải màu sắc, font chữ (`Anybody`, `DM Sans`, `Space Mono`), độ bo tròn (`--radius: 0px`), chiều rộng tối đa (`--content-max-width: 1400px`), đường viền tóc (`--border-hairline: 1px solid #D6D6D6`).
  - `globals.css`: Triển khai các lớp hạ tầng layout như `.blueprint-canvas-root`, rãnh kỹ thuật 2 bên lề `.blueprint-gutter-left/right`, lưới milimét milimeter-grid, định dạng tiêu đề font display và hiệu ứng chữ thập góc `+`.

### 3.2. `frontend/src/layouts/`
- **Mục đích**: Chứa các cấu trúc bao bọc dùng chung (Scaffolding templates).
- **Nhiệm vụ**:
  - Tách biệt hoàn toàn việc render nội dung trang với các thành phần khung cố định (Header, Footer, Gutter Rails, Sidebar điều hướng).
  - Đảm bảo tính nhất quán giữa các trang công khai (Landing, Guide, Features), trang tài liệu (Docs), và trang xác thực (Login).

### 3.3. `frontend/src/routes/`
- **Mục đích**: Quản lý điều hướng đường dẫn URL phía máy khách (Client-side Routing).
- **Nhiệm vụ**:
  - Khai báo danh mục hằng số URL (`ROUTES.HOME`, `ROUTES.LOGIN`, `ROUTES.DOCS`,...).
  - Component `RouteRenderer` đón nhận `currentPath`, quyết định layout nào và trang nào được hiển thị mà không gây tải lại toàn bộ trang trình duyệt (No full-page reload).

### 3.4. `frontend/src/hooks/`
- **Mục đích**: Chứa các hàm logic tương tác có khả năng tái sử dụng (React Custom Hooks).
- **Nhiệm vụ**:
  - `useScrollHeader.js`: Bắt sự kiện cuộn chuột (`window.addEventListener('scroll')`) để cung cấp cờ `isScrolled`, phục vụ việc thu nhỏ thanh Header từ 100% về đúng 1400px.
  - `useScrollSpy.js`: Quan sát các thẻ tiêu đề (H2, H3) trong bài viết để tự động cập nhật mục lục Table of Contents đang trỏ đến phần nào.

### 3.5. `frontend/src/components/common/`
- **Mục đích**: Thư viện Atomic Design Components (linh kiện nguyên tử).
- **Nhiệm vụ**: Cung cấp các nút bấm (`Button`), nhãn (`Badge`), khối mã nguồn (`CodeBlock`), khung cảnh báo (`AlertCard`), và logo (`Logo`) chuẩn Greptile Blueprint, có thể dùng ở bất kỳ trang nào.

### 3.6. `frontend/src/components/layout/`
- **Mục đích**: Các linh kiện cố định trong cấu trúc trang.
- **Nhiệm vụ**:
  - `Header.jsx`: Thanh điều hướng mượt mà, đổi từ Full-width sang Boxed 1400px kèm hiệu ứng làm mờ nền kính mờ (`backdrop-filter`) và 4 dấu cộng `+`.
  - `Footer.jsx`: Chân trang đậm chất kỹ thuật, chứa liên kết, sơ đồ mạch Schematic và bản quyền.
  - `MobileNavigation.jsx`: Bảng điều hướng dạng ngăn kéo cho màn hình nhỏ.

### 3.7. `frontend/src/components/marketing/`
- **Mục đích**: Trực quan hóa các tính năng nghiệp vụ của nền tảng K8s Self-Healing.
- **Nhiệm vụ**:
  - Thể hiện thẻ năng lực (`CapabilityCard`), mô phỏng chu trình MAPE-K (`ProcessStep`), hiển thị nhật ký xử lý sự cố Pod (`IncidentCard`), và khối thôi thúc đăng ký (`CTASection`).

### 3.8. `frontend/src/pages/Home/` & `frontend/src/pages/Login/`
- **Mục đích**: Nơi hiện thực hóa 2 khu vực đồ họa tương tác 3D phức tạp nhất hệ thống:
  - `Home`: 3D Hero Section với bảng điều khiển K8s và các thẻ bay theo quỹ đạo không gian.
  - `Login`: Phân cảnh 3D trực quan hóa 7 bước tiếp cận nền tảng, cơ chế gôm tụ (convergence) và bung nở bảng điều khiển (bloom).

---

## 4. BẢN ĐỒ TỪNG TỆP & CHỨC NĂNG KỸ THUẬT (FILE-BY-FILE BREAKDOWN)

### A. Nhóm Tệp Gốc & Khởi chạy (`src/`)
| Tên Tệp | Chức năng Kỹ thuật & Vai trò |
| :--- | :--- |
| [`index.js`](file:///d:/AISelfHealing/frontend/src/index.js) | Điểm nạp đầu tiên của React. Khởi tạo `ReactDOM.createRoot()`, nạp `globals.css` và `design-tokens.css`. |
| [`App.js`](file:///d:/AISelfHealing/frontend/src/App.js) | Component gốc của ứng dụng. Lưu trữ `currentPath`, bắt sự kiện `popstate` để điều hướng lịch sử trang (Back/Forward), điều hướng không cần reload bằng hàm `handleNavigate`. |
| [`index.css`](file:///d:/AISelfHealing/frontend/src/index.css) | Nạp các bộ font Google Fonts (`Anybody:800`, `DM Sans:400,500,700`, `Space Mono:400,700`), thiết lập CSS Reset, `box-sizing: border-box`. |
| [`App.test.js`](file:///d:/AISelfHealing/frontend/src/App.test.js) | Chứa các bài kiểm thử tự động (Unit Tests) xác thực việc render trang chủ, trang đăng nhập và kiểm tra không có lỗi crash. |

---

### B. Nhóm Linh kiện Dùng chung (`src/components/common/`)
| Tên Tệp | Chức năng Kỹ thuật & Vai trò |
| :--- | :--- |
| [`Button.jsx`](file:///d:/AISelfHealing/frontend/src/components/common/Button.jsx) | Nút bấm kỹ thuật chuẩn Greptile. Hỗ trợ các biến thể (`primary` Navy, `accent` Mint, `outline`, `ghost`). Sở hữu micro-transform khi hover (`translateY(-1px)`), hỗ trợ icon đầu/cuối và hiệu ứng bấm nhạy. |
| [`Badge.jsx`](file:///d:/AISelfHealing/frontend/src/components/common/Badge.jsx) | Thẻ gắn nhãn sắc nét góc cạnh (`border-radius: 0px`). Hỗ trợ các trạng thái `success`, `warning`, `info`, `neutral` với đường viền hairline 1px. |
| [`Logo.jsx`](file:///d:/AISelfHealing/frontend/src/components/common/Logo.jsx) | Biểu tượng khối lập phương Isometric 3D của SelfHeal được vẽ trực tiếp bằng SVG vector, đi kèm chữ "SelfHeal" với font `Anybody` siêu đậm. |
| [`CodeBlock.jsx`](file:///d:/AISelfHealing/frontend/src/components/common/CodeBlock.jsx) | Khối hiển thị dòng lệnh/cấu hình YAML/Bash. Có thanh tiêu đề cửa sổ terminal 3 chấm tròn, nút bấm "Sao chép" (Copy to Clipboard) với phản hồi tức thì. |
| [`AlertCard.jsx`](file:///d:/AISelfHealing/frontend/src/components/common/AlertCard.jsx) | Hộp thông báo sự cố phân loại theo mức độ nghiêm trọng (`CRITICAL`, `WARNING`, `RESOLVED`) với icon tương ứng. |
| [`SectionHeader.jsx`](file:///d:/AISelfHealing/frontend/src/components/common/SectionHeader.jsx) | Khối tiêu đề đồng bộ cho từng phân đoạn: Dòng tag Monospace chữ hoa trên cùng, Tiêu đề chính Display, và đoạn mô tả bổ trợ. |
| [`Accordion.jsx`](file:///d:/AISelfHealing/frontend/src/components/common/Accordion.jsx) | Khối gập mở thông tin kỹ thuật, có hiệu ứng chuyển động mượt mà khi xem chi tiết cấu hình. |
| [`Breadcrumb.jsx`](file:///d:/AISelfHealing/frontend/src/components/common/Breadcrumb.jsx) | Thanh điều hướng phân cấp (Vd: Docs > Architecture > Self-Healing Engine). |

---

### C. Nhóm Linh kiện Khung & Bố cục (`src/components/layout/`)
| Tên Tệp | Chức năng Kỹ thuật & Vai trò |
| :--- | :--- |
| [`Header.jsx`](file:///d:/AISelfHealing/frontend/src/components/layout/Header.jsx) | **Thanh Điều hướng Động Thông minh**: <br>• Ở đầu trang: Chiếm 100% chiều rộng màn hình, nền trong suốt hòa quyện vào canvas.<br>• Khi cuộn quá 25px: Tự động co gọn mượt mà về đúng `1400px`, nền kính mờ `rgba(238, 238, 238, 0.9)`, xuất hiện 4 dấu chữ thập `+` màu Mint tại 4 góc và mấu định vị kỹ thuật Datum Tab. <br>• Tích hợp các nút điều hướng phân cấp có mũi tên Chevron. |
| [`Footer.jsx`](file:///d:/AISelfHealing/frontend/src/components/layout/Footer.jsx) | Chân trang phong cách bản vẽ kỹ thuật 4 cột: Sản phẩm, Tài nguyên, Nền tảng và Pháp lý. Bên dưới có sơ đồ Schematic vector thể hiện luồng tín hiệu từ Kubernetes Cluster về AI Engine. |
| [`MobileNavigation.jsx`](file:///d:/AISelfHealing/frontend/src/components/layout/MobileNavigation.jsx) | Menu điều hướng tối ưu cho điện thoại di động và máy tính bảng, bung mở khi người dùng bấm nút hamburger Menu. |

---

### D. Nhóm Linh kiện Marketing & Nghiệp vụ (`src/components/marketing/`)
| Tên Tệp | Chức năng Kỹ thuật & Vai trò |
| :--- | :--- |
| [`CapabilityCard.jsx`](file:///d:/AISelfHealing/frontend/src/components/marketing/CapabilityCard.jsx) | Thẻ giới thiệu năng lực (Quan sát hạ tầng, Phân tích nguyên nhân gốc, Tự hành phục hồi) với đường viền nét đứt và hiệu ứng viền sáng khi hover. |
| [`ProcessStep.jsx`](file:///d:/AISelfHealing/frontend/src/components/marketing/ProcessStep.jsx) | Thể hiện 4 pha của vòng lặp điều khiển tự thích ứng MAPE-K: **M**onitor (Giám sát) &rarr; **A**nalyze (Phân tích) &rarr; **P**lan (Lập kế hoạch) &rarr; **E**xecute (Thực thi). |
| [`IncidentCard.jsx`](file:///d:/AISelfHealing/frontend/src/components/marketing/IncidentCard.jsx) | Thẻ trực quan hóa kịch bản sự cố thực tế: CrashLoopBackOff, OOMKilled, Pod Eviction với thời gian AI phát hiện và tự khắc phục (chỉ trong 1.8 giây). |
| [`CTASection.jsx`](file:///d:/AISelfHealing/frontend/src/components/marketing/CTASection.jsx) | Phân đoạn kêu gọi người dùng kết nối cluster và trải nghiệm thử miễn phí, nổi bật với nút CTA Mint `#28E99F`. |

---

### E. Nhóm Linh kiện 3D & Trực quan hóa Telemetry
| Tên Tệp | Chức năng Kỹ thuật & Vai trò |
| :--- | :--- |
| [`DashboardPreview.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Home/components/DashboardPreview.jsx) | Bảng điều khiển Kubernetes 3D giả lập trên Hero: Hiển thị thanh menu bên trái, bảng chỉ số cluster (Độ khả dụng 98.7%, CPU 42%, RAM 68%), biểu đồ sóng Sparkline, và danh sách Pods trực tiếp. |
| [`FloatingCard.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Home/components/FloatingCard.jsx) | Các thẻ card lơ lửng 3D bay quanh bảng điều khiển Hero, chạy hiệu ứng keyframes Orbiting (xuất hiện, bay theo quỹ đạo hình elip, sau đó mờ dần luân phiên). |
| [`HeroAmbientDecor.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Home/components/HeroAmbientDecor.jsx) | Khối trang trí không gian 3D Hero: Logo Kubernetes lăng trụ lục giác phát sáng, vòng đai quỹ đạo Halo elip xoay quanh, và các khối dữ liệu isometric bán trong suốt. |
| [`FeatureStrip.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Home/components/FeatureStrip.jsx) | Băng chuyền thông số kỹ thuật nằm ngay dưới Hero: 99.99% Uptime, <2s Recovery Time, Zero False Positives, K8s Native. |
| [`OnboardingSequence3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Login/components/OnboardingSequence3D.jsx) | **Động cơ 3D điều phối chu trình 7 bước** trên trang Đăng nhập: Chạy tuần tự từ bước 1 đến 7 &rarr; Kích hoạt hiệu ứng gôm tụ về tâm (Convergence) &rarr; Bung nở bảng điều khiển Kubernetes Bloom &rarr; Hỗ trợ chuột xoay 3D Parallax. |
| [`HexagonStepNode.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Login/components/HexagonStepNode.jsx) | Node hình lục giác kỹ thuật tạo bằng toán học SVG/CSS `clip-path: polygon()`. Chuyển đổi trạng thái viền sáng Mint khi active, thu nhỏ về tâm khi gôm tụ. |
| [`ConnectingArrow.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Login/components/ConnectingArrow.jsx) | Mũi tên dẫn hướng kết nối giữa các bước: Tính toán góc xoay và khoảng cách tự động bằng lượng giác (`Math.atan2`, `Math.hypot`), có xung photon ánh sáng chạy dọc theo cáp tín hiệu. |
| [`MiniDashboardBloom.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Login/components/MiniDashboardBloom.jsx) | Bảng điều khiển Kubernetes 3D thu nhỏ bung nở ấn tượng từ tâm sau khi 7 bước hoàn tất, thể hiện kết nối thành công tới cluster. |
| [`TelemetryProbe3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/TelemetryProbe3D.jsx) | **Trực quan hóa 3D Three.js Tàu tiêm kích bắn tia Laser & Thẻ Telemetry phân giải**: Tàu tiêm kích trung tâm quay nòng ngắm 4 thẻ Logs/Metrics, bắn chùm laser Mint `#28E99F`, kích nổ chùm hạt lượng tử tan biến (Dissolve) tuần hoàn liên tục. Căn chuẩn 340px. |
| [`AIPredictionCore3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/AIPredictionCore3D.jsx) | **Lõi Đa Diện 3D Three.js Dự Báo Bằng AI**: Lõi đa tầng xoay ngược chiều, 4 luồng telemetry trôi hạt hội tụ, 3 nhánh quỹ đạo tương lai (NOW &rarr; +30m), điểm báo động đỏ Anomaly Marker & bảng Holographic HUD. Căn chuẩn 340px. |
| [`RootCauseAnalysis3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/RootCauseAnalysis3D.jsx) | **Mạng Lưới Nhân Quả 3D Three.js Phân Tích Nguyên Nhân Gốc Rễ (RCA)**: Liên kết nhân quả đa chiều từ Nút SỰ CỐ (HTTP 5xx) &rarr; Nút Sập Pod (CrashLoop) &rarr; Nút NGUYÊN NHÂN GỐC RỄ (Memory Leak) phát sáng Hologram, hạt photon di chuyển dọc đường dây. Căn chuẩn 340px. |
| [`SelfHealingDrone3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/SelfHealingDrone3D.jsx) | **Robot 3D Three.js Tự Phục Hồi Sự Cố & Dấu + Healthy**: Robot tự cầm que hàn lượng tử sửa chữa cơ thể, phát tia hồ quang plasma xanh, sinh ra 50+ dấu cộng "+" màu xanh Mint bay bổng rồi tan biến (Dissolve). Căn chuẩn 340px. |

---

## 5. KIẾN TRÚC LAYOUTS (KHUNG BỐ CỤC TOÀN HỆ THỐNG)

Hệ thống có 3 layout cốt lõi được định nghĩa trong `src/layouts/`:

### 5.1. `PublicLayout.jsx` (Dành cho Landing Page, Hướng dẫn, Tính năng, Giới thiệu)
```
+-------------------------------------------------------------------------------+
|  BLUEPRINT GUTTER LEFT  |   HEADER (Full-width ở Top -> 1400px khi Cuộn)  |  GUTTER RIGHT |
|   (Lưới milimét mờ)     |-------------------------------------------------| (Lưới milimét)|
|                         |                                                 |               |
|                         |              MAIN CONTENT CONTAINER             |               |
|                         |                 (Tối đa 1400px)                 |               |
|                         |    Hero 3D / Năng lực / MAPE-K / Incident...    |               |
|                         |                                                 |               |
|                         |-------------------------------------------------|               |
|                         |                 FOOTER BẢN VẼ                   |               |
+-------------------------------------------------------------------------------+
```
- **Hai rãnh kỹ thuật (Gutter Rails)**: Lớp `.blueprint-gutter-left` và `.blueprint-gutter-right` nằm ở hai bên lề màn hình rộng (>1400px), hiển thị lưới đo milimét mờ nhạt chuẩn bản vẽ kỹ thuật CAD.
- **Header Động**: Khi ở đỉnh trang, Header mở rộng 100%. Khi người dùng cuộn chuột, Header co lại mượt mà với thời gian chuyển tiếp `0.45s cubic-bezier(0.16, 1, 0.3, 1)`, khớp chính xác với khung 1400px của nội dung bên dưới.

### 5.2. `AuthLayout.jsx` (Dành cho Trang Đăng nhập & Xác thực)
```
+------------------------------------------------------+------------------------------------+
|               CỘT TRÁI (Tỷ lệ 1.2)                  |        CỘT PHẢI (Tỷ lệ 1.0)        |
|  - Logo thương hiệu ở góc trên                       |  - Nền TRẮNG TINH KHIẾT (#FFFFFF)  |
|  - KHÔNG GIAN 3D TƯƠNG TÁC (OnboardingSequence3D):   |  - Biểu tượng Isometric Cube       |
|    + Chu trình 7 bước Lục giác nối nhau              |  - Form nhập Email & Mật khẩu      |
|    + Gôm tụ về tâm -> Nở Dashboard K8s               |  - Nút Đăng nhập Mint #28E99F      |
|    + Tương tác nghiêng 3D theo chuột                 |  - Nút Đăng nhập với Gmail/Google  |
|  - Dòng trạng thái kỹ thuật Monospace ở chân         |  - Liên kết Quên mật khẩu/Đăng ký  |
+------------------------------------------------------+------------------------------------+
```
- **Tách biệt thị giác hoàn hảo**: Cột trái mang phong cách tương lai viễn tưởng với nền Canvas xám kỹ thuật và đồ họa 3D chuyển động; cột phải mang phong cách tối giản, sáng sủa, tạo cảm giác tin cậy và tập trung tối đa cho người dùng khi điền biểu mẫu.

### 5.3. `DocsLayout.jsx` (Dành cho Trang Tài liệu Kỹ thuật)
- Chia làm 3 cột:
  1. **Cột trái**: `DocumentationSidebar` chứa danh mục tài liệu phân tầng, có ô tìm kiếm nhanh.
  2. **Cột giữa**: Nội dung bài viết kỹ thuật (`DocsPage`), tích hợp `CodeBlock` và sơ đồ kiến trúc.
  3. **Cột phải**: `TableOfContents` thông minh, tự động bám theo thanh cuộn và làm sáng mục đang đọc thông qua hook `useScrollSpy`.

---

## 6. CÁC SECTION COMPONENTS & KHỐI GIAO DIỆN CHÍNH

### 6.1. `HeroSection.jsx` (Khu vực trung tâm Trang Chủ)
- **Cấu trúc 2 cột tỷ lệ 1 : 1.38**:
  - **Cột bên trái**: Tiêu đề chính cực lớn bằng font `Anybody` (`font-weight: 800`, `letter-spacing: -0.035em`), đoạn giới thiệu hệ thống, cụm nút bấm hành động (Bắt đầu ngay & Xem tài liệu), kèm theo các chỉ số tin cậy (99.9% độ chính xác, hỗ trợ EKS, GKE, AKS).
  - **Cột bên phải**: Khung sân khấu 3D chứa `DashboardPreview` kết hợp với 3 `FloatingCard` bay xung quanh và `HeroAmbientDecor`.

### 6.2. `CapabilitySection` & `ProcessStep`
- Giới thiệu khả năng phát hiện lỗi trước khi xảy ra (Pre-failure detection).
- Trực quan hóa quy trình tự hành 4 bước: Lắng nghe tín hiệu Telemetry &rarr; Suy luận AI &rarr; Đưa ra phương án cô lập Pod &rarr; Tự động vá và xác nhận hồi phục.

### 6.3. `IncidentTimeline`
- Mô phỏng nhật ký thời gian thực của một sự cố Pod CrashLoopBackOff:
  - Giây 00:00: Pod phát sinh rò rỉ bộ nhớ (Memory Leak).
  - Giây 00:01: AI SelfHeal Agent phát hiện bất thường qua độ lệch metric.
  - Giây 00:02: Tự động khởi tạo Pod thay thế và chuyển tải an toàn.
  - Giây 00:03: Trạng thái hệ sinh thái trở lại 100% Healthy.

---

## 7. CHUYÊN SÂU KỸ THUẬT 3D & DASHBOARDS (CƠ CHẾ & CÁCH LÀM RA)

Đây là phần trọng tâm kỹ thuật cao cấp nhất của dự án. Toàn bộ hiệu ứng 3D được xây dựng dựa trên toán học hình học, vector tọa độ chuột và phần cứng GPU thông qua CSS 3D Transforms, không cần cài đặt thư viện ngoài nặng nề.

```
                  KIẾN TRÚC ĐỒ HỌA 3D TOÀN HỆ THỐNG
                  
  [Tương tác Chuột]             [Toán học Vector]           [Bộ điều khiển Render]
   Mouse Position     ----->    Normalize [-1, 1]    ----->  CSS 3D Engine
   (clientX, clientY)            Delta Tilt Angles            perspective(1200px - 1400px)
                                                              transform-style: preserve-3d
                                                                     |
                                      +------------------------------+-----------------------------+
                                      |                                                            |
                                      v                                                            v
                        [HERO SECTION 3D]                                            [LOGIN ONBOARDING 3D]
                        - Parallax Tilt Container                                    - Hexagonal Geometry (Polygon)
                        - 3D Orbiting Cards (Keyframes)                              - Signal Vector Pipeline (Trig Math)
                        - Isometric K8s Prisms (SVG 3-Face)                          - Convergence & Bloom Dynamics
```

---

### 7.1. HERO 3D TELEMETRY DASHBOARD (TRANG CHỦ)

#### A. Vị trí các tệp:
- Container chính: [`src/pages/Home/HeroSection.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Home/HeroSection.jsx)
- Dashboard hiển thị: [`src/pages/Home/components/DashboardPreview.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Home/components/DashboardPreview.jsx)
- Thẻ bay quỹ đạo: [`src/pages/Home/components/FloatingCard.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Home/components/FloatingCard.jsx)
- Trang trí không gian: [`src/pages/Home/components/HeroAmbientDecor.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Home/components/HeroAmbientDecor.jsx)

#### B. Chức năng:
Mô phỏng một góc nhìn tương lai về trạm điều khiển hạ tầng Kubernetes: Bảng điều khiển nghiêng theo không gian 3 chiều, phản ứng linh hoạt theo chuyển động chuột của người dùng, bao quanh bởi 3 thẻ cảnh báo lơ lửng ở các tầng độ sâu (`translateZ`) khác nhau và biểu tượng K8s phát sáng.

#### C. Cách làm ra nó (Kỹ thuật chi tiết):

##### 1. Thiết lập Không gian 3D (Perspective Setup):
Sân khấu được bọc bởi thuộc tính `perspective: 1400px` và `transform-style: preserve-3d`. Giá trị 1400px tạo ra một phối cảnh ống kính tiêu cự tự nhiên, không bị méo góc như các tiêu cự ngắn (300px - 500px).

##### 2. Thuật toán Parallax Chuột Dịu nhẹ (Gentle Mouse Parallax Math):
Trong `HeroSection.jsx`, vị trí con trỏ chuột được chuẩn hóa về khoảng $[-1, 1]$:
```javascript
const handleMouseMove = (e) => {
  const rect = containerRef.current.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;   // Giá trị từ -1 đến 1
  const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;   // Giá trị từ -1 đến 1
  setMousePos({ x, y });
};
```
Sau đó tính toán góc nghiêng gốc dịu nhẹ (Base gentle tilt) kết hợp gia số chuột:
```javascript
// Góc nghiêng mặc định: Trục Y nghiêng -5.5deg, Trục X nghiêng 2.5deg
// Chuột di chuyển sẽ tác động biên độ dịu nhẹ +/- 2 độ:
const tiltX = 2.5 - mousePos.y * 1.8;
const tiltY = -5.5 + mousePos.x * 2.5;

// Áp dụng lên khung Dashboard:
transform: `perspective(1400px) rotateY(${tiltY}deg) rotateX(${tiltX}deg)`
```

##### 3. Cơ chế Quỹ đạo Thẻ Card (3D Orbiting Keyframes):
Các thẻ `FloatingCard` được xếp ở 3 vị trí chiến lược:
- **Top-Left (TL)**: Trạng thái Pods (`24/24 Healthy`).
- **Mid-Right (MR)**: Dự đoán AI (`Anomalies: 0`).
- **Bottom-Left (BL)**: Tự phục hồi (`Auto-healed in 1.8s`).

Mỗi thẻ chạy một chu trình động học 4 thì: **Xuất hiện từ độ sâu âm** &rarr; **Bay nổi lên tầng trên** &rarr; **Giữ vị trí** &rarr; **Mờ dần và trượt sâu vào không gian**:
```css
@keyframes emergeOrbitDissolveTL {
  0% {
    opacity: 0;
    transform: translate3d(0, 16px, -35px) scale(0.88);
  }
  15% {
    opacity: 1;
    transform: translate3d(0, 0, 10px) scale(1);
  }
  65% {
    opacity: 1;
    transform: translate3d(-6px, -6px, 15px) scale(1);
  }
  85%, 100% {
    opacity: 0;
    transform: translate3d(-10px, -18px, 25px) scale(1.04);
  }
}
```
Các thẻ được gán thời gian trễ (`animation-delay: 0s, 2s, 4s`) để luân phiên xuất hiện, tạo cảm giác dữ liệu luôn được luân chuyển tuần hoàn.

##### 4. Huy hiệu Kubernetes Isometric 3D (`HeroAmbientDecor.jsx`):
Được dựng bằng hình học SVG 3 mặt lăng trụ:
- **Mặt đỉnh (Top Face)**: `polygon(50,2 95,28 50,55 5,28)` với dải màu lam nhạt `#60A5FA` &rarr; `#3B82F6`.
- **Mặt trái (Left Face)**: `polygon(5,28 50,55 50,110 5,83)` với dải màu lam đậm `#2563EB` &rarr; `#1D4ED8`.
- **Mặt phải (Right Face)**: `polygon(50,55 95,28 95,83 50,110)` với dải màu lam trung tính.
- **Vòng đai phát sáng (Orbital Halo)**: Một thẻ `div` hình elip bo góc 50%, áp dụng `transform: rotateX(65deg) rotateZ(-25deg)` và `box-shadow: 0 0 25px rgba(56, 189, 248, 0.45)`, tạo hiệu ứng vòng đai sao Thổ bao quanh khối K8s.

---

### 7.2. CHU TRÌNH 3D 7 BƯỚC ONBOARDING & MINI DASHBOARD BLOOM (TRANG ĐĂNG NHẬP)

#### A. Vị trí các tệp:
- Bộ điều phối chính: [`src/pages/Login/components/OnboardingSequence3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Login/components/OnboardingSequence3D.jsx)
- Khối lục giác 3D: [`src/pages/Login/components/HexagonStepNode.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Login/components/HexagonStepNode.jsx)
- Cáp tín hiệu & Xung photon: [`src/pages/Login/components/ConnectingArrow.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Login/components/ConnectingArrow.jsx)
- Dashboard bung nở: [`src/pages/Login/components/MiniDashboardBloom.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Login/components/MiniDashboardBloom.jsx)

#### B. Chức năng:
Thay thế toàn bộ văn bản nhàm chán ở cột bên trái trang Đăng nhập bằng một màn trình diễn đồ họa kỹ thuật:
1. **Pha 1 (Steps Flow)**: Chạy lần lượt 7 bước tiếp cận dự án:
   - Bước 1: Tạo tài khoản (`UserPlus`)
   - Bước 2: Tạo tổ chức (`Building2`)
   - Bước 3: Tạo môi trường (`Layers`)
   - Bước 4: Đăng ký cụm K8s (`Server`)
   - Bước 5: Tạo Token Agent (`Key`)
   - Bước 6: Cài đặt Agent (`Terminal`)
   - Bước 7: Bắt đầu giám sát (`Activity`)
   Mỗi bước được bọc trong hình lục giác phát sáng, nối với bước tiếp theo bằng mũi tên tín hiệu có hạt photon di chuyển.
2. **Pha 2 (Convergence - Gôm tụ)**: Sau khi bước 7 hoàn tất, cả 7 node cùng co cụm với tốc độ cao về tâm tọa độ (0, 0, -100px) và biến mất.
3. **Pha 3 (Dashboard Bloom - Nở bừng)**: Từ điểm hội tụ, một bảng điều khiển Kubernetes Dashboard 3D phát sáng nở bung ra với đầy đủ thông số cluster thời gian thực. Giữ trong 6.5 giây rồi tự động lặp lại chu kỳ mới.

#### C. Cách làm ra nó (Kỹ thuật chi tiết):

##### 1. Máy trạng thái thời gian (Time-based State Machine):
Trong `OnboardingSequence3D.jsx`, luồng hoạt động được quản trị bởi 2 state chính: `currentStep` (1 đến 7) và `phase` (`'steps'` | `'converging'` | `'dashboard'`):
```javascript
useEffect(() => {
  let timeoutId;

  if (phase === 'steps') {
    if (currentStep < 7) {
      // Mỗi bước kích hoạt sau 950ms
      timeoutId = setTimeout(() => setCurrentStep((prev) => prev + 1), 950);
    } else {
      // Giữ bước 7 trong 1.2s trước khi bắt đầu gôm tụ
      timeoutId = setTimeout(() => setPhase('converging'), 1200);
    }
  } else if (phase === 'converging') {
    // Quá trình gôm tụ diễn ra trong 850ms
    timeoutId = setTimeout(() => setPhase('dashboard'), 850);
  } else if (phase === 'dashboard') {
    // Trưng bày Dashboard trong 6.5s rồi reset về bước 1
    timeoutId = setTimeout(() => {
      setPhase('steps');
      setCurrentStep(1);
    }, 6500);
  }

  return () => clearTimeout(timeoutId);
}, [phase, currentStep]);
```

##### 2. Hình học Lục giác Kỹ thuật (`HexagonStepNode.jsx`):
Sử dụng CSS `clip-path` cắt chính xác hình đa giác 6 đỉnh đối xứng:
```css
clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
```
- Khi ở trạng thái **Active**: Node được nâng độ cao trong không gian 3D `translateZ(25px)`, phóng to nhẹ `scale(1.08)`, viền ngoài chuyển màu Mint sáng rực `#28E99F` kèm đổ bóng phát quang `box-shadow: 0 0 20px rgba(40, 233, 159, 0.4)`.
- Khi ở trạng thái **Converging**: Node nhận lệnh biến đổi:
  ```javascript
  transform: 'translate3d(0, 0, -100px) scale(0)',
  opacity: 0,
  transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
  ```

##### 3. Đường dẫn Tín hiệu & Lượng giác Vector (`ConnectingArrow.jsx`):
Mũi tên nối giữa 2 bước $(x_1, y_1)$ và $(x_2, y_2)$ được tính toán góc xoay ($\theta$) và độ dài khoảng cách ($D$) tự động:
```javascript
const dx = toX - fromX;
const dy = toY - fromY;
const length = Math.hypot(dx, dy) - 44; // Trừ bán kính 2 đầu lục giác
const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
```
Một hạt photon (Pulse Dot) chạy dọc theo đường dây tín hiệu bằng keyframe chuyển động:
```css
@keyframes photonTravel {
  0% { transform: translateX(0); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translateX(${length}px); opacity: 0; }
}
```

##### 4. Hiệu ứng Nở bừng Dashboard (`MiniDashboardBloom.jsx`):
Bảng điều khiển Mini Dashboard được kích hoạt với keyframe `bloomExpand`:
```css
@keyframes bloomExpand {
  0% {
    opacity: 0;
    transform: scale(0.35) translate3d(0, 40px, -80px);
    filter: blur(8px);
  }
  60% {
    opacity: 1;
    transform: scale(1.03) translate3d(0, -4px, 15px);
    filter: blur(0px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translate3d(0, 0, 0);
  }
}
```
Bên trong bảng điều khiển tái hiện đầy đủ:
- Thanh tiêu đề Navy `#3D3B4F` với 3 nút màu macOS.
- Đèn báo trạng thái trực tiếp `LIVE` nhấp nháy màu Mint.
- Thống kê tỷ lệ sức khỏe hạ tầng `99.98% HEALTHY`.
- Danh sách 3 Pods trọng yếu (`api-gateway`, `auth-service`, `telemetry-collector`) kèm thanh tiến trình bộ nhớ và CPU.

---

### 7.3. HỆ THỐNG 3D PHI THUYỀN BẮN LASER QUÉT & PHÂN GIẢI TELEMETRY CARDS (TRANG TÍNH NĂNG)

#### A. Vị trí tệp:
- Linh kiện: [`src/pages/Features/components/TelemetryProbe3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/TelemetryProbe3D.jsx)
- Tích hợp tại: [`src/pages/Features/index.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/index.jsx) (Khung tính năng số 1: "Giám sát hạ tầng").

#### B. Chức năng kỹ thuật:
Trực quan hóa cơ chế quan sát hạ tầng eBPF Kernel thời gian thực bằng một sa bàn Three.js không gian 3D chất lượng cao:
1. **Phi thuyền Tiêm kích Trắng Sứ (White Ceramic Stealth Interceptor)**:
   - Toàn bộ thân vỏ đa diện và cánh xuôi được bọc giáp gốm trắng sứ sáng bóng (`#FFFFFF`), kết hợp đường gân viền Mint `#28E99F` phát quang và mép cánh titan tối màu `#242233`.
   - Buồng lái pha lê dạ quang Mint `#28E99F` phát sáng rực rỡ ở sống lưng máy bay.
   - Ống phóng pháo laser đầu cánh và mũi máy bay mạ titan tối có đầu nòng dạ quang.
   - Động cơ đẩy ion plasma ở đuôi phát chùm hạt xanh lơ lửng.
2. **Động Học Bay Lướt Tới Mục Tiêu Khi Bắn Laser (Dynamic Target-Surge)**:
   - Đầu máy bay xoay hướng ngắm chính xác về thẻ telemetry mục tiêu.
   - Khi tia laser khai hỏa, máy bay **chúi mũi và tăng tốc lao lướt tới phía trước khoảng 0.75 đơn vị áp sát mục tiêu**, lửa phản lực đuôi phụt mạnh gấp đôi.
   - Khi thẻ phân giải tan biến, máy bay hãm tốc và lùi êm ái về vị trí cân bằng trung tâm, sẵn sàng lướt tới mục tiêu tiếp theo.
3. **4 Thẻ Telemetry lơ lửng xung quanh**:
   - `CPU Saturation 88%` // `1.2ms P99` (Metric)
   - `socket_connect()` // `0% loss` (eBPF Log)
   - `Socket Pool Healthy` // `120 conns` (TCP Socket)
   - `Pod Eviction Prevented` // `graceful re-route OK` (K8s Event)
4. **Cơ chế Bắn Laser 3D & Tan biến Hạt (Particle Disintegration)**:
   - Chùm tia laser 3D Mint `#28E99F` phát quang cực đại nối trực tiếp từ mũi máy bay đang lao tới đến thẻ mục tiêu.
   - Khi laser chạm tới, thẻ sáng bừng lên với viền neon Mint, phát nổ thành chùm 100+ hạt lượng tử phân rã (Dissolve) vào không gian.
   - Chu trình lặp lại tuần hoàn 12 giây (3 giây cho mỗi thẻ).
5. **Căn chuẩn**: Chiều cao chuẩn hóa **`340px`**, đồng bộ tuyệt đối với các card 3D khác.

---

### 7.4. HỆ THỐNG 3D LÕI ĐA DIỆN DỰ BÁO BẰNG AI (THREE.JS - CARD SỐ 2)

#### A. Vị trí tệp:
- Linh kiện: [`src/pages/Features/components/AIPredictionCore3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/AIPredictionCore3D.jsx)
- Tích hợp tại: [`src/pages/Features/index.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/index.jsx) (Khung tính năng số 2: "Dự báo bằng AI").

#### B. Chức năng kỹ thuật:
- **Lõi Đa Diện 3D (AI Prediction Core)**: Khối đa tầng gồm nhân cầu phát quang Mint `#28E99F`, lồng bát diện `OctahedronGeometry` xoay trục Y/X, lưới nơ-ron `IcosahedronGeometry` và lồng bảo vệ `DodecahedronGeometry` wireframe.
- **4 Luồng Telemetry 3D (`CPU`, `MEMORY`, `NETWORK`, `LATENCY`)**: Chạy dọc theo các đường cong `CatmullRomCurve3` với hạt photon hội tụ vào tâm Core. Rê chuột để highlight và xem chỉ số chi tiết.
- **3 Nhánh Quỹ Đạo Tương Lai (NOW -> +30m)**:
  - Nhánh Ổn định (Mint `#28E99F` - Healthy).
  - Nhánh Suy giảm (Lam nhạt `#60A5FA` - Degraded).
  - Nhánh Nguy cơ cao (Hổ phách &rarr; Đỏ Anomaly - High Risk).
- **Điểm Anomaly & Holographic HUD**: Báo động đỏ phát xung nhịp tại mốc `~18 min`, hiển thị: `Memory Exhaustion | 87% confidence | ~18 min`.
- **Căn chuẩn**: Chiều cao `340px`, khớp với toàn bộ các card 3D khác.

---

### 7.5. MẠNG LƯỚI QUAN HỆ NHÂN QUẢ 3D PHÂN TÍCH NGUYÊN NHÂN GỐC RỄ (RCA) (THREE.JS - CARD SỐ 3)

#### A. Vị trí tệp:
- Linh kiện: [`src/pages/Features/components/RootCauseAnalysis3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/RootCauseAnalysis3D.jsx)
- Tích hợp tại: [`src/pages/Features/index.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/index.jsx) (Khung tính năng số 3: "Phân tích nguyên nhân gốc rễ (RCA)").

#### B. Chức năng kỹ thuật:
- **Cấu trúc Mạng Lưới Nhân Quả 3D (Layered 3D Causal Graph)**:
  - **Nút SỰ CỐ (Incident Node)**: Đặt ở đỉnh tọa độ `(0, 1.25, 0.3)` với khối bát diện Octahedron màu đỏ cảnh báo (`#EF4444`) và vòng sóng âm nhấp nháy: `SỰ CỐ: HTTP 5xx (API Gateway 502)`.
  - **Nút NGUYÊN NHÂN GỐC RỄ (Root Cause Node - Tâm điểm nổi bật nhất)**: Đặt ở tầng nguồn `(-0.7, -0.85, 0.6)` với nhân cầu Mint `#28E99F`, lồng đa diện kép xoay ngược chiều, vòng hào quang Hologram và đám bụi hạt lượng tử bay quanh. Đi kèm bảng Holographic HUD: `ROOT CAUSE IDENTIFIED // Memory Leak in auth-service // 94.6% Confidence`.
  - **Các Nút Triệu chứng Cơ sở Hạ tầng & Ứng dụng**: `Sập Pod (CrashLoopBackOff)`, `Độ trễ DB`, `Lỗi mạng TCP`, `Lưu lượng Ingress`, `CPU Saturation`, `Disk I/O` nằm ở các độ sâu Z khác nhau tạo chiều sâu lập thể.
- **Đường Dây Nhân Quả & Hạt Photon Di Chuyển**:
  - Chuỗi nhân quả chính (`Root Cause` &rarr; `Pod Crash` &rarr; `Incident`) được nối bằng đường sáng phát quang Mint/Đỏ, hạt photon năng lượng di chuyển liên tục dọc theo đường dây chỉ rõ hướng suy diễn nguyên nhân.
  - Các liên kết tương quan phụ mảnh hơn, có hạt trôi chậm.
- **Tương Tác Hover & Focus**:
  - Khi rê chuột vào card: Chuỗi nhân quả chính bừng sáng, các nút phụ mờ dần, camera lerp nhẹ nhàng tập trung vào Root Cause Node.
- **Căn chuẩn**: Chiều cao `340px`, căn thẳng hàng tuyệt đối với Card 1 và Card 2.

---

### 7.6. HỆ THỐNG 3D ROBOT TỰ PHỤC HỒI SỰ CỐ & DẤU CỘNG HEALTHY (THREE.JS - CARD SỐ 4)

#### A. Vị trí tệp:
- Linh kiện: [`src/pages/Features/components/SelfHealingDrone3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/SelfHealingDrone3D.jsx)
- Tích hợp tại: [`src/pages/Features/index.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/index.jsx) (Khung tính năng số 4: "Tự động phục hồi sự cố").

#### B. Chức năng kỹ thuật:
- **Mô Hình Robot Trắng Sứ Tự Sửa Chữa (White Ceramic Cyber-Bot with Mechanical Legs)**:
  - Toàn bộ giáp thân, đầu vòm, cánh tay và chân phủ lớp gốm trắng sứ sáng bóng (`White Ceramic #FFFFFF`), kết hợp các khớp cơ khí và khung hông hợp kim titan tối màu `#262436` tạo tương phản sắc nét.
  - **Cặp chân cơ khí khớp động (Bipedal Articulated Legs)**: Đầy đủ đùi bọc giáp trắng, khớp gối trục xoay titan, cẳng chân khí nén và bàn chân ổn định đứng vững chãi, thể thao trên mặt phẳng lưới 3D, có nhịp thở cơ học tự nhiên.
  - **Lõi phản ứng Arc-Reactor Mint `#28E99F`**: Phát quang rực rỡ ở ngực nhấp nháy theo chu kỳ nhịp đập, nổi bật trên nền thân trắng.
  - **Cánh tay cơ khí cầm mỏ hàn lượng tử (Quantum Welder)**: Tự hàn gắn, sửa chữa vi mạch trên chính ngực mình, phát ra tia hồ quang plasma xanh lấp lánh (PointLight nhấp nháy) và chùm tia lửa nano (Nanite Sparks).
  - Cánh tay trái cầm bộ cữ quét chẩn đoán (Diagnostic Scanner Tool) rà soát mã lỗi.
- **Hệ Thống Dấu "+" Healthy Bay Nổi & Tan Biến (Floating Healthy Crosses)**:
  - 42+ biểu tượng dấu cộng `+` 3D màu xanh Mint phát quang liên tục sinh ra từ vị trí robot đang tự sửa chữa, bay bổng xung quanh thân robot trắng, to dần, xoay nhẹ rồi mờ dần và tan biến (Dissolve) vào không gian.
- **Bảng Holographic HUD**:
  - `SELF-HEAL LEVEL 4 // Rolling Patch Applied // 99.98% HEALTHY // Recovered in 1.8s`.
- **Căn chuẩn**: Chiều cao `340px`, căn thẳng hàng tuyệt đối với Card 1, 2 và 3.

---

### 7.7. HỆ THỐNG 3D SÚNG TRẮNG BẮN KHIÊN NĂNG LƯỢNG & HIỆU ỨNG VĂNG ĐẠN (THREE.JS - CARD SỐ 6)

#### A. Vị trí tệp:
- Linh kiện: [`src/pages/Features/components/SecurityShield3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/SecurityShield3D.jsx)
- Tích hợp tại: [`src/pages/Features/index.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/index.jsx) (Khung tính năng số 6: "Bảo mật doanh nghiệp & RBAC").

#### B. Chức năng kỹ thuật:
- **Mô Hình Khẩu Súng Công Nghệ Cao Màu Trắng (White High-Tech Sentry Cannon)**:
  - Bố trí ở bên trái sa bàn 3D (`x ≈ -2.25`).
  - Toàn bộ thân giáp phủ chất liệu gốm **Trắng Sứ nguyên khối bóng bẩy** (`White Ceramic #FFFFFF` / `#F3F5F8`), tương phản với khung cơ khí và bệ đỡ titan xám đậm `#1A1829`, điểm xuyết các rãnh tản nhiệt năng lượng màu Mint `#28E99F`.
  - Cụm nòng kép công nghệ cao với đầu nòng titanium và vòng gia tốc phát sáng Neon Cyan `#00F0FF`.
  - **Hoạt ảnh giật lùi (Recoil Kickback)**: Mỗi khi khai hỏa từng phát đạn plasma, thân súng giật lùi đàn hồi (`recoilIntensity = 1.0`, hồi vị mượt mà), đồng thời đèn chớp nòng (Muzzle Flash PointLight) lóe sáng tức thì.
- **Khiên Năng Lượng Lực Từ RBAC (Aegis Forcefield Shield)**:
  - Bố trí ở bên phải (`x ≈ 1.85`), quay mặt cong đón nhận các phát đạn bay tới.
  - Cột phát từ trường (Generator Pylon) bọc sứ trắng và titan tối màu.
  - Mặt khiên cong dạng mạng lưới lục giác tổ ong (Hexagonal Honeycomb Mesh) phát quang màu Mint `#28E99F` và Cyan `#00F0FF`.
  - Lõi huy hiệu bảo mật Zero-Trust RBAC phát quang rực rỡ ở tâm khiên cùng đĩa triện xoay vòng liên tục.
  - **Hiệu ứng sóng xung kích va chạm (Shockwave Ripple Rings)**: Khi đạn chạm mặt khiên, vòng sóng năng lượng bung nở và tan biến, khiên hơi nhún lùi về sau để hấp thụ động năng rồi đàn hồi trở lại.
- **Dòng Đạn Plasma Bắn Liên Tục (Continuous Kinetic Plasma Stream)**:
  - Các viên đạn plasma động năng mang vệt hào quang bay liên tục với tốc độ cao từ nòng súng tới mặt khiên theo chu kỳ nhịp bắn 450 RPM.
- **Hệ Thống Hiệu Ứng Văng Đạn & Mảnh Lửa Nảy Bật (Kinetic Ricochet & Deflection Sparks)**:
  - Ngay tại điểm tiếp xúc trên mặt khiên (`x ≈ 1.15`), đạn bị chặn đứng hoàn toàn và kích hoạt 30+ hạt tia lửa và mảnh đạn động năng văng dội ngược lại sang bên trái theo hình nón phản xạ, lóe sáng rực rỡ, giảm tốc do lực cản rồi tan biến dần.
  - Đèn chớp va chạm (Impact PointLight) nhấp nháy mạnh mẽ.
- **Tối Giản Hóa & Khung Kỹ Thuật Chuẩn**:
  - Đã loại bỏ toàn bộ các khối chữ/text HUD overlay theo yêu cầu của người dùng để mang lại không gian trình diễn 3D thuần khiết, tập trung và không bị rối mắt.
  - Canvas Three.js được gắn vào container chuyên biệt (`position: absolute; inset: 0`), giải quyết triệt để lỗi tràn canvas xuống dưới danh sách tính năng.
  - Toàn bộ mô hình súng, đạn, tia lửa văng và khiên năng lượng được căn chỉnh gọn gàng, hoàn hảo bên trong khung đen kỹ thuật cao `340px`, thẳng hàng tuyệt đối với 5 card còn lại trong lưới 3x2.

---

### 7.8. HỆ THỐNG 3D BÀN TAY KIỂM SOÁT SỢI CHỈ & CÁC THẺ PHÊ DUYỆT (THREE.JS - CARD SỐ 5)

#### A. Vị trí tệp:
- Linh kiện: [`src/pages/Features/components/HumanInTheLoop3D.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/components/HumanInTheLoop3D.jsx)
- Tích hợp tại: [`src/pages/Features/index.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Features/index.jsx) (Khung tính năng số 5: "Con người tham gia kiểm soát").

#### B. Chức năng kỹ thuật:
- **Mô Hình Bàn Tay Con Người 3D (Human Puppeteer Hand)**:
  - Tọa lạc ở nửa trên sa bàn 3D (`y ≈ 1.15`), mu bàn tay hướng lên và các ngón tay cong gập tự nhiên hướng xuống như người làm chủ hệ thống.
  - **Tông màu da ấm tự nhiên, vàng nhẹ (`Warm Natural Skin #E5BD96`)**: Tạo cảm giác con người chân thực, nổi bật sắc nét trên nền đen kỹ thuật `#161522`.
  - Khớp ngón tay (ngón cái, trỏ, giữa, áp út, út) được phân khớp giải phẫu học cơ học. Mỗi đốt ngón tay có **vòng chỉ trắng buộc chặt quanh đốt** y hệt hình ảnh tham chiếu.
  - **Diễn hoạt nhích ngón tay tự nhiên (Organic Finger Twitching Kinematics)**: Các ngón tay luân phiên co nhẹ, nhích lên xuống với nhịp thở cơ học mượt mà theo hàm sóng sin.
- **Hệ Thống 4 Sợi Chỉ Điều Khiển Con Rối (Marionette Suspension Strings)**:
  - 4 sợi chỉ trắng bạc mảnh mai nối từ đầu/đốt ngón tay buông thẳng xuống 4 card con bên dưới.
  - Tọa độ 2 đầu sợi chỉ cập nhật động theo thời gian thực kết nối giữa đầu ngón tay đang nhích và móc treo trên đỉnh thẻ card.
- **4 Card Tính Năng AI Chờ Con Người Duyệt (Suspended Action Cards)**:
  - Card 1: `DRAIN NODE & EVICT PODS` &bull; `[PENDING HITL]` (Ngăn chặn sập pod hàng loạt)
  - Card 2: `ROLLBACK DB MIGRATION` &bull; `[APPROVAL REQ]` (Bảo toàn dữ liệu nghiệp vụ quan trọng)
  - Card 3: `SCALE CLUSTER DOWN 0` &bull; `[BLOCKED GATE]` (Bảo vệ chi phí & dịch vụ)
  - Card 4: `RESTART INGRESS ROUTE` &bull; `[DIFF READY]` (Kiểm tra diff lưu lượng mạng)
  - Khi ngón tay nhích kéo dây, card tương ứng sẽ nâng bổng nhẹ lên theo lực căng dây, viền card bừng sáng màu Mint `#28E99F`, Hổ phách `#F59E0B` hoặc Đỏ cảnh báo `#EF4444` và đung đưa tự nhiên.
- **Căn chuẩn**: Chiều cao chuẩn hóa `340px`, căn thẳng hàng tuyệt đối với 5 card còn lại trong lưới 3x2.

---

## 8. HỆ THỐNG DESIGN TOKENS & NGUYÊN TẮC BLUEPRINT GREPTILE

Toàn bộ hệ thống tuân thủ bảng mã tham chiếu được chuẩn hóa trong [`src/styles/design-tokens.css`](file:///d:/AISelfHealing/frontend/src/styles/design-tokens.css):

### Bảng Mã Màu Cốt Lõi:
| Tên Biến Token | Giá trị Mã Màu | Ý nghĩa & Vị trí Áp dụng |
| :--- | :--- | :--- |
| `--color-canvas` / `--bg-canvas` | `#EEEEEE` | Nền canvas bản vẽ kỹ thuật toàn trang |
| `--color-surface` / `--bg-surface` | `#FFFFFF` | Nền thẻ card, form đăng nhập sạch, cửa sổ nổi |
| `--color-primary` / `--bg-navy` | `#3D3B4F` | Navy Greptile đặc trưng dùng cho Header, Nút bấm, Tiêu đề cửa sổ |
| `--color-accent` | `#28E99F` | Mint điện tử rực rỡ dùng cho Trạng thái tốt, Viền active, Nút nổi bật |
| `--color-accent-decorative` | `#ECFFA3` | Vàng chanh nhạt bổ trợ cho các điểm nhấn trang trí |
| `--color-ink` | `#000000` | Đen tuyền dùng cho tiêu đề chính (Main Display Headings) |
| `--color-hairline` / `--border-default` | `#D6D6D6` | Đường viền tóc 1px sắc nét ngăn cách các khối |
| `--border-dashed` | `1px dashed rgba(61, 59, 79, 0.16)` | Đường kẻ gióng kỹ thuật Blueprint |

### Quy tắc Hình học & Bố cục:
- **`--radius-*`**: Mọi giá trị bo góc đều cố định bằng **`0px`**. Không sử dụng bo tròn (Rounded corners) nhằm giữ đúng tính chất cơ khí chính xác.
- **`--content-max-width`**: Cố định **`1400px`** cho màn hình lớn.
- **Corner Crosshairs**: Bốn góc của mọi container lớn (Header khi cuộn, Hero Section, Khung 3D Onboarding) luôn có 4 ký tự chữ thập `+` được định vị tuyệt đối tại các góc biên (`top: -7px`, `left: -6px`,...) tạo chất bản vẽ CAD công nghiệp.

---

## 9. HƯỚNG DẪN MỞ RỘNG VÀ BẢO TRÌ MÃ NGUỒN

1. **Khi thêm một trang mới**:
   - Khởi tạo thư mục mới trong `src/pages/<TênTrang>/index.jsx`.
   - Khai báo đường dẫn trong `src/routes/index.jsx` tại đối tượng `ROUTES`.
   - Bọc trang bằng layout phù hợp (`PublicLayout`, `AuthLayout` hoặc `DocsLayout`).
2. **Khi điều chỉnh tốc độ hoặc hiệu ứng 3D**:
   - Chỉnh sửa các góc tilt `tiltX, tiltY` và hệ số nhân chuột tại `HeroSection.jsx` hoặc `OnboardingSequence3D.jsx`.
   - Chỉnh sửa thời gian chu kỳ các bước tại mảng timer trong `useEffect` của `OnboardingSequence3D.jsx`.
3. **Khi thay đổi giao diện theo thương hiệu**:
   - Chỉ cần thay đổi các biến màu tương ứng trong `src/styles/design-tokens.css`, toàn bộ ứng dụng từ nút bấm, đường kẻ cho đến bảng điều khiển 3D sẽ tự động cập nhật đồng bộ.

---

## 10. HỆ THỐNG DASHBOARD VẬN HÀNH CALM OPERATIONS (WHITE-FIRST)

Bảng điều khiển xác thực (Authenticated Dashboard) được xây dựng theo phong cách **White-First Calm Operations**, ưu tiên tính trực quan, tĩnh lặng, khả năng đọc cao và quy trình vận hành Kubernetes thực tế cho các SME.

### 10.1. Cấu Trúc Linh Kiện:
- **Design Tokens**: [`frontend/src/styles/dashboard-tokens.css`](file:///d:/AISelfHealing/frontend/src/styles/dashboard-tokens.css) (Emerald `#059669`, Mint `#ECFDF5`, Slate navy `#0F172A`, light gray `#F8FAFC`, hairline `#E2E8F0`).
- **Context Quản Trị**: [`frontend/src/pages/Dashboard/context/DashboardContext.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Dashboard/context/DashboardContext.jsx) (Org, Env, Role RBAC: SME Owner / DevOps / Viewer, Agent Connected Toggle, Auto-refresh 30s, Notifications).
- **Layout & Navigation**:
  - Layout: [`frontend/src/layouts/DashboardLayout.jsx`](file:///d:/AISelfHealing/frontend/src/layouts/DashboardLayout.jsx)
  - Sidebar 7 nhóm: [`frontend/src/components/dashboard/Sidebar.jsx`](file:///d:/AISelfHealing/frontend/src/components/dashboard/Sidebar.jsx) (OVERVIEW, ORGANIZATION, INFRASTRUCTURE & AGENT, MONITORING, AI & INCIDENTS, SELF-HEALING, SYSTEM).
  - Header: [`frontend/src/components/dashboard/TopHeader.jsx`](file:///d:/AISelfHealing/frontend/src/components/dashboard/TopHeader.jsx) (Chọn Org, Env, Role Switcher Demo, Refresh/Auto-refresh, Notifications, User Menu).
- **Trang 1 Overview**: [`frontend/src/pages/Dashboard/Overview/index.jsx`](file:///d:/AISelfHealing/frontend/src/pages/Dashboard/Overview/index.jsx) (Page Header, System Health Card, 8 Metric Cards, Biểu đồ tài nguyên CPU/RAM, AI Prediction, Incident Summary, Self-Healing Summary, Empty State).
- **Tài liệu chi tiết**: [`docs/DASHBOARD_ARCHITECTURE.md`](file:///d:/AISelfHealing/docs/DASHBOARD_ARCHITECTURE.md).

---
*Tài liệu được biên soạn và chuẩn hóa bởi AI Senior Architect của hệ thống SelfHeal Systems.*
