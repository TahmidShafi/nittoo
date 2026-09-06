# Nittoo — Design System & UX Specification

> **Document Classification:** Standalone Product Design Specification  
> **Brand Promise:** *Know What Lasts.*  
> **Target Audience:** Product Designers, Design Engineers, UX Researchers, and Autonomous Systems  
> **Scope:** Complete visual language, UX constitution, interaction models, component behaviors, information architecture, and screen specifications.

---

## 1. Executive Summary & Document Purpose

Nittoo is a **personal consumption intelligence application**. It empowers individuals to understand the everyday physical products they buy, own, consume, finish, and replace. 

This document serves as the authoritative, standalone **Visual and UX Constitution** of Nittoo. It documents the conceptual principles, visual tokens, interaction heuristics, component patterns, and page layouts that govern the application.

### Standalone Mandate
This specification intentionally contains:
- **No** programming language constructs or frontend framework references.
- **No** database schema definitions or server infrastructure details.
- **No** repository file paths or local build scripts.

It describes **WHAT** the user experiences and **WHY** the interface behaves the way it does. Even if the entire underlying technical implementation were replaced tomorrow, this document remains the permanent blueprint for Nittoo's design integrity.

---

## 2. Product Positioning & Information Architecture

### 2.1 The Problem Nittoo Solves
Consumers live in a continuous cycle of purchasing consumables—skincare, haircare, oral hygiene, supplements, household detergents, and pantry essentials. Yet almost nobody knows:
- How many days a bottle of facewash actually lasts.
- What an everyday essential truly costs per day of use.
- Whether a backup bottle already exists in a cupboard before buying another.
- When an active product will run out and demand replenishment.
- What baseline monthly expenditure is committed to physical consumption.

Traditional budgeting tools treat purchases as disconnected lump-sum transactions on a credit card statement. Inventory tools treat items like pallets in an enterprise logistics warehouse. Nittoo bridges this gap by creating **consumption intelligence** tailored to everyday personal life.

```text
BUY
 ↓
OWN
 ↓
START USING
 ↓
TRACK
 ↓
FINISH
 ↓
LEARN
 ↓
PREDICT
 ↓
DECIDE
```

---

### 2.2 The Six Foundational Concepts

To prevent ambiguity, the interface rigorously distinguishes between six distinct concepts:

| Concept | User Question | Definition |
| :--- | :--- | :--- |
| **ESSENTIALS** | *"What products do I track?"* | The conceptual product archetype (e.g., *CeraVe Hydrating Cleanser 236ml*). It holds identity, category, brand, and accumulated multi-cycle intelligence. |
| **INVENTORY** | *"What do I currently own?"* | The total physical containers in the user's possession. Inventory is the sum of **Active** and **Unopened** items. |
| **ACTIVE** | *"What am I using right now?"* | The single container whose seal is broken and is actively being consumed today. |
| **UNOPENED** | *"What do I own but haven't started?"* | Physical purchases held in reserve as backup stock. They have an acquisition date and price, but no consumption timeline. |
| **HISTORY** | *"What have I finished?"* | The chronological ledger of completed containers with definitive opened-to-finished lifespans and verified daily costs. |
| **PREDICTION** | *"What will I probably need next?"* | Mathematical forecasts calculated strictly from finished historical lifespans, estimating run-out dates and monthly run rates. |

---

## 3. Design Personality & Ethos

Nittoo's personality balances high-utility productivity software with a warm, calm personal health companion:

```text
Calm • Precise • Personal • Trustworthy • Modern • Quietly Intelligent • Practical • Warm • Refined
```

### 3.1 Linear-Inspired Information Discipline + Softer Health Character
Nittoo adopts the visual discipline celebrated by tools like Linear:
- **Quiet Chrome:** Structural borders, navigation headers, and dividers recede into the background. Content and data always take center stage.
- **Precise Typographic Alignment:** Data points, tabular figures, badges, and labels align to a strict spatial grid.
- **High Information Density:** The interface respects the user’s screen real estate, presenting comprehensive metrics without requiring endless scrolling.
- **Restrained Elevation:** Elevation is communicated through crisp 1px borders and whisper-soft shadows rather than theatrical gradients.

**However, Nittoo is NOT a dark-mode developer ticket board.**  
It introduces a softer, organic, consumer-focused character through:
- An airy, natural paper-white canvas (`#FBFBFB`).
- Deep forest greens (`#2D6A4F`) evocative of wellness, sustainability, and longevity.
- Warm, rounded container geometry (16px to 24px corner radiuses).
- Humanized, reassuring copy that celebrates finishing a product rather than creating anxiety about productivity.

---

## 4. Logo & Brand Identity

### 4.1 The Brand Mark
The Nittoo logo embodies the physical lifecycle of everyday liquids and essentials. It combines four organic elements into a single icon:

1. **The Dispenser Arch ("n"):** A stylized, architectural arch forming the lowercase letter "n", shaped like a classic pump dispenser bottle.
2. **The Natural Leaf Accent:** A fresh green leaf (`#52B788`) budding from the top right of the dispenser head, signifying natural ingredients, shelf life, and mindful replenishment.
3. **The Coral Dot:** A warm peach/coral droplet (`#F07167`) hovering over the dispenser nozzle, representing measured dispensing and daily personal care.
4. **The Inner Cutout:** A crisp pump cutout rendered against the primary forest body (`#0C3823` / `#1B4332`), ensuring the symbol remains instantly recognizable at 16x16px favicon sizes.

```text
       [Leaf #52B788]
          \    /
       [Dispenser] ---- [Coral Dot #F07167]
         /     \
       |  (n)   |
       | Bottle |
```

### 4.2 The Wordmark
The wordmark uses a lowercase, modern geometric sans-serif: **nittoo**.  
- **Proportions:** Clean circular forms for the vowels, paired with crisp vertical stems for the consonants.
- **Kerning:** Optically spaced for legibility across micro navigation headers and hero authorization displays.
- **Color:** Deep slate black (`#111827`) or dark forest green (`#1B4332`).

### 4.3 Brand Tagline
> **"Know What Lasts."**

**Usage Philosophy:** The tagline is an intentional, philosophical statement. It appears on authentication screens, landing hero blocks, and minimal desktop footers. It is **never** repeated inside high-density functional workspaces (such as the Dashboard grid or Inventory tables) to protect information clarity.

---

## 5. Color System & Semantic Tokens

Nittoo’s color system uses color exclusively for **state, hierarchy, and identity**, never as arbitrary decoration.

```text
CANVAS (#FBFBFB)
  └── SURFACE (#FFFFFF)
        ├── BORDER (#E8ECE9)
        └── BRAND ACCENT (#2D6A4F)
              ├── HEALTHY: Forest Green (#2D6A4F / #EBF4F0)
              ├── ATTENTION: Amber Gold (#D97706 / #FEF3C7)
              ├── CRITICAL: Rose Ruby (#E11D48 / #FFE4E6)
              └── LEARNING: Slate Neutral (#737373 / #F5F5F5)
```

### 5.1 Primary Brand Palette
- **Forest Green (Primary Accent):** `#2D6A4F`  
  *Usage:* Primary call-to-action buttons, active navigation indicators, key progress bars, highlighted metrics.
- **Forest Green Hover:** `#24563F`  
  *Usage:* Tactile hover state for primary buttons and high-emphasis interactive elements.
- **Deep Brand Green:** `#1B4332`  
  *Usage:* High-contrast brand headers, primary logo body, heavy typographic anchors.
- **Brand Leaf:** `#52B788`  
  *Usage:* Brand logo accent, organic illustrations, eco/sustainability indicators.
- **Brand Coral:** `#F07167` (Background tint: `#FFF0ED`)  
  *Usage:* Brand mark dispenser dot, warm visual accents.

### 5.2 Canvas & Neutral Surfaces
- **Application Canvas:** `#FBFBFB`  
  *Usage:* The foundational background of the entire application. Off-white with an ultra-subtle warm undertone that eliminates harsh monitor glare.
- **Surface Panel:** `#FFFFFF`  
  *Usage:* Interactive cards, data containers, modal sheets, popovers, and sticky navigation headers.
- **Subtle Surface:** `#F8F9FA`  
  *Usage:* Form input backgrounds, table row hover states, secondary badge fills.
- **Hairline Border:** `#E8ECE9`  
  *Usage:* Universal 1px structural container boundary. Provides razor-sharp contrast between panels and the `#FBFBFB` canvas.
- **Subtle Divider:** `#F0F2F1`  
  *Usage:* Internal row dividers and micro-separators within cards.

### 5.3 Typography Neutral Palette
- **Text Primary:** `#111827` (Near-black with a touch of blue-gray for optimal contrast and readability).
- **Text Secondary:** `#4B5563` (Supportive descriptions, form labels, secondary data points).
- **Text Muted:** `#8B95A5` (Eyebrow headers, unit labels, inactive icons, timestamps).

### 5.4 Semantic Status System

Color signifies real-world physical states. Every status indicator pairs a specific foreground text color with a lightened background tint and a matching 1px border.

```text
┌─────────────────┬──────────────┬──────────────┬──────────────────────────────────────────┐
│ Status State    │ Text Color   │ Background   │ Physical Meaning                         │
├─────────────────┼──────────────┼──────────────┼──────────────────────────────────────────┤
│ Healthy Active  │ #2D6A4F      │ #EBF4F0      │ Container in use; ample lifespan remains │
│ Attention Soon  │ #D97706      │ #FEF3C7      │ Projected to run out in < 14 days        │
│ Overdue / Alert │ #E11D48      │ #FFE4E6      │ Usage exceeds average historical cycle   │
│ Learning Data   │ #737373      │ #F5F5F5      │ Cycle 1 in progress; baseline forming    │
│ Unopened Stock  │ #4B5563      │ #F3F4F6      │ Stored backup container; seal unbroken   │
└─────────────────┴──────────────┴──────────────┴──────────────────────────────────────────┘
```

#### Color Usage Governance
- **Prohibited:** Never use `#E11D48` (Rose) or `#D97706` (Amber) for decorative styling. If red appears, something is overdue or about to be permanently deleted.
- **Prohibited:** Never use full-bleed dark backgrounds for large workspace cards. Nittoo is an airy, natural, paper-white experience.
- **Prohibited:** Never display naked numbers without unit binding (e.g., always write `৳24.50/day`, never just `24.50`).

---

## 6. Typography System

Nittoo employs a crisp, modern, highly legible sans-serif type system (Inter or the clean modern system font stack). Typography creates immediate visual hierarchy through weight and tracking rather than oversized font scales.

```text
[EYEBROW]           11px  Bold      Uppercase  Tracking +0.05em  #2D6A4F
[PAGE TITLE]        28px  Bold      Tight      Tracking -0.02em  #111827
[DESCRIPTION]       14px  Regular   Normal     Leading 1.5       #4B5563
[PRIMARY METRIC]    32px  Extrabold Tabular    Tight -0.03em     #111827
[SECONDARY METRIC]  13px  Medium    Normal     Leading 1.2       #4B5563
```

### 6.1 Typographic Scale & Roles

| Role | Size | Weight | Tracking | Color | Usage Context |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Metric** | 36px–40px | 900 (Black) | `-0.03em` | `#2D6A4F` | Monthly consumption cost on Analytics page |
| **Primary Metric**| 28px–32px | 700 (Bold) | `-0.02em` | `#111827` | Big numerical counts on Dashboard and Detail summary cards |
| **Page Title (H1)**| 24px–28px | 700 (Bold) | `-0.02em` | `#111827` | Top of every major screen |
| **Section Title (H2)**| 16px–18px | 700 (Bold) | `-0.01em` | `#111827` | Card headers, table section titles, modal titles |
| **Subsection (H3)**| 13px–14px | 600 (Semibold)| `0` | `#111827` | Form group headers, nested product titles |
| **Eyebrow Header** | 10px–11px | 700 (Bold) | `+0.05em` | `#2D6A4F` / `#8B95A5` | Uppercase context anchor above H1 or card content |
| **Body Standard** | 13px–14px | 400 (Regular)| `0` | `#4B5563` | Narrative copy, empty state descriptions, dialog text |
| **Body Strong** | 13px–14px | 600 (Semibold)| `0` | `#111827` | Interactive labels, active table rows, strong data tags |
| **Microcopy / Meta**| 11px–12px | 500 (Medium) | `0` | `#8B95A5` | Timestamps, category tags, purchase dates, unit captions |
| **Semantic Badges** | 10px–11px | 600 (Semibold)| `+0.02em` | Semantic | Status pills, backup count chips, cycle tags |

### 6.2 Numerical & Financial Formatting Rules
1. **Currency Symbol Binding:** The currency symbol (`৳`) is locked to the number with zero whitespace: `৳1,250`, not `৳ 1250`.
2. **Per-Day Frequency:** When cost is annualized or divided by lifespan, the frequency suffix is explicit: `৳18.50/day` or `৳555/mo run rate`.
3. **Tabular Numerics:** All numbers in tables, timelines, and metric cards use tabular (monospaced) figure rendering so that digits align vertically across cycles.

---

## 7. Spacing, Density & Structural Grid

Nittoo follows an **8-point spatial grid** (with a 4-point micro-step for fine alignments).

```text
4px   • Micro spacing: Icon-to-text gap, badge padding
8px   • Tight spacing: Inline button elements, pill padding
12px  • Compact spacing: Form input vertical padding, card micro-gutters
16px  • Standard spacing: Card internal padding (mobile), list item separation
20px  • Moderate spacing: Desktop card padding, grid gutter
24px  • Section spacing: Gaps between major UI groupings
32px  • Generous spacing: Page header bottom margin, major dashboard divisions
48px+ • Structural spacing: Empty state vertical padding, viewport breathing room
```

### 7.1 Density Philosophy
Nittoo delivers **high information density without crampedness**.
- **No Empty Hero Blocks:** The screen does not waste half the viewport on decorative stock photos or giant banner illustrations.
- **No Starved Cards:** A card must carry meaningful density—product identity, status badge, current duration, predicted remaining days, progress bar, daily cost, and direct actions.
- **Generous Viewport Margins:** While cards themselves are compact and data-dense, the margins around the page container (`max-w-6xl`) allow the user's eyes to rest.

### 7.2 Container Boundaries
- **App Shell Container:** `max-width: 1152px` (72rem / `max-w-6xl`), centered with responsive horizontal padding (`16px` on mobile, `24px` on desktop).
- **Focused Forms & Settings:** `max-width: 672px` (`max-w-2xl`) to maintain comfortable reading and input line lengths.
- **Modal Dialogs:** `max-width: 448px`–`512px` (`max-w-md` to `max-w-lg`) for focused, centered confirmation and editing tasks.

---

## 8. Surface Hierarchy & Elevation System

Nittoo uses a strict **3-Level Surface Hierarchy**. Elevation is communicated through border contrast, slight tone shifts, and soft atmospheric shadows.

```text
LEVEL 1: Canvas Ground (#FBFBFB)
   └── LEVEL 2: Structured Surface Panel (#FFFFFF)
         └── LEVEL 3: Floating Overlay / Modal (#FFFFFF + Shadow-2xl + Backdrop Blur)
```

### 8.1 Surface Levels

#### Level 1: Canvas Ground
- **Tone:** `#FBFBFB`
- **Border:** None.
- **Shadow:** None.
- **Role:** The ambient viewport background on which all cards and workspaces rest.

#### Level 2: Surface Panel
- **Tone:** `#FFFFFF`
- **Border:** 1px solid `#E8ECE9`
- **Shadow:** Subtle resting shadow `0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.04)`
- **Hover State:** Translate `-1.5px` upward, with shadow `0 8px 24px -4px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.02)`. Border tightens to `#2D6A4F/30`.
- **Role:** Every card, list item container, dashboard overview panel, and table wrapper.

#### Level 3: Elevated Dialog & Overlay
- **Tone:** `#FFFFFF`
- **Border:** 1px solid `#E8ECE9`
- **Shadow:** Pronounced but soft `0 25px 50px -12px rgba(0, 0, 0, 0.12)`
- **Backdrop:** Screen-filling blackout overlay at `40% opacity` with `4px backdrop blur`.
- **Role:** Action dialogs, completion modals, inventory editing sheets, and search suggestion popovers.

---

## 9. Border Radius & Shape Architecture

Nittoo rejects extreme pill-shaped UI for structural panels. Rounded rectangles create visual structure; full pills are strictly reserved for badges.

```text
[ CONTROL / BADGE ]     radius: 6px – 8px
[ BUTTON / INPUT ]      radius: 10px – 12px
[ PRODUCT CARD / PANEL] radius: 16px – 20px
[ MODAL DIALOG ]        radius: 20px – 24px
[ SEMANTIC STATUS PILL] radius: 9999px (Full Pill)
```

### 9.1 Rules of Geometry
1. **Pills are Semantic Only:** Never render a card, form input, or primary content box as a full pill. Full pills are exclusive to status badges (e.g., `55 days left`, `Unopened`), counter tags (`3`), and category filter tabs.
2. **Nested Radius Formula:** When a control sits inside a panel, the child radius is smaller than the parent radius (`Radius_child ≈ Radius_parent - Padding`), ensuring geometric harmony.
3. **Continuous 1px Hairlines:** All interactive containers feature a 1px solid border. This prevents surfaces from melting into each other on varying display brightness settings.

---

## 10. Navigation Architecture & Global Shell

Nittoo employs an adaptive, device-aware navigation framework: a **sticky top header** on desktop and a **thumb-friendly bottom bar** on mobile.

```text
DESKTOP (>= 768px):
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo] nittoo   Dashboard   Inventory   Analytics   Account   [user] ⎋ │
└────────────────────────────────────────────────────────────────────────┘

MOBILE (< 768px):
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo] nittoo                                                 [user] ⎋ │
├────────────────────────────────────────────────────────────────────────┤
│                           PAGE CONTENT                                 │
├────────────────────────────────────────────────────────────────────────┤
│   [⊞] Dashboard     [📦] Inventory     [📈] Analytics     [👤] Account │
└────────────────────────────────────────────────────────────────────────┘
```

### 10.1 Desktop Navigation Bar
- **Dimensions:** Height `56px`–`64px`, sticky to viewport top (`z-index: 30`).
- **Surface:** `#FFFFFF` at `90% opacity` with `12px backdrop blur` and a `1px bottom hairline (#E8ECE9)`.
- **Left Cluster:**
  - Official Nittoo brand logo (mark + wordmark).
  - Primary navigation links arranged horizontally as compact pill buttons:
    - **Dashboard**
    - **Inventory**
    - **Analytics**
    - **Account**
- **Active Navigation State:**
  - Background: Tinted forest light (`#EBF4F0`).
  - Text: Forest Green (`#2D6A4F`), font-weight `600`.
  - Icon: Solid Forest Green (`#2D6A4F`).
- **Inactive Navigation State:**
  - Background: Transparent.
  - Text: Neutral Gray (`#4B5563`), font-weight `500`. Hover brings text to `#111827` on `#F3F4F6`.
- **Right Cluster:**
  - Authenticated user pill: Subtle badge containing a pulsing emerald indicator dot and truncated user email.
  - Unobtrusive "Sign Out" button: Text-neutral button with hover border.

### 10.2 Mobile Bottom Navigation Bar
- **Dimensions:** Height `56px`–`60px`, fixed to viewport bottom (`z-index: 40`).
- **Surface:** `#FFFFFF` at `95% opacity` with `16px backdrop blur` and a `1px top hairline (#E8ECE9)`.
- **Layout:** Balanced 4-column grid.
- **Touch Target:** Every link occupies a minimum touch box of `44px x 44px`.
- **Vertical Stack:** Centered vector icon (`16px x 16px`) positioned above a micro-label (`10px`).
- **Active Visual Indicator:** Active tab receives a rounded container highlight (`#EBF4F0`) and forest green styling (`#2D6A4F`).

---

## 11. Page Header System

Every major page opens with a consistent, 4-tier structural header:

```text
[EYEBROW CONTEXT]           CURRENT INVENTORY
[PAGE TITLE H1]             Inventory
[SUPPORTING DESCRIPTION]    See what you're currently using and what you have waiting.
[PRIMARY / ACTION BUTTONS]  [+ Add Inventory]  [+ Add Essential]
```

### Why Consistency Matters
1. **Orientation:** The user immediately knows their location within the consumption lifecycle.
2. **Context:** The eyebrow anchors the domain (e.g., `CURRENT INVENTORY`, `CONSUMPTION INTELLIGENCE`, `PERSONAL DASHBOARD`).
3. **Action Predictability:** Primary creation actions (`+ Add Product`, `+ Add Inventory`) consistently anchor the top right on desktop and stack cleanly below the header on mobile.

---

## 12. Button & Control System

Buttons provide immediate tactile feedback and enforce clear task priority.

```text
PRIMARY:     [ + Add Inventory ]     #2D6A4F background, white text, bold
SECONDARY:   [ + Add Essential ]     White surface, 1px border #E8ECE9, dark text
TERTIARY:    [ View Report →   ]     Text link, subtle hover underline
DESTRUCTIVE: [ Reset Data      ]     Rose outline / fill, explicit confirm
```

### 12.1 Button Hierarchy & Specifications

| Variant | Surface / Border | Text / Icon | Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | Background `#2D6A4F`<br>Hover `#24563F` | White `#FFFFFF`<br>Weight: 600 | `40px`–`44px` | Main page action (`Add Product`, `Save Changes`, `Start Using`) |
| **Secondary** | Surface `#FFFFFF`<br>Border `1px #E8ECE9`<br>Hover `#F8F9FA` | Text `#1F2937`<br>Weight: 600 | `36px`–`40px` | Complementary action (`Add Essential`, `Cancel`, `Edit`) |
| **Tertiary / Ghost**| Surface `Transparent`<br>Hover `#F3F4F6` | Text `#4B5563`<br>Hover `#111827` | `32px`–`36px` | Inline table controls, header dismissals |
| **Destructive** | Surface `Transparent` or `#FFF1F2`<br>Border `1px #FECDD3` | Text `#E11D48`<br>Weight: 600 | `36px`–`40px` | Irreversible actions (`Reset Tracker Data`, `Delete`) |
| **Icon Button** | Surface `Transparent` or `#F3F4F6`<br>Border `1px #E8ECE9` | Centered glyph<br>`#4B5563` | `36px x 36px` (min 44px touch) | Modal close (`✕`), clear search |
| **Inline Link** | Transparent | `#2D6A4F`<br>Weight: 600 | Inline | In-card navigation (`View Report →`) |

### 12.2 Tactile Interaction States
- **Hover:** Subtle upward translation `-1px` or color darken.
- **Active Press:** Physical `scale(0.98)` spring depression lasting `140ms`, giving buttons a tactile, responsive feel.
- **Focus-Visible:** Accessible 2px solid ring in Forest Green (`#2D6A4F`) with `2px offset`.
- **Loading State:** Button disables, text dims, and a centered spinning circle matches the text color. The button width is preserved to prevent layout shifts.

---

## 13. Form Design & Data Entry

Forms in Nittoo feel like focused, calm workspaces. Fields are grouped logically by real-world meaning rather than arbitrary database tables.

```text
┌─────────────────────────────────────────────────────────┐
│ 1. PRODUCT IDENTITY                                     │
│    Product Name *                                       │
│    [ CeraVe Hydrating Cleanser                        ] │
│    Category *                      Brand (Optional)     │
│    [ Skincare              ▾ ]    [ CeraVe            ] │
├─────────────────────────────────────────────────────────┤
│ 2. VOLUME / SIZE SPECIFICATIONS                         │
│    Size / Volume (Optional)        Unit                 │
│    [ 236                     ]    [ ml                ▾ ]│
├─────────────────────────────────────────────────────────┤
│ 3. PURCHASE & INITIAL USAGE                             │
│    Purchase Price (BDT ৳) *        Purchase Date *      │
│    [ ৳ 1250                  ]    [ 2026-09-07        ] │
│                                                         │
│    When will you start using it?                        │
│    (•) Start using today       ( ) Keep unopened        │
└─────────────────────────────────────────────────────────┘
```

### 13.1 Form Principles
1. **Logical Fieldsets:** Always segment product creation into **Product Identity**, **Volume/Specifications**, and **Purchase/Usage**.
2. **Separation of Purchase and Usage:** Nittoo never assumes that buying an essential means opening it immediately. Every entry flow explicitly asks: *When will you start using it?*
3. **Sensible Defaults:**
   - Purchase Date defaults to `Today (UTC)`.
   - Add Essential defaults to `Start using today`.
   - Add Inventory defaults to `Keep unopened` (because adding inventory to an existing product represents acquiring a backup).
4. **Immediate Inline Validation:** Field validation is visible directly below the input with clear instructions, avoiding vague error dialogs.

---

## 14. Product Search & Existing Essential Selection

When users add products or inventory, the interface acts intelligently without pretending to be a commercial e-commerce store.

```text
Search input: [ CeraVe                  ]
┌─────────────────────────────────────────────────────────┐
│ EXISTING TRACKED ESSENTIALS                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ CeraVe Hydrating Cleanser                           │ │
│ │ CeraVe • Skincare • 236 ml                          │ │
│ │ [Existing essential • Active: 55d left • Unopened: 1]│
│ └─────────────────────────────────────────────────────┘ │
│ Not in the list?                                        │
│ [+ Add as brand new product]                            │
└─────────────────────────────────────────────────────────┘
```

### 14.1 Search Heuristics
- **No Confusing Terminology:** Never use internal developer jargon like "Repeat Purchase Mode". The user simply sees **"Existing Essential"**.
- **Contextual Transparency:** When an existing essential appears in search, it immediately surfaces its current status:
  - *Active bottle: 55 days remaining* (or *overdue*, or *learning baseline*).
  - *Unopened backups: 2 waiting*.
- **Clear Branching:** The user can instantly choose between linking a purchase to an existing essential or creating a new product definition with a single click.

---

## 15. Active Inventory UX

Active Inventory represents the items being consumed right now.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ CeraVe Hydrating Cleanser   [Skincare]               [ 55d remaining ] │
│ CeraVe • 236 ml • ৳1,250 • [ 1 backup ]                                │
│                                                                        │
│ Day 7 in use ─────────────────────────────── Target: ~62 days          │
│ [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 11%      │
│                                                                        │
│ COST PER DAY: ৳20.16/day                     UNIT RATE: ৳5.30/ml       │
│                                                                        │
│ [ View Report → ]                                     [ Mark Finished] │
└────────────────────────────────────────────────────────────────────────┘
```

### 15.1 Active Card Visual Hierarchy
1. **Category & Status Pill:** Positioned at the top corners for instant scanning.
2. **Product Title & Brand:** Dominant primary font (`16px–18px bold`).
3. **Backup Count Chip:** If unopened containers exist in inventory, an inline chip highlights: `1 backup` or `2 backups`.
4. **Lifespan Progress Bar:**
   - Progress is clamped between 0% and 100%.
   - **Green (`#2D6A4F`):** Healthy consumption.
   - **Amber (`#D97706`):** Running low (< 14 days remaining).
   - **Rose (`#E11D48`):** Overdue (100% full with an active pulse dot).
   - **Neutral (`#E5E7EB`):** Cycle 1 (no historical average exists yet; shows indeterminate pattern).
5. **Prominent Daily Metrics:** Daily cost (`৳20.16/day`) and unit rate (`৳5.30/ml`).
6. **Direct Actions:** Quick link to detailed report and direct button to **Mark Finished**.

---

## 16. Unopened Inventory UX

Unopened inventory represents physical stock owned by the user that has not yet been opened.

```text
UNOPENED (3)
┌────────────────────────────────────────────────────────────────────────┐
│ CeraVe Hydrating Cleanser  [Skincare]                     2 unopened   │
├────────────────────────────────────────────────────────────────────────┤
│ [📦] Purchased Sep 6, 2026 • ৳1,250 BDT • Unopened   [Edit] [Start Using]│
│ [📦] Purchased Aug 12, 2026 • ৳1,200 BDT • Unopened  [Edit] [Start Using]│
└────────────────────────────────────────────────────────────────────────┘
```

### 16.1 Unopened Heuristics
- **Ownership Without Consumption:** Unopened purchases do not have an opened date, do not calculate days used, and do not trigger run-out warnings.
- **Grouped by Product:** Multiple unopened containers of the same essential are grouped under the product heading, while **each purchase retains individual actionability**.
- **First-Class Citizen:** Backups are never hidden in obscure settings sub-menus; they are prominently displayed on the **Inventory** page and inside the **Product Detail** report.
- **Accidental Activation Prevention:** Clicking `[Start Using]` checks if an active container already exists for that essential. If one is already active, the interface prevents double-activation and displays an explanatory prompt.

---

## 17. The Single-Active Container Rule

Nittoo enforces a core physical reality:

> **1 ACTIVE + N UNOPENED**

```text
┌─────────────────────────┐
│     1 ACTIVE BOTTLE     │  ← Sits by the bathroom sink (In Use)
└────────────┬────────────┘
             │ (Finish current bottle)
             ▼
┌─────────────────────────┐
│   N UNOPENED BACKUPS    │  ← Stored in the cupboard (Waiting)
└─────────────────────────┘
```

### 17.1 Why the Rule Exists
In personal life, an individual does not simultaneously consume two identical bottles of facewash or shampoo. You open one, use it until empty, and then open the backup. Allowing multiple concurrent active bottles would corrupt duration calculations, distort average lifespans, and generate invalid daily cost predictions.

### 17.2 Interface Handling
- If a user attempts to "Start Using" an unopened bottle while an active bottle exists, the system blocks the action with a friendly explanation:  
  *“A bottle of CeraVe Hydrating Cleanser is currently in use. You must finish your active bottle before starting an unopened purchase.”*
- When the active bottle is marked as finished, the unopened backup can be activated with a single click.

---

## 18. Editing Active vs. Unopened Inventory

Editing existing records must be intuitive, safe, and respectful of historical data.

```text
┌─────────────────────────────────────────────────────────┐
│ EDIT CURRENT BOTTLE                                 [✕] │
├─────────────────────────────────────────────────────────┤
│ Product Details                                         │
│ Name:        [ CeraVe Hydrating Cleanser              ] │
│ Category:    [ Skincare                             ▾ ] │
│ Brand:       [ CeraVe                                 ] │
│ Size:        [ 236           ] Unit: [ ml           ▾ ] │
├─────────────────────────────────────────────────────────┤
│ Purchase Details                                        │
│ Date:        [ 2026-09-01    ] Price: [ ৳ 1250        ] │
├─────────────────────────────────────────────────────────┤
│ Usage Details                                           │
│ Opened Date: [ 2026-09-01    ]                          │
├─────────────────────────────────────────────────────────┤
│ [ Cancel ]                               [ Save Changes ]│
└─────────────────────────────────────────────────────────┘
```

### 18.1 Edit Current Bottle Modal
- **Purpose:** Correcting factual data on the bottle currently in use (e.g., fixing a typo in the price, correcting the opened date, or adjusting brand information).
- **Scope:** Modifies only the active container and its associated purchase record.
- **Protection:** Past completed cycles remain strictly read-only and immutable.

### 18.2 Edit Unopened Purchase Modal
- **Purpose:** Updating purchase details for stored stock.
- **Fields:** Product identity, purchase date, price, and currency.
- **Constraint:** **No opened date field is displayed.** An unopened purchase cannot have an opened date.

---

## 19. Prediction Engine & Metrics UX

Nittoo’s mathematical foundation is rooted in absolute transparency. **Nittoo never invents or fabricates an estimate.**

```text
COMPLETED CYCLES (Finished Usage Periods)
             ↓
[Calculate Duration for each cycle: finished_date - opened_date]
             ↓
[Average Lifespan = sum(durations) / count(cycles)]
             ↓
[Predicted Remaining Days = average_lifespan - current_days_used]
```

### 19.1 Handling Insufficient Data ("Learning Baseline")
When an essential has zero completed usage periods:
- The status pill displays: **First cycle • Learning**
- Remaining days display: **Collecting first cycle duration**
- Cost per day displays: **Not enough data**
- Progress bar displays: An indeterminate, calm, neutral pattern.

The user is explicitly told: *“Historical trends appear automatically after marking a bottle as finished.”* This builds trust; the system never guesses or generates fake analytics.

### 19.2 The Metrics Suite

#### 1. Average Lifespan
```text
average_lifespan = sum(duration_days of finished periods) / count(finished periods)
```
Displayed in whole days (e.g., `62 days`).

#### 2. Predicted Remaining Days
```text
predicted_remaining_days = average_lifespan - current_days_used
```
- If positive: `45 days left` (Healthy green) or `8 days left` (Running low amber).
- If negative: `Overdue by 5 days` (Rose alert). Overdue simply means: *“You have used this longer than your historical average.”*

#### 3. Weighted Cost Per Day
To prevent single abnormal cycles or varying container sizes from skewing numbers, cross-cycle cost per day is mathematically weighted:
```text
weighted_cost_per_day = total_completed_price / total_completed_days
```
Displayed in local currency: `৳20.16/day`.

#### 4. Price Per Unit (Unit Rate)
```text
price_per_unit = purchase_price / size_value
```
Displayed alongside the unit: `৳5.30/ml` or `৳12.00/count`. This is **never** conflated with daily consumption cost.

#### 5. Estimated Monthly Consumption Cost
```text
monthly_consumption_run_rate = sum((purchase_price / average_lifespan) * 30)
```
Standardizes irregular multi-month purchases into a predictable monthly run rate.

---

## 20. Categorization & Domain Taxonomy

Nittoo organizes personal goods into 15 clear categories:

```text
1. Skincare             6. Personal Hygiene      11. Food & Beverage
2. Haircare             7. Shaving & Grooming    12. Fitness
3. Body Care            8. Household Cleaning    13. Pet Care
4. Oral Care            9. Laundry               14. Baby Care
5. Supplements         10. Home Essentials       15. Other
```

### 20.1 Category Representation
- **Category Chips:** Light neutral pill (`bg-neutral-100 text-neutral-600`) displayed on every card and table row.
- **Dashboard Filter Bar:** Horizontally scrollable pill tabs allowing instant filtering (`All`, `Skincare`, `Haircare`, etc.) with active pill count indicators.

---

## 21. Screen-by-Screen Specifications

### 21.1 Dashboard (`/dashboard`)
The daily command center. Displays what is active, what needs attention, and baseline consumption.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ PERSONAL DASHBOARD                                                     │
│ Your Essentials                                       [ + Add Product ]│
│ See what's running low, what it costs, and what you've learned.        │
├────────────────────────────────────────────────────────────────────────┤
│ [ 8 Active Essentials ]   [ 2 Attention Needed ]   [ ৳2,450 Monthly ]  │
├────────────────────────────────────────────────────────────────────────┤
│ [All] [Skincare] [Haircare] [Oral Care]            [ 🔍 Search...    ] │
├────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────┐ │
│ │ CeraVe Cleanser      │ │ Moroccanoil Shampoo  │ │ Sensodyne Tooth  │ │
│ │ [Overdue by 3d]      │ │ [8d left - Amber]    │ │ [52d left - Grn] │ │
│ │ ৳20.16/day           │ │ ৳35.00/day           │ │ ৳6.50/day        │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```
- **Sorting Hierarchy:**
  1. Most overdue items first (`-10d` before `-2d`).
  2. Soonest predicted run-out second (`2d` before `45d`).
  3. Items without predictions last, sorted by opened date.
- **Responsive Layout:** 3-column grid on desktop, 2-column on tablet, single-column stack on 375px mobile.

---

### 21.2 Inventory (`/inventory`)
The physical ownership management workspace. Answers: *“What physical goods do I have right now?”*

- **Header Controls:** Dual primary actions: `[+ Add Inventory]` (primary green) and `[+ Add Essential]` (secondary outline).
- **Section 1: Active Inventory:**
  - Compact horizontal cards showing current in-use containers.
  - Displays remaining days, average lifespan, daily cost, and backup count badge.
  - Direct `[View]` and `[Edit]` controls.
- **Section 2: Unopened Inventory:**
  - Grouped by product archetype.
  - Lists every individual waiting purchase with acquisition date and price.
  - Direct `[Edit]` and `[Start Using]` action buttons.

---

### 21.3 Product Detail & Personal Report (`/product/:id`)
An analytical deep-dive into a single essential’s complete history.

- **Header:** Category badge, brand name, volume specs, product title, and `[+ Add Inventory]` button.
- **Active Bottle Hero Card:** Displays current in-use bottle progress, opened date, purchase cost, and `[Mark Finished]` trigger.
- **Unopened Purchases Module:** Displays waiting backup containers with immediate `[Start Using]` capability.
- **4-Card Summary Statistics Grid:**
  1. *Average Lifespan* (e.g., `62 days`).
  2. *Cost Per Day* (e.g., `৳20.16/day`).
  3. *Total Spent* (e.g., `৳3,750 across 3 purchases`).
  4. *Unit Rate* (e.g., `৳5.30/ml`).
- **Duration Trends Chart (Recharts Bar Chart):** Visualizes finished bottle lifespans over time, tracking whether usage duration is increasing or decreasing.
- **Completed Lifespans Timeline:** Chronological ledger of every past bottle showing cycle number, opened date, finished date, verified lifespan, and historical cost per day.

---

### 21.4 Analytics & Forecasting (`/analytics`)
Cross-product intelligence providing financial and replenishment foresight.

- **Section 1: Upcoming Depletions (Next 30 Days):**
  - Urgent replenishment list sorted by soonest run-out date.
  - Displays predicted run-out date and estimated replacement cost based on historical purchase prices.
- **Section 2: Estimated Monthly Consumption Cost:**
  - Dominant hero card highlighting normalized 30-day run rate across all essentials with completed cycles.
- **Section 3: Cost Efficiency Rankings:**
  - Side-by-side comparison tables:
    - *Most Cost-Efficient Essentials* (lowest daily cost).
    - *Highest Daily Cost Essentials* (highest daily cost).
- **Section 4: Cost Per Day Comparison Chart:**
  - Horizontal/vertical bar chart benchmarking cost per day across all active essentials.

---

### 21.5 Add Essential (`/add-product`)
Free-form onboarding flow for tracking a new product archetype. Includes live autocomplete lookup to prevent duplicate records, clear category selectors, volume units, purchase price, and the initial usage decision (`Start using today` vs `Keep unopened`).

---

### 21.6 Add Inventory (`/add-inventory`)
Dedicated purchase logging for existing essentials.
1. *Select Tracked Essential:* Instant search across existing items with active and unopened status previews.
2. *Purchase Details:* Acquisition date, price, and currency.
3. *Usage Selection:* Defaults to `Keep unopened (Recommended for inventory)` with a safe radio toggle for `Start using today`.

---

### 21.7 Account & Settings (`/account`)
Profile management, default currency display (`BDT ৳`), active storage engine indicator, and non-destructive / destructive data management options with explicit confirmation safeguards.

---

### 21.8 Authentication Suite (`/login`, `/signup`, `/forgot-password`)
Minimalist, centered card layout on the `#FBFBFB` canvas. Showcases the brand logo and wordmark, clean input fields, clear loading feedback, error banners, and an unobtrusive magic-link toggle.

---

## 22. Modal Dialogs & Feedback Patterns

### 22.1 Mark Finished Modal (`FinishUsageModal`)
Triggered when the user finishes a container.
- Confirms product name and opened date.
- Provides a date picker defaulting to `Today (UTC)` for when the container was finished.
- Dynamically computes and previews the resulting cycle duration:  
  *“Calculated cycle duration: 58 days.”*
- Action buttons: `[Cancel]` and `[Confirm & Finish Bottle]`.

### 22.2 Ambient Feedback Banners
- **Success Banner:** Soft emerald background (`#EBF4F0`), forest border (`#2D6A4F/20`), forest text (`#2D6A4F`). Auto-dismissible with an explicit close button (`✕`).
- **Error / Alert Banner:** Soft rose background (`#FFF1F2`), rose border (`#FECDD3`), rose text (`#9F1239`). Carries a clear explanation and an inline `[Retry]` option where appropriate.

---

## 23. Motion & Animation Principles

Motion in Nittoo is functional, graceful, and fast. It reinforces spatial hierarchy without delaying user interactions.

```text
TIMING CURVE:  cubic-bezier(0.22, 1, 0.36, 1)  (Snappy deceleration)
DURATION:      140ms – 220ms                   (Sub-perceptual latency)
```

### 23.1 Motion Tokens
- **Page Entry Transition:** Opacity fades from 0 to 1 with an upward drift of `6px` over `220ms`.
- **Modal Dialog Scale-In:** Opacity fades from 0 to 1 with a gentle scale from `0.97` to `1.0` and `4px` upward translation over `180ms`.
- **Backdrop Fade:** Blackout backdrop fades to `40% opacity` over `160ms`.
- **Tactile Button Press:** Button scales down to `0.98` on `:active` over `140ms`.
- **Interactive Card Hover:** Subtle elevation translation `-1.5px` with shadow expansion over `200ms`.
- **Loading Skeleton Shimmer:** A 2-stage gradient shimmer smoothly sweeps horizontally every `1.6s`.
- **Reduced Motion Compliance:** When `prefers-reduced-motion: reduce` is active, all animation durations collapse to `0.01ms`, preserving accessibility for motion-sensitive users.

---

## 24. Responsive Rules & Viewport Adaptations

Nittoo is built to function flawlessly across screen sizes from **375px mobile viewports** to **ultra-wide desktop displays**.

```text
┌──────────────────────────┬──────────────────────────┬──────────────────────────┐
│ Mobile (< 768px)         │ Tablet (768px – 1024px)  │ Desktop (>= 1024px)      │
├──────────────────────────┼──────────────────────────┼──────────────────────────┤
│ Fixed bottom navigation  │ Sticky top header        │ Sticky top header        │
│ 1-column card stack      │ 2-column card grid       │ 3-column card grid       │
│ Full-width modal sheets  │ Centered dialogs         │ Centered dialogs         │
│ Horizontal scrolling tabs│ Wrapped filter chips     │ Inline filter tabs       │
│ Min touch target: 44px   │ Standard pointer targets │ Standard pointer targets │
└──────────────────────────┴──────────────────────────┴──────────────────────────┘
```

### Responsive Heuristics
1. **Zero Horizontal Overflow:** Page layouts never produce accidental horizontal scrollbars. Tables collapse cleanly into stacked cards on mobile.
2. **Mobile Keyboard Protection:** Date pickers and form inputs use `16px` base font sizes on mobile to prevent iOS Safari from zooming into the viewport.
3. **Bottom Navigation Clearance:** Main page content includes a minimum bottom margin of `80px` on mobile to prevent the fixed bottom navigation bar from obscuring interactive controls.

---

## 25. Accessibility (a11y) Standards

1. **Color Contrast:** All text pairings meet WCAG AA standards (minimum contrast ratio of `4.5:1` for standard copy, `3:1` for large numerical metrics).
2. **Multi-Modal State Indication:** Statuses never rely solely on color. Red/amber/green states always pair colored fills with text labels (e.g., `Overdue by 3d`) and geometric indicators (e.g., pulsing dots, distinct icons).
3. **Visible Focus Rings:** Keyboard navigation is fully supported with a high-contrast 2px solid ring (`#2D6A4F`) with `2px offset`.
4. **Accessible Forms:** Every input is bound to a semantic `<label>` element with unambiguous placeholder text and descriptive error messages.

---

## 26. Content & Copywriting Principles

Nittoo speaks like an organized, mindful friend—clear, supportive, and precise.

```text
AVOID:   "SKU #49102 depleted. Inventory level: 0 units."  (Too industrial)
AVOID:   "OMG you finished it!! Level up your streak! 🔥"   (Too juvenile)
USE:     "CeraVe Hydrating Cleanser is finished. 58-day cycle recorded." (Calm, precise, personal)
```

### 26.1 Terminology Glossary
- Use **Essential**, not "Item" or "SKU".
- Use **Active Bottle / Container**, not "Current record".
- Use **Unopened Purchase**, not "Buffer stock".
- Use **Lifespan**, not "Time to live" or "Depletion period".
- Use **Baseline Run Rate**, not "Burn rate".
- Use **Existing Essential**, not "Repeat Purchase Mode".

---

## 27. Design Anti-Patterns (What Nittoo Must NEVER Do)

1. **The E-Commerce Trap:** Nittoo must never look like an online store. There are no "Buy Now", "Add to Cart", star ratings, or discount badges. Nittoo tracks what you *already own*.
2. **The Warehouse Logistics Trap:** Nittoo must never look like SAP or an industrial inventory system. No barcode-first interfaces, warehouse shelf numbers, or bulk pallet counts.
3. **The Fictional Precision Trap:** Nittoo must never present fabricated predictions before a product has finished its first cycle. If data is lacking, state clearly: *“Not enough data.”*
4. **The Gamification Trap:** Nittoo must never introduce manipulative streaks, badges, or confetti popups when a container is finished. Consuming shampoo is not a video game.
5. **The Floating Card Aesthetic:** Avoid heavy drop-shadows, glow effects, or cards that look like they are hovering 50px off the screen. Restrained surfaces and hairline borders maintain calm visual order.

---

## 28. Future Design Extensibility

While preserving the core visual constitution, Nittoo’s design system is structured to accommodate future capabilities:

1. **Product Imagery:** The card header layout is built to support a 40x40px rounded container image slot without disrupting text hierarchy.
2. **Multi-Currency Display:** The financial presentation engine is modular, allowing users to track purchases in USD, EUR, or GBP while normalizing monthly run rates into their primary home currency.
3. **Replenishment Reminders:** When an item enters the "Running Soon" status (< 14 days), the notification architecture can extend to subtle email summaries or device calendar reminders.
4. **Barcode Ingestion:** Mobile addition flows can incorporate a clean camera viewport sheet for rapid UPC lookup without altering the underlying manual form model.

---

> **End of Specification**  
> *Nittoo — Know What Lasts.*
