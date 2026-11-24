# UI Component Specifications — AI-Driven Proactive Self-Healing Infrastructure for SMEs

**Audit Date:** November 22, 2026  
**Format Standard:** Official User Interface Design Document (`Table X. [Page Name]` with `No. | Field Name | Type | Require | Target`) matching `Figure 1`–`Figure 112` in [UI_SCREENSHOT_CHECKLIST.md](file:///d:/AISelfHealing/docs/ui-audit/UI_SCREENSHOT_CHECKLIST.md).  
**Verification Policy:** Every component, label, placeholder, color token, validation rule, API endpoint, and mock tag below is verified directly from `Frontend/src/`. Visual properties absent from source are marked `Not specified`.

---

## 2.1 Authentication & Public Landing

### 2.1.1 Login (`/login`, `/get-started`)
- **Role:** Public / Unauthenticated Redirect | **Layout:** `AuthLayout` | **Source:** `pages/Login/index.jsx`, `components/auth/AuthShared.jsx`, `pages/Login/components/OnboardingSequence3D.jsx` | **Status:** Implemented (Real API + Google OAuth2 + 2FA) | **Figures:** Figure 1, Figure 2

**Table 1. Login**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | SelfHeal Logo | Image | `<Logo size={46}>` (`Logo.svg`); Left-aligned above heading; Clickable to `/` (left pane) | Identifies the SelfHeal platform and provides navigation back to home. |
| 2 | Title `"Đăng nhập tài khoản"` | Text | Font: `Anybody`, `1.85rem`, weight `600`, color `#2A2A2A` | Identifies the authentication entry screen. |
| 3 | Register Link `"Đăng ký"` | Link | Inline after `"Chưa có tài khoản?"`; Color `#3D3B4F`, hover `#2563EB` | Navigates to `/register` to create a new account. |
| 4 | Email / Username Input (`#login-email`) | Input Field | Label `"Email công việc hoặc Tên tài khoản"`; `type="text"`, required; Placeholder `"ten@congty.com"`; Radius `6px`, border `1px solid #D1D5DB`, padding `11px 14px` | Captures user email or username for authentication. |
| 5 | Password Input (`#login-password`) | Input Field | Label `"Mật khẩu"`; `type="password"`, masked, required; Placeholder `"••••••••••••"`; No show/hide toggle | Captures user password securely. |
| 6 | Forgot Password Link `"Quên mật khẩu?"` | Link | Inline right of Password label; Color `#3D3B4F`, hover `#2563EB` | Navigates to `/forgot-password` recovery flow. |
| 7 | Login Button `"Đăng nhập"` | Button | Height `44px`, bg `#22E59B` (hover `#1BD48E`), text `#111827`, radius `6px`, `ArrowRight` icon; Loading state `"Đang đăng nhập..."` + `Loader2` | Submits credentials to `POST /api/v1/auth/login`, fetches profile, navigates to `/portal` (or transitions to Step 2 if `require_2fa`). |
| 8 | Google Auth Button `"Đăng nhập với Google"` | Button | Bg `#F3F4F6` (hover `#E5E7EB`), 4-color Google SVG icon; Disabled during loading | Initiates Google OAuth2 popup (`POST /api/v1/auth/google`) and signs user in. |
| 9 | Auth Legal Footer | Link Group | Text `"Bằng việc tiếp tục, bạn đồng ý với..."`; Links `/terms` & `/privacy` | Provides access to Terms of Service and Privacy Policy. |
| 10 | 3D Onboarding Sequence (`OnboardingSequence3D`) | Interactive Container | Left pane (`flex: 1.2`, `#EEEEEE`, hidden `<=840px`); 7 clickable `HexagonStepNode` buttons (`01`–`07`), Pause/Play toggle, `StepDetailCard` HUD, `MiniDashboardBloom` phase (static demo) | Educates new users on the 7-step Kubernetes onboarding workflow interactively. |
| 11 | 2FA Header `"Xác thực Hai Yếu Tố (2FA)"` | Container / Text | Shown when `isTwoFactorStep=true`; Circular `#ECFDF5` badge with `ShieldCheck` `#059669`; Inline red error box `#FEF2F2`/`#FCA5A5` | Guides user to enter TOTP or backup code when 2FA is enabled. |
| 12 | 2FA OTP Input (`#login-2fa-otp`) | Input Field | `type="text"`, `autoFocus`, required, `maxLength={8}`, centered `1.25rem` bold, `letterSpacing: 3px`, placeholder `"123456"` | Captures 6-digit authenticator code or backup code (strips whitespace). |
| 13 | Confirm 2FA Button `"Xác Nhận Đăng Nhập"` | Button | Primary navy `var(--color-primary)` (`#3D3B4F`), loading spinner | Submits OTP to `POST /api/v1/auth/login/2fa` and completes login. |
| 14 | Back to Login Button `"Quay lại đăng nhập"` | Button | `ArrowLeft` icon; Secondary link style | Exits Step 2 and returns to credentials form. |

---

### 2.1.2 Register (`/register`)
- **Role:** Public | **Layout:** `AuthLayout` | **Source:** `pages/Register/index.jsx` | **Status:** Implemented (Real API; GSI script defect on direct load; resend catch fakes success) | **Figures:** Figure 3, Figure 4

**Table 2. Register**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Title `"Tạo tài khoản mới"` & Login Link | Text / Link | `Anybody` `1.85rem` `#2A2A2A`; Subtext `"Đã có tài khoản? Đăng nhập"` -> `/login`; Inline red submit error box | Identifies registration page and links existing users to `/login`. |
| 2 | Full Name Input (`#register-name`) | Input Field | Label `"Họ và tên"`; Required, min `2` chars; Placeholder `"Nguyễn Văn A"`; Red `#EF4444` border on error | Captures the user's full display name. |
| 3 | Work Email Input (`#register-email`) | Input Field | Label `"Email công việc"`; `type="email"`, regex validated; Placeholder `"ten@congty.com"` | Captures unique work email for account creation and OTP delivery. |
| 4 | Password Input (`#register-password`) | Input Field | Masked password with `Eye`/`EyeOff` toggle; Required, `>=8` chars, `strength.score >= 2` | Captures account password with visibility toggle. |
| 5 | Password Strength Meter | Progress Bar | 3 segmented bars: `"Mật khẩu yếu"` (`#EF4444`), `"Mật khẩu trung bình"` (`#F59E0B`), `"Mật khẩu mạnh"` (`#10B981`) | Provides real-time password complexity feedback. |
| 6 | Confirm Password Input (`#register-confirm-password`) | Input Field | Masked with `Eye`/`EyeOff` toggle; Must match password | Prevents password entry typos. |
| 7 | Terms Checkbox | Checkbox | Mandatory; Label `"Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật"` (links `/terms`, `/privacy`) | Confirms legal agreement before registration. |
| 8 | Submit Button `"Bắt đầu miễn phí"` | Button | Bg `#22E59B`, height `44px`, `ArrowRight`; Loading `"Đang tạo tài khoản..."` | Calls `POST /api/v1/auth/register` and transitions to Step 2 OTP card. |
| 9 | Google Signup Button `"Đăng ký với Google"` | Button | `GoogleAuthButton`; *Defect: GSI script not injected on `/register` mount* | Triggers Google OAuth2 signup (`POST /api/v1/auth/google`). |
| 10 | OTP Card Header & Email Pill | Container / Text | Shown when `submitted=true`; Bordered `#FFFFFF` card (`radius: 8px`), `KeyRound` `#2563EB`/`#EFF6FF`, title `"Nhập mã xác thực OTP"`, displays `registeredEmail` | Confirms email address receiving the 6-digit verification code. |
| 11 | 6-Digit OTP Input Boxes | Input Group | 6 numeric inputs (`44×50px`, `1.4rem` mono, `inputMode="numeric"`, active `#2563EB` / error `#EF4444`); Supports 6-digit paste, keyboard arrows, auto-submit on 6th digit | Captures 6-digit email verification code. |
| 12 | Confirm OTP Button `"Xác nhận mã OTP"` | Button | Active `#111827`, disabled `#9CA3AF` until 6 digits; States: verifying / `"Đã xác thực thành công"` | Submits code to `POST /api/v1/auth/verify-email` and redirects to `/portal` after 900ms. |
| 13 | Resend OTP Cooldown Footer | Text / Button | 60s countdown (`"Gửi lại sau {n}s"`) -> clickable `"Gửi lại mã OTP"` (`POST /api/v1/auth/send-verification`) | Requests a new email verification code. |
| 14 | Change Email Button `"Đổi địa chỉ email khác"` | Button | `ArrowLeft` icon | Returns to Step 1 form to correct registration details. |

---

### 2.1.3 Forgot Password (`/forgot-password`)
- **Role:** Public | **Layout:** `AuthLayout` | **Source:** `pages/ForgotPassword/index.jsx` | **Status:** Implemented (Real API; resend cooldown timer bug) | **Figures:** Figure 5, Figure 6

**Table 3. Forgot Password**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Title `"Quên mật khẩu?"` | Text | `Anybody` `1.85rem` `#2A2A2A` + instructional subtitle | Identifies password recovery initiation screen. |
| 2 | Work Email Input (`#forgot-email`) | Input Field | Required, regex validated; Placeholder `"ten@congty.com"`; Inline validation/API error | Captures account email to receive reset link. |
| 3 | Submit Button `"Gửi liên kết khôi phục"` | Button | Bg `#22E59B`, `ArrowRight`; Loading `"Đang gửi liên kết..."` | Calls `POST /api/v1/auth/forgot-password` and enters Sent state. |
| 4 | Back to Login Link `"Quay lại đăng nhập"` | Link | Secondary link | Navigates back to `/login`. |
| 5 | Sent Confirmation Header | Container / Text | Circular `rgba(34,229,155,0.16)` badge with `Mail` `#059669`; Title `"Kiểm tra hộp thư của bạn"` | Confirms reset email dispatch. |
| 6 | Echoed Email Pill & Expiry Notice | Text / Badge | `#F3F4F6` email pill + 15-minute link expiry instruction | Clarifies destination inbox and validity window. |
| 7 | Resend Button & Back Link | Button / Link | `RefreshCw` + `"Gửi lại email sau {n}s"` (*Defect: stuck at 30s — missing interval timer*) + `/login` link | Intended to resend reset email or return to sign-in. |

---

### 2.1.4 Reset Password (`/reset-password?token=...`)
- **Role:** Public (Token-gated) | **Layout:** `AuthLayout` | **Source:** `pages/ResetPassword/index.jsx` | **Status:** Implemented (Real API; English-only UI) | **Figures:** Figure 7, Figure 8

**Table 4. Reset Password**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Card Header & Title `"Reset your password"` | Container / Text | `#FFFFFF` card, `1px solid #E2E8F0`, `radius: 8px`, padding `36px 32px`, `<Logo size={52}>` | Identifies password reset form for valid tokens (`length >= 16`). |
| 2 | New Password Input (`#new-password`) & Strength Bar | Input Field / Progress | Masked with `Eye`/`EyeOff` toggle; 3-bar strength meter (`Weak`/`Medium`/`Strong`) | Captures new password and previews strength. |
| 3 | Confirm New Password (`#confirm-new-password`) | Input Field | Masked with `Eye`/`EyeOff` toggle; Must match new password | Verifies password entry accuracy. |
| 4 | Password Requirements Checklist | Info Block | `#F9FAFB` box; 4 live items (`>=8 chars`, `1 number`, `1 uppercase`, `1 special symbol`) with `#10B981` met indicators | Communicates mandatory password complexity rules in real time. |
| 5 | Submit Button `"Reset Password"` | Button | Bg `#28E99F`, height `44px`, `radius: 4px`; Loading `"Updating password..."` (`#A7F3D0`); Inline `role="alert"` error box | Submits `{ token, new_password }` to `POST /api/v1/auth/reset-password`. |
| 6 | Expired / Invalid Token Alert | Container | Shown if `!token`, `token.length < 16`, or API expired error; `AlertCircle` `#E11D48`/`#FFF1F2`, title `"Reset Link Expired or Invalid"` | Notifies user that recovery link cannot be used. |
| 7 | Request New Link Button | Button | Navy button `"Request New Reset Link"` | Navigates to `/forgot-password`. |
| 8 | Success Card & Sign-In Button | Container / Button | `CheckCircle2` `#059669`, `"Password Reset Successfully"`, mint button `"Return to Sign In"` | Confirms password update and navigates to `/login`. |

---

### 2.1.5 Public Layout Shell (Header, Resources Mega Menu, Mobile Drawer & Footer)
- **Role:** Public (Guest & Authenticated) | **Layout:** `PublicLayout` | **Source:** `layouts/PublicLayout.jsx`, `components/layout/{Header,Footer,ResourcesMegaMenu,MobileNavigation}.jsx` | **Status:** Implemented (Language switcher UI-only) | **Figures:** Figure 9

**Table 5. Public Layout Shell**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Brand Logo | Link / Image | `<Logo size={40\|34}>`; Sticky header `64px` (top `#EEEEEE`) -> `56px` (scrolled glass `rgba(238,238,238,0.92)` with 4 `+` crosshairs) | Returns user to `/` homepage. |
| 2 | Center Navigation Links | Link Group | `Space Mono` `0.8rem` uppercase `#555368`, active/hover `#000000`: `HƯỚNG DẪN` (`/guide`), `TÍNH NĂNG` (`/features`), `GIỚI THIỆU` (`/about`), `TÀI LIỆU` (button toggling Mega Menu) | Navigates across primary public sections. |
| 3 | Resources Mega Menu (`#resources-mega-menu`) | Dropdown / Grid | 3×2 grid (`#EEEEEE`, dashed border, 2-col `<=900px`): `/guide`, `/terms`, `/contact`, `/security`, `/privacy`, `/about`; Closes on `Escape` or outside click | Provides direct access to documentation, legal, security, and contact pages. |
| 4 | Language Switcher (`VI`/`EN`) | Dropdown | `Globe` + `VI`/`EN` + `ChevronDown`; Options `Tiếng Việt`, `English`; *UI-only local state, no global i18n* | Toggles displayed language indicator (non-persistent). |
| 5 | Auth CTA Group / Authenticated Capsule | Button Group / Dropdown | Guest: Dual hex buttons `"Đăng nhập"` (`#3D3B4F`) & `"Đăng ký"` (`#28E99F`). Authenticated: `"Bảng điều khiển"` (`/dashboard`) + User dropdown (name, email, role badge, `"Vào Bảng điều khiển"`, `"Đăng xuất"` calling `POST /auth/logout`) | Provides sign-in/sign-up for guests or workspace access and logout for signed-in users. |
| 6 | Mobile Menu Toggle & Drawer | Button / Drawer | Shown at `<=900px`; Fullscreen `z-index: 9999` drawer with Logo, `X` close, nav links, expandable `Tài liệu` accordion (6 links incl. GitHub), and auth CTAs | Enables full public navigation on tablet and mobile devices. |
| 7 | 4-Column Blueprint Footer | Footer Container | Bg `#EDEDF0` with 16px dot matrix; CAD SVG logo + 3 link columns (`NỀN TẢNG`, `TÀI NGUYÊN`, `HỖ TRỢ` + GitHub/LinkedIn) + copyright bar; Stacks at `<=1024px` | Provides site-wide navigation, legal links, and external community links. |

---

### 2.1.6 Home / Landing Page (`/`)
- **Role:** Public | **Layout:** `PublicLayout` (with blueprint gutters) | **Source:** `pages/Home/*` | **Status:** Implemented (Static Marketing) | **Figures:** Figure 10

**Table 6. Home / Landing Page**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Hero Title & Dual-Hex CTAs (`#overview`) | Text / Button Group | H1 `"AI Self Healing"` (`Anybody` `90px` `#3D3B4F`, responsive `<=768px`), subtitle, hex buttons `"Bắt đầu ngay"` (`/login`) & `"Xem hướng dẫn"` (`/guide`), sublink `"onboard with your agent →"` (`/guide`) | Communicates core product value and drives users to login or documentation. |
| 2 | `ChickenMascot` Hero Visual | Animated SVG | Right column (`max-width: 620px`); GSAP-rigged vector rooster pecking 4 `#28E99F` grains; Respects `reducedMotion` | Reinforces brand personality on the landing hero. |
| 3 | Social Proof Tool Grid & Quote | Container | 4-cell logo bar (`Kubernetes`, `Docker`, `Prometheus`, `Grafana`) + dashed blockquote + CTA `"Khám phá kiến trúc hệ thống"` (`/features`) | Highlights ecosystem compatibility and links to technical features. |
| 4 | Agent Connection Strip (`[ AGENT ]`) | Banner | Dark slate `#434154` band with `#C5FFD6` text, scanline track, CTA `"Tìm hiểu thêm"` (`/guide`) | Introduces the lightweight Kubernetes SelfHeal Agent bridge. |
| 5 | How It Works Video Cards (`#monitoring`, `#prediction`, `#self-healing`) | Video Cards | 3 hatched cards with muted looping `<video>` (`playbackRate=1.75`) for Steps 1–3 (`Thu thập`, `Dự báo AI`, `Tự động phục hồi`) | Visually demonstrates the 3-stage proactive protection pipeline. |
| 6 | Adaptation & Learning Cards | Mockup Cards | `#EDEDF0` band; 2 static UI mockup cards (`Quy Tắc Tùy Chỉnh` & `Học Tập & Ghi Nhớ`) with CTAs to `/guide` | Explains policy customization and post-incident learning concepts. |
| 7 | 4-Step Onboarding Blueprint | Grid Container | Neon lime `#E4FF6B` pill + 4-column workflow cards (`01`–`04`) + CTA `"Bắt đầu ngay"` (`/login`) | Previews the SME onboarding and team governance journey. |
| 8 | Controlled Self-Healing Stage (`#human-approval`) | Animated Stage | Looping GSAP sprite storyboard (`HealBot` + `Human Operator SRE`) showing `CrashLoopBackOff` alert -> `Restart Pod?` -> `Action Approved By SRE` + CTA `/guide` | Demonstrates Human-in-the-Loop (HITL) approval governance. |
| 9 | FAQ Accordion (`#faq`) | Accordion | 6 expandable Q&A items (single-open toggle) + footer link `"Liên hệ với chúng tôi."` (routes to `/guide`) | Answers common SME Kubernetes onboarding and safety questions. |
| 10 | Connect Cluster CTA & `HealBotAnimation` | Banner / Animation | Dark `#3D3B4F` band, `#ECFFA3` crosshairs, dual CTAs (`/guide`, `/login`), 5-phase pixel-art egg-to-guardian sprite cycle | Final conversion call-to-action at page footer. |

---

### 2.1.7 Features Page (`/features`)
- **Role:** Public | **Layout:** `PublicLayout` (Full-bleed) | **Source:** `pages/Features/index.jsx`, `BlueprintWireframeCard.jsx` | **Status:** Implemented (Static + Interactive 2D Canvases) | **Figures:** Figure 11

**Table 7. Features & Self-Healing Lifecycle**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Hero Header | Text | H1 `"Năng Lực Tính Năng & Vòng Lặp Tự Phục Hồi"` (`clamp(2.75rem, 6vw, 4.5rem)`) + subtitle | Introduces the 6-pillar autonomous MAPE-K lifecycle. |
| 2 | Tractor-Feed Sprocket Sheet | Canvas Container | Full-bleed 2D canvas drawing 24px grid & side sprocket holes (`width > 640px`), content `max-width: 1200px` | Frames technical product documentation in blueprint aesthetic. |
| 3 | 6 Lifecycle Rows (`#step-detect` .. `#step-audit`) | Content Blocks | Alternating 2-col rows (stacks `<=960px`); Colored badges (`#059669`, `#D97706`, `#DC2626`, `#4F46E5`, `#0284C7`, `#0D9488`), H3, description, 3 `CheckCircle2` bullets | Details Detect, Predict, Diagnose, Verify (HITL), Recover, and Audit stages. |
| 4 | Interactive `BlueprintWireframeCard` Canvases | Canvas (×6) | Height `320px` (`280px` mobile), hatched `#B8B8C4` border, pointer-move parallax 2D visualizations (`vortex`, `timeseries`, `causal-dag`, `yaml-diff-gate`, `rolling-switchboard`, `audit-ledger`) | Provides interactive visual metaphors for each self-healing pillar. |
| 5 | Spiral Notebook Final CTA Card | Card / Buttons | 2D spiral-bound canvas card with buttons `"Khám phá SelfHeal"` (`/login`) & `"Liên hệ Đội ngũ"` (`/contact`) | Converts readers to sign in or contact the team. |

---

### 2.1.8 SRE Operations Handbook (`/guide`, `/docs`)
- **Role:** Public | **Layout:** `PublicLayout` (Full-bleed) | **Source:** `pages/Guide/*`, `components/common/{CodeBlock,Breadcrumb}.jsx` | **Status:** Implemented (Static Docs) | **Figures:** Figure 12

**Table 8. SRE Operations Handbook (Guide)**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Breadcrumb & Hero | Breadcrumb / Text | `"Trang chủ > Sổ tay Vận hành Kỹ sư"`; H1 `"Sổ Tay Vận Hành Hạ Tầng SelfHeal"` | Orients user within public documentation. |
| 2 | Sticky TOC Sidebar & Reading Progress | Navigation / Progress | Desktop `310px` sticky (`top: 96px`); `0%–100%` mint `#28E99F` reading progress bar; 11 chapter tabs (`01`–`11`) synced via `useScrollSpy` | Tracks reading progress and jumps smoothly to any chapter (`#sec-01`–`#sec-11`). |
| 3 | Chapter `SectionTitleCanvas` | Canvas Header | Ruler ticks + `SEC-INDEX // {nn}` per chapter across 11 operational runbook chapters | Visually delineates handbook sections. |
| 4 | `NotebookNoticeCard` | Callout Card | Spiral-ring canvas callout; Warning (`#92400E` + drawn pencil) & Tip (`#065F46`) variants | Highlights zero-inbound-port, RBAC least-privilege, and dual-approval safety notices. |
| 5 | `CodeBlock` with Copy Button | Code Viewer | `#2A2A2A` dark terminal (`#F7F7F8` mono) for Helm v3 install & `kubectl` verification; `"Sao chép"` / `"Đã sao chép"` (2s) button | Allows engineers to copy verified deployment and verification commands. |
| 6 | Mobile Collapsible TOC Bar | Accordion | Shown at `<=1024px`, sticky `top: 60px`; Toggle `"Mục lục sổ tay (11 chương)"` + 11 chapter jump buttons | Enables chapter navigation on tablet and mobile viewports. |

---

### 2.1.9 About SelfHeal (`/about`)
- **Role:** Public | **Layout:** `PublicLayout` (Full-bleed) | **Source:** `pages/About/index.jsx` | **Status:** Implemented (Static Editorial) | **Figures:** Figure 13

**Table 9. About SelfHeal**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Hero Header | Text | H1 `"Về Dự án SelfHeal"` (`clamp(2.75rem, 6vw, 4.5rem)`) + subtitle | Introduces the project vision and SME mission. |
| 2 | 7 Editorial Sections on Sprocket Sheet | Text Sections | `max-width: 860px` container on 24px grid canvas (`story`, `problem`, `mission`, `how-it-works`, `principles`, `technology`, `team`); GSAP fade-in | Explains the problem statement, architecture philosophy, and engineering team. |
| 3 | Spiral Notebook CTA Card | Card / Buttons | Buttons `"Khám phá SelfHeal"` (`/login`) & `"Liên hệ Đội ngũ"` (`/contact`) | Directs visitors to sign in or reach the team. |

---

### 2.1.10 Contact Consultation Page (`/contact`)
- **Role:** Public | **Layout:** `PublicLayout` | **Source:** `pages/Contact/ContactPage.jsx`, `PixelWaveCanvas.jsx` | **Status:** Partial (Simulated 400ms `setTimeout` submit — no backend API) | **Figures:** Figure 14, Figure 15

**Table 10. Contact Consultation Page**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | `PixelWaveCanvas` Hero Banner | Banner / Canvas | Height `300px` (`260px` `<=640px`), bg `#E6E6E5`, pastel mint animated square wave, H1 `"Liên Hệ Tư Vấn"` | Sets visual identity for sales/consultation inquiries. |
| 2 | First & Last Name Inputs (`#firstName`, `#lastName`) | Input Fields | 2-col row (1-col `<=640px`), required; `User` icon; Placeholders `"Tú"` & `"Ngô"` | Captures inquirer's name. |
| 3 | Work Email (`#workEmail`) & Phone (`#phoneNumber`) | Input Fields | Email required (`@` & `.` checked); Phone optional (`+84 912 345 678`); Bg `#E6E6E5`, border `#BAC0CB` | Captures business contact information. |
| 4 | Company Name (`#companyName`) & Team Size (`#teamSize`) | Input / Dropdown | Company required; Team Size `<select>` (`1-10`, `11-50`, `51-200`, `201-500`, `Trên 500 kỹ sư`) | Captures organization size context. |
| 5 | Support Notes (`#notes`) | Text Area | 4 rows, optional; Label `"BẠN CẦN CHÚNG TÔI HỖ TRỢ ĐIỀU GÌ TRƯỚC CUỘC HẸN?"` | Collects pre-meeting infrastructure questions. |
| 6 | Submit Button `"Gửi Yêu Cầu Tư Vấn"` | Button | Double-hex clip-path `#3D3B4F`/`#FFFFFF` (full-width `<=640px`); Loading `"Đang gửi..."`; Inline `#FEE2E2` error banner | Validates form and triggers simulated 400ms submission (*no backend API*). |
| 7 | Confirmation Card `"Cảm ơn bạn!"` | Container | `CheckCircle2` `#059669` (`48px`), echoes `formData.workEmail` | Confirms inquiry receipt visually. |
| 8 | Reset Button `"Gửi yêu cầu khác"` | Button | Secondary button | Clears submission state to enter another inquiry. |

---

### 2.1.11 Legal & Security Pages (`/terms`, `/privacy`, `/security`, `/security-practices`)
- **Role:** Public | **Layout:** `PublicLayout` (Full-bleed) | **Source:** `pages/Terms/index.jsx`, `pages/Privacy/index.jsx`, `pages/SecurityPractices/index.jsx` | **Status:** Implemented (Static Legal) | **Figures:** Figure 16

**Table 11. Legal & Security Pages**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Hero Title & Last Updated Stamp | Text | H1 `"Điều Khoản Dịch Vụ & Sử Dụng Hệ Thống"` / `"Chính sách Bảo mật & Quyền riêng tư"` / `"Thực tiễn & Chính sách Bảo mật"`; Stamp `"Last updated: November 14, 2026"` | Identifies legal/security policy document and effective date. |
| 2 | 8 Structured Policy Sections | Text Sections | `max-width: 860px` on 24px sprocket-hole canvas; Anchor IDs (`#terms-*`, `#privacy-*`, `#security-*`); GSAP fade-in | Publishes binding service terms, data privacy rules, and security practices (agent RBAC, encryption, HITL). |
| 3 | Highlight Callout & Contact Address | Info Block / Link | Terms: `#00C853` left-border callout + clickable `mailto:legal@selfheal.dev` (`#008744`). Privacy & Security: non-clickable monospace `<span>` badges (`privacy@selfheal.dev`, `security@selfheal.dev`) | Highlights key clauses and displays legal/security contact channels. |

---

## 2.2 Onboarding Wizard (Authenticated First-Time Setup)

### 2.2.1 Step 1 — Organization Setup (`/onboarding`, `/onboarding/organization`)
- **Role:** All Authenticated | **Layout:** `OnboardingLayout` (`currentStep=1`) | **Source:** `pages/Onboarding/OrganizationStep.jsx`, `components/onboarding/{OnboardingHeader,OnboardingProgress,OrganizationForm}.jsx` | **Status:** Hybrid (Real slug check API; DB persist deferred to Step 4) | **Figures:** Figure 17

**Table 12. Onboarding Step 1 — Organization Setup**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | `OnboardingHeader` | Header Bar | Sticky `60px`, `#FFFFFF`, dashed bottom border; `<Logo size={36}>`, `"ONBOARDING WORKSPACE"` badge, Help/Docs links (`/guide`), User Profile popover (`Đăng xuất`) | Provides workspace context, quick docs access, and session logout. |
| 2 | `OnboardingProgress` Stepper & Live Context Box | Sidebar Stepper | Desktop `320px` sticky (mobile compact bar `<=1024px`); 5 vertical steps (`01`–`05`) + Live Context summary (`Tổ chức`, `Môi trường`, `Cụm K8s`) | Tracks setup progress and previews accumulated configuration. |
| 3 | `StepHeader` | Header | Badge `"STEP 01/05 // KHÔNG GIAN TỔ CHỨC"` (`#28E99F` border), H1 `"Tạo tổ chức của bạn"` (`clamp(1.75rem,3vw,2.25rem)` bold) | Identifies Step 1 objective. |
| 4 | Organization Name (`#org-name`) | Input Field | Required, 2–150 chars; Height `44px`; Placeholder `"Ví dụ: Công ty TNHH Giải pháp Đám mây Acme"` | Captures organization display name and auto-generates ASCII kebab slug. |
| 5 | Organization Slug (`#org-slug`) | Input Field | Required, monospace, `/^[a-z0-9-]+$/`, 2–150 chars; Debounced 350ms `GET /organizations/check-slug/:slug`; Right badge `"KHẢ DỤNG"` (`#059669`) or red `#E11D48` taken error | Defines unique URL/API tenant key and checks availability in real time. |
| 6 | Business Description (`#org-desc`) | Text Area | Optional, 3 rows; Placeholder `"Ví dụ: Hạ tầng microservices bán lẻ..."` | Records optional infrastructure scope notes. |
| 7 | Continue Button `"Tiếp tục sang Môi trường"` | Button | `PrimaryButton` (`#3D3B4F`/`#FFFFFF`, `ArrowRight`) | Validates fields, saves to `OnboardingContext`/`sessionStorage`, advances to `/onboarding/environment`. |

---

### 2.2.2 Step 2 — Environment Setup (`/onboarding/environment`)
- **Role:** All Authenticated | **Layout:** `OnboardingLayout` (`currentStep=2`) | **Source:** `pages/Onboarding/EnvironmentStep.jsx`, `components/onboarding/{OrganizationSummary,EnvironmentForm}.jsx` | **Status:** Local Context (DB persist deferred to Step 4) | **Figures:** Figure 18

**Table 13. Onboarding Step 2 — Environment Setup**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | `OrganizationSummary` Card | Info Card | Displays selected org name, `"TỔ CHỨC ĐÃ CHỌN"` badge, slug, and `"Thay đổi"` link (-> Step 1) | Confirms parent organization and allows quick backtracking. |
| 2 | Environment Name (`#env-name`) | Input Field | Required, min 2 chars; Default `'Production'` / `'Staging'` | Names the Kubernetes monitoring environment. |
| 3 | Environment Type Radio Cards (`DEV` / `STAGING`) | Radio Card Group | 2-col grid; Active `2px solid #3D3B4F` + `#28E99F` checkmark; Options: `Môi trường Phát triển (DEV)` & `Môi trường Thử nghiệm (STAGING)` (default) | Classifies environment tier for monitoring and policy isolation. |
| 4 | Environment Notes (`#env-desc`) | Text Area | Optional, 3 rows | Captures environment purpose/CI-CD notes. |
| 5 | Footer Navigation Buttons | Button Group | `SecondaryButton` `"Quay lại Tổ chức"` (`ArrowLeft`) + `PrimaryButton` `"Tiếp tục sang Kubernetes"` (`ArrowRight`) | Returns to Step 1 or saves environment to context and advances to Step 3. |

---

### 2.2.3 Step 3 — Kubernetes Cluster & Agent Token (`/onboarding/kubernetes`)
- **Role:** All Authenticated | **Layout:** `OnboardingLayout` (`currentStep=3`) | **Source:** `pages/Onboarding/KubernetesStep.jsx`, `components/onboarding/{ClusterRegistrationCard,AgentTokenCard,InstallationCodeBlock,AgentInstallerBanner,RBACNotice}.jsx` | **Status:** Hybrid (Real token rotation API; local cluster save) | **Figures:** Figure 19

**Table 14. Onboarding Step 3 — Kubernetes Cluster & Agent Token**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Organization & Environment Summary Strip | Summary Cards | 2-col strip showing `OrganizationSummary` & `EnvironmentSummary` (`THỬ NGHIỆM`/`PHÁT TRIỂN` badge) with `"Thay đổi"` links | Displays current target tenant and environment context. |
| 2 | Cluster Registration Card (`#cluster-name-input`) | Input Card | Step badge `1`; Monospace DNS-1123 input (default `k8s-cluster-01`); Right badge `"TÊN HỢP LỆ"` *(static display)* | Captures target Kubernetes cluster identifier. |
| 3 | Agent Token Card (`AgentTokenCard`) | Security Card | Step badge `2`; `"Cấp Token mới"` button (`POST .../tokens`), masked/unmasked token box (`Eye`/`EyeOff`), amber one-time warning when raw token present, `CopyButton`, 90-day scope footer | Displays or rotates the cluster agent authentication token. |
| 4 | `InstallationCodeBlock` & `AgentInstallerBanner` | Code / Tab Panel | Step badge `3`; 4 OS/method tabs (`PowerShell (Windows)`, `Bash (Linux/macOS)`, `Kubectl Manifest (URL)`, `Helm 3`); Dark `#161521` CAD `AgentInstallerBanner` (`agentchicken.png`); `#2A2A2A` terminal + `"Sao chép lệnh"` + security warning | Generates copyable one-liner commands to install the SelfHeal Agent. |
| 5 | `RBACNotice` Expandable Banner | Accordion Banner | Mint `rgba(40,233,159,0.08)` with `4px` `#28E99F` left bar; Toggle `"Xem Quyền hạn"` / `"Ẩn Chi tiết"` listing 4 K8s API groups (`core`, `apps`, `metrics.k8s.io`, `events.k8s.io`) + `/guide` link | Explains Zero Cluster-Admin least-privilege RBAC permissions. |
| 6 | Footer Navigation & Error Alert | Button Group / Alert | Conditional `<ErrorAlert>` + `"Quay lại Môi trường"` & `"Chỉ dẫn Kết nối Tác tử"` | Validates DNS-1123 cluster name and advances to Step 4. |

---

### 2.2.4 Step 4 — Verify Agent Connection (`/onboarding/verify-agent`)
- **Role:** All Authenticated | **Layout:** `OnboardingLayout` (`currentStep=4`) | **Source:** `pages/Onboarding/VerifyAgentStep.jsx`, `TroubleshootingAccordion.jsx` | **Status:** Real API (4-step DB persistence on Continue + Sandbox fallback) | **Figures:** Figure 20

**Table 15. Onboarding Step 4 — Verify Agent Connection**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Optional Connection Info Banner & Save Error Alert | Banners | Green `#F0FDF4` banner explaining non-blocking verification; Conditional red `#FEF2F2` save error box with `"Bỏ qua & Tiếp tục (Sandbox)"` escape button | Informs users they can proceed before agent connects and handles save failures safely. |
| 2 | Connection Credentials Card | Summary Card | Displays Org, Cluster Name, Environment, and Agent Token box with `CopyButton` | Summarizes credentials needed to run installation scripts. |
| 3 | 3 Numbered Deployment & Verification Cards | Instruction Cards | Step 1 (`AgentInstallerBanner` + 3 tabs: `Helm Chart`, `Script Tự Động`, `Kubectl Manifest` + `#0F172A` code + Copy); Step 2 (`kubectl get pods -n selfheal-system`); Step 3 (`kubectl logs ...`) | Guides SREs step-by-step through agent deployment and health verification. |
| 4 | Heartbeat Status Listener Box | Status Panel / Button | Waiting (`#F8FAFC` dashed) vs Connected (`#F0FDF4` `#86EFAC`); Button `"Kiểm tra tín hiệu"` (`GET .../agents/:id`, manual click — no `setInterval`) | Checks live backend heartbeat status of the newly deployed agent. |
| 5 | `TroubleshootingAccordion` | Accordion | 4 collapsible diagnostics (`CrashLoopBackOff`, `Permission Denied`, `Token Hết hạn`, `Firewall/Proxy`), each with dark `#1E1E1E` command + Copy + resolution | Assists operators in resolving common K8s agent connection failures. |
| 6 | Footer Navigation Buttons | Button Group | `"Quay lại Bước 3"` (disabled while saving) + `"Tiếp tục Hoàn tất"` (executes 4-step DB persist: Org -> Env -> Agent/Cluster -> Portal sync -> `/onboarding/complete`) | Commits onboarding entities to PostgreSQL and advances to Step 5. |

---

### 2.2.5 Step 5 — Complete Setup (`/onboarding/complete`)
- **Role:** All Authenticated | **Layout:** `OnboardingLayout` (`currentStep=5`, Steps 1–4 locked) | **Source:** `pages/Onboarding/CompleteStep.jsx`, `SetupSummary.jsx` | **Status:** Implemented (Context handoff + mock fallback counts) | **Figures:** Figure 21

**Table 16. Onboarding Step 5 — Complete Setup**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Locked Stepper Sidebar | Navigation | Steps 1–4 disabled (`cursor: not-allowed`, `opacity: 0.7`); URL guards keep user on `/onboarding/complete` | Prevents accidental duplicate re-submission of steps 2–4. |
| 2 | Completion Success Banner | Banner Card | Top border `4px solid #28E99F`, centered `CheckCircle2` `#059669`, mono `"ONBOARDING HOÀN TẤT THÀNH CÔNG"`, H2 `"Môi trường của bạn đã sẵn sàng"` | Confirms onboarding completion. |
| 3 | 4-Tile Infrastructure Summary Grid | Summary Cards | Displays Organization, Environment, Kubernetes Cluster (`k8sVersion`, `nodeCount`), and Agent Status (*always displays green `"HOẠT ĐỘNG & TRUYỀN DỮ LIỆU"` + fallback `v1.29.4`/`4 Nodes`/`38 Pods` when metrics are 0*) | Summarizes configured target workspace entities. |
| 4 | Primary CTA `"Đến Doanh Nghiệp Của Tôi (Dashboard)"` | Button | Bg `#28E99F`, text `#000000`, padding `14px 32px` | Writes active org/env/cluster keys to `localStorage`, resets wizard state, and navigates to `/dashboard`. |
| 5 | Secondary CTA `"Đọc Tài liệu Hướng dẫn"` | Button | `SecondaryButton` with `ExternalLink` icon | Navigates to `/guide`. |

---

## 2.3 Personal Portal (`/portal/*` — All Authenticated Roles)

### 2.3.1 Personal Dashboard (`/portal`, `/portal/dashboard`, `/user`, `/personal`, `/me`)
- **Role:** All Authenticated | **Layout:** `PersonalPortalLayout` | **Source:** `pages/Personal/PersonalDashboardPage.jsx`, `components/personal/{PersonalSidebar,PersonalHeader}.jsx` | **Status:** Hybrid (5 Real APIs + `localStorage` fallback) | **Figures:** Figure 22

**Table 17. Personal Dashboard**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | `PersonalSidebar` | Sidebar | Width `260px` / `72px` collapsed (`#FFFFFF`, border `#E2E8F0`); Brand `"SelfAI User"`; 8 nav links with dynamic Company count badge, static `2FA`/`FAQ` pills, and red Unread badge; *No mobile drawer wired* | Primary navigation across all 8 Personal Portal pages. |
| 2 | `PersonalHeader` | Header Bar | Height `64px`, `#FFFFFF`; Collapse toggle, Breadcrumb `"Trung Tâm Điều Khiển / {Page}"`, Notification Bell (unread badge -> `/portal/notifications`), `UserProfileDropdown` | Displays page location, quick alerts link, and cross-portal account menu. |
| 3 | Pending Invitations Banner | Alert Container | Conditional `#EFF6FF`/`#BFDBFE` card; Lists pending org invites with `"Đồng ý"` (`POST /organizations/:orgId/members/accept`) & `"Từ chối"` (*local-only*) + `"Xem chi tiết →"` | Enables one-click acceptance or rejection of company invitations. |
| 4 | 4 Summary KPI Cards | KPI Cards | Fixed 4-col grid (`radius: 12px`): `Tổng Company Tham Gia`, `Company Đang Hoạt Động`, `Thông Báo Chưa Đọc` (-> `/portal/notifications`), `Bảo Mật Tài Khoản` (`Đã bật 2FA` / `Chưa bật 2FA` -> `/portal/security`) | Summarizes personal memberships, unread alerts, and account 2FA posture. |
| 5 | My Companies Card (`Công Ty Của Tôi`) | List Card | Left `7fr` col; Loading/Error/Empty (`Tạo Company Mới`) states; Rows show initial avatar, org name, role badge (`SME OWNER`/`DEVOPS`/`VIEWER`), K8s cluster/workload counts, `"Vào Workspace →"` button | Allows direct launch into any organization's SME Dashboard (`/dashboard`). |
| 6 | Tabbed Notifications & Activity Card | Tabbed Feed | Right `5fr` col; Segmented tabs `"Thông Báo"` (5 recent items) & `"Hoạt Động"` (5 recent category-badged items) + `"Xem tất cả →"` links | Surfaces recent personal notifications and audit activities without leaving the hub. |

---

### 2.3.2 My Companies & Invitations (`/portal/companies`)
- **Role:** All Authenticated | **Layout:** `PersonalPortalLayout` | **Source:** `pages/Personal/PersonalCompaniesPage.jsx` | **Status:** Hybrid (List/Create/Accept = Real API; Reject/Leave = `localStorage`-only) | **Figures:** Figure 23, Figure 24, Figure 25

**Table 18. My Companies & Invitations**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Create Company Button `"+ Tạo Công Ty Mới"` | Button | Bg `#059669`, text `#FFFFFF`, `radius: 9px` | Opens `"Tạo Mới Công Ty"` modal. |
| 2 | Underline Section Tabs | Tabs | `"Công Ty Đang Tham Gia ({N})"` & `"Lời Mời Đang Chờ ({N})"` (red pill when `>0`) | Switches between active memberships and pending invitations. |
| 3 | Search & Role Filter Bar | Input / Dropdown | Search `"Tìm kiếm theo tên công ty hoặc slug..."` + Role `<select>` (`Tất cả`, `SME Owner`, `DevOps Lead`, `Viewer`) | Filters joined company cards in real time. |
| 4 | Company / Invitation Cards Grid | Card Grid | Joined cards (`minmax(340px,1fr)`): Status pill, role, K8s/member counts, `"Vào Workspace →"` (`#059669`), Leave icon button (`LogOut`). Invitation cards: `"Chấp Nhận Tham Gia"` & `"Từ Chối"` | Launches workspace, initiates leave flow, or responds to invitations. |
| 5 | Create Modal — Company Name | Input Field | Required; Placeholder `"Ví dụ: TechHub Vietnam Co., Ltd"`; Auto-generates slug | Captures new organization name. |
| 6 | Create Modal — Slug URL | Input Field | Required, monospace `#F8FAFC` | Defines unique slug identifier. |
| 7 | Create Modal — Domain | Input Field | Optional; Placeholder `"Ví dụ: techhub.vn"` | Captures corporate domain. |
| 8 | Create Modal — Short Description | Text Area | Optional, 2 rows | Captures organization summary. |
| 9 | Create Modal Footer Buttons | Button Group | `"Hủy Bỏ"` & `"Xác Nhận Tạo"` (`#059669`); Inline `#FEF2F2` validation alert | Closes modal or calls `POST /organizations` to create tenant. |
| 10 | Confirm Leave Modal Warning | Modal Content | `maxWidth: 440px`, red `AlertTriangle` header + bold target org name | Warns user before leaving an organization. |
| 11 | Confirm Leave Footer Buttons | Button Group | `"Hủy"` & `"Xác Nhận Rời"` (`#DC2626`) | Cancels or removes membership (*currently `localStorage`-only*). |

---

### 2.3.3 Personal Profile (`/portal/profile`, `/profile`, `/dashboard/profile`, `/admin/profile`)
- **Role:** All Authenticated | **Layout:** `PersonalPortalLayout` | **Source:** `pages/Personal/PersonalProfilePage.jsx` | **Status:** Hybrid (`GET/PUT /users/me` + local `department`/`bio`) | **Figures:** Figure 26

**Table 19. Personal Profile**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Avatar & Camera Upload Button | Image / File Input | `110×110px` circular avatar (`#059669`->`#10B981` monogram or Base64 preview) + `32×32px` camera button (`accept="image/*"`, max `3MB`) | Uploads and previews user profile picture. |
| 2 | Account Identity Summary Box | Info Block | `#F8FAFC` box showing Account Status (`KÍCH HOẠT (ACTIVE)`), Highest System Role, Join Date, Last Login | Displays read-only identity and system role metadata. |
| 3 | Full Name Input (`#field-fullname`) | Input Field | Required (`*`) | Edits user's full display name. |
| 4 | Email Address (`#field-email`) | Input Field | **Disabled** (`#F8FAFC`) | Displays non-editable login email address. |
| 5 | Phone & Job Title Inputs | Input Fields | `#field-phone` (`tel`, `"0912345678"`) & `#field-jobtitle` (`"Senior DevOps Engineer"`) | Edits contact phone and professional role title. |
| 6 | Department & Bio Fields | Input / Text Area | `#field-department` & `#field-bio` (3 rows); *Stored in `localStorage` only* | Captures department and short user biography. |
| 7 | Submit Button `"Lưu Thay Đổi Hồ Sơ"` | Button | Bg `#059669`, `Save` icon; Loading `"Đang Lưu Hồ Sơ..."`; Green banner (`#ECFDF5`, 3.5s) + Toast | Persists profile updates via `PUT /api/v1/users/me` and syncs header avatar/name. |

---

### 2.3.4 Account Security & 2FA (`/portal/security`)
- **Role:** All Authenticated | **Layout:** `PersonalPortalLayout` | **Source:** `pages/Personal/PersonalSecurityPage.jsx` | **Status:** Hybrid (2FA & Login History = Real API; Change Password & Active Sessions = Local/Mock) | **Figures:** Figure 27, Figure 28, Figure 29

**Table 20. Account Security & 2FA**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Change Password Inputs & Strength Bar | Input Group / Progress | Current Password (toggle), New Password (toggle, `>=8` chars, 4-level strength bar: `Yếu`/`Trung bình`/`Khá`/`Mạnh`), Confirm Password | Captures credentials for password update with live strength meter. |
| 2 | Update Password Button `"Cập Nhật Mật Khẩu"` | Button | Bg `#059669`, `Lock` icon; Inline green/red alert; *Local/Mock validation only — no backend password API called* | Validates new password locally and logs security activity. |
| 3 | 2FA Status Card & Action Button | Status Card / Button | Enabled (`#F0FDF4`, `BẢO VỆ TỐI ĐA`, `"Vô Hiệu Hóa 2FA"` `#DC2626`) vs Disabled (`#FEF2F2`, `NGUY HIỂM`, `"Kích Hoạt 2FA Ngay"` `#059669`) | Displays TOTP 2FA protection status and launches setup or disable modal. |
| 4 | Active Sessions List & Revoke Button | List / Button | Shows current browser device (`"Thiết bị này"` badge) + other local sessions; `"Đăng Xuất Khỏi Thiết Bị Khác ({N})"` (disabled when 0; *localStorage-only*) | Lists active device sessions and clears other local session entries. |
| 5 | Login History Table & Pagination | Data Table | 6 cols (`Thời Gian`, `Phương Thức`, `Địa Chỉ IP` mono, `Vị Trí`, `Thiết Bị`, `Trạng Thái`), `"Làm Mới"` button, custom page size (`5/10/25/50`) & Prev/Next (`GET /users/me/activities?category=AUTH`) | Audits recent account authentication events. |
| 6 | Setup 2FA Modal — QR Code | Modal / Image | `maxWidth: 480px`, `180×180px` QR code from `POST /auth/2fa/setup` | Allows scanning TOTP secret into authenticator apps. |
| 7 | Setup 2FA Modal — Manual Secret & Copy | Info Box / Button | Monospace secret key + `"Sao chép"` / `"Đã chép"` button | Supports manual authenticator entry. |
| 8 | Setup 2FA Modal — 6-Digit OTP & Activate | Input / Button | `maxLength=6` numeric-only, `"000000"`; `"Xác Nhận & Kích Hoạt"` disabled until 6 digits (`POST /auth/2fa/enable`) | Verifies authenticator code and enables 2FA. |
| 9 | Backup Codes Modal — 8 Codes Grid | Modal / Grid | 2-col grid of 8 monospace recovery codes shown after 2FA activation | Provides one-time emergency recovery codes. |
| 10 | Backup Codes Modal Actions | Button Group | `"Sao chép 8 mã"` & `"Đã Lưu & Hoàn Tất"` | Copies recovery codes to clipboard and closes setup wizard. |
| 11 | Disable 2FA Modal — Warning | Modal Content | `maxWidth: 440px`, red `AlertTriangle`, security risk warning (*no password input rendered*) | Warns user before removing 2FA protection. |
| 12 | Disable 2FA Modal Buttons | Button Group | `"Hủy bỏ"` & `"Xác Nhận Tắt 2FA"` (`#DC2626`, calls `POST /auth/2fa/disable`) | Cancels or disables account 2FA. |

---

### 2.3.5 Personal Preferences (`/portal/preferences`)
- **Role:** All Authenticated | **Layout:** `PersonalPortalLayout` | **Source:** `pages/Personal/PersonalPreferencesPage.jsx` | **Status:** Mock / `localStorage`-only (theme & language not wired globally) | **Figures:** Figure 30

**Table 21. Personal Preferences**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Language Selector Cards | Card Group | 2-col cards: `🇻🇳 Tiếng Việt` (default), `🇺🇸 English (US)`; Active `2px solid #059669`, `#F0FDF4`, `✓` | Selects preferred UI language (*saved locally; does not translate app*). |
| 2 | Appearance Selector Cards | Card Group | 3-col cards: `Light Mode (Sáng)`, `Dark Mode (Tối)`, `System Default`; Active shows `"ĐANG DÙNG"` pill | Selects UI theme (*sets `data-theme`, no dark CSS rules defined yet*). |
| 3 | Regional Settings Dropdowns (×4) | Dropdown Group | 2×2 grid: Timezone (5 zones), Date Format (`DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`), Time Format (`24h`/`12h`), Number Format (`comma_decimal`/`dot_decimal`) | Configures preferred regional timestamp and numeric formatting. |
| 4 | Real-Time Format Preview Box | Info Block | Dashed `#F8FAFC` bar rendering live formatted date, time, and `MiB` sample in monospace | Previews selected regional formatting immediately. |
| 5 | Personal Notification Checkboxes (×6) | Checkbox Group | 2-col clickable cards (`In-App`, `Email`, `Company Invites`, `Role Changes`, `Security Alerts`, `System Maintenance`) | Toggles personal notification channel/category preferences. |
| 6 | Save Button `"Lưu Tùy Chỉnh Cá Nhân"` | Button | Bg `#059669`, `Save` icon; Shows 3s `#ECFDF5` confirmation banner | Saves preferences to `localStorage` and logs activity. |

---

### 2.3.6 Personal Notifications (`/portal/notifications`)
- **Role:** All Authenticated | **Layout:** `PersonalPortalLayout` | **Source:** `pages/Personal/PersonalNotificationsPage.jsx` | **Status:** Hybrid (Real API + `localStorage` cache; settings modal local-only) | **Figures:** Figure 31, Figure 32

**Table 22. Personal Notifications**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header Actions | Button Group | Conditional `"Đánh Dấu Tất Cả Đã Đọc"` (`#F0FDF4`/`#065F46`, shown when `unreadCount > 0`) & `"Cài Đặt Nhận Tin"` | Marks all notifications read or opens channel settings modal. |
| 2 | Filter Bar (Status Pills & Type Select) | Tabs / Dropdown | Status buttons: `Tất cả`, `Chưa đọc`, `Đã đọc` (active `#059669`); Type `<select>` (`ALL`, `INFRASTRUCTURE`, `BROADCAST`, `SYSTEM`, `SECURITY`, `INVITATION`, `ROLE`) | Filters personal notifications by read state and category. |
| 3 | Notification Feed Cards | List Cards | Unread `#F0FDF4`/`#A7F3D0` with `"MỚI"` badge; Displays type badge, title, message, Org/Cluster/Service chips, contextual `"Xem Sự Cố"` / `"Xem Lời Mời"` CTA, single Mark-Read button (`CheckCheck`); Empty dashed state | Displays personal alerts with direct deep-links into incidents or company invites. |
| 4 | Settings Modal — 6 Checkboxes | Modal / Checkboxes | `maxWidth: 480px`: `webNotify`, `emailNotify`, `companyInvitations`, `securityAlerts`, `criticalAlerts`, `weeklyDigest` | Configures notification delivery switches (*localStorage-only*). |
| 5 | Settings Modal Footer Buttons | Button Group | `"Đóng"` & `"Lưu Cài Đặt"` (`#059669`, 1.2s green confirmation banner) | Closes modal or persists notification preferences. |

---

### 2.3.7 Personal Activity Log (`/portal/activity`)
- **Role:** All Authenticated | **Layout:** `PersonalPortalLayout` | **Source:** `pages/Personal/PersonalActivityPage.jsx` | **Status:** Real API (`GET /users/me/activities` + CSV export) | **Figures:** Figure 33

**Table 23. Personal Activity Log**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header Actions (`Làm mới` & `Xuất Báo Cáo CSV`) | Button Group | `"Làm mới"` (`RefreshCw`, disabled while loading) & `"Xuất Báo Cáo CSV"` (`Download`, UTF-8 BOM `.csv` of current filtered view) | Refreshes audit log or exports visible activities to CSV. |
| 2 | Search & Category Filter Bar | Input / Dropdown | Debounced 200ms search `"Tìm theo hành động, IP, chi tiết sự kiện..."` + Category `<select>` (`ALL`, `AUTH`, `PROFILE`, `COMPANY`, `SECURITY`) | Filters personal activity records by keyword and category. |
| 3 | 5-Column Activity Table | Data Table | Cols: `Hành Động & Chi Tiết` (with Org & Cluster pills), `Phân Loại` (colored badge), `Địa Chỉ IP` (mono), `Thời Gian Thực Thi`, `Trạng Thái` (`Hoàn thành` `#059669` / `Thất bại` `#DC2626`); Loading spinner & Empty state | Provides chronological personal security and workspace audit trail. |
| 4 | Pagination Bar | Pagination | `AdminTablePagination` (`pageSizeOptions={[5, 10, 25, 50]}`, `itemLabel="hoạt động"`) | Navigates server-paginated personal activity pages. |

---

### 2.3.8 Personal Help Center (`/portal/help`)
- **Role:** All Authenticated | **Layout:** `PersonalPortalLayout` | **Source:** `pages/Personal/PersonalHelpPage.jsx` | **Status:** Implemented (Static Docs & FAQ) | **Figures:** Figure 34

**Table 24. Personal Help & Technical Guide**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Section Tabs | Tabs | `"1. Tài Liệu Hướng Dẫn Kỹ Thuật"` (`BookOpen`) & `"2. Câu Hỏi Thường Gặp (FAQ)"` (`HelpCircle`); Active `#059669` bottom border | Switches between step-by-step runbooks and searchable FAQs. |
| 2 | Docs Sidebar TOC | List Menu | Width `320px`; Lists `DOCUMENTATION_DATA` guides; Active `#F0FDF4`/`#065F46` with `ChevronRight` | Selects active technical guide article. |
| 3 | Docs Content Card | Article Card | Category pill, H3 title, numbered step cards (`#F8FAFC`), dark `#0F172A` monospace command snippet, amber `#FFFBEB` troubleshooting tips card | Presents actionable SRE procedures and CLI snippets. |
| 4 | FAQ Search, Category Filter & Accordion | Input / Select / Accordion | Search input + Category `<select>` (`ALL`, `Agent`, `Hạ Tầng`, `AI`, `Tổ Chức`, `Phân Quyền`) + single-expand accordion cards with optional deep-link action buttons | Lets users search answers and jump directly to relevant portal screens. |

---

## 2.4 SME Owner Portal (`/dashboard/*` — Tenant Governance & Shared Workspace)

### 2.4.1 SME Dashboard Shell (`DashboardLayout`, `TopHeader`, `Sidebar`, `UserProfileDropdown`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER`, `DEVOPS`, `VIEWER` (role-filtered menus) | **Layout:** `DashboardLayout` | **Source:** `layouts/DashboardLayout.jsx`, `components/dashboard/{Sidebar,TopHeader}.jsx`, `components/common/UserProfileDropdown.jsx`, `pages/Dashboard/context/DashboardContext.jsx` | **Status:** Real API (Notification state initially seeded from `mocks/notificationMockData`) | **Figures:** Figure 35

**Table 25. SME Dashboard Shell**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Organization Switcher Dropdown | Dropdown | Left `TopHeader` (`60px` desktop, `52px` `<=860px`); Displays active org name + role badge (`SME_OWNER` `#FEF3C7`/`#92400E`, `DEVOPS` `#E0E7FF`/`#3730A3`, `VIEWER` `#F1F5F9`/`#475569`); Keyboard `ArrowUp`/`Down`/`Enter`/`Escape` | Switches active tenant workspace, cancels in-flight requests, updates `X-Organization-Id`, and broadcasts `ORG_SWITCHED`. |
| 2 | Cluster Switcher Dropdown | Dropdown | Displays active cluster name, status dot (`#10B981` ONLINE / `#EF4444` OFFLINE), refresh icon, footer CTA `"+ Quản Lý & Thêm Cụm Kubernetes"` (`/dashboard/clusters` — *visible to Viewer, hits 403*) | Switches active Kubernetes cluster context for all telemetry/incident/healing views. |
| 3 | Top Navigation Dropdowns (`Hạ tầng`, `Tổ chức`, `Hệ thống`) | Dropdown Group | Right `TopHeader`; Role-filtered: `Hạ tầng` (Agents, Clusters*, Infrastructure, Workloads), `Tổ chức`* (Org Profile, Members — Owner/Admin only), `Hệ thống` (Policies*, Audit Logs, Reports, Settings*); *`*` hidden by role* | Provides secondary navigation to governance, infrastructure, and reporting modules. |
| 4 | Notifications Bell & Popover | Button / Popover | Red unread badge (`#EF4444`); Popover lists recent real/WS notifications (`Đánh dấu đã đọc`) + footer `"Xem tất cả trong Trung tâm thông báo →"` (`/dashboard/notifications`) | Surfaces real-time incidents and approval alerts without leaving the current page. |
| 5 | `UserProfileDropdown` | Dropdown | `32×32px` avatar/emerald monogram (`#065F46`->`#059669`), `280px` popover: `/portal`, `/dashboard`, `/admin` (admin only), `/portal/profile`, `/portal/security`, settings link, red `"Đăng Xuất Tài Khoản"` | Switches portals, accesses personal settings, or logs out across tabs. |
| 6 | Floating Frosted `Sidebar` | Sidebar | Fixed floating glass panel (`rgba(255,255,255,0.88)`, `blur(18px)`, `radius: 16px`, `68px` collapsed / `256px` expanded / `272px` mobile drawer `<=860px`); 4 nav groups (`TỔNG QUAN`, `GIÁM SÁT`, `AI & SỰ CỐ`, `TỰ PHỤC HỒI`) with live counters (`activeIncidentsCount`, `newHealingHistoryCount`, `pendingApprovalsCount`); Hides `Chờ phê duyệt` for `VIEWER` | Primary operational navigation across Overview, Monitoring, Incidents, and Self-Healing. |

---

### 2.4.2 SME Overview — AI Self-Healing Pipeline Canvas (`/dashboard`)
- **Role:** All Authenticated SME Roles | **Layout:** `DashboardLayout` (Full-bleed `isOverview=true`) | **Source:** `pages/Dashboard/Overview/index.jsx`, `components/dashboard/ai/AIPipelineFlowCanvas.jsx` | **Status:** 100% Real API (11 parallel endpoints + 4s silent poll + WebSocket) | **Figures:** Figure 36, Figure 37

**Table 26. SME Overview — AI Self-Healing Pipeline Canvas**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 8 Floating Glass KPI Cards | KPI Cards | 8-col responsive strip (`rgba(255,255,255,0.9)`, `blur(12px)`, `radius: 12px`): `CPU Cụm`, `RAM Cụm`, `Ổ Đĩa Cụm` (-> Metrics), `Pods & Nodes` (-> Workloads), `Sự cố Mở` (-> Incidents), `Tác tử Agent` (-> Agents), `Tự Phục Hồi 24h` (-> History), `Chờ Duyệt HITL` (-> Approvals; *hits 403 for Viewer*) | Displays live cluster health KPIs and acts as one-click deep-links to operational modules. |
| 2 | Live Status Floating Pill | Status Badge | Top-left pill: `LIVE` / `OFFLINE` / `DỪNG`, Pod/Node counts, active node names | Indicates live telemetry stream connectivity. |
| 3 | Service Selector, Scale Toggle & Refresh Pill | Controls Bar | Top-right floating pill: `Dịch vụ (N)` `<select>` (persisted per cluster in `localStorage`), Y-axis toggle (`Tự co giãn` / `0 - 100%`), `"Làm mới"` button | Scopes the AI pipeline visualization to a specific Kubernetes workload. |
| 4 | 7-Stage Interactive `AIPipelineFlowCanvas` | Interactive Canvas | Pan/zoom (`25%–260%`) dot-grid canvas connecting Stage 01 (6 Metrics) -> Stage 02 (GRU 12-Step Waveform Hub) -> Stage 03 (7 Risk Heads) -> Stage 04 (RCA + 6 Rule Engine rules) -> Stage 05 (Policy Engine) -> Stage 06 (`AUTO`/`HITL`/`AUDIT` branches) -> Stage 07 (60s Verify & Closed-Loop) | Visualizes the end-to-end real-time MAPE-K AI prediction, RCA, and self-healing pipeline. |
| 5 | Bottom Focus Tabs & Zoom Toolbar | Toolbar | Focus modes (`1. AI & Rule Engine`, `2. RCA & Tự phục hồi`, `3. Vòng lặp Khép kín`, `Toàn luồng`), Zoom `%`, `+`, `-`, `"Đặt lại góc nhìn vừa khung (Reset)"` | Pans/zooms smoothly to specific pipeline zones or resets viewport framing. |
| 6 | Inspector Popover Header (Pinned/Draggable) | Popover Header | Width `375px`, `rgba(255,255,255,0.98)`; Hover preview / click pin / drag header / `Esc` close; Stage badge + live healthy/alert pill | Inspects detailed live metrics for any clicked pipeline node. |
| 7 | Inspector Telemetry Rows & Guidance Box | Info Block | Live key-value metrics + blue `"Bước tiếp theo"` SRE guidance box | Explains current anomaly context and recommended operational action. |
| 8 | Inspector Contextual Navigation Button | Button | `"Xem chi tiết →"` deep-link button | Navigates directly to the relevant Metrics, Incidents, Policies, or Approvals page. |

---

### 2.4.3 Organization Profile (`/dashboard/organization`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER` (`DEVOPS`/`VIEWER` 403) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Organization/OrganizationPage.jsx` | **Status:** 100% Real API (`GET/PUT /organizations/:id`) | **Figures:** Figure 38, Figure 39

**Table 27. Organization Profile**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Organization Header & Edit Button | Header / Button | Org name, status badge, primary button `"Chỉnh Sửa Thông Tin"` (`#059669`) | Identifies organization profile and opens the edit modal. |
| 2 | 4 Summary KPI Cards | KPI Cards | `MÃ ĐỊNH DANH SLUG`, `THÀNH VIÊN`, `VAI TRÒ CỦA BẠN`, `MÚI GIỜ VẬN HÀNH` | Displays key tenant identity and operational metadata. |
| 3 | Basic Info Card | Info Card | Read-only display: Name, Slug, Organization Type, Description | Presents core organization details. |
| 4 | Extended Contact & Location Card | Info Card | Read-only display: Website, Contact Email, Phone, City, Timezone | Presents administrative contact and geographic details. |
| 5 | Edit Modal — Name, Slug & Type | Modal Inputs | Organization Name (required), Slug (read-only), Organization Type `<select>` | Edits core organization identity fields. |
| 6 | Edit Modal — Contact, Website & Description | Modal Inputs | Website URL (validated `http://`/`https://`, blocks `javascript:`/`data:` XSS), Contact Email, Phone, City, Timezone `<select>`, Description textarea | Edits organization contact information safely. |
| 7 | Edit Modal Footer Buttons | Button Group | `"Hủy"` & `"Lưu Thay Đổi"` (submits `PUT /organizations/:id` with toast feedback) | Discards edits or persists organization updates. |

---

### 2.4.4 Organization Members & RBAC (`/dashboard/organization/members`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER` (`DEVOPS`/`VIEWER` 403) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Organization/MembersPage.jsx`, `services/organizationMemberService.js` | **Status:** Real API (with silent `localStorage` fallback on network error) | **Figures:** Figure 40, Figure 41, Figure 42

**Table 28. Organization Members & RBAC**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 3 Membership KPI Cards | KPI Cards | `TỔNG NHÂN SỰ & LỜI MỜI`, `ĐANG HOẠT ĐỘNG`, `LỜI MỜI ĐANG CHỜ` | Summarizes active team headcount and pending invitations. |
| 2 | Toolbar (Tabs, Search, Role Filter & Invite CTA) | Controls Bar | Status tabs (`Tất Cả`, `Đang Hoạt Động`, `Lời Mời Đang Chờ`), Search input, Role `<select>` (`ALL`, `SME_OWNER`, `DEVOPS`, `VIEWER`), `"Mời Thành Viên"` button (`ORG_MANAGE`) | Filters member directory and opens the member invitation modal. |
| 3 | 5-Column Members Table | Data Table | Cols: `Thành viên` (avatar/name/email), `Vai trò` (badge), `Trạng thái`, `Ngày tham gia / Hoạt động cuối`, `Thao tác` (View Profile, Edit Role, Remove; protects self & `"Chủ Sở Hữu"`) | Lists organization members and provides per-user management actions. |
| 4 | Static RBAC Comparison Matrix | Info Table | 8 features × 3 roles (`SME_OWNER`, `DEVOPS`, `VIEWER`) *(Note: states DevOps cannot edit policies, contradicting `usePermissions.js`)* | Explains role responsibilities within the organization. |
| 5 | Invite Modal — Email Input | Input Field | Required, email format validated | Specifies email address to invite (`POST /organizations/:id/invitations`). |
| 6 | Invite Modal — Role Selector | Radio / Select | Options: `SME_OWNER`, `DEVOPS`, `VIEWER` with permission descriptions | Assigns tenant role to the invited user. |
| 7 | Invite Modal Footer Buttons | Button Group | `"Hủy"` & `"Gửi Lời Mời"` | Closes modal or dispatches organization invitation. |
| 8 | Edit Role Modal (`Thay Đổi Vai Trò`) | Modal | Target member summary, Role select, Last-Active-Owner demotion guard, `"Hủy"` & `"Cập Nhật Vai Trò"` (`PUT .../members/:userId`) | Changes an existing member's organization role safely. |
| 9 | Profile Detail Modal (`Chi Tiết Hồ Sơ Cá Nhân`) | Modal | Read-only profile, role, status, inviter, joined/updated dates, MFA status | Inspects member account metadata. |
| 10 | Remove / Revoke Confirmation Modal | Confirmation Modal | Amber warning box, target email/name, `"Hủy"` & `"Xác Nhận"` (`DELETE .../members/:userId`) | Confirms permanent member removal or invitation revocation. |

---

### 2.4.5 Kubernetes Clusters Management (`/dashboard/clusters`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER`, `DEVOPS` (`VIEWER` 403) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Clusters/ClustersPage.jsx` | **Status:** 100% Real API (`clusterService`) | **Figures:** Figure 43, Figure 44

**Table 29. Kubernetes Clusters Management**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header Actions (`Làm mới` & `+ Đăng Ký Cụm Mới`) | Button Group | `"+ Đăng Ký Cụm Mới"` (`#059669`, gated by `ENV_MANAGE`) & `"Làm mới"` | Refreshes cluster list or opens cluster registration modal. |
| 2 | 4 Summary KPI Cards | KPI Cards | `TỔNG CỤM K8S`, `AGENT TRỰC TUYẾN`, `TỔNG NODES`, `TỔNG PODS` | Displays tenant-wide Kubernetes inventory metrics. |
| 3 | Cluster Cards Grid | Card Grid | Shows cluster name, env badge (`PRODUCTION`/`STAGING`/`DEVELOPMENT`), `ONLINE`/`OFFLINE` pill, K8s version, Node/Pod counts, last heartbeat, `"Quản lý & Chi tiết →"` button | Provides per-cluster status cards and navigation to `/dashboard/clusters/:id`. |
| 4 | Register Modal — Cluster Form Fields | Modal Inputs | Required Cluster Name, Environment select, Provider select (`K3S`, `MINIKUBE`, `EKS`, `GKE`, `AKS`, `ON_PREM`), Region, Description | Collects metadata for creating a new cluster (`POST /organizations/:orgId/clusters`). |
| 5 | Register Modal Submit `"Tạo Cụm & Sinh Token"` | Button | Primary emerald button with loading state | Registers cluster and triggers the one-time token modal. |
| 6 | One-Time Token Modal Warning Banner | Alert Banner | `data-testid="token-display-modal"`; Amber `#FFFBEB`/`#F59E0B` warning stating token is shown once only | Warns operator to copy the agent secret immediately. |
| 7 | Raw Token & Quick Install Copy Boxes | Code Boxes | Dark `#0F172A` / `#34D399` monospace boxes with `"Sao chép"` / `"Đã sao chép"` buttons | Copies raw registration token or install command to clipboard. |
| 8 | Token Modal CTA `"Đã Lưu Token & Đi Tới Chi Tiết →"` | Button | Primary button | Closes modal and navigates to the new cluster's detail page. |

---

### 2.4.6 Cluster Detail, Agent Guide & Danger Zone (`/dashboard/clusters/:id`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER` (full incl. Delete), `DEVOPS` (no Delete), `VIEWER` (403) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Clusters/ClusterDetailPage.jsx`, `hooks/useK8sResourcePolling.js` | **Status:** 100% Real API (12s detail poll + 20s resource poll) | **Figures:** Figure 45, Figure 46

**Table 30. Cluster Detail, Agent Guide & Danger Zone**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Back Link & Cluster Status Header | Header | `"← Quay lại Danh sách Cụm"`, cluster name, env/status pills, `"Làm mới"`, inline polling error & Stale Data (`>60s`) banners | Displays live freshness status and returns to cluster list. |
| 2 | 5 KPI Summary Cards | KPI Cards | `Control Plane`, `Tác tử eBPF Agent`, `Máy chủ Nodes`, `Khối lượng Pods`, `Deployments` | Summarizes live cluster capacity and agent connectivity. |
| 3 | 3 Detail Navigation Tabs | Tabs | `Quản Lý & Kết Nối Agent`, `Nhật Ký Kết Nối (Connection Logs)`, `Cấu Hình & Vùng Thao Tác` | Switches between agent setup, connection history, and destructive operations. |
| 4 | eBPF Probes & Active Token Card (Tab 1) | Status / Security Card | 4 probe indicators (CPU/RAM, Network, Syscall/Logs, K8s Events), version, masked token prefix, `"Xoay Vòng / Đổi Token"` (`AGENT_MANAGE`) & `"Thu Hồi Token"` | Monitors probe health and manages cluster agent token lifecycle. |
| 5 | 3-OS Agent Install / Uninstall Guide (Tab 1) | Tabbed Code Panel | Tabs: `Windows PowerShell`, `Linux Bash`, `Gỡ cài đặt` (`Script`/`Kubectl`/`Helm`) with copyable commands | Provides copy-ready commands to deploy or remove the agent. |
| 6 | Agent Configuration Form (Tab 1) | Form | Polling/heartbeat interval inputs, telemetry toggles, `"Lưu Cấu Hình Agent"` (`PATCH /clusters/:id/agent-config`) | Adjusts agent telemetry collection settings. |
| 7 | Connection Logs Table (Tab 2) | Data Table | Paginated (10/page) table of agent connect/disconnect/heartbeat/token events | Audits cluster agent connectivity history. |
| 8 | Danger Zone Action Cards (Tab 3) | Action Cards | `"Ngắt Kết Nối Agent"` (`AGENT_MANAGE` — Owner & DevOps) and `"Xóa Cụm Kubernetes"` (`ENV_DELETE` — Owner/Admin only) | Initiates safe agent disconnection or permanent cluster removal. |
| 9 | Delete Confirmation Name Input & `force` Checkbox | Confirmation Modal | Requires typing exact cluster name; shows `force=true` checkbox if Agent is currently `ONLINE` | Prevents accidental deletion of an active Kubernetes cluster. |
| 10 | Confirm Disconnect / Delete Buttons | Button Group | Destructive red confirmation buttons (`POST .../disconnect-agent`, `DELETE /clusters/:id`) | Executes confirmed cluster disconnection or deletion. |

---

### 2.4.7 Human-in-the-Loop (HITL) Approvals Gate (`/dashboard/self-healing/approvals`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER` (full Approve/Reject), `DEVOPS` (read-only disabled buttons via `PermissionGate(HITL_APPROVE)` — *except YAML modal gap*), `VIEWER` (403) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/SelfHealing/ApprovalsPage.jsx` | **Status:** Real API + WebSocket (+ `localStorage` auto-dismiss toggle) | **Figures:** Figure 47, Figure 48, Figure 79

**Table 31. HITL Approvals Gate**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Auto-Dismiss Reconciler Toggle & Banner | Toggle / Banner | Toggle persisted to `localStorage` (`captone_hitl_auto_dismiss`, default `true`) + dismissible banner of auto-cleaned stale (`>15m`)/resolved approvals *(Note: `DashboardContext` also runs auto-reject globally every 60s)* | Controls display/handling of expired or already-healed approval requests. |
| 2 | 4 HITL KPI Cards | KPI Cards | `CHỜ KÝ DUYỆT`, `RỦI RO CAO / KHẨN`, `ĐÃ XỬ LÝ PHIÊN NÀY`, `ĐỒNG BỘ TRỰC TUYẾN` | Tracks pending approval queue volume and real-time sync status. |
| 3 | Cluster Filter & Search Bar | Dropdown / Input | Cluster `<select>` (`all`, `current`, others) + Search input synced with `?target=` URL query | Filters pending approval requests by cluster or workload. |
| 4 | Approval Request Cards (5/page) | Cards | Action type badge, target workload, **Live Pod Health badge** (`podService.getPodsByCluster`), cluster, risk pill (`CRITICAL`/`HIGH`/`MEDIUM`/`LOW`), AI confidence %, blue `"Hành động tự lành"` summary | Gives SME Owners full diagnostic context before authorizing high-risk remediation. |
| 5 | Card Action Buttons (×4) | Button Group | `"Chi tiết"` (-> `RootCauseModal`), `"Xem trước Diff (YAML)"` (-> YAML Modal), `"Phê Duyệt Ngay"` (green, `PermissionGate(HITL_APPROVE)`), `"Từ chối yêu cầu này"` (red outline, `PermissionGate`); *No confirmation dialog — executes immediately* | Inspects RCA/YAML or immediately approves (`POST .../approve`) / rejects (`POST .../reject`) remediation. |
| 6 | YAML Diff Modal — Split Code Viewer | Modal / Diff Viewer | Client-synthesized Before (red) vs After (green) Kubernetes YAML manifest diff | Lets operators verify exact cluster configuration changes before approving. |
| 7 | YAML Diff Modal — Cancel Button `"Hủy"` | Button | Secondary button | Closes YAML preview modal without acting. |
| 8 | YAML Diff Modal — Approve Button | Button | `"Phê Duyệt & Tự Động Vá Cấu Hình"` *(Audit Gap: missing `PermissionGate` wrapper at line 1614)* | Approves and triggers the remediation action directly from the diff modal. |

---

### 2.4.8 Self-Healing Policies & Safety Guards (`/dashboard/self-healing/policies`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER`, `DEVOPS` (`POLICY_MANAGE`), `VIEWER` (403) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/SelfHealing/{PoliciesPage,NewPolicyModal,PolicyDetailModal}.jsx` | **Status:** Hybrid (Policy CRUD = Real API; Global Mode & 5 Guards = `localStorage` + per-policy backend sync on Save) | **Figures:** Figure 49, Figure 50, Figure 51

**Table 32. Self-Healing Policies & Safety Guards**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header Actions (`Tạo Quy Tắc Mới` & `Lưu Cấu Hình`) | Button Group | Gated by `canManagePolicies`; Unsaved-changes banner shown when global guards modified | Opens structured policy creation modal or syncs global guard settings to backend. |
| 2 | Global Automation Mode Selector (3 Cards) | Radio Cards | `SUPERVISED` (Giám sát), `AUTONOMOUS` (Tự trị), `AUDIT` (Chỉ ghi nhận) | Sets cluster-wide self-healing execution posture. |
| 3 | 5 Safety Guard Controls | Slider / Dropdowns | `blastRadiusThreshold` slider (`10%–50%`, step `5%`), `maxRestarts` (`2`/`3`/`5`), `restartTimeWindow` (`10`/`15`/`30m`), `approvalTimeout` (`10`/`20`/`30m`), `cooldownPeriod` (`3`/`5`/`10m`) | Enforces blast-radius, circuit-breaker, and cooldown guardrails. |
| 4 | 8-Column Policies Table | Data Table | Cols: `Mã & Tên Quy Tắc`, `Phân Loại`, `Điều Kiện Kích Hoạt`, `Hành Động Tự Sửa Lỗi`, `Rủi Ro`, `Cần Duyệt (HITL)`, `Bật / Tắt`, `Chi Tiết` (`"Xem"`) | Lists active and inactive remediation policies with inline controls. |
| 5 | Immutable HITL Lock & Active Toggle | Badge / Toggle | Policies matching `ROLLBACK` or `DRAIN` render non-removable `"Bắt Buộc Duyệt (Khóa)"` lock (warning toast on click); Active switch toggles enabled state | Guarantees critical destructive actions can never bypass human approval. |
| 6 | `NewPolicyModal` — Trigger Condition Builder | Form Controls | Metric (6 options: CPU, Memory, Latency, HTTP 5xx, Pod Restart, Disk), Operator (`>`, `>=`, `==`), Threshold number, Duration (`1m`/`3m`/`5m`/`10m`), Namespace (`default`/`production`/`staging`/`all`) | Builds structured trigger rules without requiring raw PromQL syntax. |
| 7 | `NewPolicyModal` — Action, Risk & HITL Controls | Form Controls | Action select (**7 `STANDARD_ACTIONS`:** `SCALE_REPLICAS`, `RESTART_POD`, `REPLACE_POD`, `RESTART_DEPLOYMENT`, `ROLLBACK_DEPLOYMENT`, `CLEANUP_TEMP_FILES`, `DRAIN_NODE`), Risk (`LOW`–`CRITICAL`), HITL checkbox (auto-locked on high risk) | Configures the automated remediation action and approval gate. |
| 8 | `NewPolicyModal` — Policy Name & Live Preview | Input / Info Box | Auto-generated editable policy name + live human-readable rule preview card | Confirms rule semantics before creation. |
| 9 | `NewPolicyModal` Footer Buttons | Button Group | `"Hủy"` & `"Tạo Quy Tắc"` (`POST /self-healing/policies`; *errors via native `window.alert()`*) | Submits new remediation policy. |
| 10 | `PolicyDetailModal` Technical Metadata | Modal Content | Read-only display of ID, category, condition, action code, risk, HITL lock, cooldown, max retries, timestamps | Inspects full policy configuration. |
| 11 | `PolicyDetailModal` Delete Trigger | Button | Red `"Xóa Quy Tắc Này"` (`canManagePolicies`) | Opens the in-app policy deletion confirmation dialog. |
| 12 | Delete Policy Confirmation Dialog | Confirmation Modal | `"Xác nhận xóa quy tắc tự phục hồi"`, red warning, policy summary, `"Hủy"` & `"Xác nhận xóa"` (`DELETE /self-healing/policies/:id`) | Safely confirms permanent policy removal. |

---

### 2.4.9 SLA Reports & Multi-Format Export (`/dashboard/reports`)
- **Role:** All Authenticated SME Roles (`VIEWER` sees `"Chỉ Đọc (Viewer)"` lock pill with Export disabled) | **Layout:** `DashboardLayout` (+ `@media print` A4 executive layout) | **Source:** `pages/Dashboard/Reports/ReportsPage.jsx`, `components/dashboard/{ExcelExportModal,SLACostSavingsChart,IncidentSeverityBreakdown,ActionActorBreakdownChart,ErrorActionMatrixChart,ActionFailureReasonsChart}.jsx` | **Status:** 100% Real API | **Figures:** Figure 52, Figure 53

**Table 33. SLA Reports & Analytics**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Filter & Export Toolbar | Controls Bar | Scope toggle (`Cụm K8s` / `Toàn công ty`), Service select, Time Pills (`7D`, `1M`, `3M`, `6M`, `1Y`), Reset, `"Xuất Excel (.xlsx)"` + Dropdown (`CSV`, `JSON`, `In / Lưu PDF`); Disabled for `VIEWER` | Scopes SLA analytics and exports executive reports in 4 formats. |
| 2 | 4 Executive KPI Cards | KPI Cards | SLA Uptime %, Avg MTTR, Total Healing Actions, Success & AI/Human Autonomy Rate | Summarizes quarterly/monthly reliability KPIs. |
| 3 | `SLACostSavingsChart` | Multi-Mode Chart | 3 modes (`SLA Uptime`, `MTTR & Tự Trị`, `Kết Quả Action`), dual-axis SVG chart + cost-savings KPI strip | Visualizes reliability trends and estimated downtime cost savings. |
| 4 | Incident Types & `IncidentSeverityBreakdown` | Donut Charts | Root-cause SVG Donut + P1–P4 (`CRITICAL` `#EF4444`, `HIGH` `#F97316`, `MEDIUM` `#F59E0B`, `LOW` `#3B82F6`) Donut & 2×2 bars; Clicking cross-filters Table 1 | Breaks down incident frequency by category and severity. |
| 5 | Actor, Error×Action Matrix & Failure Charts | Charts / Heatmap | `ActionActorBreakdownChart`, `ErrorActionMatrixChart` heatmap (clickable cells cross-filter), `ActionFailureReasonsChart` horizontal bars | Analyzes AI vs Human execution ratio, remediation effectiveness, and failure causes. |
| 6 | Table 1 — Action Traceability Table | Data Table | 5 columns, server-paginated (`25`/page), 4 dropdown filters + search + active cross-filter chips | Audits individual error-to-action outcomes. |
| 7 | Before-vs-After Cards & Table 2 (Microservice SLA) | Comparison / Table | Side-by-side manual vs AI comparison cards + 6-col Microservice SLA table with search & SLA tier filter + print signature block | Evaluates per-service SLA compliance and AI ROI. |
| 8 | `ExcelExportModal` — 5 Quick Presets | Button Group | Presets: Full Report, Executive Summary, Incident/SLA, Detailed Action Log, Visual Charts | Rapidly selects common `.xlsx` sheet bundles. |
| 9 | `ExcelExportModal` — 10 Sheet Checkboxes | Checkbox Group | Individual toggles for all 10 report worksheets | Customizes included workbook tabs. |
| 10 | `ExcelExportModal` — Chart PNG & Row Scope | Toggle / Radio | Toggle to embed 2× resolution Canvas PNG charts + Row Scope (`25` current page vs `500` full fetch) | Controls chart imagery and row depth in generated Excel file. |
| 11 | `ExcelExportModal` — Filename Input | Input Field | Auto-sanitized `.xlsx` filename | Sets downloaded report file name. |
| 12 | `ExcelExportModal` — Generate Button | Button | `"Tạo & Tải File Excel"` (`exceljs` client generation with loading spinner) | Builds and downloads the customized `.xlsx` workbook. |

---

### 2.4.10 Tenant Immutable Audit Logs (`/dashboard/audit-logs`)
- **Role:** All Authenticated SME Roles (*Note: Export lacks `VIEWER` gate & exports current 10-row page only*) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/AuditLogs/AuditLogsPage.jsx`, `components/dashboard/AuditDistributionChart.jsx` | **Status:** 100% Real API (`GET organizations/:orgId/audit-logs`) | **Figures:** Figure 54, Figure 55

**Table 34. Tenant Immutable Audit Logs**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header & Export Dropdown | Header / Dropdown | Immutable ledger badge, Export (`CSV`, `JSON`, `In / Lưu PDF`), `"Làm mới"` | Refreshes ledger or exports current page of audit entries. |
| 2 | 4 Audit KPI Cards | KPI Cards | `Tổng Bản Ghi Sổ Cái`, `AI MAPE-K & Agent K8s`, `Cổng Phê Duyệt HITL`, `Vi Phạm Bị Chặn (RBAC)` | Summarizes audit activity by actor and security outcome. |
| 3 | Multi-Filter Bar | Controls Bar | Calendar popover (`Ngày`/`Tháng`/`Năm`, default `today`), Scope toggle (`Cụm`/`Công ty`), Service select, 300ms Search, Role pills (6 options), Status pills (`Tất cả`/`Thành Công`/`Thất Bại`/`Bị Từ Chối`) | Narrows up to 20,000 fetched records client-side. |
| 4 | `AuditDistributionChart` | Stacked Bar Chart | Toggleable 4-category chart (`AI/Agent`, `HITL`, `RBAC/Security`, `Config/Other`) with data-label switch & hover tooltip | Visualizes audit event volume distribution over time. |
| 5 | 6-Column Immutable Ledger Table | Data Table | Cols: `Log ID` (`AUD-000001`), `Thời gian`, `Chủ thể & Vai trò`, `Hành động & Mô tả`, `Đối tượng / Cụm`, `Trạng thái` + `"Chi tiết"`; 10 rows/page | Browses chronological tenant audit records. |
| 6 | Detail Modal — 4 Metadata Cards | Modal Cards | SHA-256 hash & ID, Actor/IP/User-Agent, Timestamp/Request ID, Status/Reason Code | Displays cryptographic proof and request provenance. |
| 7 | Detail Modal — Runtime Parameters & Description | Info Block | Extracted parameter pills + full action description | Explains exact operational context of the audited event. |
| 8 | Detail Modal — Before / After JSON State Diff | Code Diff Viewer | Side-by-side `"Trước thay đổi (Before)"` vs `"Sau thay đổi (After)"` formatted JSON panels + `"Đóng"` | Verifies exact resource state mutations. |

---

### 2.4.11 Emergency Alert Settings (`/dashboard/settings`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER` (`DEVOPS`/`VIEWER` 403) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Settings/SettingsPage.jsx` | **Status:** 100% Real API (`GET/PUT /organizations/:id/alert-settings`, `POST .../test`) | **Figures:** Figure 56

**Table 35. Emergency Alert Settings**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 3 Alert Settings KPI Cards | KPI Cards | `EMAIL CẢNH BÁO KHẨN`, `CHỐNG SPAM (COOLDOWN)`, `NGƯỜI NHẬN RBAC` | Displays active emergency notification configuration summary. |
| 2 | 3 Alert Trigger Checkboxes | Checkbox Group | `"Bật Email Cảnh Báo Khẩn Cấp"`, `"Gửi khi AI khuyến nghị NO_ACTION / Chờ kiểm tra"`, `"Gửi khi Auto-Healing thất bại"` | Enables or disables specific emergency email triggers. |
| 3 | Cooldown Presets & Numeric Input | Pill Group / Input | Presets (`5`, `15`, `30`, `60` phút) + integer input validated `1–1440` phút | Prevents alert email flooding during persistent incidents. |
| 4 | Additional Emails & RBAC Recipients Box | Input / Info Box | Comma-separated additional emails (regex-validated) + read-only preview of active `SME_OWNER` & `DEVOPS` emails (excludes `VIEWER`) | Defines custom escalation recipients alongside default RBAC recipients. |
| 5 | Test Email Input & Button | Input / Button | Target email + `"Gửi Email Test Cảnh Báo"` (`POST .../alert-settings/test`) | Verifies SMTP delivery to a chosen inbox. |
| 6 | Save Button `"Lưu Cấu Hình Cảnh Báo"` | Button | Primary `#059669`; Disabled if `!canEditAlertSettings` or saving (`PUT .../alert-settings`) | Persists organization emergency alert settings. |

---

### 2.4.12 Tenant Notifications Center (`/dashboard/notifications`, `/notifications`)
- **Role:** All Authenticated SME Roles | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Notifications/NotificationsPage.jsx` | **Status:** Hybrid (Real API + WS + `mocks/notificationMockData` initial seed) | **Figures:** Figure 57

**Table 36. Tenant Notifications Center**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | `"Đánh dấu tất cả đã đọc"` Button | Button | Disabled when `unreadNotifsCount === 0`; Calls `PATCH /users/me/notifications/read-all` | Clears all unread indicators across workspace notifications. |
| 2 | 3 Notification KPI Cards | KPI Cards | `TỔNG THÔNG BÁO`, `CHƯA ĐỌC`, `ĐÃ ĐỌC` | Summarizes notification inbox counters. |
| 3 | Status Tabs & Type Filter Chips | Tabs / Chips | Status (`Tất Cả`, `Chưa Đọc`, `Đã Đọc`) + Types (`Tất Cả Loại`, `Hạ Tầng`, `Tự Phục Hồi`, `Bảo Mật`, `Hệ Thống`) | Filters tenant operational notifications. |
| 4 | Notification Feed Cards | List Cards | Severity bar/icon, unread dot, title, message, env/cluster/resource tags, timestamp, deep-link CTA (`Xem Sự Cố` / `Tới Cổng Phê Duyệt`), read toggle (`PATCH .../read`) | Displays real-time operational events with quick navigation to affected screens. |
| 5 | `"Xem thêm"` Load-More Button | Button | Increments visible items by 6 per click; Empty state `"Không có thông báo nào"` | Loads older notifications progressively. |

---

## 2.5 DevOps Portal (`/dashboard/*` — Infrastructure Operations, Monitoring, Incidents & Remediation)

*(Note: DevOps also has full access to SME Overview [Table 26], Clusters without Delete [Tables 29–30], Policies [Table 32], Reports [Table 33], Audit Logs [Table 34], Notifications [Table 36], and read-only HITL Approvals [Table 31 / Figure 79].)*

### 2.5.1 Infrastructure Nodes (`/dashboard/infrastructure`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER`, `DEVOPS`, `VIEWER` (*RBAC Bug: `VIEWER` not blocked from Drain*) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Infrastructure/index.jsx` | **Status:** Partial Real API (Real node list & Drain API; CPU/RAM allocated estimated client-side; `maxPods=110` hardcoded) | **Figures:** Figure 58, Figure 59

**Table 37. Infrastructure Nodes**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header & Refresh Button | Header / Button | Title `"Hạ Tầng Máy Chủ (Nodes)"`, active cluster subtitle, `"Làm Mới"` (`nodeService.getNodesByCluster`) | Refreshes cluster node inventory manually. |
| 2 | 4 Node KPI Cards | KPI Cards | `TỔNG SỐ NODE`, `CPU PHÂN BỔ` (*est. `pods*0.15`*), `RAM PHÂN BỔ` (*est. `pods*0.2 GB`*), `PODS ĐANG CHẠY` (`/ maxPods`) | Summarizes node count and estimated cluster resource allocation. |
| 3 | Search & Status Filter Pills | Input / Pills | Search `"Tìm kiếm tên node, IP..."` + Pills (`Tất cả`, `Ready`, `NotReady`, `Cordoned`) | Filters cluster nodes by name, IP, or scheduling status. |
| 4 | 7-Column Nodes Table | Data Table | Cols: `TÊN MÁY CHỦ & IP`, `VAI TRÒ`, `TRẠNG THÁI`, `PODS`, `CPU ƯỚC TÍNH`, `RAM ƯỚC TÍNH`, `THAO TÁC` (`Chi tiết`, `Tháo tải (Drain)` — both open the same modal) | Displays per-node health and opens inspection/drain modal. |
| 5 | Node Modal — Header & Status Badge | Modal Header | Node name + `Ready` (`#059669`) / `NotReady` (`#DC2626`) / `Cordoned` (`#D97706`) badge | Identifies inspected Kubernetes node. |
| 6 | Node Modal — System Specs & Resource Bars | Info Grid / Progress | IP, OS, Kernel, Kubelet, Container Runtime + CPU/RAM/Pod bars | Displays detailed node runtime specifications. |
| 7 | Node Modal — `"Đóng"` & `"Tháo tải an toàn (Drain Node)"` | Button Group | Executes `POST /nodes/:id/drain` with loading state (*errors via `window.alert()`; **missing RBAC check for Viewer***) | Closes modal or cordons and drains pods off the node. |

---

### 2.5.2 Workloads & Pods (`/dashboard/workloads`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER`, `DEVOPS` (full + Restart via `ENV_MANAGE`), `VIEWER` (read-only) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Workloads/index.jsx` | **Status:** Partial Real API (3s auto-poll `podService`; estimated CPU/RAM; static `age` label) | **Figures:** Figure 60, Figure 61

**Table 38. Workloads & Pods**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | View Mode Toggle & Refresh | Segmented Control | `"Khối Công Việc"` (grouped) vs `"Từng Pod Riêng Lẻ"` (flat) + `"Làm Mới"` | Switches between Deployment/Workload grouping and individual Pod rows. |
| 2 | 4 Workload KPI Cards | KPI Cards | `TỔNG WORKLOADS`, `PODS SẴN SÀNG`, `LƯỢT RESTART`, `NAMESPACES` | Summarizes live workload health and crash-loop restarts. |
| 3 | Search, Namespace & Type Filter Pills | Controls Bar | Search input, dynamic Namespace pills, Workload Type pills (`Mọi loại`, `Deployments`, `DaemonSets`, `Core / Static`) | Filters workloads and pods by namespace and controller kind. |
| 4 | Workloads / Pods Table | Data Table | Name, Namespace, Type, Status (`Running`/`Pending`/`CrashLoopBackOff`/`Failed`), Restarts, Estimated CPU/RAM, Node, Actions (`Chi tiết` / `Khởi động lại` gated by `ENV_MANAGE`) | Monitors live pod health (refreshed every 3s) and triggers detail modal. |
| 5 | Detail Modal — Metadata Grid | Modal Content | Namespace, Node, Pod IP, Status, Restarts, Container Images | Inspects pod/workload operational metadata. |
| 6 | Detail Modal — Sub-Pod List | List | Lists member pods with individual status badges (in grouped Workload view) | Displays replica health breakdown. |
| 7 | Detail Modal — `"Đóng"` & Rolling Restart Button | Button Group | `"Khởi Động Lại Pod (Rolling Restart)"` (`POST /pods/:name/restart`; hidden for `VIEWER`; *errors via `window.alert()`*) | Executes rolling pod restart for remediation. |

---

### 2.5.3 eBPF Agents Management (`/dashboard/agents`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER` (full incl. `AGENT_DELETE`), `DEVOPS` (`AGENT_MANAGE` Disconnect only), `VIEWER` (read-only; *Install modal openable*) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Agents/index.jsx` | **Status:** Partial Real API (Real list/disconnect/delete; static heartbeat `3.0s` / `0.3% CPU` / `~15.1 MB RAM` / `Linux 5.15+` when ONLINE) | **Figures:** Figure 62, Figure 63

**Table 39. eBPF Agents Management**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Scope Toggle & `"+ Cài Đặt Agent Mới"` | Controls Bar | `"Cụm hiện tại"` vs `"Toàn tổ chức"`, `"Làm Mới"`, `"+ Cài Đặt Agent Mới"` | Switches org/cluster scope or opens agent installation instructions modal. |
| 2 | 4 Agent KPI Cards | KPI Cards | `TỔNG TÁC TỬ AGENT`, `ĐANG TRỰC TUYẾN`, `HEARTBEAT TRUNG BÌNH` (*static `3.0s`*), `CHI PHÍ TÀI NGUYÊN AGENT` (*static `0.3% / ~15.1 MB`*) | Displays agent fleet status and lightweight resource profile. |
| 3 | Search & Status Filter Pills | Input / Pills | Search input + Pills (`Tất cả`, `Trực tuyến`, `Ngoại tuyến`) | Filters agent inventory. |
| 4 | Agents Table | Data Table | Agent ID/Cluster, Status pill, Version/Kernel, Node & Heartbeat, Footprint, Actions (`Ngắt kết nối` [`AGENT_MANAGE`], `Xóa` [`AGENT_DELETE`]) | Monitors agent connectivity and launches lifecycle actions. |
| 5 | Install Modal — `AgentInstallerBanner` & 3 OS Tabs | Modal / Tabs | Tabs: `Windows PowerShell`, `Linux Bash`, `Helm Chart` | Selects deployment platform for installing a new agent. |
| 6 | Install Modal — Command Box & Copy | Code Box | Dark `#0F172A` command snippet + Copy button | Copies installation command to clipboard. |
| 7 | Disconnect Agent Confirmation Modal | Confirmation Modal | Warning + `"Hủy"` / `"Xác Nhận Ngắt Kết Nối"` (`POST /agents/:id/disconnect`) | Safely disconnects an active agent. |
| 8 | Delete Agent Confirmation Modal | Confirmation Modal | Warning + `force=true` checkbox (if ONLINE) + `"Hủy"` / `"Xóa Vĩnh Viễn"` (`DELETE /agents/:id`) | Permanently removes an agent record (`SME_OWNER`/`ADMIN` only). |

---

### 2.5.4 Node Metrics Flow Canvas (`/dashboard/monitoring/metrics`)
- **Role:** All Authenticated SME Roles | **Layout:** `DashboardLayout` (Full-bleed `isOverview=true`) | **Source:** `pages/Dashboard/Monitoring/MetricsPage.jsx`, `components/dashboard/{NodeMetricsFlowCanvas,NodeMetricsChartsPanel}.jsx` | **Status:** Real API (`lightweight-charts` v5 + 20s auto-poll; minor `minikube` fallback when empty) | **Figures:** Figure 64

**Table 40. Node Metrics Flow Canvas**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 4 Floating Glass KPI Cards | KPI Cards | `CPU MÁY CHỦ`, `BỘ NHỚ RAM`, `Ổ CỨNG (DISK)`, `MẠNG (RX / TX)` with peak/avg subtext | Displays real-time node utilization metrics at top of viewport. |
| 2 | Floating Metrics Control Bar | Controls Bar | Node `<select>`, Pods pill, Filesystem Mount `<select>` (if >1 mount), Time Pills (`15m`, `1h`, `6h`, `24h`, `7d`), Auto-refresh (`Auto 20s`/`Tạm dừng`), `"Làm mới"` | Filters telemetry by node, disk mount, and time window. |
| 3 | Stage 01 Cluster & Stage 02 Node Cards | Flow Nodes | Stage 01 Cluster telemetry source card (`LIVE`/`OFFLINE`) -> Stage 02 Clickable Node cards with CPU/RAM/Disk mini bars & Network RX/TX | Visualizes eBPF telemetry flow and lets user switch active node by clicking a card. |
| 4 | Stage 03 Synced `LightweightMetricChart` 2×2 Grid | Line/Area Charts | Synchronized time-axis toolbar (`<`, `ZoomIn`, `ZoomOut`, `>`, `Vừa khít`) + 4 `lightweight-charts` v5 panels (`196px` high): CPU (`#059669`), RAM (`#2563EB`), Disk (`#7C3AED`), Network RX/TX (`#0891B2`/`#EA580C` with series toggles) | Plots synchronized multi-resource telemetry with linked hover crosshair & time zoom. |
| 5 | Bottom Canvas Zoom & Reset Toolbar | Toolbar | Zoom `%`, `+`, `-`, `"Đặt lại góc nhìn mặc định (Reset)"` | Navigates the infinite pan/zoom node-metrics canvas. |

---

### 2.5.5 System & Container Logs (`/dashboard/monitoring/logs`)
- **Role:** All Authenticated SME Roles | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Monitoring/LogsPage.jsx`, `components/dashboard/LogDetailModal.jsx` | **Status:** 100% Real API (including real Fetch SSE Live Tail) | **Figures:** Figure 65, Figure 66

**Table 41. System & Container Logs**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Live Tail, Copy, Download & Refresh Controls | Button Group | `"Tạm dừng Live"` / `"Bật Live Tail"` (SSE `/logs/stream`), `"Sao chép"`, `"Tải xuống (.log)"`, `"Làm mới"` | Controls real-time log streaming and exports visible logs. |
| 2 | 4 Logs KPI Cards | KPI Cards | `TỔNG NHẬT KÝ`, clickable `LỖI (ERROR / FATAL)`, clickable `CẢNH BÁO (WARN)`, `LUỒNG STREAM` (SSE status) | Summarizes log severity volume and quick-filters errors/warnings. |
| 3 | 2-Row Filter & Cascading K8s Controls | Controls Bar | 300ms Search, 6 Level pills (`ALL`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`), 5 Time pills (`15m`–`Tất cả`), cascading `Namespace` / `Deployment` / `Pod` / `Service` dropdowns, Reset, `"Tự cuộn mới nhất"` checkbox | Pinpoints container logs across Kubernetes hierarchy; displays SSE overflow banner on backpressure. |
| 4 | Dark Terminal Log Viewer | Terminal / List | Bg `#0B1120`, text `#E2E8F0`, monospace, max 500 buffered lines, automatic secret masking (`maskSensitiveData`), GMT+7 timestamps, floating `"Cuộn về log mới nhất"`, Load More & pagination (`25`/`50`/`100`) | Streams and inspects raw container log lines safely. |
| 5 | `LogDetailModal` — Severity & K8s Metadata | Modal Header / Grid | `maxWidth: 780px`, `Esc` close; Severity pill, full GMT+7 timestamp, Namespace/Pod/Container/Service/Node metadata | Identifies exact container source of a selected log line. |
| 6 | `LogDetailModal` — Masked Message & Copy | Code Block | Full masked log payload + `"Sao chép nội dung"` button | Reads and copies complete log message without exposing secrets. |
| 7 | `LogDetailModal` — Expandable Raw JSON | Accordion / Code | Expandable raw JSON object + `"Sao chép JSON"` button + `"Đóng"` | Inspects structured telemetry fields attached to the log entry. |

---

### 2.5.6 Kubernetes Cluster Events (`/dashboard/monitoring/events`)
- **Role:** All Authenticated SME Roles | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Monitoring/EventsPage.jsx`, `components/dashboard/{EventDetailModal,K8sEventSeverityBadge}.jsx` | **Status:** 100% Real API | **Figures:** Figure 67, Figure 68

**Table 42. Kubernetes Cluster Events**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 4 Events KPI Cards | KPI Cards | `TỔNG SỰ KIỆN`, clickable `CẢNH BÁO (WARNING)`, clickable `THÔNG THƯỜNG (NORMAL)`, `TỔNG LƯỢT LẶP` | Summarizes cluster event counts and provides quick type filters. |
| 2 | 2-Row Event Filter Bar | Controls Bar | 300ms Search, Type pills (`Tất cả`/`Warning`/`Normal`), 6 Time pills (`15m`–`Tất cả`), dropdowns (`Namespace`, `Lý do (Reason)`, `Loại tài nguyên`), Reset | Filters Kubernetes events by severity, time, namespace, reason, and object kind. |
| 3 | 6-Column Events Table | Data Table | Cols: `MỨC ĐỘ & LÝ DO` (`K8sEventSeverityBadge`), `ĐỐI TƯỢNG (OBJECT)`, `NAMESPACE`, `NỘI DUNG SỰ KIỆN` (inline `Xem thêm`/`Thu gọn`), `LẶP LẠI & THỜI GIAN`, `THAO TÁC` (`Chi tiết`); Pagination `10`/`25`/`50`/`100` | Reviews Kubernetes scheduling, scaling, and probe events. |
| 4 | `EventDetailModal` — Severity/Reason Header | Modal Header | Fetches fresh record via `GET /k8s-events/:id`; Loading, 404 Not Found, and Error-Retry states | Displays authoritative event severity and reason. |
| 5 | `EventDetailModal` — Quick-Filter Chips | Button Group | `"Lọc theo loại"`, `"Lọc theo namespace"`, `"Lọc theo lý do"` | Closes modal and applies the selected filter directly to `EventsPage`. |
| 6 | `EventDetailModal` — Object & Timestamps Grid | Info Grid | Object, Kind, Namespace, Source Component, Host, First Seen, Last Seen, Observed | Displays full Kubernetes event lifecycle metadata. |
| 7 | `EventDetailModal` — Masked Message & Raw JSON | Code Blocks | Masked message + Copy + expandable Raw JSON | Inspects and copies complete Kubernetes event payload. |

---

### 2.5.7 Alerts & Threshold Rules (`/dashboard/alerts` — Direct URL Only)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `SME_OWNER`, `DEVOPS` (full CRUD + ACK/Resolve/Assign), `VIEWER` (read-only) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Alerts/{AlertsPage,AlertDetailDrawer,AlertRuleModal}.jsx` | **Status:** 100% Real API + WebSocket (*Unlinked in Sidebar/TopHeader; `Auto 15s` label actually polls 60s; Delete Rule lacks confirm dialog*) | **Figures:** Figure 69, Figure 70, Figure 71

**Table 43. Alerts & Threshold Rules**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header Controls & Rule Actions | Controls Bar | WS badge, Auto-refresh toggle (*labeled `Auto 15s`, runs `60s`*), `"Đánh Giá Rule Ngay"` (`canManageAlerts`), `"+ Tạo Quy Tắc Ngưỡng"` (`canManageAlerts`), `"Làm mới"` | Evaluates threshold rules on demand, opens rule modal, or refreshes alert stream. |
| 2 | 5 Alert KPI Cards | KPI Cards | `Tổng Cảnh Báo Đang Mở`, `Khẩn Cấp (CRITICAL)`, `Cảnh Báo (WARNING)`, `Thông Tin (INFO)`, `Đã Giải Quyết (RESOLVED)` | Summarizes active alert distribution by severity. |
| 3 | Alerts & Rules Tabs | Tabs | `Danh Sách Cảnh Báo` (`EVENTS`) & `Quy Tắc Ngưỡng Cảnh Báo` (`RULES`) *(No History tab — `AlertHistoryPage` unreachable)* | Switches between triggered alert events and threshold rule definitions. |
| 4 | 7-Control Events Filter Bar | Controls Bar | Search, Severity, Status (`OPEN`/`ACKNOWLEDGED`/`RESOLVED`), Source (`RESOURCE`/`APM`/`KUBERNETES`), Assignee (`UNASSIGNED`/`ME`/members), Time Range, Reset | Filters alert events across operational dimensions. |
| 5 | Events Table (9 cols) & Rules Table (7 cols) | Data Tables | Events: Severity, Name/Rule, Target, Value/Threshold, Status, Assignee, Repeat, Time, Actions (`Chi tiết`, `ACK`, `Resolve` -> inline Resolve confirm modal). Rules: Name, Category/Metric, Condition, Severity, Window/Cooldown, Enable Toggle, `Sửa`/`Xóa` (*no delete confirm*) | Manages triggered alerts and threshold rules; Viewer sees read-only rows. |
| 6 | `AlertDetailDrawer` — Header & 3 Metric Cards | Slide-Over Drawer | Width `640px`, `z-index: 60`; Severity/Status badges + Observed Value, Threshold, Dedup Count cards | Summarizes quantitative trigger context of the selected alert. |
| 7 | `AlertDetailDrawer` — Assignment Panel | Form / Confirm | `canManageAlerts` only: Member dropdown, `"Phân công"`, inline Reassign Confirmation box, `"Gỡ phân công"` | Assigns incident ownership to a team member. |
| 8 | `AlertDetailDrawer` — Audit Timeline | Timeline | Chronological state transitions (`OPEN` -> `ACKNOWLEDGED` -> `RESOLVED`), actors, and notes (`GET /alerts/:id/audit-trail`) | Tracks alert handling accountability. |
| 9 | `AlertDetailDrawer` — ACK & Resolve Forms | Forms | `canManageAlerts` only: Note inputs (max 2000 chars counter), optimistic locking `expectedVersion` (handles HTTP `409` conflict) | Acknowledges or resolves alerts with audit notes and concurrency safety. |
| 10 | `AlertRuleModal` — Identity & Metric Fields | Modal Inputs | Rule Name (2–255 chars), Description, Category (`RESOURCE`/`APM`/`KUBERNETES`), Metric Type (14 options) | Defines what telemetry signal a threshold rule evaluates. |
| 11 | `AlertRuleModal` — Condition & Window Fields | Modal Inputs | Operator (`>`, `>=`, `<`, `<=`, `==`), Threshold & Unit (`0–100` for `%`), Severity, `eval_window` (regex `^([1-9]\d*)(s\|m\|h)$`), Hold duration, Cooldown, Scope | Configures alerting sensitivity and anti-flap timing. |
| 12 | `AlertRuleModal` — Active Toggle & Submit | Toggle / Buttons | `"Kích hoạt ngay"` toggle, inline validation errors, `"Hủy"` & `"Tạo Quy Tắc"` / `"Lưu Thay Đổi"` | Validates and saves alert rule (`POST`/`PUT /alert-rules`). |

---

### 2.5.8 Incidents & Root Cause Analysis Drawer (`/dashboard/incidents`)
- **Role:** All Authenticated SME Roles (*Note: `"Xác Nhận & Đóng Sự Cố"` has no RBAC gate or confirmation dialog*) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/Incidents/{IncidentsPage,RootCauseModal,incidentUtils}.jsx` | **Status:** 100% Real API (15s poll) | **Figures:** Figure 72, Figure 73, Figure 74

**Table 44. Incidents & Root Cause Analysis**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header & Live Refresh Controls | Header | Title `"Quản Lý Sự Cố & Chẩn Đoán Gốc Rễ"`, live indicator, `"Làm mới"` | Displays incident dashboard context and refreshes manually. |
| 2 | 4 Clickable Incident KPI Cards | KPI Cards | `TỔNG SỰ CỐ`, `NGUY CẤP & CAO`, `ĐANG TỰ PHỤC HỒI`, `ĐÃ KHẮC PHỤC` (clicking sets quick filter) | Summarizes incident states and acts as fast filter toggles. |
| 3 | 2-Row Filter Bar & Calendar Popover | Controls Bar | Search, Severity quick pills (`Tất cả`/`Nguy cấp`/`Cao`/`Trung bình`/`Thấp`), Calendar (`Ngày`/`Tháng`/`Năm`/`Tất cả`, default `today`), Status select (7 states), Service select, `"Đặt lại bộ lọc"` | Filters incidents across time, severity, status, and microservice. |
| 4 | 6-Column Incidents Table | Data Table | Cols: `MÃ SỰ CỐ` (`INC-XXXXXXXX`), `MỨC ĐỘ`, `DỊCH VỤ / NODE`, `TIÊU ĐỀ SỰ CỐ` (+ AI confidence), `TRẠNG THÁI` (`Chờ duyệt HITL` links to `/dashboard/self-healing/approvals?target=`), `THAO TÁC` (`"Xem RCA"`); Pagination `10`/`20`/`50` | Lists incidents and opens deep RCA drawer (`?incident=` deep-link supported). |
| 5 | `RootCauseModal` — Header & 2 Tabs | Slide-Over Drawer | Width `880px`, `100vh`; Code, title, confidence pill, clickable AI Risk pill, Tabs: `"1. Chẩn Đoán & Khắc Phục"` & `"2. Viễn Trắc & Dự Báo AI"` | Frames full multi-agent diagnostic and GRU telemetry views. |
| 6 | Tab 1 — Urgent Banner & Metadata Grid | Banner / Info Grid | Conditional red banner when `CRITICAL` + `NO_ACTION`; 4-col metadata grid, Severity/Priority/Risk Score/Cluster/Source IP chips, Last Execution Error alert | Highlights emergency manual-intervention requirements and core incident metadata. |
| 7 | Tab 1 — Symptoms, Evidence & Healing Timeline | Diagnostics / Timeline | Expandable pod/event logs, `"Bằng chứng xác thực (evidence_for)"`, `"Dữ liệu còn thiếu (missing_evidence)"`, MAPE-K timeline (with `DRAIN_NODE` single-node/primary-DB circuit-breaker step) | Explains AI diagnostic evidence and chronological healing attempts. |
| 8 | Tab 1 — SelfAI Decision & SRE Playbook | Info Card / Code | Rule Engine (`ALLOW`/`BLOCK`), Circuit Breaker (`OPEN`/`CLOSED`), AI Early Risk, 3-step SRE playbook + dark `kubectl` CLI snippet with `"Sao chép"` | Guides SREs with verified remediation commands. |
| 9 | Tab 1 — Plain-Text SRE Summary | Text Box / Button | Formatted incident summary box + `"Sao chép"` button | Copies post-mortem summary for chat/ticket sharing. |
| 10 | `RootCauseModal` — Footer Actions | Button Group | Timestamp, `"Sao chép JSON"`, red `"Xác Nhận & Đóng Sự Cố"` (`PATCH /ai/incidents/:id/status` -> `RESOLVED`, *no confirm/RBAC*), `"Đóng cửa sổ"` | Exports JSON evidence or marks incident resolved. |
| 11 | Tab 2 — 7 GRU Risk Head Progress Cards | Progress Bars | `conf% / threshold%` bars for 7 K8s failure classes (`CPU_OVERLOAD`, `MEMORY_PRESSURE`, `LATENCY_SPIKE`, `ERROR_5XX_SPIKE`, `DISK_SATURATION`, `TRAFFIC_SURGE`, `POD_CRASH_LOOP`) | Shows multi-head neural network risk probabilities. |
| 12 | Tab 2 — 8 Telemetry Summary KPIs | KPI Cards | `CPU`, `RAM`, `Disk`, `Latency`, `Req/s`, `5xx`, `Restarts`, `Replicas` | Summarizes peak/latest telemetry snapshot at incident onset. |
| 13 | Tab 2 — 10-Column Timestep Sequence Table | Data Table | Monospace table of `T1..Tn` 12-step GRU input vectors (`GET /ai/predictions/:id/inputs`) | Enables forensic verification of exact time-series inputs fed into the GRU model. |

---

### 2.5.9 Live Self-Healing Actions — MAPE-K (`/dashboard/self-healing`, `/dashboard/self-healing/actions`)
- **Role:** All Authenticated SME Roles (`POLICY_MANAGE` gates `"Dừng can thiệp"` Abort button) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/SelfHealing/HealingActionsPage.jsx` | **Status:** Real API + WebSocket (*`SUCCEEDED` vs `COMPLETED` enum mismatch in KPI calculation*) | **Figures:** Figure 75, Figure 76

**Table 45. Live Self-Healing Actions (MAPE-K)**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header & Live WebSocket Badge | Header | Live WS status pill, `"Làm mới"`, quick links to History/Policies | Monitors live remediation channel status. |
| 2 | 4 Live Healing KPI Cards | KPI Cards | `ĐANG THỰC THI`, `HOÀN TẤT GẦN ĐÂY`, `TỶ LỆ THÀNH CÔNG`, `VÒNG LẶP MAPE-K` | Summarizes in-flight and recent autonomous healing activity. |
| 3 | 5-Stage MAPE-K Pipeline Grid | Stepper Cards | `1. MONITOR` -> `2. ANALYZE` -> `3. PLAN` -> `4. EXECUTE` -> `5. KNOWLEDGE` with active highlight | Shows current active phase of autonomous recovery. |
| 4 | Active In-Flight Actions List | Progress List | Action badge, target workload/namespace, live progress bar, elapsed time, red `"Dừng can thiệp"` button (`POLICY_MANAGE` only); Empty state when idle | Tracks executing remediations and allows authorized emergency abort. |
| 5 | Recent 5 Completed Actions & Guide | List / Cards | Last 5 completed actions + 3-card architectural guide (Autonomous MAPE-K, HITL, Circuit Breaker) | Provides quick visibility into latest outcomes and safety architecture. |
| 6 | Abort Modal — Target Summary & Warning | Confirmation Modal | `"Xác Nhận Dừng Can Thiệp Tự Động"`, target action ID/type/workload, amber Kubernetes impact warning | Clarifies consequences of aborting a running remediation. |
| 7 | Abort Modal — Reason Input | Input Field | Pre-filled `"Dừng can thiệp thủ công để kiểm tra sự cố"` | Captures mandatory audit reason for aborting execution. |
| 8 | Abort Modal — Footer Buttons | Button Group | `"Hủy"` & `"Dừng Can Thiệp Ngay"` (`POST /self-healing/actions/:id/abort`) | Cancels or aborts the active remediation action. |

---

### 2.5.10 Self-Healing Action History (`/dashboard/self-healing/history`)
- **Role:** All Authenticated SME Roles (Read-only) | **Layout:** `DashboardLayout` | **Source:** `pages/Dashboard/SelfHealing/{ActionHistoryPage,ActionDetailModal}.jsx`, `components/dashboard/SelfHealingTrendChart.jsx` | **Status:** Real API (*`SUCCEEDED` pill filter vs `COMPLETED` mapper mismatch*) | **Figures:** Figure 77, Figure 78

**Table 46. Self-Healing Action History**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 4 History KPI Cards | KPI Cards | `TỔNG HÀNH ĐỘNG`, `TỶ LỆ THÀNH CÔNG`, `MTTR TRUNG BÌNH`, `CHỜ DUYỆT HITL` | Summarizes historical remediation performance. |
| 2 | 2-Row Filter Bar | Controls Bar | Search, Status pills (`ALL`/`SUCCEEDED`/`PENDING`/`FAILED`/`CANCELLED`), Calendar popover, Service select, Action Type select (10 canonical types: `RESTART_POD`, `REPLACE_POD`, `SCALE_REPLICAS`, `RESTART_DEPLOYMENT`, `ROLLBACK_DEPLOYMENT`, `CLEANUP_TEMP_FILES`, `DRAIN_NODE`, `BLOCK_IP_TEMP`, `ADJUST_RESOURCE_LIMITS`, `NO_ACTION`), Reset, Chart toggle | Filters up to 2,000 historical remediation records. |
| 3 | `SelfHealingTrendChart` | Stacked Bar + Line Chart | Toggleable SVG stacked bar (Success/Failed/Pending/Cancelled) + success-rate line with hover tooltip | Visualizes historical remediation volume and success rate trends. |
| 4 | 7-Column Action History Table | Data Table | Cols: `MÃ BẢN GHI` (`ACT-...`), `HÀNH ĐỘNG & NỘI DUNG`, `ĐỐI TƯỢNG`, `THỜI LƯỢNG`, `KẾT QUẢ`, `THỜI ĐIỂM`, `CHI TIẾT` (`"Chi tiết"`); 10 rows/page | Browses historical self-healing executions and opens detail modal. |
| 5 | `ActionDetailModal` — Header & 4 Highlight Cards | Modal Cards | `maxWidth: 850px`; Short ID, UUID, status pill + 4 highlight cards (`Duration`, `SLO Probe`, `Target`, `Agent`) | Summarizes outcome and post-action SLO verification of a remediation. |
| 6 | `ActionDetailModal` — Summary Banner & Linked Incident | Info Cards | Color-coded execution summary banner + linked Incident code, root cause, and AI confidence | Connects the remediation back to its triggering root-cause incident. |
| 7 | `ActionDetailModal` — 6-Field Metadata Grid | Info Grid | Cluster, Namespace, Policy, Execution Mode, Actor/Approver, Timestamps + `"Đóng cửa sổ"` | Displays complete audit metadata for the action. |

---

## 2.6 Viewer Portal (Read-Only Monitoring & Reporting Role)

### 2.6.1 Viewer Role Access & Read-Only UI Restrictions
- **Role:** `VIEWER` | **Layout:** `DashboardLayout` / `AdminLayout` (Overview only) / `PersonalPortalLayout` | **Source:** `routes/index.jsx`, `hooks/usePermissions.js`, `components/dashboard/{Sidebar,TopHeader}.jsx`, `ReportsPage.jsx`, `Workloads/index.jsx`, `AlertsPage.jsx` | **Figures:** Figure 80, Figure 81

**Table 47. Viewer Role Access & Read-Only UI Restrictions**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Viewer Locked Export Indicator (`ReportsPage`) | Badge / Disabled Buttons | `"Chỉ Đọc (Viewer)"` lock pill; `"Xuất Excel (.xlsx)"` and Export dropdown (`CSV`/`JSON`/`PDF`) rendered disabled | Prevents read-only viewers from exporting executive SLA datasets. |
| 2 | Filtered Navigation Menus (`Sidebar` & `TopHeader`) | Navigation | Hides `Chờ phê duyệt` in `Sidebar`; hides `Tổ chức`, `Cụm Kubernetes`, `Chính sách tự lành`, `Cài đặt` in `TopHeader`; `AdminSidebar` shows only `Bảng Điều Khiển` (`/admin`) | Restricts Viewer navigation strictly to permitted monitoring and read-only views. |
| 3 | Read-Only Action Modals & Tables | Conditional Controls | Hides `Restart Pod` (`Workloads`), `Disconnect`/`Delete` (`Agents`), `Abort` (`HealingActions`), `Evaluate`/`Create Rule`/`ACK`/`Resolve`/`Assign` (`Alerts`) *(Known Gaps: `Infrastructure` Drain, `RootCauseModal` Resolve, and `AuditLogs` Export lack Viewer gates)* | Ensures read-only inspection without mutating cluster workloads or alert rules. |
| 4 | 403 Forbidden Route Guard (`ForbiddenPage`) | Error Guard | Triggered on direct URL access to `/dashboard/organization*`, `/dashboard/clusters*`, `/dashboard/self-healing/policies`, `/dashboard/self-healing/approvals`, `/dashboard/settings`, and `/admin/*` (except `/admin`, `/admin/overview`, `/admin/profile`) | Enforces route-level RBAC protection with role-specific access-denied messaging. |

---

## 2.7 Platform Admin & Super Admin Portal (`/admin/*`)

### 2.7.1 Admin Portal Shell (`AdminLayout`, `AdminSidebar`, `AdminHeader`, `AdminNotificationButton`, `AdminProfileMenu`)
- **Role:** `SUPER_ADMIN` (14 sidebar items), `ADMIN` (12 items; hides Roles & Settings), `DEVOPS` (7 technical items), `VIEWER` (Overview only) | **Layout:** `AdminLayout` | **Source:** `layouts/AdminLayout.jsx`, `components/admin/{AdminSidebar,AdminHeader,AdminBreadcrumb,AdminNotificationButton,AdminProfileMenu}.jsx` | **Status:** Implemented (Real API notifications popover) | **Figures:** Figure 82

**Table 48. Admin Portal Shell**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | `AdminSidebar` | Sidebar | Width `260px` / `72px` collapsed (`Ctrl+B`/`Cmd+B`, auto-collapse `<1024px`, `280px` slide-over drawer `<=768px`, `#FFFFFF`, `1px solid #E2E8F0`); Brand `"SelfAI Admin"` + role subtitle; 5 nav groups filtered by role; Hover dark tooltips (`#0F172A`) when collapsed; Skip-link `"Chuyển đến nội dung chính"` | Primary platform administration navigation scoped by RBAC role. |
| 2 | `AdminBreadcrumb` | Breadcrumb | Inside `64px` `AdminHeader`; `Shield` + `"ADMIN"` + clickable parent segments mapped via `PATH_NAME_MAP` | Displays hierarchy location and navigates to parent admin sections. |
| 3 | `AdminNotificationButton` Popover | Button / Popover | `38×38px` bell + `#EF4444` unread count (`9+`); `380px` popover with `"Đã đọc tất cả"`, 2 tabs (`Cảnh Báo Kỹ Thuật` via `getAlertsOverview` & `Bản Tin Phát Sóng` via `fetchAdminBroadcasts`, max 8 each), footer CTAs to `/admin/alerts` & `/admin/notifications` | Aggregates platform technical alerts and network broadcasts globally. |
| 4 | `AdminProfileMenu` (`UserProfileDropdown`) | Dropdown | `variant="admin"`, `logoutLabel="Đăng Xuất Khỏi Admin"`; Links `/portal`, `/dashboard`, `/admin`, `/portal/profile`, `/portal/security`, `/admin/audit-logs`, `/admin/settings` (*shown to ADMIN even though `/admin/settings` returns 403*) | Switches portals or signs out of the Admin Console. |

---

### 2.7.2 Admin Platform Overview (`/admin`, `/admin/overview`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS`, `VIEWER` (`SME_OWNER` redirected to `/dashboard`) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Overview/index.jsx`, `KPISection.jsx`, `AIAndAgentSections.jsx`, `InteractiveOrganizationGrowthChart.jsx` | **Status:** Real API with fallback + Client-Interpolated Historical Growth Chart | **Figures:** Figure 83

**Table 49. Admin Platform Overview**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header & Refresh Button | Header / Button | Emerald `LayoutDashboard` icon (`46×46px`), H1 `"Bảng Điều Khiển Quản Trị Nền Tảng"`, `"Làm Mới Dữ Liệu"` / `"Đang Nạp..."` | Reloads 5 parallel platform overview endpoints. |
| 2 | 4 Clickable Platform KPI Cards (`KPISection`) | KPI Cards | Inside `WidgetContainer` (6 states); 4-col grid (2-col `<=992px`, 1-col `<=540px`): `TỔNG SỐ COMPANY` (`/admin/companies`), `TỔNG SỐ USER` (`/admin/users`), `TỔNG SỐ AGENT TOÀN MẠNG` (`/admin/agents`), `TỔNG SỐ CỤM K8S` (`/admin/clusters`) | Displays macro platform metrics and navigates to management consoles. |
| 3 | `InteractiveOrganizationGrowthChart` | Multi-Series SVG Chart | `viewBox="0 0 800 280"`, 4 pillars (`#059669`, `#2563EB`, `#8B5CF6`, `#D97706`) + dashed red `#DC2626` KPI Target; Modes (`Theo Ngày` date pickers + `7N/14N/30N/90N`, `Theo Tháng`, `Theo Năm`), Scale toggle (`%` vs Absolute), 5 series pills, hover crosshair/tooltip, 4 summary cards (*historical points interpolated client-side from live totals*) | Analyzes platform growth trends across organizations, users, agents, and clusters. |
| 4 | `AIOverviewSection` | Info / KPI Card | Active model name, version, `ACTIVE` pill, 4 metrics (`ĐỘ CHÍNH XÁC`, `F1-SCORE`, `TỶ LỆ BÁO NHẦM`, `ĐỘ TRỄ SUY DIỄN`), footer (`TỔNG LƯỢT SUY LUẬN`, `Bộ dữ liệu`) | Summarizes live production AI model health and inference volume. |

---

### 2.7.3 Admin Organizations List (`/admin/companies`, `/admin/organizations`)
- **Role:** `SUPER_ADMIN`, `ADMIN` (*Gap: `/admin/organizations` not blocked for `SME_OWNER`/`DEVOPS`*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Organizations/OrganizationsListPage.jsx`, `components/admin/organizations/{OrganizationFilters,OrganizationTable,OrganizationStatusBadge}.jsx` | **Status:** Real API with dev mock fallback (*No Create/Edit modal; Suspend executes without confirm*) | **Figures:** Figure 84

**Table 50. Admin Organizations List**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 3 Summary KPI Cards | KPI Cards | `TỔNG DOANH NGHIỆP`, `ĐANG HOẠT ĐỘNG (ACTIVE)` (`#A7F3D0`), `TẠM DỪNG (SUSPENDED)` (`#FECACA`) | Summarizes total, active, and suspended tenant organizations. |
| 2 | `OrganizationFilters` Bar | Controls Bar | 300ms debounced search `"Tìm theo tên tổ chức, slug hoặc email..."`, Status `<select>` (`ALL`/`ACTIVE`/`SUSPENDED`), count pill `"Tổng cộng: N tổ chức"` | Filters tenant list by keyword or operational status. |
| 3 | 7-Column `OrganizationTable` | Data Table | Cols: `Tổ Chức & Tên Miền` (clickable), `Thành Viên`, `Cụm K8s & Pods`, `Tác Tử eBPF` (color-coded pill), `Trạng Thái` (`ACTIVE`/`TRIAL`/`SUSPENDED`/`INACTIVE`), `Ngày Tạo`, `Thao Tác Quản Trị` (`"Tạm Ngưng"`/`"Kích Hoạt"` calling `PATCH /organizations/:id/status` with *no confirm dialog*, + `"Chi Tiết ↗"`) | Manages all SME tenants and opens detailed tenant inspector. |
| 4 | Custom Pagination Footer | Pagination | Page sizes `10`/`20`/`50 doanh nghiệp` (client-side slicing) | Navigates organization directory pages. |

---

### 2.7.4 Admin Organization Details (`/admin/companies/:id`, `/admin/organizations/:id`)
- **Role:** `SUPER_ADMIN`, `ADMIN` (*Same `/admin/organizations/:id` gap*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Organizations/OrganizationDetailsPage.jsx`, `components/admin/organizations/*` (8 components) | **Status:** Real API with multi-layer mock fallback | **Figures:** Figure 85

**Table 51. Admin Organization Details**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Back Link & Tenant Status Action | Header / Button | `"← Quay lại danh sách tổ chức"` & `"Tạm Dừng Hoạt Động Tenant"` / `"Kích Hoạt Hoạt Động Tenant"` (*no confirm dialog*) | Returns to list or toggles tenant status immediately. |
| 2 | Tenant Identity, 2FA Badge & Quota Bars | Summary Card | `52×52px` avatar, name + status badge, domain/email/createdAt, 2FA policy badge (green enforced vs amber optional), 2 quota progress bars (`HẠN MỨC CỤM KUBERNETES`, `HẠN MỨC PODS`) | Displays tenant administrative profile, security policy, and resource quota usage. |
| 3 | 7 Detail Navigation Tabs (`role="tablist"`) | Tabs | `Tổng Quan Toàn Diện`, `Nhân Sự SME`, `Môi Trường`, `Cụm K8s`, `Tác Tử eBPF`, `Sự Cố & MTTR`, `Nhật Ký Kiểm Toán` + `"Làm mới"` | Switches between unified overview and dedicated tenant sub-resource tables. |
| 4 | 6 Tenant Sub-Resource Tables | Data Tables | Members (5 cols), Environments (5 cols), Clusters (7 cols), Agents (7 cols), Incidents (7 cols), Immutable Audit SHA-256 (5 cols); Individual loading/empty states + Not Found fallback | Provides read-only cross-domain inspection of a specific SME tenant. |

---

### 2.7.5 Admin Users Management (`/admin/users`, `/admin/members`)
- **Role:** `SUPER_ADMIN`, `ADMIN` | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Users/AdminUsersPage.jsx` | **Status:** 100% Real API (*Z-index bug: Drawer `9999` covers Lock Modal `1000` when triggered from inside drawer*) | **Figures:** Figure 86, Figure 87

**Table 52. Admin Users Management**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 4 User KPI Cards | KPI Cards | `TỔNG SỐ NGƯỜI DÙNG`, `ĐANG HOẠT ĐỘNG (ACTIVE)` (`#059669`), `ĐÃ XÁC THỰC EMAIL` (`#2563EB`), `QUYỀN QUẢN TRỊ VIÊN HIỆN TẠI` (`#7C3AED`) | Summarizes platform user base and email verification metrics. |
| 2 | Search, Status & Sort Toolbar | Controls Bar | 300ms search `"Tìm theo Họ tên, Email hoặc UUID..."` + clear `X`, Status `<select>` (`ALL`/`ACTIVE`/`PENDING`/`INACTIVE`/`SUSPENDED`), Sort By (`created_at`/`last_login_at`/`full_name`/`email`), Order toggle (`Mới nhất ↓`/`Cũ nhất ↑`) | Queries server-paginated user list (`GET /users`). |
| 3 | 6-Column Users Table | Data Table | `minWidth: 1240px`; Cols: `Người Dùng`, `Email & Định Danh` (verified check / amber `"Chưa xác thực"`), `Trạng Thái`, `Đăng Nhập Gần Nhất`, `Ngày Tạo`, `Thao Tác` (`Chi tiết`, `Khóa`/`Mở khóa` disabled for self or `ADMIN` targeting `SUPER_ADMIN`); 5-row skeleton loading, inline 403 & error states | Manages user accounts and access status across the platform. |
| 4 | `AdminTablePagination` | Pagination | Options `[10, 20, 50]`, `itemLabel="người dùng"` | Navigates user directory pages. |
| 5 | User Details Drawer — Overview & IAM Notice | Slide-Over Drawer | `maxWidth: 480px`, `zIndex: 9999`; Fetches `GET /users/:id` + `/roles`; Displays IAM protection notice for Admin/Super Admin accounts | Inspects comprehensive user profile and timestamps. |
| 6 | User Details Drawer — Manual Email Verify | Inline Confirm | `"Kích hoạt xác thực ngay"` button -> inline `"Xác nhận"` / `"Hủy"` calling `PATCH /users/:id/verify-email` | Manually verifies unconfirmed user email addresses. |
| 7 | Lock / Unlock Modal — Header & Summary | Confirmation Modal | `maxWidth: 480px`, `zIndex: 1000`; Red (`Khóa`) / Emerald (`Mở khóa`) header + target user card | Confirms target account before status mutation. |
| 8 | Lock / Unlock Modal — Warning & Buttons | Button Group | Immediate-effect warning + `"Hủy bỏ"` / `"Xác nhận khóa tài khoản"` (`PATCH /users/:id/status`) | Suspends or reactivates the user account with toast feedback. |

---

### 2.7.6 Admin Roles & RBAC Matrix (`/admin/roles`) — `[SUPER_ADMIN Only]`
- **Role:** **`SUPER_ADMIN` Only** (`ADMIN` receives embedded 403) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Roles/AdminRolesPage.jsx` | **Status:** Real API (Tab 1 & Modals = Real API; Tab 2 = Static Policy Matrix; Tab 3 = Audit API with dev fallback) | **Figures:** Figure 88, Figure 89

**Table 53. Admin Roles & RBAC Matrix**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Role Hierarchy Explainer Card | Info Card | Visual chain `SUPER_ADMIN (Tối Cao)` > `ADMIN (Vận Hành)` > `USER (Người Dùng)` + SME org-role scope note | Clarifies platform-level vs tenant-level RBAC inheritance. |
| 2 | 3 RBAC Navigation Tabs | Tabs | `Gán Vai Trò Người Dùng`, `Ma Trận Quyền Hạn Chi Tiết (9)`, `Nhật Ký Kiểm Toán Phân Quyền` | Switches between admin role assignment, policy matrix, and RBAC audit logs. |
| 3 | Tab 1 — Admin Assignment Table & Grant CTA | Controls / Table | `"+ Cấp Quyền Quản Trị"` button, search, Role select (`ALL`/`SUPER_ADMIN`/`ADMIN`), 5-col table (`NGƯỜI DÙNG`, `TỔ CHỨC`, `VAI TRÒ HIỆN TẠI`, `HOẠT ĐỘNG`, `THAO TÁC`: `Chi tiết` & `Thay đổi vai trò`) + `AdminTablePagination` | Lists and modifies platform `SUPER_ADMIN` and `ADMIN` accounts. |
| 4 | Tab 2 — 9-Module Permission Matrix | Read-Only Table | `"Chế độ Chỉ Đọc"` pill; 4 cols (`Phân Hệ & API Route`, `SUPER_ADMIN`, `ADMIN`, `USER`) across 9 platform modules | Documents backend-enforced RBAC rules transparently. |
| 5 | Tab 3 — RBAC Audit Trail Table | Data Table | 5 cols (`Thời Gian`, `Actor`, `Đối Tượng Nhận Quyền`, `Hành Động`, `Lý Do / Căn Cứ`) | Audits historical role promotions and demotions. |
| 6 | Modal 1 — Super Admin Security Warning | Alert Box | Amber warning shown when promoting to or demoting from `SUPER_ADMIN` | Highlights elevated privilege impact before applying change. |
| 7 | Modal 1 — Role Select & Audit Reason | Form | Role `<select>` (`SUPER_ADMIN`/`ADMIN`/`USER`), optional Audit Reason textarea, blocks no-op change, `"Hủy Bỏ"` & `"Lưu & Áp Dụng Ngay"` (`POST /roles/assign`) | Updates a user's platform system role. |
| 8 | Modal 3 — 2-Step Grant Admin Flow | Modal | Step 1: Email search (`GET /users?search=`) + `"Cấp Quyền"` per result; Step 2: Role (`ADMIN`/`SUPER_ADMIN`), **required** Reason textarea, `"Xác Nhận Cấp Quyền"` | Promotes a standard user to Admin or Super Admin with mandatory justification. |
| 9 | Modal 2 — Account Profile & Live Audit | Tabbed Modal | `maxWidth: 820px`; Tab 1: 6 identity tiles (UUID copy) + 4-col Associated Organizations table; Tab 2: Live audit event cards + SHA-256 snippet | Inspects an administrator's cross-organization footprint and live actions. |

---

### 2.7.7 Admin User Activity Tracking (`/admin/activity`)
- **Role:** `SUPER_ADMIN`, `ADMIN` (*RBAC Bug: matched before `isViewerUser`, reachable by `VIEWER`/`SME_OWNER`/`DEVOPS`*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Activity/AdminUserActivityPage.jsx` | **Status:** Real API with dev mock stats fallback | **Figures:** Figure 90

**Table 54. Admin User Activity Tracking**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 4 Activity KPI Cards | KPI Cards | `LƯỢT ĐĂNG NHẬP TÀI KHOẢN` (success %), `NGƯỜI DÙNG KÍCH HOẠT` (`#2563EB`), `ĐĂNG NHẬP THẤT BÀI` (`#DC2626`, *typo `[sic]`*), `THAO TÁC QUẢN TRỊ` (`#7C3AED`) | Summarizes authentication and administrative activity metrics. |
| 2 | Search, Action & Risk Filter Controls | Controls Bar | Search (name/email/IP/detail + clear `X`), Action `<select>` (8 auth/role/lock types), Client-side Risk `<select>` (`ALL`/`LOW`/`MEDIUM`/`HIGH`) | Filters activity events by keyword, action category, and risk level. |
| 3 | Multi-Mode Calendar Popover | Date Picker Popover | `330px` popover (default `today`); 3 tabs (`📅 Ngày` + 5 quick-day pills, `🗓️ Tháng` 12-month grid, `📆 Năm`) + `"Về hôm nay"` / `"Áp dụng"` | Scopes activity query by day, month, or year. |
| 4 | 6-Column Activity Table & Pagination | Data Table | `minWidth: 1080px`: `Thời Gian`, `Người Dùng`, `Hành Động`, `IP & Vị Trí` (mono IP + browser), `Mức Độ` (Red/Amber/Emerald pill), `Chi Tiết`; `AdminTablePagination` (`10`/`20`/`50`/`100`) | Audits platform-wide user logins and security events. |

---

### 2.7.8 Admin Growth Analytics (`/admin/analytics`)
- **Role:** `SUPER_ADMIN`, `ADMIN` (*Gap: `SME_OWNER`/`DEVOPS` not blocked in `routes/index.jsx`*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Analytics/AdminAnalyticsPage.jsx` | **Status:** 100% Real API + CSV Export | **Figures:** Figure 91

**Table 55. Admin Growth Analytics**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Year/Month Filters & CSV Export | Controls Bar | Year `<select>` (`2026`/`2025`/`2024`), Month `<select>` (`ALL`, `1–12`; *hardcoded `(+18 DN)`/`(+3 DN)` labels on Months 10–11*), `"Xem 12 Tháng"` reset chip, `"Làm Mới"`, `"Xuất Báo Cáo CSV"` (`GET /admin/analytics/export`) | Filters growth analytics timeframe and downloads CSV report. |
| 2 | 4 Platform Growth KPI Cards | KPI Cards | `Tổng Doanh Nghiệp Khách Hàng`, `Người Dùng Hoạt Động (MAU)`, `Cụm K8s Đang Quản Lý`, `Tỷ Lệ Tự Phục Hồi` | Summarizes macro business and infrastructure scale. |
| 3 | Chart View Control & 2 Clickable Bar Charts | Segmented Control / Charts | View modes (`Tất Cả`, `Doanh Nghiệp Mới`, `Người Dùng Mới`); 2 CSS bar charts (`height: 180px`, emerald `#10B981` & blue `#3B82F6`); Clicking any month bar filters KPIs | Visualizes monthly acquisition trends with interactive month drill-down. |
| 4 | Environment Breakdown & Correlation Cards | Progress / Metric Cards | 3 progress bars (`Production`, `Staging`, `Development`) + account status legend + 4 correlation tiles (`Users/Company`, `Service Density`, `Online eBPF`, `MAPE-K Rate`) | Breaks down tenant environment mix and operational ratios. |

---

### 2.7.9 Admin Network Broadcast Center (`/admin/notifications`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Notifications/AdminBroadcastPage.jsx` | **Status:** 100% Real API (*Delete executes immediately with no confirm; right inbox "Mark all read" is local state*) | **Figures:** Figure 92

**Table 56. Admin Network Broadcast Center**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Compose Broadcast Form (`Soạn Thông Báo Mới`) | Form Card | Title (`minLength=3`, required), Content textarea (`minLength=5`, required), Priority (`INFO`/`WARNING`/`CRITICAL`), Audience (`ALL`/`OWNERS`/`DEVOPS`), Checkboxes (`Pin Banner` default `true`, `SMTP Gmail` default `false`), `"Phát Thông Báo Toàn Mạng Ngay"` (`POST /admin/broadcasts`) | Creates and dispatches platform-wide announcements and optional emails. |
| 2 | Security & AI Alerts Inbox | List Card | Unread count, color-coded `ORG`/`AI`/`SECURITY` alerts, `"Đánh dấu tất cả cảnh báo là đã đọc →"` (*client-side state only*) | Displays internal platform security and model alerts alongside broadcast controls. |
| 3 | 7-Column Broadcast History Table | Data Table | Cols: `TIÊU ĐỀ` (code + 90-char preview), `MỨC ĐỘ`, `ĐỐI TƯỢNG`, `TRẠNG THÁI`, `THỜI ĐIỂM GỬI`, `LƯỢT TIẾP CẬN`, `THAO TÁC` (red `Trash2` calling `DELETE /admin/broadcasts/:id` with *no confirm*) | Reviews and deletes historical network broadcasts. |

---

### 2.7.10 Admin Agents Management (`/admin/agents`, `/admin/infrastructure/agents`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Agents/AdminAgentManagementPage.jsx` | **Status:** Partial Real API (List/Rotate/Revoke = Real API; `Ping` is 100% mock 800ms -> `"OK (1.1ms)"`; Drawer memory/kernel static; shadows `AdminInfrastructurePage` agents) | **Figures:** Figure 93, Figure 94

**Table 57. Admin Agents Management**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | One-Time New Token Banner | Alert Banner | `data-testid="admin-new-token-banner"`; Amber `#FFFBEB`, read-only monospace token input, `"Đóng"` | Displays newly rotated agent token once after rotation. |
| 2 | 4 Fleet Agent KPI Cards | KPI Cards | `TỔNG TÁC TỬ eBPF`, `TRỰC TUYẾN (ONLINE)` (*static `"Độ trễ trung bình: 1.1ms"`*), `SUY GIẢM (DEGRADED)`, `NGOẠI TUYẾN (OFFLINE)` | Monitors global eBPF agent fleet health. |
| 3 | Search, Status & Company Filter Bar | Controls Bar | 250ms search, Status (`ONLINE`/`DEGRADED`/`OFFLINE`), Company `<select>`, count display | Filters platform-wide agents by tenant, cluster, or status. |
| 4 | 7-Column Agents Table & Security Actions | Data Table | Cols: `Node Máy Chủ`, `Công Ty & Cụm K8s`, `eBPF & Kernel`, `Trạng Thái`, `Nhịp Tim / Độ Trễ`, `Agent Token`, `Thao Tác Bảo Mật` (`Ping` [*mock*], `Xoay Token`, `Thu Hồi`, `Chi Tiết`; Ping/Revoke disabled when `OFFLINE`) | Performs fleet diagnostics, token rotation, revocation, and profile inspection. |
| 5 | `AdminTablePagination` | Pagination | Options `[5, 10, 20, 50]`, `itemLabel="tác tử"` | Paginates global agent list. |
| 6 | Rotate / Revoke Token Confirmation Modal | Confirmation Modal | `maxWidth: 480px`, `zIndex: 9999`; `"Hủy Bỏ"` & `"Tiến Hành Xoay Vòng"` (`#059669`, `POST /agents/:id/tokens`) / `"Thu Hồi Ngay"` (`#DC2626`, `POST /agents/:id/revoke`) | Confirms security-sensitive token rotation or revocation. |
| 7 | Agent Profile Drawer — Header | Slide-Over Drawer | `maxWidth: 520px`, `"HỒ SƠ TÁC TỬ eBPF"`, node name, close `X` | Identifies inspected eBPF agent. |
| 8 | Agent Profile Drawer — 4 Technical Cards | Info Cards | `#F8FAFC` cards: `Công Ty Sở Hữu`, `Môi Trường Nhân (Kernel)`, `Kênh Viễn Trắc`, `Bảo Mật & Khóa Kết Nối` + `"Đóng Ngăn Thông Tin"` | Displays agent ownership, kernel metadata, and token security details. |

---

### 2.7.11 Admin Cluster Overview (`/admin/clusters`, `/admin/infrastructure/clusters`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Clusters/AdminClusterOverviewPage.jsx` | **Status:** 100% Real API (`GET /clusters`; shadows `AdminInfrastructurePage` clusters) | **Figures:** Figure 95

**Table 58. Admin Cluster Overview**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header & Sync Button | Header / Button | Emerald `Layers` icon, H1 `"Tổng Quan Cụm Kubernetes Toàn Mạng"`, `"Đồng Bộ Cụm"` | Reloads global cluster inventory from `GET /clusters`. |
| 2 | 4 Global Cluster KPI Cards | KPI Cards | `TỔNG CỤM K8S ĐĂNG KÝ`, `CỤM SẴN SÀNG (READY)`, `QUY MÔ MÁY CHỦ & PODS` (`#2563EB`), `CẢNH BÁO & LỖI` (dynamic red/amber border) | Summarizes multi-tenant Kubernetes capacity and health. |
| 3 | 4-Control Filter Bar | Controls Bar | Search, Status (`READY`/`WARNING`/`CRITICAL`), Environment (`Production`/`Staging`/`Development`), Company `<select>`, count display | Filters global clusters client-side. |
| 4 | 9-Column Clusters Table & Pagination | Data Table | Cols: `Tên Cụm & Vùng`, `Công Ty`, `Môi Trường`, `Phiên Bản K8s`, `Nodes & Pods`, `Tác Tử eBPF`, `Trạng Thái`, `Đồng Bộ Cuối`, `Thao Tác` (`"Xem Công Ty"` -> `/admin/organizations/:companyId`); `AdminTablePagination` (`10`/`20`/`50`) | Audits every registered tenant cluster and links to tenant details. |

---

### 2.7.12 Admin Unified Infrastructure (`/admin/infrastructure`, `/admin/infrastructure/nodes`, `/admin/infrastructure/workloads` — Direct URL Only)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Infrastructure/AdminInfrastructurePage.jsx`, `components/admin/infrastructure/*` | **Status:** Partial / Mostly Mock (`Nodes` & `Workloads` 100% Mock; ALL row actions = fake toasts; `AgentTable` 100% unreachable due to route shadowing) | **Figures:** Figure 96

**Table 59. Admin Unified Infrastructure**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 4 Infrastructure KPI Cards | KPI Cards | `CỤM KUBERNETES`, `TÁC TỬ eBPF SENSOR`, `MÁY CHỦ (NODES)`, `KHỐI CÔNG VIỆC (WORKLOADS)` | Summarizes platform infrastructure counts. |
| 2 | `InfrastructureNavTabs` (4 Tabs) | Tabs | `Cụm Kubernetes`, `Tác Tử eBPF`, `Máy Chủ (Nodes)`, `Khối Công Việc (Workloads)` (*Clicking Tab 1 or 2 navigates to shadowed routes `AdminClusterOverviewPage`/`AdminAgentManagementPage`*) | Switches infrastructure views across clusters, nodes, and workloads. |
| 3 | `InfrastructureFilters` | Controls Bar | Search (`320px`), context-aware Status `<select>`, Workload Type `<select>` (`Deployment`/`StatefulSet`/`DaemonSet` on workloads tab), `"Đặt lại"` | Filters table rows by status and workload controller type. |
| 4 | `ClusterTable` (10 cols), `NodeTable` (7 cols) & `WorkloadTable` (8 cols) | Data Tables | `NodeTable` renders CPU/RAM progress bars (red `#DC2626` `>80%`); `WorkloadTable` renders Desired vs Available replicas & type badges; Row actions (`Đồng Bộ`, `Quét An Toàn`, `Bảo Trì`, `Cuộn An Toàn`) fire *simulated client-side toasts only* | Displays cross-cluster nodes and workloads (*mock data on Nodes & Workloads*). |

---

### 2.7.13 Admin System Monitoring (`/admin/monitoring`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Monitoring/AdminMonitoringPage.jsx` | **Status:** 100% Real API (`GET /health`, `/ai/health`, `/ai-models`, `/ai/predictions/stats`) | **Figures:** Figure 97

**Table 60. Admin System Monitoring**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header Timestamp & Refresh Button | Header / Button | H1 `"Giám Sát Hệ Thống & Vi Dịch Vụ Cốt Lõi"`, `"Cập nhật lúc: HH:MM:SS"`, `"Làm Mới Số Liệu"` / `"Đang kiểm tra..."` | Runs live health checks across all 4 core backend subsystems. |
| 2 | 4 Core Subsystem Health Cards | Status Cards | Responsive grid (`minmax(280px,1fr)`): `Main Backend` (`PORT 5005`), `AI Backend Engine` (`PORT 8005`, Multi-Head GRU), `PostgreSQL Database` (`PORT 5433`), `Redis Cache Engine` (`PORT 6380`) with `ONLINE`/`OPTIMAL`/`HEALTHY`/`CONNECTED` vs `OFFLINE`/`DISCONNECTED` pills & latency/RAM specs | Monitors platform control-plane availability and database/cache connectivity. |
| 3 | AI Model Telemetry Health Card & CTA | Info Card / Button | 4 `#F8FAFC` tiles (Active Model, Accuracy/F1, FPR/Latency, Total Inference Count + Checkpoint path) + button `"So Sánh Model Trước/Sau"` (-> `/admin/ai/comparison`) | Displays production AI engine metrics and links to model comparison. |

---

### 2.7.14 Admin Platform Alerts (`/admin/alerts`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Alerts/AdminAlertsPage.jsx` | **Status:** Hybrid (Real API + 30s poll + 6-alert mock fallback; Threshold Modal = `localStorage`-only) | **Figures:** Figure 98, Figure 99

**Table 61. Admin Platform Alerts**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Header Actions (`Làm Mới` & `Cấu Hình Ngưỡng Cảnh Báo`) | Button Group | `"Làm Mới"` & `"Cấu Hình Ngưỡng Cảnh Báo"` (`Sliders`) | Refreshes platform alerts or opens threshold configuration modal. |
| 2 | 5 Core Health Strip Cards | Status Strip | `Main Backend (API)`, `AI Engine (FastAPI)`, `PostgreSQL`, `Redis Cache & Queue`, `WebSocket Telemetry` with status dot & latency ms | Provides instant platform service health telemetry. |
| 3 | 4 Platform Alert Metric Cards | KPI Cards | `CẢNH BÁO NỀN TẢNG`, `CẢNH BÁO KHẨN (CRITICAL)`, `TÁC TỬ eBPF NGOẠI TUYẾN`, `TỰ PHỤC HỒI & MTTR` | Summarizes platform alert volume and recovery efficiency. |
| 4 | Mass Disconnect Detection Banner | Alert Banner | Conditional red `#FEF2F2` banner (`offlineCount >= threshold`) with `"Đến Quản Lý Agent"` (`/admin/agents`) vs green `#F0FDF4` safe banner (`Bán Kính Ảnh Hưởng: 0.00`) | Detects and escalates correlated multi-agent disconnects. |
| 5 | Filter Bar & 7-Column Alerts Table | Controls / Table | Search, Category (`CORE_INFRA`/`DATABASE`/`SECURITY`/`PLATFORM_OPS`), Severity, Status; 7-col table with `"Đánh Dấu Giải Quyết"` (`PATCH /ai/incidents/:id/status`) + `AdminTablePagination` (`5`/`10`/`20`) | Investigates and resolves platform infrastructure alerts. |
| 6 | Thresholds Modal — 6 Numeric Inputs | Modal Inputs | `maxWidth: 520px`; HTML5 min/max/step validated: Mass Disconnect (`1–50`), AI Latency ms (`5–500`), API 5xx % (`0.1–10`), DB Pool % (`50–100`), Redis Backlog (`100–50000`), Max Failed Logins (`3–50`) | Configures client-stored platform alert threshold rules (*`localStorage`-only*). |
| 7 | Thresholds Modal Footer Buttons | Button Group | `"Hủy Bỏ"` & `"Lưu Cấu Hình"` (`#059669`) | Closes modal or saves thresholds locally with toast. |

---

### 2.7.15 Admin Incidents List & 8-Stage Incident Detail (`/admin/incidents`, `/admin/incidents/:id` — Direct URL Only)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Incidents/{IncidentsListPage,IncidentDetailPage}.jsx`, `components/admin/incidents/*` (8 components) | **Status:** **Partial / Broken on Live API** (`IncidentTable` L218 crashes on real DB rows; `IncidentDetailPage` mock-only IDs; HITL CTA links to 404 `/admin/approvals`) | **Figures:** Figure 100, Figure 101

**Table 62. Admin Incidents List & 8-Stage Incident Detail**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 5 Platform Incident KPI Cards | KPI Cards | `TỔNG SỐ SỰ CỐ`, `NGHIÊM TRỌNG (P1)`, `CHỜ DUYỆT HITL`, `ĐÃ KHẮC PHỤC`, `MTTR TRUNG BÌNH` | Summarizes cross-tenant incident volume and MTTR. |
| 2 | `IncidentFilters` Bar | Controls Bar | 300ms search, Severity (`CRITICAL`/`MAJOR`/`MINOR`/`INFO`), Status (`RESOLVED`/`HEALING`/`AWAITING_APPROVAL`/`RCA_COMPLETED`/`INVESTIGATING`), `"Đặt lại"` | Filters global incident list. |
| 3 | 13-Column `IncidentTable` | Data Table | ID, Clickable Title (-> `/admin/incidents/:id`), `SeverityBadge`, `IncidentStatusBadge`, Org, Env, Cluster, Source, Detected, Started, Resolved, MTTR, `"Chi Tiết"` (*Crashes on live API due to undefined `recoveryDuration`*) | Displays platform incident ledger. |
| 4 | Detail Header, Meta Grid & HITL Banner | Header Card | Back button, ID + Severity/Status badges, conditional red HITL banner (`AWAITING_APPROVAL`) with `"Đến Cổng Phê Duyệt HITL"` (*404 `/admin/approvals`*), 4-col Meta Grid | Summarizes incident ownership and approval gate status. |
| 5 | 4 Detail Sub-Tabs | Tabs | `Toàn Cảnh Sự Cố` (`all`), `Chu Trình 8 Giai Đoạn` (`timeline`), `Chẩn Đoán Nguyên Nhân Gốc (RCA)`, `Kế Hoạch Tự Phục Hồi` (`actions`) + `"Làm mới"` | Switches between full stacked view and focused investigation panels. |
| 6 | Horizontal 8-Stage `IncidentTimeline` | Stepper / Timeline | `Detection -> Investigation -> RCA -> Recommendation -> Approval -> Healing -> Verification -> Resolution` + vertical narrative feed (*mock*) | Tracks lifecycle progression of an incident. |
| 7 | `IncidentRCA` Panel | Diagnostic Panel | Confidence pill, Root Cause `#F0FDF4` callout, Causal Chain numbered cards, 4-col Telemetry Signals table, Amber Blast Radius bar | Explains causal diagnostics and service blast radius. |
| 8 | `IncidentHealingActions` Table | Read-Only Table | Amber safety notice + 7-col read-only actions table (`Hành Động`, `Phân Loại`, `Đối Tượng K8s`, `Tham Số`, `Trạng Thái`, `Thời Điểm`, `SHA-256`) (*mock*) | Audits recommended and executed healing steps without allowing direct bypass. |

---

### 2.7.16 Admin AI Management (`/admin/ai/overview`, `/admin/ai/models`, `/admin/ai/comparison`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked; `canManageModels` `|| true` bypass*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/AI/AdminAIPage.jsx`, `components/admin/ai/{AINavTabs,AIOverviewSection,AIModelsTable,AIComparisonView,UploadModelModal,AIEmptyState}.jsx` | **Status:** 100% Real API (`GET /ai-models`, `POST /ai-models/upload`, `PUT /ai-models/:id/activate`; `/predictions`, `/rca`, `/performance` redirect to `models`) | **Figures:** Figure 102, Figure 103, Figure 104, Figure 105

**Table 63. Admin AI Management (Overview, Registry & Comparison)**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | `AINavTabs` (3 Pill Tabs) | Tabs | `Tổng Quan AI` (`/admin/ai/overview`), `Kho Mô Hình Học Máy` (`/admin/ai/models`), `Đánh Giá & So Sánh Trước/Sau` (`/admin/ai/comparison`); Active `#059669`/`#FFFFFF` | Navigates across the 3 active AI governance views. |
| 2 | Overview — 5 AI KPI Cards | KPI Cards | `MÔ HÌNH HOẠT ĐỘNG`, `TỔNG LƯỢT SUY LUẬN`, `ĐỘ CHÍNH XÁC KIỂM ĐỊNH`, `DỰ BÁO CẢNH BÁO RỦI RO`, `PHÂN TÍCH NGUYÊN NHÂN (RCA)` | Summarizes AI model deployment and inference KPIs. |
| 3 | Overview — Production Active Model Banner | Banner Card | `2px solid #059669`, `PRODUCTION ACTIVE` pill, 5 quick metrics, CTAs `"So Sánh Phiên Bản"` & `"Hồ Sơ Chi Tiết Model"` | Highlights active model performance and links to registry/comparison. |
| 4 | Overview — Live Telemetry Risk Distribution | Stacked Bar | 14px segmented bar + legend: `NORMAL` (`#059669`), `OOM` (`#DC2626`), `HTTP_5XX_SPIKE` (`#7C3AED`), `HIGH_LATENCY` (`#2563EB`), `CPU_OVERLOAD` (`#D97706`) | Visualizes real-time risk classification distribution across live predictions. |
| 5 | Overview — 2 Spotlight Cards | Navigation Cards | Cards linking to `/admin/ai/models` & `/admin/ai/comparison` | Quick-launches model registry and comparison workflows. |
| 6 | Registry — 3 KPIs & Filter/Upload Bar | KPIs / Controls | 3 KPI cards; Search, Model Type select (4 types), Status select (`ACTIVE`/`TRAINING`/`DEPRECATED`), Reset, green `"+ Tải Lên Model Mới"` | Filters registered ML models and opens upload modal. |
| 7 | Registry — 7-Column `AIModelsTable` | Data Table | Sticky right `Thao Tác`: Name/UUID, Category, Version, Framework (`ONNX`/`PyTorch`), Status (+ `"⚡ Đổi sang model này"`), Dataset, Actions (`Kích hoạt` calling `PUT /ai-models/:id/activate`, `Chi tiết`) | Manages production activation and opens technical profile drawer. |
| 8 | Model Technical Drawer — Header | Slide-Over Drawer | `maxWidth: 720px`, `role="dialog"`; Status pill, UUID + `"Chép"` copy, conditional `"Kích hoạt model này"`, close `X` | Inspects and activates a selected ML model checkpoint. |
| 9 | Model Technical Drawer — 3 Inner Tabs | Tabbed Content | `Bảng Điểm Kiểm Định` (6 holdout metrics + 7-risk scorecard table), `Kiến Trúc & 8 Đặc Trưng` (static Multi-Head GRU & 8-feature table), `Vận Hành & Checkpoint` (checkpoint path, live count, metadata) | Audits model holdout accuracy, neural architecture, and runtime metadata. |
| 10 | `UploadModelModal` — File Dropzone | File Upload | `maxWidth: 620px`; Drag-and-drop/click (`accept=".pth,.pt,.onnx,.pkl"`); Auto-fills name & `v2.0.0` | Uploads trained ML model weight artifact. |
| 11 | `UploadModelModal` — Metadata & Hot-Reload | Form Inputs | Required Name & Version, Model Type select, Framework (`PyTorch`/`ONNX Runtime`/`Scikit-learn`), Notes textarea, checkbox `"Kích hoạt mô hình ngay (Hot-Reload)"` | Attaches registry metadata and optional zero-downtime activation. |
| 12 | `UploadModelModal` — Submit & Step 2/3 Scorecard | Button / Result | `"Tải Lên & Chạy Kiểm Định"` (`POST /ai-models/upload` multipart) -> Step 2 Evaluating spinner -> Step 3 6-metric verification scorecard + `"Hoàn Tất"` | Uploads, runs backend holdout validation, and displays benchmark results. |
| 13 | Comparison — Dual Model A/B Selector & CTA | Controls Bar | Model A (`Baseline`) `<select>`, circular Swap (`ArrowLeftRight`), Model B (`Candidate`, `2px #059669`), contextual `"Kích Hoạt Model Sau (B)"` or `"Rollback Về Model Trước (A)"` | Selects two evaluated models for head-to-head comparison or promotion/rollback. |
| 14 | Comparison — Automated AI Verdict Banner | Status Banner | 3 states: Green `"KHUYẾN NGHỊ: NÊN ÁP DỤNG"` (`diffF1>=0 && diffFPR<=0`), Amber `"CÂN NHẮC..."`, Red `"CẢNH BÁO: KHÔNG KHUYẾN NGHỊ ĐỔI"` | Provides automated deployment recommendation based on F1 & FPR deltas. |
| 15 | Comparison — 3 Inner Tabs | Tabbed Tables | Tab 1: 6 Overall metrics + A/B bars; Tab 2: 6 K8s Risks comparison (*Bug: renders literal `$\Delta$` & `$\rightarrow$`*); Tab 3: Client-computed Drift Score bar (`10%` threshold) & Model Audit Log | Compares overall accuracy, per-risk recall/F1, and model drift metrics. |
| 16 | Comparison — Rollback Confirmation Modal | Confirmation Modal | `maxWidth: 480px`, red `AlertTriangle` `"Xác Nhận Rollback Mô Hình AI"`, `"Hủy Bỏ"` & `"Xác Nhận Rollback Ngay"` (`PUT /ai-models/:id/activate`) | Confirms rolling back production inference to baseline Model A. |

---

### 2.7.17 Admin Self-Healing Management (`/admin/self-healing/*` — Direct URL Only)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/SelfHealing/AdminSelfHealingPage.jsx`, `components/admin/self-healing/*` (10 components) | **Status:** Real API with full Mock fallback (*Bugs: camelCase filter params ignored on live API; `/admin/approvals` 404 link; `updatePolicyConfig` drops `activeStatus`/`Dry-Run`*) | **Figures:** Figure 106, Figure 107

**Table 64. Admin Self-Healing Management**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | `SelfHealingNavTabs` (4 Tabs) | Tabs | `Hành Động Cứu Hộ` (`/actions`), `Danh Mục Loại Hành Động` (`/action-types`), `Chính Sách Tự Lành` (`/policies`), `Số Liệu Phân Tích` (`/analytics`); Active `#059669` | Navigates across platform self-healing governance views. |
| 2 | `SelfHealingFilters` & HITL Notice | Controls / Banner | 300ms search, Risk (`LOW`–`CRITICAL`), Mode (`AUTONOMOUS`/`HITL_GATE`/`MANUAL`), Status (`COMPLETED`/`EXECUTING`/`FAILED`/`ROLLED_BACK`), Reset + Amber HITL anti-bypass notice (`"Đến Cổng Phê Duyệt HITL"` -> *404 `/admin/approvals`*) | Filters platform remediation logs and enforces HITL visibility. |
| 3 | 14-Column `HealingActionsTable` | Data Table | Wide scrollable table: Action, Target, Org, Env, `RiskBadge`, `ExecutionModeBadge`, Approval (+ `"Chuyển Đến Duyệt →"`), Execution status, Requested/Executed By, 3 Timestamps, Result + SHA-256 | Audits cross-tenant self-healing actions globally. |
| 4 | `ActionTypesCatalog` Card Grid | Card Grid | Green info banner + `minmax(350px,1fr)` cards showing category, `RiskBadge`, description, target resource, HITL requirement, Rollback capability (*read-only; no empty state*) | Catalogs supported Kubernetes remediation action definitions. |
| 5 | 10-Column `PoliciesTable` | Data Table | Policy Name, Trigger, Risk Class, Execution Mode, Confidence (`>=X%`), Cooldown, Max Retries, Approval Rule, Active Pill Toggle (`PATCH /healing/policies/:id/toggle`), `"Cấu Hình"` button | Lists and toggles global self-healing policies. |
| 6 | `SelfHealingAnalytics` (5 KPIs + Bars) | KPIs / Bar Chart | 5 KPI cards (Total, Success Rate, Failed, Avg MTTR, Retries) + Horizontal gradient Action Type Distribution bars | Visualizes platform-wide self-healing efficacy. |
| 7 | `PolicyConfigModal` — Header & Safety Notice | Modal Header | `maxWidth: 520px`, `Esc` close; Glossy emerald header (`#065F46->#059669`), Policy ID/Name, safety notice | Frames policy parameter editing modal. |
| 8 | `PolicyConfigModal` — Parameter Controls | Form Controls | Confidence Slider (`80–99%`), Cooldown `<select>` (`5m`–`60m`), Max Retries (`1–5`), Execution Mode (`Fully Autonomous`/`HITL Approval Required`/`Dry-Run Only`) | Tunes policy thresholds and automation posture. |
| 9 | `PolicyConfigModal` — Active Checkbox | Checkbox | `"Kích hoạt chính sách này trên toàn nền tảng (Active)"` (*Note: omitted in `PUT` payload bug*) | Toggles policy active state inside modal. |
| 10 | `PolicyConfigModal` — Footer Buttons | Button Group | `"Hủy"` & `"Lưu Cấu Hình"` (`#059669`, `Save` icon) | Closes modal or submits policy update (`PUT /healing/policies/:id`). |

---

### 2.7.18 Admin Immutable Audit Logs SHA-256 (`/admin/audit-logs`)
- **Role:** `SUPER_ADMIN`, `ADMIN`, `DEVOPS` (*Gap: `SME_OWNER` not blocked*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/AuditLogs/AdminAuditLogsPage.jsx`, `components/admin/audit-logs/*` (5 components) | **Status:** Real API + Mock Fallback + Partial KPI Synthesis (*Sort params not forwarded to live API*) | **Figures:** Figure 108

**Table 65. Admin Immutable Audit Logs (SHA-256)**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | 5 Audit Summary KPI Cards | KPI Cards | `TỔNG BẢN GHI KIỂM TOÁN`, `TÍNH TOÀN VẸN MẬT MÃ` (*hardcoded `"100% (SHA-256 Validated)"`*), `HÀNH VI BỊ CHẶN (BLOCKED)`, `CAN THIỆP TỰ ĐỘNG AI` (*synthesized `40%`*), `TÁC NHÂN ĐÃ GHI NHẬN` | Summarizes platform cryptographic audit metrics. |
| 2 | `AuditLogsFilters` & Active Chips Bar | Controls / Chips | 300ms full-text search + 6 selects (`Date Range`, `Actor Type`, `Action` [12 values], `Resource Type`, `Cluster`, `Status`) + removable blue filter chips & red `"Xóa tất cả"` | Filters immutable audit records across platform dimensions. |
| 3 | 9-Column `AuditLogsTable` | Data Table | Sortable headers (Timestamp, Actor, Action, Cluster, Status), `ActorTypeBadge` (`SYSTEM_AI`/`EBPF_AGENT`/`API_KEY`/`USER`), `AuditStatusBadge`, IP, `Eye` detail button (full row clickable) + `AdminTablePagination` (`10`/`25`/`50`) | Browses platform-wide immutable audit events. |
| 4 | `AuditDetailDrawer` | Slide-Over Drawer | `maxWidth: 640px`, `zIndex: 9999`, `Esc`/backdrop close; Cryptographic seal banner, 2×2 context grid, Description, side-by-side Red `BEFORE DATA` vs Green `AFTER DATA` JSON diff, dark `#0F172A` SHA-256 hash box with Copy (`Copy`->`Check`), Correlation ID/Latency/Session/IP/UA, `"Đóng ngăn kéo"` | Performs read-only forensic inspection and hash verification of any audit record. |

---

### 2.7.19 Admin System Settings `[SUPER_ADMIN Only]` & Account Settings (`/admin/settings`, `/admin/account-settings`)
- **Role:** `/admin/settings` = **`SUPER_ADMIN` Only** (`ADMIN` 403); `/admin/account-settings` = Direct URL only (*RBAC bug: reachable by `VIEWER`*) | **Layout:** `AdminLayout` | **Source:** `pages/Admin/Settings/{AdminSystemSettingsPage,AdminAccountSettingsPage}.jsx` | **Status:** Mostly Mock / 100% Mock (only Audit Retention Stats/Purge & embedded Tab 6 Audit Logs call real APIs) | **Figures:** Figure 109, Figure 110

**Table 66. Admin System Settings & Account Settings**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | System Settings — 6 Tabs | Tabs | `AI Model & Configuration`, `Self-Healing Policy`, `Platform Settings`, `Maintenance & Updates`, `Data Management & Storage`, `Nhật Ký Kiểm Toán (Audit Logs)` (embeds `<AdminAuditLogsPage />`) | Organizes global platform configuration categories. |
| 2 | Tabs 1–3 Numeric & Checkbox Forms | Forms | Tab 1: Model Version (disabled), Confidence (`0.5–0.99`), Latency (`5–100ms`), Window (`10–300s`), 2 checkboxes (*plus misplaced Retention Purge widget with raw `${retentionStats.*}` bug*); Tab 2: Retries, Cooldown, 2 checkboxes; Tab 3: WS Heartbeat, Agent Timeout, Rate Limit, red Maintenance Mode checkbox | Adjusts platform AI, self-healing, and networking parameters (*Save buttons currently fire local mock toast only*). |
| 3 | Tab 4 — Maintenance & Release Cards | Info Cards | 3 read-only hardcoded version cards (`v2.4.0-stable`, `v2.1.0-prod`, `v1.4.2-ebpf`) + scheduled maintenance window notice | Displays current control-plane release versions. |
| 4 | Tab 5 — Retention Controls & Storage Bar | Form / Progress | Audit Retention (`30–730d`), Telemetry Retention (`7–90d`), hardcoded PostgreSQL usage bar (`14.2 GB / 100 GB`) | Displays data retention policy and storage utilization. |
| 5 | Tab Save Buttons & Retention Purge Button | Buttons | `"Lưu Cấu Hình AI/Chính Sách/Mạng/Lưu Trữ"` (*mock toast*); `"Dọn Dẹp Log Quá Hạn Ngay"` (real `POST audit-logs/retention/purge` with `window.confirm`) | Triggers retention purge or simulates saving settings. |
| 6 | Account Settings (`/admin/account-settings`) — 5 Tabs | Tabs | `Hồ Sơ Cá Nhân`, `Đổi Mật Khẩu`, `Xác Thực 2 Bước (2FA)`, `Phiên Đăng Nhập`, `Tùy Chọn Thông Báo` (*100% Mock / Client-Only; unlinked in Sidebar/Profile Menu*) | Provides standalone mock admin account preferences interface. |
| 7 | Account Settings — Profile, Password & 2FA Forms | Forms | Name/Phone (editable), Email/Role (disabled), Password inputs (basic non-empty/match check), 2FA local toggle | Simulates local admin profile and security updates. |
| 8 | Account Settings — Sessions & Notification Checkboxes | List / Checkboxes | 3 mock active sessions + `"Đăng Xuất Khỏi Các Phiên Khác"`, 5 email notification checkboxes + `"Lưu Tùy Chọn"` | Simulates session revocation and notification settings. |

---

## 2.8 System Error & Operational Status Pages

### 2.8.1 HTTP Error & Infrastructure Status Pages (10 Variants)
- **Routes:** `/401` (`/unauthorized`), `/403` (`/forbidden`), `/404` (`/not-found`), `/429`, `/500`, `/503`, `/maintenance`, `/status/agent-offline`, `/status/cluster-lost`, `/status/monitoring`, plus RBAC guard blocks & unknown catch-all `*`
- **Role:** Public / All Roles | **Layout:** `PublicLayout` (standard routes), Standalone (un-wrapped RBAC blocks), or Embedded inside `AdminLayout`/`DashboardLayout`/`PersonalPortalLayout` | **Source:** `pages/Error/{PixelStatusPage,statusConfigs,StatusPages,ForbiddenPage}.jsx`, `PixelStatusPage.css` | **Status:** Implemented (Static Pixel-Art + 404 Toast warning; **missing in-page return CTA buttons**) | **Figures:** Figure 111, Figure 112

**Table 67. System Error & Operational Status Pages**

| No. | Field Name | Type | Require | Target |
|---|---|---|---|---|
| 1 | Scenic Pixel-Art Background | Image / Container | Full-bleed (`min-height: 520px`) or `embedded` (`min-height: 440px`, `radius: 16px`); 3 sky themes (`bg-daylight.png`, `bg-sunset.png`, `bg-twilight.png`; fallback sky gradient); Stacks vertically (`column-reverse`) at `<=768px` | Provides calm, distinct visual atmosphere per error severity class. |
| 2 | Large Shadowed HTTP Code | Text | `Anybody` `clamp(3.5rem, 7vw, 5.25rem)`, weight `700`, `#FFFFFF` with drop shadow: `401`, `403`, `404`, `429`, `500`, `503` | Clearly communicates the exact HTTP status code. |
| 3 | Status Speech Bubble (`role="alert"`) | Callout Box | `#FFFFFF`, `#24292F`, `radius: 6px`, padding `20px 24px`, right triangle pointer (top-center `<=768px`); `H1` (`Anybody 1.05rem`) + `p` (`DM Sans 0.9375rem`); Overridden with role-specific Vietnamese message on RBAC 403 blocks | Explains the error or access restriction clearly to the user. |
| 4 | Pixel-Art Mascot Artwork | Image | `260×260px` (`210×210px` `<=768px`), `image-rendering: pixelated`; Dedicated `status-*.png` per variant + oval ground shadow | Reinforces error context with consistent brand illustration. |
| 5 | Invalid Path 404 Warning Toast | Toast Notification | Fired via `ToastContext.warning` once per `warnPath` (`"Đường dẫn \"{warnPath}\" không tồn tại..."`, title `"Cảnh báo chuyển trang — 404"`) | Alerts user immediately when navigating to an unknown URL. |
| 6 | Operational Text-Status Headline (`isTextStatus`) | Text | Scaled `clamp(2.1rem, 4.2vw, 3.1rem)`: `AGENT OFFLINE`, `CLUSTER LOST`, `MONITORING`, `MAINTENANCE` | Displays non-HTTP infrastructure operational state cleanly. |
| 7 | Operational Artwork & Speech Bubble | Image / Callout | Dedicated artwork (`status-agent-offline.png`, `status-cluster-lost.png`, `status-monitoring.png`, `status-maintenance.png`) + status copy; *Note: Zero navigation/back buttons rendered inside `PixelStatusPage`/`ForbiddenPage`* | Informs users of platform maintenance or cluster/agent telemetry outages. |
