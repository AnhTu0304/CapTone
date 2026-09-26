---
version: alpha
name: Greptile
description: |
  Greptile's design system projects a modern, technical, and approachable
  aesthetic tailored for engineering teams. The palette combines a sophisticated
  dark navy (#3D3B4F) with a vibrant mint accent (#28E99F), creating high
  contrast and visual energy. The canvas background (#EEEEEE) maintains
  brightness and clarity, supporting readability and focus. Typography anchors
  the system with Anybody for display and DM Sans for body text, reinforcing
  both personality and accessibility. Shadows are minimal; depth comes primarily
  through color-blocking — strategic use of surface colors rather than layered
  elevation. The overall impression is clean, purposeful, and trustworthy —
  appropriate for a product that reviews and validates code.
source:
  url: "https://www.greptile.com/?utm_source=vite&utm_medium=sponsorship&utm_campaign=vite_sponsor_page"
  pagesAnalyzed: 1
  extractedAt: 2026-09-16
  tokensMeasured: true
colors:
  primary: "#3D3B4F"
  accent: "#28E99F"
  link: "#555368"
  canvas: "#EEEEEE"
  on-primary: "#FFFFFF"
  ink: "#000000"
  body: "#3D3B4F"
  muted: "#FFCFFE"
  hairline: "#D6D6D6"
  accent-1: "#ECFFA3"
  neutral-1: "#2A2A2A"
typography:
  display-xxl:
    fontFamily: Anybody
    fontSize: 96px
    fontWeight: 800
    lineHeight: 1
    letterSpacing: -2.4px
  display-xl:
    fontFamily: Anybody
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -1.92px
  heading-md:
    fontFamily: Anybody
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.11
    letterSpacing: -1.44px
  heading-sm:
    fontFamily: Anybody
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -1.2px
  heading-xs:
    fontFamily: Anybody
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: -0.96px
  body-xl:
    fontFamily: Anybody
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: -0.48px
  body-lg:
    fontFamily: Anybody
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: -0.4px
  body-md:
    fontFamily: Anybody
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.18px
  body-md-dm-sans:
    fontFamily: "DM Sans"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.56
    letterSpacing: -0.18px
  body-sm:
    fontFamily: Anybody
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.14px
  body-sm-strong:
    fontFamily: Anybody
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.14px
  button:
    fontFamily: Anybody
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0px
  caption:
    fontFamily: "DM Sans"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  code-lg:
    fontFamily: "Space Mono"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0.35px
    textTransform: uppercase
  code-md:
    fontFamily: "Space Mono"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0.6px
    textTransform: uppercase
  code-sm:
    fontFamily: "Space Mono"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0.28px
    textTransform: uppercase
  code-sm-2:
    fontFamily: "Space Mono"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0.55px
    textTransform: uppercase
  code-xs:
    fontFamily: "Space Mono"
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  code-xs-uppercase:
    fontFamily: "Space Mono"
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 3px
    textTransform: uppercase
rounded:
  none: 0px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 40px
  xxxl: 48px
  section: 64px
  band: 80px
borderWidths:
  thin: 1px
elevationStrategy: color-blocking
themes:
  derived: dark   # the other theme is the site's measured palette
  light:
    bg: "#EEEEEE"
    surface: "#E7E7E7"
    surfaceRaised: "#DEDEDE"
    text: "#000000"
    textMuted: "#3D3B4F"
    border: "#D6D6D6"
    accent: "#3D3B4F"
    accentFg: "#FFFFFF"
    focusRing: "#3D3B4F"
    elevation: shadow
  dark:
    bg: "#0E0E10"
    surface: "#1C1C1E"
    surfaceRaised: "#29292A"
    text: "#F7F7F8"
    textMuted: "#9E9EA0"
    border: "#353536"
    accent: "#7F7C9D"
    accentFg: "#0B0B0C"
    focusRing: "#615E7E"
    elevation: "border+surface"
components:
  button-primary:
    typography: "{typography.body-sm}"
    textColor: "{colors.canvas}"
    height: 41px
    padding: "10px 26px 10px 26px"
    backgroundColor: "{colors.primary}"
  button-filled:
    typography: "{typography.body-sm}"
    textColor: "{colors.ink}"
    height: 41px
    padding: "10px 26px 10px 26px"
    backgroundColor: "{colors.accent}"
  button-filled-lg:
    typography: "{typography.body-md}"
    textColor: "{colors.accent-1}"
    height: 55px
    padding: "14px 34px 14px 34px"
    backgroundColor: "{colors.accent-1}"
  button-primary-2:
    typography: "{typography.body-sm}"
    textColor: "{colors.hairline}"
    height: 41px
    padding: "10px 26px 10px 26px"
    backgroundColor: "{colors.primary}"
  navigation:
    typography: "{typography.caption}"
    textColor: "{colors.ink}"
    height: 66px
  footer:
    typography: "{typography.caption}"
    textColor: "{colors.ink}"
    backgroundColor: "{colors.canvas}"
  link:
    typography: "{typography.caption}"
    textColor: "{colors.ink}"
  link-sm:
    typography: "{typography.body-sm}"
    textColor: "{colors.accent-1}"
    padding: "10px 26px 10px 26px"
    backgroundColor: "{colors.primary}"
states:
  other-hover:
    target: other
    state: hover
    backgroundColor: "rgba(61, 59, 79, 0.03)"
  link-hover:
    target: link
    state: hover
    textColor: "rgba(0, 0, 0, 0.7)"
  button-hover:
    target: button
    state: hover
    transform: "translate(-4px)"
breakpoints:
  - width: 375
    containerWidth: 327
    gridColumns: 4
    navLinksVisible: 2
    menuToggleVisible: true
    headingPx: 60
    bodyPx: 16
    sectionPaddingX: 24
  - width: 768
    containerWidth: 672
    gridColumns: 4
    navLinksVisible: 2
    menuToggleVisible: true
    headingPx: 72
    bodyPx: 16
    sectionPaddingX: 48
  - width: 1024
    containerWidth: 896
    gridColumns: 8
    navLinksVisible: 7
    menuToggleVisible: false
    headingPx: 96
    bodyPx: 16
    sectionPaddingX: 64
  - width: 1280
    containerWidth: 1152
    gridColumns: 8
    navLinksVisible: 7
    menuToggleVisible: false
    headingPx: 96
    bodyPx: 16
    sectionPaddingX: 64
  - width: 1440
    containerWidth: 1312
    gridColumns: 8
    navLinksVisible: 7
    menuToggleVisible: false
    headingPx: 96
    bodyPx: 16
    sectionPaddingX: 64
coverage:
  statesFound: 61
  gradientsFound: 0
  rolesUnassigned: 2
  archetypesUnnamed: 0
  archetypesDetected: 0
  responsiveMeasured: true
  stylesheetsBlocked: false
  semanticRampDeclared: false
---

# Design System Inspired by Greptile

## 1. Visual Theme & Atmosphere

Greptile's design system projects a **modern, technical, and approachable** aesthetic tailored for engineering teams. The palette combines a sophisticated dark navy (`{colors.primary}` — `#3D3B4F`) with a vibrant mint accent (`{colors.accent}` — `#28E99F`), creating high contrast and visual energy. The canvas background (`{colors.canvas}` — `#EEEEEE`) maintains brightness and clarity, supporting readability and focus. Typography anchors the system with **Anybody** for display and **DM Sans** for body text, reinforcing both personality and accessibility. Shadows are minimal; depth comes primarily through **color-blocking** — strategic use of surface colors rather than layered elevation. The overall impression is **clean, purposeful, and trustworthy** — appropriate for a product that reviews and validates code.

**Key Characteristics:**
- Minimal shadow treatment; depth via color and contrast
- Sharp corners (`0px` border-radius) across all interactive and container elements, reinforcing a **technical, no-frills aesthetic**
- High-contrast primary CTA and accent colors ensure immediate visual hierarchy
- Responsive typography scales dramatically between mobile and desktop (60px to 96px for display sizes)
- Generous section spacing (`{spacing.band}` — `80px`) creates breathing room and clear section demarcation
- Monochromatic neutral palette grounded in black, white, and grayscale for trust and clarity

## 2. Color Palette & Roles

### Primary

- **Primary / Brand** (`{colors.primary}` — `#3D3B4F`): Dark navy used as the default CTA fill, brand accent, active state indicator, and primary body text. Core to the system's authority and approachability.
- **On Primary** (`{colors.on-primary}` — `#FFFFFF`): White label and text color applied over brand surfaces (buttons, dark containers).

### Accent Colors

- **Accent** (`{colors.accent}` — `#28E99F`): Vibrant mint green used as secondary accent, hero band fills, and high-energy CTAs. Creates visual pop and draws attention to key actions.
- **Accent (Decorative)** (`{colors.accent-1}` — `#ECFFA3`): Pale yellow-green with no measured semantic role; used decoratively for visual interest in patterns or illustrations.

### Interactive

- **Link** (`{colors.link}` — `#555368`): Muted purple-gray for inline links; slightly subdued to differentiate from primary navigation.

### Neutral Scale

- **Canvas** (`{colors.canvas}` — `#EEEEEE`): Default page background; light gray providing soft contrast to text and components.
- **Ink** (`{colors.ink}` — `#000000`): Pure black for headings and primary text; maximum contrast and legibility.
- **Muted** (`{colors.muted}` — `#FFCFFE`): Light pink-purple reserved for captions, secondary text, and fine print. Recessive in the hierarchy.
- **Neutral-1** (`{colors.neutral-1}` — `#2A2A2A`): Dark charcoal used sparingly as a secondary dark option.

### Surface & Borders

- **Hairline** (`{colors.hairline}` — `#D6D6D6`): Light gray (`1px` stroke) for dividers, borders, and subtle separation between elements.

## 3. Typography Rules

### Font Family

- **Primary:** Anybody (fallback: `sans-serif`)
- **Secondary:** DM Sans (fallback: `sans-serif`)
- **Monospace:** Space Mono (used for code blocks and technical content; fallback: `monospace`)

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Display XL | Anybody | 96px | 400 | 144px | 0px | Hero / page title; scales to 60px on mobile (375px) and 72px on tablet (768px) |
| Heading MD | DM Sans | 24px | 400 | 36px | 0px | Section headings and subheadings |
| Body MD | DM Sans | 16px | 400 | 24px | 0px | Primary body copy and navigation; default reading text |
| Button | Anybody | 14px | 400 | 21px | 0px | Interactive labels; secondary size 18px on large variants |
| Link | DM Sans | 16px | 400 | 24px | 0px | Inline and standalone links |
| Caption | DM Sans | 12px | 400 | 18px | 0px | Footnotes, fine print, metadata |

### Principles

- **Consistent weight:** 400 (regular) used throughout; no bold or extra-light weights in the system
- **Spacious line height:** Always 1.5× font size, supporting rapid scanning and accessibility
- **No letter spacing:** Tracking is neutral across all sizes, relying on careful type selection rather than manipulation
- **Display dominance:** Large, confident sizes on hero sections (96px) decrease predictably as content hierarchy descends
- **Font pairing:** Anybody (sans-serif, rounded personality) paired with DM Sans (geometric, neutral) creates a balance of warmth and precision
- **Mobile adaptation:** Display type scales significantly (96px → 60px); body and navigation remain fixed at 16px for readability

## 4. Component Stylings

### Buttons

**Primary Button**
- Background: `{colors.primary}` (`#3D3B4F`)
- Text Color: `{colors.canvas}` (`#EEEEEE`)
- Font: Anybody, 14px, weight 400, line-height 21px
- Padding: 10px 26px
- Height: 41px
- Border Radius: `{rounded.none}` (0px)
- Border: None
- Hover State: `transform: translateX(-4px)` (shifts left on hover for interactive feedback)
- Notes: Solid, commanding CTA for primary actions (e.g., "Contact Sales")

**Secondary Button (Accent)**
- Background: `{colors.accent}` (`#28E99F`)
- Text Color: `{colors.ink}` (`#000000`)
- Font: Anybody, 14px, weight 400, line-height 21px
- Padding: 10px 26px
- Height: 41px
- Border Radius: `{rounded.none}` (0px)
- Border: None
- Hover State: `transform: translateX(4px)` (shifts right on hover for tactile feedback)
- Notes: Bright, energetic accent for secondary actions (e.g., "Start Now" / "Sign Up")

**Tertiary Button (Large Variant)**
- Background: `{colors.accent-1}` (`#ECFFA3`)
- Text Color: `{colors.accent-1}` text variant (`#236255163`)
- Font: Anybody, 18px, weight 400, line-height 27px
- Padding: 14px 34px
- Height: 55px
- Border Radius: `{rounded.none}` (0px)
- Border: None
- Notes: Oversize variant for prominent calls-to-action on hero sections

**Ghost / Outline Button**
- Background: Transparent
- Text Color: `{colors.primary}` or `{colors.accent}` (semantic variant)
- Border: `1px solid` matching text color
- Font: Anybody, 14px, weight 400
- Padding: 10px 26px
- Height: 41px
- Hover State: Background fills with color at reduced opacity (`rgba(X, X, X, 0.1)`)

### Cards & Containers

**Default Card**
- Background: `{colors.on-primary}` (`#FFFFFF`)
- Border Radius: `{rounded.none}` (0px)
- Border: 1px solid `{colors.hairline}` (`#D6D6D6`)
- Padding: `{spacing.lg}` to `{spacing.xl}` (24px–32px) depending on content density
- Shadow: None (color-blocking system; no elevation shadow)
- Hover State: Background lightens to `rgba(238, 238, 238, 0.6)` or border brightens to `#ECFFA3`

**Section Container**
- Background: `{colors.canvas}` (`#EEEEEE`) or `{colors.on-primary}` (`#FFFFFF`)
- Max Width: 1312px at 1440px viewport; scales down proportionally
- Padding X: `{spacing.section}` (64px) on desktop; `{spacing.lg}` (24px) on mobile (375px)
- Border Radius: None
- Notes: Full-bleed sections with internal content constrained to max-width container

### Inputs & Forms

**Text Input**
- Background: `{colors.on-primary}` (`#FFFFFF`)
- Border: 1px solid `{colors.hairline}` (`#D6D6D6`)
- Border Radius: `{rounded.none}` (0px)
- Font: DM Sans, 16px, weight 400, line-height 24px
- Padding: `{spacing.md}` (16px) horizontal, `{spacing.sm}` (12px) vertical
- Focus State: `box-shadow: 0 0 0 1000px var(--color-slate) inset` (internal fill on focus for high visibility)
- Hover State: Box-shadow identical to focus state
- Notes: Sharp corners reinforce technical aesthetic; inset shadow focus state is distinctive

**Select / Dropdown**
- Visual Treatment: Same as text input; caret or toggle indicator aligned right
- Border Radius: `{rounded.none}` (0px)
- Z-index (when open): `{z-index.dropdown}` (10–50 depending on nesting)

### Navigation

**Header Navigation (Default)**
- Background: Transparent (`rgba(0, 0, 0, 0)`)
- Border: None (sits flush against canvas or hero background)
- Font: DM Sans, 16px, weight 400, line-height 24px
- Text Color: `{colors.ink}` (`#000000`)
- Height: 66px (including padding)
- Padding: `{spacing.md}` (16px) sides
- Links: Undecorated; hover state shifts color to `rgba(0, 0, 0, 0.7)` (darkened) or underlines
- Logo: Top-left; `24px × 24px` or proportional
- Right-side CTAs: Primary button ("Contact Sales") + Accent button ("Sign Up") stack horizontally on desktop; collapse to menu toggle on mobile
- Responsive Collapse: Menu toggle appears at 768px viewport; nav links reduce from 7 visible to 2 on mobile

**Footer Navigation**
- Background: `{colors.canvas}` (`#EEEEEE`)
- Font: DM Sans, 16px, weight 400
- Text Color: `{colors.ink}` (`#000000`)
- Height: Expands to 862px total (multi-section footer)
- Padding: `{spacing.section}` to `{spacing.band}` (64px–80px) between sections
- Link hover: Color shifts to `rgba(0, 0, 0, 0.7)` or `{colors.accent}` (`#28E99F`)
- Structure: Multiple columns (Company, Product, Resources, etc.) in a grid layout; responsive to single-column at mobile

### Links

**Inline Link**
- Base Color: `{colors.link}` (`#555368`)
- Font: DM Sans, 16px, weight 400
- Text Decoration: Underline (implicit or explicit)
- Hover State: Color shifts to `rgba(0, 0, 0, 0.7)` (darkened to `{colors.ink}`)
- Visited State: Not measured; inferred as same or slightly muted
- Notes: Used for contextual navigation and external references within body copy

**Link Button / CTA Link**
- Display: Inline-block or button-like depending on context
- Font: Anybody, 14px, weight 400
- Padding: 10px 26px (when button-style)
- Background: `{colors.primary}` or `{colors.accent}` (styled as button)
- Border Radius: `{rounded.none}` (0px)
- Hover State: Transform shift (translateX) + background opacity change

### Badge / Pill (Inferred from Accent Secondary Color)

- Background: `{colors.accent}` (`#28E99F`) at low opacity (`rgba(40, 233, 159, 0.15)`)
- Border: 1px solid `{colors.accent}` or transparent
- Text: `{colors.accent}` (`#28E99F`) at full opacity
- Font: DM Sans or Anybody, 12px, weight 400
- Border Radius: `{rounded.none}` (0px) or 9999px (if pill-style; not explicitly measured)
- Padding: `{spacing.xs}` to `{spacing.sm}` (8px–12px) sides
- Notes: Used for tags, status indicators, and accent highlights

## 5. Layout Principles

### Spacing System

**Base Unit:** `{spacing.xxs}` = 4px

**Scale (in multiples of base):**
- `{spacing.xxs}` = 4px (1×)
- `{spacing.xs}` = 8px (2×)
- `{spacing.sm}` = 12px (3×)
- `{spacing.md}` = 16px (4×)
- `{spacing.lg}` = 24px (6×)
- `{spacing.xl}` = 32px (8×)
- `{spacing.xxl}` = 40px (10×)
- `{spacing.xxxl}` = 48px (12×)
- `{spacing.section}` = 64px (16×)
- `{spacing.band}` = 80px (20×)

**Usage Context:**
- **`{spacing.xxs}` / `{spacing.xs}`:** Icon spacing, tight component gaps, form field margins
- **`{spacing.sm}` / `{spacing.md}`:** Button padding, inline element margins, small container gutters
- **`{spacing.lg}` / `{spacing.xl}`:** Card padding, medium section gutters, heading margins
- **`{spacing.xxl}` / `{spacing.xxxl}`:** Large container padding, component spacing
- **`{spacing.section}`:** Page section padding-left/right on desktop (64px)
- **`{spacing.band}`:** Vertical spacing between major page sections (80px)

### Grid & Container

**Max Width Progression:**
- 375px (mobile): 327px content column
- 768px (tablet): 672px content column
- 1024px+ (desktop): 896–1312px content column (expands with viewport to 1312px at 1440px)

**Container Strategy:**
- Full-bleed sections at `{spacing.canvas}` (`#EEEEEE`) or `{colors.on-primary}` (`#FFFFFF`)
- Inner content constrained to max-width with `{spacing.section}` padding (64px) on desktop, `{spacing.lg}` (24px) on mobile
- Grid columns: 4 columns on mobile (375px), 4–8 columns on tablet (768px), 8 columns on desktop (1024px+)

**Section Padding (Horizontal):**
- 375px: `{spacing.lg}` (24px)
- 768px: `{spacing.lg}` (24px) or `{spacing.xl}` (32px)
- 1024px+: `{spacing.section}` (64px)

### Whitespace Philosophy

Greptile employs **generous, intentional whitespace** to emphasize clarity and focus:
- **Vertical rhythm:** Major sections separated by `{spacing.band}` (80px) or `{spacing.section}` (64px)
- **Breathing room:** Cards and containers use `{spacing.lg}` to `{spacing.xl}` internal padding
- **Scanability:** Headings, body, and supporting content are visually isolated, not cramped
- **Mobile-first reduction:** Spacing scales down proportionally on smaller viewports but never disappears entirely
- **Color blocking:** Alternating section backgrounds (`{colors.canvas}` + `{colors.on-primary}`) provide implicit visual pause without borders

### Border Radius Scale

| Value | Component Roles | Appearance |
|---|---|---|
| `{rounded.none}` (0px) | Buttons, cards, inputs, images, navigation | Sharp, angular corners; technical and modern |

**System Philosophy:** Greptile commits entirely to **0px border-radius** across all measured roles, reinforcing a **minimalist, grid-aligned, technical aesthetic**. No softening or rounding is employed.

### Border Widths

| Style | Width | Usage |
|---|---|---|
| Hairline | `1px` | Dividers, card borders, input outlines, subtle separators |

**Single-thickness system:** Only one border width is used, keeping stroke treatment minimal and consistent.

## 6. Depth & Elevation

### Elevation Strategy

Greptile uses a **color-blocking** depth system rather than layered shadows. Depth is communicated through:
- **Surface color changes:** Light (`{colors.canvas}` — `#EEEEEE`) vs. light-white (`{colors.on-primary}` — `#FFFFFF`) vs. dark (`{colors.primary}` — `#3D3B4F`)
- **Contrast and position:** Darker elements appear to advance; lighter elements recede
- **Opacity shifts:** Subtle transparency changes on hover or secondary states

**No shadows were measured on the extracted site.** The system achieves depth through spatial color relationships, not elevation blur or vertical lift.

### Opacity Levels

- **12%** (`0.12`): Very subtle overlay or disabled state; barely perceptible
- **25%** (`0.25`): Secondary hover or focus state; light emphasis
- **30%** (`0.30`): Reduced-opacity accent (e.g., badge backgrounds)
- **40%** (`0.40`): Moderate transparency for overlays or secondary fills
- **70%** (`0.70`): High transparency; often used for link hover or muted text
- **96%** (`0.96`): Near-opaque; almost full color, with imperceptible fading

**Application:**
- Disabled or inactive elements: 30–40% opacity
- Hover backgrounds: 0.12–0.25 opacity applied to component background
- Link hover: 70% opacity applied to text color
- Overlay screens: 40–96% opacity depending on prominence

### Z-index / Layering

| Context | Z-index Value | Element Example |
|---|---|---|
| Base | 1–2 | Static content, body sections |
| Dropdown | 10–20 | Menus, select dropdowns, tooltips |
| Sticky | 30 | Fixed nav (implied; not explicitly measured) |
| Modal | 50 | Overlay modals, dialogs (if present) |

**Stacking Philosophy:** Minimal nesting; most interactive elements stay below z-index 50 to reserve very high values for emergency overlays.

## 7. Do's and Don'ts

### Do

- **Use sharp corners** (`0px` radius) on all buttons, cards, and inputs to maintain the technical, grid-aligned aesthetic
- **Apply color-blocking** for depth; choose surface colors carefully (canvas vs. white) rather than adding shadows
- **Pair Anybody with DM Sans** for display and body text respectively; this combination defines the brand voice
- **Scale typography dramatically** between mobile and desktop; 60px → 96px for display headings is expected
- **Use `{colors.accent}` (`#28E99F`) sparingly** for high-energy CTAs and attention-grabbing elements; it is a power color
- **Maintain consistent `{spacing.band}` (80px) vertical spacing** between major sections for rhythm and hierarchy
- **Keep navigation transparent** on hero sections; allow background imagery or color to breathe
- **Apply subtle hover transforms** (translateX ±4px) on buttons for tactile, interactive feedback without flashiness
- **Use `{colors.primary}` (`#3D3B4F`) as the default text and CTA fill;** it is the system's anchor
- **Provide high contrast** between text and backgrounds (black on white, white on navy); accessibility is non-negotiable

### Don't

- **Do not add rounded corners** to interactive or container elements; the system is deliberately sharp
- **Do not stack heavy shadows** or use blur effects; Greptile's depth is communicated through color and position
- **Do not introduce new colors outside the defined palette;** consistency is key to brand recognition
- **Do not use letter-spacing or tracking** beyond the standard 0px; typography is set as-is from the font files
- **Do not mix button styles indiscriminately;** use primary (navy) for high-priority actions, accent (mint) for secondary, ghost for low-priority
- **Do not reduce section padding below `{spacing.md}` (16px)** on any viewport; whitespace is a design feature, not wasted space
- **Do not override font weights;** 400 (regular) is the only weight used; do not attempt bold or light variants
- **Do not rely on underlines alone** to indicate links; use color and consider hover states for clarity
- **Do not over-use `{colors.muted}` (`#FFCFFE`);** it is reserved for captions and secondary text, not primary body copy
- **Do not remove the hairline borders** on inputs or cards; they provide essential visual definition in a sharp-corner system

## 8. Responsive Behavior

### Breakpoints

| Breakpoint | Width | Content Column | Grid Cols | Nav Visible | Largest Heading | Primary Button Width | Key Changes |
|---|---|---|---|---|---|---|---|
| Mobile | 375px | 327px | 4 | 2 links (collapse menu) | 60px | 152px | Full-bleed layout; hero text reduced; nav links collapse to toggle |
| Tablet | 768px | 672px | 4 | 2 links (collapse menu) | 72px | 152px | Heading grows slightly; section padding increases to 48px |
| Desktop (Standard) | 1024px | 896px | 8 | 7 links (no toggle) | 96px | 152px | Full nav visible; heading reaches 96px max; grid expands to 8 columns |
| Desktop (Large) | 1280px | 1152px | 8 | 7 links (no toggle) | 96px | 152px | Content column grows; section padding remains 64px |
| Desktop (XL) | 1440px | 1312px | 8 | 7 links (no toggle) | 96px | 152px | Maximum content width; no further scaling |

**Collapse Point:** Navigation collapses to a menu toggle between 768px and 1024px; at 1024px+, all 7 header links are visible and the toggle disappears.

### Touch Targets

- **Minimum interactive height:** 41px (buttons, nav links)
- **Minimum interactive width:** Varies; CTA buttons measure ~124–152px wide depending on label
- **Minimum tap-safe area:** `{spacing.md}` (16px) margin around adjacent tappable elements
- **Icon size (if used):** 24px × 24px standard; padding of `{spacing.xs}` (8px) around for safe tap area
- **Link underline / hover area:** Full text width + `{spacing.xs}` (8px) padding vertically

### Collapsing Strategy

**At 375px (Mobile):**
- Display heading drops from 96px to 60px
- Body and button text remains 14–16px (no shrinkage)
- Section padding reduces from 64px to 24px
- Navigation menu collapses; hamburger toggle appears
- Multi-column grids collapse to single column or 4-column grid
- Footer sections stack vertically instead of inline
- Hero image or background scales to fit viewport

**At 768px (Tablet):**
- Display heading grows to 72px
- Navigation still shows 2–4 primary links; remaining items in dropdown
- Section padding increases to 48px
- Grid columns remain at 4; content column expands to 672px
- Cards and sections begin to use side-by-side layout

**At 1024px+ (Desktop):**
- Display heading reaches 96px max
- Navigation fully visible; all 7 links inline (no toggle)
- Section padding stabilizes at 64px
- Grid expands to 8 columns
- Multi-column layouts for cards, testimonials, feature sections
- Footer may display in 3–4 column grid

**Sticky Navigation:** Header remains at top (inferred z-index ~30–50); content scrolls beneath.

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary CTA:** Primary (`{colors.primary}` — `#3D3B4F`)
- **Secondary CTA:** Accent (`{colors.accent}` — `#28E99F`)
- **Background (light):** Canvas (`{colors.canvas}` — `#EEEEEE`)
- **Background (white):** On Primary (`{colors.on-primary}` — `#FFFFFF`)
- **Text (primary):** Ink (`{colors.ink}` — `#000000`)
- **Text (secondary):** Muted (`{colors.muted}` — `#FFCFFE`)
- **Borders:** Hairline (`{colors.hairline}` — `#D6D6D6`)
- **Links:** Link (`{colors.link}` — `#555368`)
- **Decorative accent:** Accent-1 (`{colors.accent-1}` — `#ECFFA3`)

### Iteration Guide

1. **All interactive elements (buttons, inputs, cards) use `{rounded.none}` (0px) border-radius.** Do not add rounding; sharpness is non-negotiable.

2. **Typography is anchored to two fonts: Anybody (display, buttons) and DM Sans (body, nav).** Use 400 weight exclusively; no bold or light variants.

3. **Depth comes from color, not shadows.** Alternate section backgrounds between `{colors.canvas}` and `{colors.on-primary}` to create visual hierarchy. Do not add box-shadows.

4. **Button hover states use micro-transforms:** primary buttons shift left (`translateX(-4px)`), secondary buttons shift right (`translateX(4px)`). Apply no other transform.

5. **Scale typography aggressively on mobile:** display headings drop to 60px at 375px, grow to 96px at 1024px+. Body text (16px) remains fixed across all breakpoints.

6. **Section padding scales with viewport:** 24px on mobile (375px), 48px on tablet (768px), 64px on desktop (1024px+). Never reduce below these thresholds.

7. **Links use `{colors.link}` base color (`#555368`); on hover, shift to near-black (`rgba(0, 0, 0, 0.7)`).** Underline implicitly or explicitly; do not rely on color alone.

8. **Use `{colors.accent}` (`#28E99F`) sparingly:** secondary CTAs, badges, accent highlights. Primary actions default to `{colors.primary}` (`#3D3B4F`).

9. **Form inputs use inset focus state:** `box-shadow: 0 0 0 1000px var(--color-slate) inset` (fills interior with subtle color on focus). Do not use outline or border-color changes.

10. **Maintain generous whitespace:** `{spacing.band}` (80px) between major page sections, `{spacing.lg}` to `{spacing.xl}` inside containers. Whitespace is a design feature; do not compress to save space.

11. **Navigation collapses to a menu toggle between 768px and 1024px viewport widths.** Header links reduce from 7 visible to 2 before toggle appears; no intermediate partial-hide state.

12. **The color palette is closed.** The 10 defined colors are exhaustive; do not invent new shades. Use opacity (0.12–0.96) to create secondary states within the existing palette.

## 10. Known Gaps

- **No interaction states recorded for focus, active, or disabled button variants.** Hover states for transforms and background changes are documented; focus states (outline, ring, or border) are not measured and should not be inferred.
- **No semantic color ramp (error, success, warning, info).** The extracted site does not expose status-specific colors in its markup. Do not invent error-red or success-green; such states are outside the measured design.
- **No gradient or mesh decoration data.** The system appears to use solid colors and color-blocking only; any gradient fills or decorative overlays are not evidenced in the extracted tokens.
- **Two colors have no measured semantic role:** `{colors.accent-1}` (`#ECFFA3`) and `{colors.neutral-1}` (`#2A2A2A`) are classified as decorative or auxiliary. Use them cautiously and consistently; do not repurpose for primary UI roles.
- **No shadow or depth elevation tokens extracted.** The system's depth strategy is inferred as color-blocking; no specific shadow CSS values were found in the codebase.
- **Z-index layering is partially inferred.** Dropdown (10–20), sticky (30+), and modal (50+) ranges are extrapolated from standard pattern; explicit z-index declarations for all components are not all measured.
- **No dark mode or theme variant data.** The extracted design is light-mode only. A dark or high-contrast variant may exist but was not captured.
- **Opacity values are documented as raw percentages (12%, 25%, 30%, 40%, 70%, 96%); exact component assignments for each opacity level are not fully enumerated.** Designers should apply these values to interactive states contextually.
- **One page (homepage) analyzed.** Surfaces behind authentication, account dashboards, settings, or other authenticated flows were not visited and are outside this design system's scope.
- **Border-width scale contains only one value (1px).** No thick, medium, or thin hierarchy is present; all borders in the system are hairline (`1px` solid).