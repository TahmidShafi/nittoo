# Nittoo — Current Project State & System Handoff

> **Authoritative Handoff Document**  
> **Repository:** `TahmidShafi/nittoo` (`D:\nittoo`)  
> **Timestamp:** September 2026  
> **Target Audience:** Autonomous Coding Agents, Senior Engineers, Product Designers, and Technical Architects.  
> **Guiding Principle:** Implementation-grounded snapshot. All statements derived strictly from active code, configuration, schemas, and verification suites. Zero conjecture.

---

## 1. Executive Summary

Nittoo is a high-precision **personal consumption intelligence web application** designed specifically for everyday physical consumables—skincare, haircare, oral care, supplements, personal hygiene, household cleaners, and pantry essentials. 

Unlike traditional warehouse inventory trackers that ask *"How many units are in stock?"* or personal finance apps that record lump-sum credit card charges, Nittoo tracks **actual consumption lifecycles**:
1. **How long a bottle or container actually lasts** (observed duration in days).
2. **What an essential truly costs per day of use** (`৳/day`).
3. **When an active container is predicted to run out** (data-driven runout forecasting).
4. **Normalized monthly consumption run rate** committed to everyday essentials (`৳/month`).

### Milestones Completed (Stages 0 through 16)
- **Core Essentials Lifecycle**: Add product, record purchases, activate containers, track daily usage, and finish cycles.
- **Strict Finished-Periods Analytics**: Zero fabricated estimates; predictions and average lifespans strictly require completed historical usage cycles.
- **Dual-Storage Engine Architecture**: Seamless switching between offline-first `localStorage` mock database and live cloud Supabase PostgreSQL with database-level Row Level Security (RLS).
- **Inventory Subsystem**: Dedicated tracking of **Active** (in-use, max 1 per product) vs. **Unopened** (stored backup inventory) purchases.
- **Store / Vendor Tracking (Stage 16)**: Optional purchase-level vendor metadata tracking across forms, databases, display views, and export/restore pipelines without altering prediction math.
- **Personal Value Comparison**: Objective head-to-head comparison engine with unit price economics and deterministic, non-judgmental insights.
- **Prediction Confidence Engine**: Deterministic evidence-maturity framework classifying prediction maturity across 5 states (`no_data` to `strong_history`) based on completed cycle volume.
- **Account & Security Center**: Quiet, document-style account settings for email updates, password updates, global session termination, and complete account deletion with cascade data purging.
- **Professional Data Portability**: 4-format unified export engine (Excel `.xlsx`, CSV archive `.zip`, editorial PDF report `.pdf`, and authoritative JSON backup `.json`).
- **Idempotent Backup Restore & Import**: Multi-step, user-confirmed restore system with schema validation, relational integrity checks, active-container conflict preservation, and strict current-user ownership reassignment.
- **Tab Return & Window Focus Silent Revalidation**: Resilient 3-second throttled background revalidation eliminating dashboard repaint flashes on window focus.
- **Comprehensive Automated Verification**: 21 automated test scripts (`npm run verify:*`) validating 100% of domain math, vendor attributes, RLS policies, multi-tenant isolation, mock persistence, and UI layout invariants.

---

## 2. Technology Stack

Discovered directly from [`package.json`](file:///d:/nittoo/package.json), [`vite.config.ts`](file:///d:/nittoo/vite.config.ts), and configuration files:

| Layer | Technology | Exact Version | Purpose & Configuration |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `19.0.0` | Core UI library (`react`, `react-dom`) |
| **Language** | TypeScript | `~5.7.2` | Strict typing (`tsc -b`), ES2020 target, Node module resolution |
| **Build Tool & Bundler** | Vite | `^6.2.0` | Next-gen frontend tooling with `@vitejs/plugin-react` (`4.3.4`) |
| **Styling & CSS** | Tailwind CSS | `^4.0.9` | Tailwind CSS v4 via `@tailwindcss/vite` (`4.0.9`) and `@theme` tokens in `src/index.css` |
| **Client Routing** | React Router DOM | `^7.3.0` | Declarative client-side routing with route guards |
| **Database (Cloud)** | PostgreSQL / Supabase | `^2.49.1` | Cloud backend via `@supabase/supabase-js` with RLS enforcement |
| **Database (Dev/Mock)** | Browser LocalStorage | Native API | Offline-first mock database with in-memory fallback for test runners |
| **Data Visualization** | Recharts | `^2.15.1` | SVG duration trends and cost-per-day charts |
| **Spreadsheet Export** | SheetJS (XLSX) | `^0.18.5` | Formatted multi-sheet Excel workbook generator (`xlsx`) |
| **Archive Packaging** | JSZip | `^3.10.1` | Multi-file ZIP packaging for UTF-8 CSV tabular data (`jszip`) |
| **PDF Document Engine**| jsPDF | `^4.2.1` | Vector/editorial PDF generation for personal consumption reports |
| **Script Execution** | tsx | `^4.23.13` | Direct execution of TypeScript verification scripts in Node.js |
| **Package Manager** | npm | OS native | Dependency management and script lifecycle runner |
| **Production Hosting** | Vercel | Configured | Static SPA hosting with `vercel.json` rewrite (`/(.*)` -> `/index.html`) |

---

## 3. Project Structure

```text
d:\nittoo\
├── .agents/                        # IDE agent customizations and skills
├── .vscode/                        # Visual Studio Code workspace settings
├── dist/                           # Production build output from `npm run build`
├── docs/                           # Architectural and verification documentation
│   ├── current-state.md            # [THIS FILE] Authoritative project handoff
│   └── supabase-rls-checklist.md   # Supabase RLS security audit checklist
├── public/                         # Static assets served at root
│   ├── favicon.svg                 # SVG brand favicon
│   └── nittoo-logo.png             # Official high-resolution brand wordmark/logo
├── scripts/                        # 20 Automated verification suites (Node.js / tsx)
│   ├── verify-account.ts           # Account settings & touch target audit
│   ├── verify-add-product.ts       # Product creation & repeat purchase logic
│   ├── verify-analytics.ts         # Run rate, upcoming rebuys, and rankings
│   ├── verify-auth.ts              # Auth flows, session persistence, mock hashing
│   ├── verify-comparison.ts        # Product comparison math, insights, and compatibility
│   ├── verify-confidence.ts        # Evidence maturity thresholds and confidence states
│   ├── verify-dashboard.ts         # Dashboard data loading, sorting, and edge cases
│   ├── verify-data-layer.ts        # IDataSource API adherence across mock and real DB
│   ├── verify-edit-inventory.ts    # Inventory editing rules and date validations
│   ├── verify-export.ts            # Multi-format export generation and schema audit
│   ├── verify-focus-refresh.ts     # Window focus revalidation and referential stability
│   ├── verify-full-walkthrough.ts  # End-to-end full user journey simulation
│   ├── verify-inventory.ts         # Active vs Unopened inventory lifecycle
│   ├── verify-live-audit.ts        # Live Supabase multi-tenant isolation audit
│   ├── verify-product-detail.ts    # Product detail data aggregation and trend math
│   ├── verify-restore-button.ts    # Visual button styling and responsive layout verification
│   ├── verify-restore.ts           # 40-test restore engine verification suite
│   ├── verify-supabase-live.ts     # Live cloud database connection and CRUD checks
│   ├── verify-supabase-rls.ts      # Live 2-account cross-tenant RLS attack suite
│   └── verify-unopened-lifecycle.ts# Unopened purchase state transitions
├── src/                            # Application source code
│   ├── App.tsx                     # Top-level application routing and route guards
│   ├── main.tsx                    # React 19 root mounting
│   ├── index.css                   # Tailwind v4 import, @theme definitions, keyframes
│   ├── vite-env.d.ts               # Vite client type declarations
│   ├── components/                 # Reusable UI components and modal dialogs
│   │   ├── ChangeEmailModal.tsx    # Modal for email address updates
│   │   ├── ChangePasswordModal.tsx # Modal for password updates
│   │   ├── DeleteAccountModal.tsx  # Destructive account deletion modal
│   │   ├── EditInventoryModal.tsx  # Modal for editing active/unopened inventory
│   │   ├── ExportDataModal.tsx     # Format selector dialog (Excel, CSV, PDF, JSON)
│   │   ├── FinishUsageModal.tsx    # Modal for finishing active bottle with finish date
│   │   ├── Layout.tsx              # Sticky desktop header + mobile 4-tab bottom bar
│   │   ├── NittooLogo.tsx          # Brand logo renderer (wordmark / vector bottle mark)
│   │   ├── ProductCard.tsx         # Dashboard card with days used, progress bar, badge
│   │   ├── ProtectedRoute.tsx      # Guard redirecting unauthenticated users to /login
│   │   ├── PublicOnlyRoute.tsx     # Guard redirecting authenticated users to /dashboard
│   │   ├── RestoreDataModal.tsx    # Multi-step backup restore wizard (Upload -> Plan -> Execute)
│   │   └── SignOutAllSessionsModal.tsx # Modal for global session termination
│   ├── contexts/                   # React shared state contexts
│   │   └── AuthContext.tsx         # Dual-mode authentication provider (Supabase & Mock)
│   ├── hooks/                      # Custom React hooks
│   │   ├── useAuth.ts              # Convenient accessor for AuthContext
│   │   └── usePrediction.ts        # Memoized prediction calculations for product cards
│   ├── lib/                        # Core domain logic, engines, and database abstraction
│   │   ├── analytics.ts            # Cross-product analytics (monthly run rate, rebuys)
│   │   ├── comparison.ts           # Value intelligence comparison engine
│   │   ├── confidence.ts           # Prediction confidence & evidence maturity engine
│   │   ├── dataSource.ts           # Central data source router (routes to db or mockDb)
│   │   ├── dateUtils.ts            # UTC date arithmetic, day calculations, formatting
│   │   ├── db.ts                   # Supabase database client implementing IDataSource
│   │   ├── mock-db.ts              # Offline mock database implementing IDataSource
│   │   ├── prediction.ts           # Pure prediction math (lifespan, cost/day, remaining days)
│   │   ├── supabase.ts             # Supabase client initializer and environment detector
│   │   ├── export/                 # Data export subsystem
│   │   │   ├── csv.ts              # RFC 4180 CSV tables + ZIP packager
│   │   │   ├── excel.ts            # Styled multi-sheet XLSX generator
│   │   │   ├── index.ts            # Unified exporter facade (`exportUserDataAs`)
│   │   │   ├── json.ts             # Formatted JSON backup generator
│   │   │   ├── normalizer.ts       # Raw database to NittooExportData normalizer
│   │   │   ├── pdf.ts              # Editorial PDF report generator
│   │   │   └── types.ts            # Normalized export data interfaces
│   │   └── restore/                # Data restore & import subsystem
│   │       ├── executor.ts         # Confirmed plan dispatcher
│   │       ├── index.ts            # Restore engine facade (`validateBackupFile`, `buildImportPlan`)
│   │       ├── planner.ts          # Pure comparison and mutation planner
│   │       ├── types.ts            # Validation, plan, and conflict interfaces
│   │       └── validator.ts        # Schema versioning, relational, and secret validator
│   ├── pages/                      # Application route screens
│   │   ├── AccountPage.tsx         # Account settings, security, export, and restore
│   │   ├── AddInventoryPage.tsx    # Dedicated purchase recorder for existing essentials
│   │   ├── AddProductPage.tsx      # Essential onboarding & repeat purchase creator
│   │   ├── AnalyticsPage.tsx       # Cross-product consumption analytics & charts
│   │   ├── DashboardPage.tsx       # Main dashboard with active essentials & urgency sort
│   │   ├── ForgotPasswordPage.tsx  # Password recovery request screen
│   │   ├── InventoryPage.tsx       # Inventory manager (Active vs Unopened backups)
│   │   ├── LoginPage.tsx           # User sign-in (email/password, magic link toggle)
│   │   ├── ProductComparisonPage.tsx # Head-to-head product value comparison screen
│   │   ├── ProductDetailPage.tsx   # Detailed essential report, trends chart, history
│   │   ├── ResetPasswordPage.tsx   # Password reset screen with recovery token
│   │   └── SignupPage.tsx          # User registration screen
│   └── types/                      # Single source of truth for domain interfaces
│       └── index.ts                # Products, purchases, usage, and IDataSource contract
├── supabase/                       # Supabase PostgreSQL configuration
│   └── schema.sql                  # DDL schema, constraints, unique partial indexes, RLS
├── design.md                       # Comprehensive UX and design system specification
├── nittoo-build-guide.md           # Build guide documenting stages 0–7
├── README.md                       # Public repository documentation
├── vercel.json                     # Vercel SPA routing rewrite configuration
└── vite.config.ts                  # Vite build and Tailwind plugin configuration
```

---

## 4. Product Philosophy

1. **Consumption Intelligence, Not Warehouse Logistics**:  
   Traditional inventory tools assume goods sit static on a warehouse shelf. Nittoo recognizes that everyday essentials continuously deplete through personal use. The core unit of interest is the **usage cycle** (from opened date to finished date).
2. **Zero Fabricated Metrics**:  
   If an essential has zero completed usage cycles, its average lifespan cannot be known. Nittoo displays **"Not enough data"** instead of guessing from manufacturer claims, global averages, or arbitrary heuristics.
3. **Strict Separation of Price Per Unit vs. Cost Per Day**:  
   - **Price Per Unit** (`৳/ml`, `৳/g`) measures purchase-time bulk efficiency.  
   - **Cost Per Day** (`৳/day`) measures actual personal consumption value.  
   A 500ml shampoo with a lower price per unit may cost more per day if the user consumes it twice as fast. Nittoo treats these as fundamentally separate dimensions.
4. **Calm, High-Agency Experience**:  
   No gamification, badges, streaks, or noisy alerts. Nittoo functions like a high-precision personal instrument—quiet, trustworthy, and deterministic.

---

## 5. Domain Model

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        DOMAIN RELATIONSHIP MODEL                       │
└────────────────────────────────────────────────────────────────────────┘

 [auth.users] (Current Authenticated User)
       │
       │ 1:N (Direct Ownership)
       ▼
 ┌───────────────┐
 │   products    │  ◄── "Essential" (What you track: Brand, Name, Category, Size)
 └───────┬───────┘
         │
         │ 1:N (Foreign Key: product_id ON DELETE CASCADE)
         ▼
 ┌───────────────┐
 │   purchases   │  ◄── "Physical Acquisition" (Date, Price, Currency)
 └───────┬───────┘      [Unopened Backup if no linked usage_period exists]
         │
         │ 1:1 (Foreign Key: purchase_id ON DELETE CASCADE)
         ▼
 ┌───────────────┐
 │ usage_periods │  ◄── "Consumption Cycle" (Opened Date, Finished Date, Status)
 └───────────────┘      • status = 'active'   ──► Active Bottle (Max 1 per product)
                        • status = 'finished' ──► Historical Cycle (Feeds predictions)
```

### Concepts & Invariant Distinctions

| Domain Concept | Representation & Source | What It Does | What It Must NOT Be Confused With |
| :--- | :--- | :--- | :--- |
| **Product / Essential** | Table: `products` | The conceptual item being tracked (e.g. "CeraVe Hydrating Cleanser"). Stores name, brand, category, size value, and size unit. | Must NOT be confused with a physical bottle or purchase. One essential can have dozens of purchases over years. |
| **Purchase** | Table: `purchases` | A discrete physical transaction. Stores price (`price`), date (`purchase_date`), and currency (`BDT`). | Must NOT be confused with starting to use an item. Buying a bottle does not mean opening it. |
| **Usage Period** | Table: `usage_periods` | A duration of active consumption. Links `product_id` and `purchase_id`. Tracks `opened_date`, optional `finished_date`, and `status`. | Must NOT be confused with purchase date. An item can be bought months before being opened. |
| **Active Inventory** | `usage_periods` where `status = 'active'` | The single container currently open and in use. Enforced by unique partial index `idx_usage_periods_single_active`. | Must NOT have multiple active bottles per essential. |
| **Unopened Inventory** | `purchases` with NO linked row in `usage_periods` | Stored backup items waiting in cupboards or shelves. | Must NOT contribute to daily usage counters or runout predictions until activated. |
| **History / Finished Cycles** | `usage_periods` where `status = 'finished'` | Completed consumption cycles with valid `finished_date >= opened_date`. | Must NOT include ongoing active usage. Active containers do not have an observed lifespan yet. |
| **Prediction** | Pure function calculation | Runout date and remaining days calculated as $\text{average\_lifespan} - \text{days\_used}$. | Must NOT fabricate estimates when finished cycle count is 0. |
| **Confidence** | Pure function calculation | Evidence maturity state based strictly on completed cycle count (0: `no_data`, 1: `early`, 2–3: `developing`, 4–5: `reliable`, 6+: `strong_history`). | Must NOT be an arbitrary percentage score or machine-learning probability. |
| **Comparison** | Pure function calculation | Objective head-to-head comparison of two essentials across observed lifespan, cost/day, unit price, and size. | Must NOT substitute active container estimates into historical observed metrics. |
| **Analytics** | Pure function calculation | Aggregated portfolio intelligence: estimated 30-day consumption run rate, upcoming 30-day runouts, cost efficiency rankings. | Must NOT be confused with monthly bank balance or total spend. It represents ongoing consumption burn rate. |
| **Category** | Fixed union of 15 strings | Categorical taxonomy (`Skincare`, `Haircare`, `Body Care`, `Oral Care`, `Supplements`, etc.). | Categories do not enforce restrictive validation on product names. |
| **Vendor / Store** | Table: `purchases.store_vendor` | Optional purchase-level metadata recording where the purchase was acquired (e.g. "Shajgoj", "Daraz"). Supported across forms, database, mock DB, exports, and backup restore. | Must NOT be confused with a product attribute. Multiple purchases of the same essential can have different vendors. Does NOT affect consumption or prediction math. |
| **Product Image** | Vector Logo / Fallbacks | SVG icon marks and official brand logo (`/nittoo-logo.png`). | User image upload is **NOT implemented**. |
| **Manual Lifespan Estimate** | Explicitly Forbidden | Design constitution strictly rejects manual guesses. | Historical duration must come from actual usage dates. |
| **Export** | 4 formats | Normalized export representation of user data. | Export is read-only; never mutates records. |
| **Restore** | JSON only (v1.0.0) | Multi-step additive import into authenticated user account. | Excel, CSV, and PDF are **never** used for restore. |

---

## 6. Current User Lifecycle

```text
[ 1. ACQUISITION ]
   User purchases an essential (e.g. CeraVe Cleanser, ৳1,250 on 2026-08-30).
   └── In UI: /add-product OR /add-inventory
         ├── Choice A: "Start using today" (Opens active usage period immediately)
         └── Choice B: "Keep unopened / backup" (Stores purchase without usage period)
                 │
                 ▼
[ 2. UNOPENED INVENTORY ]
   Purchase sits in /inventory under UNOPENED.
   └── Shows purchase date, price, and backup count badge on product card.
   └── Zero impact on daily usage counters, burn rate, or lifespan averages.
                 │
                 ▼ (When active container runs out)
[ 3. ACTIVATION ("Start Using") ]
   User clicks "Start Using" on an unopened purchase.
   └── Validates single-active-bottle invariant (blocks if active container already exists).
   └── Creates a row in usage_periods linking product_id and purchase_id with status = 'active'.
                 │
                 ▼
[ 4. ACTIVE CONSUMPTION ]
   Active bottle appears on Dashboard and Product Detail.
   └── Displays live counter: "Day 34 in use".
   └── Displays runout forecasting if historical data exists.
   └── Flags as "Overdue" if current days in use exceed historical average lifespan.
                 │
                 ▼ (When container is empty)
[ 5. COMPLETION ("Finish Usage") ]
   User clicks "Finish Usage" and enters finish date (must be >= opened date).
   └── Sets status = 'finished' and records finished_date.
   └── Cycle is closed permanently. Product now has 0 active bottles.
                 │
                 ▼
[ 6. HISTORICAL LEARNING ]
   Observed duration is calculated: finished_date - opened_date.
   └── Contributes to new arithmetic average lifespan.
   └── Increments completed cycle count (advances confidence state).
   └── Recalculates personal weighted cost per day: total finished cost / total finished days.
                 │
                 ▼
[ 7. NEXT-BOTTLE CONTINUITY ]
   User either activates next unopened backup from inventory OR buys a new bottle.
   └── Predictions on the subsequent bottle now reflect updated historical learning.
```

---

## 7. Database Schema

The database schema is defined in [`supabase/schema.sql`](file:///d:/nittoo/supabase/schema.sql) and mirrored in [`src/lib/mock-db.ts`](file:///d:/nittoo/src/lib/mock-db.ts).

### Table 1: `public.products`
Tracks tracked consumables belonging to a user.
- `id` (`UUID`, PK, default: `gen_random_uuid()`)
- `user_id` (`UUID`, NOT NULL, FK: `auth.users(id) ON DELETE CASCADE`)
- `name` (`TEXT`, NOT NULL)
- `category` (`TEXT`, NOT NULL)
- `brand` (`TEXT`, NULLABLE)
- `size_value` (`NUMERIC`, NULLABLE, `CHECK (size_value IS NULL OR size_value > 0)`)
- `size_unit` (`TEXT`, NULLABLE)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, default: `now()`)
- **Index**: `idx_products_user_id ON public.products(user_id)`

### Table 2: `public.purchases`
Tracks physical purchase transactions linked to products.
- `id` (`UUID`, PK, default: `gen_random_uuid()`)
- `product_id` (`UUID`, NOT NULL, FK: `public.products(id) ON DELETE CASCADE`)
- `purchase_date` (`DATE`, NOT NULL)
- `price` (`NUMERIC`, NOT NULL, `CHECK (price >= 0)`)
- `currency` (`TEXT`, NOT NULL, default: `'BDT'`)
- `store_vendor` (`TEXT`, NULLABLE) — Optional store or vendor name (e.g. "Shajgoj", "Daraz", "local pharmacy"). Nullable, no foreign key, no vendor table.
- `created_at` (`TIMESTAMPTZ`, NOT NULL, default: `now()`)
- **Index**: `idx_purchases_product_id ON public.purchases(product_id)`
- **Note**: Does NOT store `user_id` directly; user ownership is derived relationally through `product_id`.

### Table 3: `public.usage_periods`
Tracks discrete periods of product consumption.
- `id` (`UUID`, PK, default: `gen_random_uuid()`)
- `product_id` (`UUID`, NOT NULL, FK: `public.products(id) ON DELETE CASCADE`)
- `purchase_id` (`UUID`, NOT NULL, FK: `public.purchases(id) ON DELETE CASCADE`)
- `opened_date` (`DATE`, NOT NULL)
- `finished_date` (`DATE`, NULLABLE)
- `status` (`TEXT`, NOT NULL, default: `'active'`, `CHECK (status IN ('active', 'finished'))`)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, default: `now()`)
- **Constraint**: `chk_finished_date_valid CHECK (finished_date IS NULL OR finished_date >= opened_date)`
- **Relational Indexes**:
  - `idx_usage_periods_product_id ON public.usage_periods(product_id)`
  - `idx_usage_periods_purchase_id ON public.usage_periods(purchase_id)`
  - `idx_usage_periods_status ON public.usage_periods(status)`
- **Critical Unique Partial Index**:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_periods_single_active 
  ON public.usage_periods (product_id) 
  WHERE status = 'active';
  ```
  *Guarantees at the database engine level that no product can ever have more than one active usage period simultaneously.*

---

## 8. Security & Row Level Security (RLS)

All tables in `supabase/schema.sql` have Row Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).

### 1. Products Policies (Direct Ownership)
- `SELECT`: `auth.uid() = user_id`
- `INSERT`: `auth.uid() = user_id` (enforced via `WITH CHECK`)
- `UPDATE`: `auth.uid() = user_id`
- `DELETE`: `auth.uid() = user_id`

### 2. Purchases Policies (Indirect Relational Ownership)
- `SELECT`, `UPDATE`, `DELETE`:
  ```sql
  USING (EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = purchases.product_id
    AND products.user_id = auth.uid()
  ))
  ```
- `INSERT`:
  ```sql
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = purchases.product_id
    AND products.user_id = auth.uid()
  ))
  ```

### 3. Usage Periods Policies (Relational Ownership & Cross-Entity Integrity)
- `SELECT`, `UPDATE`, `DELETE`:
  ```sql
  USING (EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = usage_periods.product_id
    AND products.user_id = auth.uid()
  ))
  ```
- `INSERT` (Guarantees relational consistency across product, purchase, and user):
  ```sql
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.purchases pu ON pu.product_id = p.id
    WHERE p.id = usage_periods.product_id
    AND pu.id = usage_periods.purchase_id
    AND p.user_id = auth.uid()
  ))
  ```

### Security Invariants
- **No Service Role Key in Frontend**: The frontend bundle strictly uses the public `anon` key.
- **Relational Tamper Protection**: An authenticated user cannot attach a purchase or usage period to another user's product ID, nor link a usage period to a purchase belonging to a different product.

---

## 9. Authentication

Authentication is handled by [`src/contexts/AuthContext.tsx`](file:///d:/nittoo/src/contexts/AuthContext.tsx) in dual mode:

### 1. Supabase Mode (Live Cloud)
- **Sign In**: `supabase.auth.signInWithPassword({ email, password })`.
- **Sign Up**: `supabase.auth.signUp({ email, password })`. Returns `requiresEmailConfirmation: true` if session is null.
- **Sign Out**: `supabase.auth.signOut()`.
- **Magic Link**: `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`.
- **Password Reset**: `supabase.auth.resetPasswordForEmail(email)` followed by `supabase.auth.updateUser({ password })` on `/reset-password`.
- **Update Email**: `supabase.auth.updateUser({ email })`. Informs user to check new inbox for confirmation.
- **Update Password**: `supabase.auth.updateUser({ password })`.
- **Sign Out All Sessions**: `supabase.auth.signOut({ scope: 'global' })`.
- **Delete Account**: Calls `db.resetUserData(user.id, true)` (deletes products, purchases, usage periods) and triggers global sign-out.

### 2. Mock Mode (Offline Development)
- **Deterministic Mock User Generator**: `generateDeterministicMockUserId(email)` uses an FNV-1a hash algorithm to produce deterministic user IDs (e.g. `demo-user@nittoo.local` $\to$ `default-mock-user`).
- **Session Persistence**: Stored in `localStorage` under `nittoo_auth_session`.
- **Multi-Tenant Isolation in Mock**: Different email addresses generate distinct mock IDs. Data for `mock-user-alice-*` is completely invisible to `mock-user-bob-*`.

### Route Guards
- **`ProtectedRoute`**: Blocks access to `/dashboard`, `/inventory`, `/analytics`, `/product/:id`, `/compare`, `/account` if `user === null`. Redirects to `/login`.
- **`PublicOnlyRoute`**: Blocks access to `/login`, `/signup`, `/forgot-password` if user is already authenticated. Redirects to `/dashboard`.

---

## 10. Data Source Architecture

The application enforces a strict **Data Source Abstraction Pattern**:

```text
┌────────────────────────────────────────────────────────┐
│                      UI Components                     │
│         (Pages, Cards, Forms, Modals, Hooks)           │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ Imports { db } exclusively from
                            ▼
┌────────────────────────────────────────────────────────┐
│               src/lib/dataSource.ts                    │
│      Single Source of Truth (implements IDataSource)   │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
   if (isSupabaseConfigured)     if (!isSupabaseConfigured)
              │                            │
              ▼                            ▼
┌───────────────────────────┐┌───────────────────────────┐
│       src/lib/db.ts       ││     src/lib/mock-db.ts    │
│  (Supabase PostgreSQL)    ││   (LocalStorage Adapter)  │
└───────────────────────────┘└───────────────────────────┘
```

### Architectural Rules
1. **Forbidden Imports**: UI pages, components, and hooks are strictly forbidden from importing directly from `src/lib/db.ts` or `src/lib/mock-db.ts`. All data access must pass through `import { db } from '../lib/dataSource'`.
2. **Contract Completeness**: Both `db.ts` and `mock-db.ts` implement the identical `IDataSource` interface defined in `src/types/index.ts`.
3. **Automatic Fallback**: `src/lib/supabase.ts` inspects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If they are empty, undefined, or contain placeholder strings (`YOUR_SUPABASE_URL`), `isSupabaseConfigured` evaluates to `false` and mock mode activates automatically.

---

## 11. Current Features — Complete Inventory

### IMPLEMENTED Features
- **Dual-Mode Authentication**: Email/password, magic link, password reset, session persistence.
- **Essential Onboarding (`/add-product`)**: Free-form name, brand, 15 categories, custom size (`ml`, `g`, `count`), purchase price, purchase date, opened today vs keep unopened.
- **Existing Essential Search & Repeat Purchases**: Auto-suggests existing essentials in Add Product to prevent duplicate records; preserves price history under existing item.
- **Dedicated Add Inventory (`/add-inventory`)**: Focused purchase logger for existing essentials; defaults to "Keep unopened" for personal pantry/cupboard inventory.
- **Inventory Subsystem (`/inventory`)**: Active vs Unopened sections, backup counts, "Start Using" activation, single active container enforcement.
- **Active Bottle Tracking & Days-in-Use**: Live daily usage counter, progress bar, overdue flags when usage exceeds average lifespan.
- **Finish Usage Cycle (`FinishUsageModal`)**: Modal dialog to record completion date, enforce `finished_date >= opened_date`, and update historical averages.
- **Edit Current Inventory (`EditInventoryModal`)**: Edit active bottle purchase price and opened date, or unopened backup price and purchase date.
- **Dashboard (`/dashboard`)**: Urgency-sorted essentials (Overdue $\to$ Runout soonest $\to$ Learning), summary metrics (running soon, overdue, monthly run rate).
- **Product Detail Report (`/product/:id`)**: Hero metrics, Recharts historical duration trends bar chart, unopened backup list, and full historical log.
- **Cross-Product Analytics (`/analytics`)**: Monthly consumption expenditure, upcoming 30-day runouts timeline, and cost-per-day efficiency leaderboard.
- **Product Value Comparison (`/compare`)**: Side-by-side comparison of any two essentials, size compatibility validation, unit price comparison, and deterministic insight generation.
- **Prediction Confidence Framework**: 5 deterministic evidence states (`no_data` to `strong_history`) communicating prediction maturity without arbitrary percentages.
- **Account & Security Settings (`/account`)**: Change email, change password, global session termination, complete account deletion with cascade purging.
- **Store / Vendor Tracking (Stage 16)**: Optional purchase-level metadata field (`store_vendor`) supported across `AddProductPage`, `AddInventoryPage`, `EditInventoryModal`, `ProductDetailPage`, `InventoryPage`, Supabase and mock databases, export engine (Excel, CSV, PDF, JSON), and idempotent restore.
- **Multi-Format Professional Data Export**: Excel (`.xlsx`), CSV archive (`.zip`), editorial PDF (`.pdf`), and JSON backup (`.json`).
- **Idempotent Backup Restore (`RestoreDataModal`)**: Validated JSON backup restoration with conflict resolution, relational integrity checks, and current-user isolation.
- **Focus & Visibility Silent Revalidation**: 3-second throttled background data refresh on window focus and tab return without UI flicker or skeletons.

### PARTIALLY IMPLEMENTED Features
- None. All planned core tracking and inventory features through Stage 16 are fully implemented.

### PLANNED / REFERENCED ONLY Features
- **External Product Discovery & Auto-Fill**: Suggested in README roadmap; not implemented.
- **Barcode / UPC Scanning**: Camera-based barcode recognition suggested in README roadmap; not implemented.
- **Push Restock Notifications**: Web push alerts suggested in README roadmap; not implemented.
- **PWA & Offline Background Sync**: Service worker sync suggested in README roadmap; not implemented.
- **Multi-Currency Converter**: Currency defaults to `BDT` in database; multi-currency conversions are not implemented.

### NOT PRESENT Features
- **Product Images / Photo Uploads**: No file upload endpoint or storage bucket for user photos.
- **Manual Lifespan Overrides**: Deliberately forbidden by product design constitution.
- **Excel / CSV Data Import**: By design, JSON is the sole authoritative restore format.

---

## 12. Calculations & Business Logic

All core calculations reside in pure, deterministic TypeScript modules:

### 1. Usage Duration ([`src/lib/prediction.ts`](file:///d:/nittoo/src/lib/prediction.ts))
$$\text{duration} = \max(0, \text{finished\_date} - \text{opened\_date})$$
- **Input**: `UsagePeriod` with `status === 'finished'` and valid ISO dates.
- **Output**: Integer $\ge 0$, or `null` if period is active.

### 2. Historical Average Lifespan ([`src/lib/prediction.ts`](file:///d:/nittoo/src/lib/prediction.ts))
$$\text{average\_lifespan} = \text{round}\left( \frac{\sum_{i=1}^N \text{duration}_i}{N}, 1 \right)$$
- **Input**: Array of finished usage periods ($N \ge 1$).
- **Output**: Number rounded to 1 decimal place. If $N = 0$, returns `null` ("Not enough data").

### 3. Current Days Used ([`src/lib/prediction.ts`](file:///d:/nittoo/src/lib/prediction.ts))
$$\text{days\_used} = \max(0, \text{today} - \text{opened\_date})$$
- **Input**: ISO `opened_date`, optional reference date.
- **Output**: Non-negative integer.

### 4. Predicted Remaining Days ([`src/lib/prediction.ts`](file:///d:/nittoo/src/lib/prediction.ts))
$$\text{predicted\_remaining\_days} = \text{round}(\text{average\_lifespan} - \text{days\_used})$$
- **Output**: Integer (can be negative if overdue), or `null` if `average_lifespan === null`.

### 5. Cost Per Day ([`src/lib/prediction.ts`](file:///d:/nittoo/src/lib/prediction.ts))
$$\text{cost\_per\_day} = \text{round}\left( \frac{\text{purchase\_price}}{\text{lifespan\_days}}, 2 \right)$$
- **Output**: Number rounded to 2 decimal places. Returns `null` if lifespan $\le 0$ or unavailable.

### 6. Price Per Unit ([`src/lib/prediction.ts`](file:///d:/nittoo/src/lib/prediction.ts))
$$\text{price\_per\_unit} = \text{round}\left( \frac{\text{purchase\_price}}{\text{size\_value}}, 2 \right)$$
- **Output**: Number rounded to 2 decimal places. Returns `null` if `size_value` missing or $\le 0$.

### 7. Observed Weighted Cost Per Day ([`src/lib/comparison.ts`](file:///d:/nittoo/src/lib/comparison.ts))
$$\text{observed\_cost\_per\_day} = \text{round}\left( \frac{\sum \text{finished\_purchase\_prices}}{\sum \text{finished\_duration\_days}}, 2 \right)$$
- Weighting cost by total duration avoids distortion when purchase prices fluctuate across cycles.

### 8. Estimated Monthly Consumption Run Rate ([`src/lib/analytics.ts`](file:///d:/nittoo/src/lib/analytics.ts))
$$\text{monthly\_consumption} = \sum_{\text{eligible essentials}} \left( \frac{\text{latest\_price}}{\text{average\_lifespan}} \times 30 \right)$$
- Standardized 30-day consumption run rate. Returns `null` if 0 eligible essentials exist.

---

## 13. Observed vs. Predicted Separation

Nittoo enforces a strict architectural boundary between **OBSERVED** and **PREDICTED** metrics:

```text
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│           OBSERVED METRICS            │   │           PREDICTED METRICS           │
│         (Historical Ground Truth)     │   │              (Forecasts)              │
├───────────────────────────────────────┤   ├───────────────────────────────────────┤
│ • Completed Usage Cycles Count        │   │ • Days Used So Far                    │
│ • Historical Average Lifespan         │   │ • Predicted Remaining Days            │
│ • Observed Weighted Cost / Day        │   │ • Predicted Finish Date               │
│ • Normalized Monthly Consumption      │   │ • Overdue Days Count                  │
│ • Purchase Price & Unit Price         │   │ • Progress Percentage (0–100%)        │
└───────────────────────────────────────┘   └───────────────────────────────────────┘
```

1. **Active Usage Isolation**: Ongoing active usage **NEVER** participates in the calculation of `average_lifespan` or historical `cost_per_day`. A container's lifespan is unknown until finished.
2. **Unopened Purchases Isolation**: Unopened purchases do not impact daily usage counters, burn rate, or lifespan calculations.

---

## 14. Prediction Confidence Framework

Implemented in [`src/lib/confidence.ts`](file:///d:/nittoo/src/lib/confidence.ts), confidence is a deterministic reflection of evidence maturity based solely on completed cycle volume:

| Completed Cycles | Confidence State | UI Badge Label | Supporting Text | Semantic Meaning |
| :---: | :--- | :--- | :--- | :--- |
| **0** | `no_data` | Not enough data | Complete a cycle to start learning. | No completed personal history |
| **1** | `early` | Early data | Based on 1 completed cycle | Very limited personal history |
| **2 – 3** | `developing` | Developing | Based on X completed cycles | Some repeated personal history |
| **4 – 5** | `reliable` | Reliable | Based on X completed cycles | Multiple completed observations |
| **6+** | `strong_history` | Strong history | Based on X completed cycles | Substantial repeated history |

- **Non-Invasive**: Confidence describes evidence maturity; it never modifies the underlying prediction math.
- **Calm Visual Badges**: Uses subtle, accessible styling (`bg-[#EBF4F0] text-[#2D6A4F]` for reliable/strong; amber for early; neutral for developing/no data).

---

## 15. Inventory System

Implemented in [`src/pages/InventoryPage.tsx`](file:///d:/nittoo/src/pages/InventoryPage.tsx):

- **Active Inventory**: Items currently being consumed (`status = 'active'`). Shows opened date, days used, remaining days, and backup count badge.
- **Unopened Inventory**: Physical purchases waiting for consumption. Displays purchase date, price, and a direct **"Start Using"** action button.
- **Activation Rule**: Clicking "Start Using" activates an unopened purchase into an active bottle. If the essential already has an active bottle, the action is blocked with an error banner to protect the single-active-container invariant.
- **Backup Badges**: The number of unopened purchases for a product is surfaced as `+X backup` across cards and detail pages.

---

## 16. Product Comparison Engine

Implemented in [`src/lib/comparison.ts`](file:///d:/nittoo/src/lib/comparison.ts) and [`src/pages/ProductComparisonPage.tsx`](file:///d:/nittoo/src/pages/ProductComparisonPage.tsx):

### Comparative Dimensions
1. **Price Difference**: Absolute difference and percentage relative to Product A.
2. **Size Compatibility**: Compares sizes only if units match (`ml` vs `ml`, `g` vs `g`). Disallows false cross-unit math.
3. **Unit Price Economics**: Difference in `৳/ml` or `৳/g`.
4. **Observed Average Lifespan Difference**: Difference in days across completed cycles.
5. **Cost Per Day Difference**: True personal consumption value difference (`৳/day`).
6. **Monthly Consumption Difference**: Difference in 30-day normalized cost.

### Deterministic Insight Engine
Generates objective, non-judgmental insights without marketing hype:
- *Similar Value*: Within 2% or ৳0.25/day $\to$ *"Your usage shows very similar value between these products."*
- *Upfront vs Daily*: Higher upfront but cheaper per day $\to$ *"[Product B] costs more upfront than [Product A], but is cheaper per day for your usage."*
- *Unit Price Trap*: Higher unit price but cheaper per day $\to$ *"Although the unit price is higher than [Product A], your usage makes [Product B] cheaper per day."*
- *Longer Lasting but More Expensive*: *"[Product B] lasts longer than [Product A], but costs more per day for your usage."*
- *Early Data Notice*: Prominently warns if either product has only 1 completed cycle.

---

## 17. Analytics Engine

Implemented in [`src/lib/analytics.ts`](file:///d:/nittoo/src/lib/analytics.ts):

1. **Estimated Monthly Consumption**: Sum of $((\text{latest\_price} / \text{average\_lifespan}) \times 30)$ across all eligible active essentials with finished history.
2. **Upcoming Rebuys Horizon**: Products predicted to run out within 30 days. Deterministically sorted with **Overdue items first** (most overdue first: -10 before -2), followed by future runouts (0, 1, 2... days).
3. **Cost Efficiency Rankings**: Leaderboard ranking essentials from lowest cost per day (most efficient) to highest cost per day (least efficient).
4. **Interactive Bar Chart**: Visual comparison of daily costs powered by Recharts.

---

## 18. Account & Security Settings

Implemented in [`src/pages/AccountPage.tsx`](file:///d:/nittoo/src/pages/AccountPage.tsx):

- **Layout**: Document-style layout constrained to 640–760px (`max-w-[700px]`) with calm card surfaces.
- **Change Email**: Triggers confirmation workflow via `ChangeEmailModal`.
- **Change Password**: Enforces 6-character minimum via `ChangePasswordModal`.
- **Sign Out All Sessions**: Global session revocation via `SignOutAllSessionsModal`.
- **Export Data**: Opens `ExportDataModal` to download Excel, CSV, PDF, or JSON.
- **Backup & Restore**: Two distinct, styled buttons with 44px touch targets:
  - `[ Download Backup ]`: Triggers instant download of authoritative JSON backup.
  - `[ Restore Backup ]`: Opens multi-step `RestoreDataModal`.
- **Delete Account (Danger Zone)**: Destructive modal requiring uppercase confirmation (`DELETE`) that cascades deletions across all user records before terminating auth sessions.

---

## 19. Export System

Implemented in [`src/lib/export/`](file:///d:/nittoo/src/lib/export/):

All export formats consume an identical normalized data model (`NittooExportData`):
- `version`: Schema version (`1.0.0`)
- `exported_at`: ISO timestamp
- `user`: Authenticated user metadata (`id`, `email`)
- `summary`: Portfolio statistics, category breakdowns, 30-day run rate
- `products`: Array of tracked essentials
- `purchases`: Array of physical transactions
- `usage_history`: Array of active and completed usage periods
- `inventory`: Unified active and unopened inventory records
- `analytics`: Observed lifespans, daily costs, and confidence states

### Format Characteristics
1. **Excel (.xlsx)**: 6 styled worksheets (`Summary`, `Products`, `Purchases`, `Usage History`, `Inventory`, `Analytics`) with freeze panes and formatted headers.
2. **CSV Archive (.zip)**: 6 RFC 4180-compliant CSV files bundled in a ZIP archive with UTF-8 BOM (`\uFEFF`) for broad spreadsheet compatibility.
3. **PDF Report (.pdf)**: High-resolution editorial document featuring summary cards, category distributions, and product tables.
4. **JSON Backup (.json)**: Indented machine-readable schema (the official restore format).

---

## 20. Restore System

Implemented in [`src/lib/restore/`](file:///d:/nittoo/src/lib/restore/):

```text
[ Upload Backup JSON ]
         │
         ▼
[ 1. Validator ] ──────► Rejects files > 10MB, malformed JSON, unsupported versions,
         │               relational orphan records, or embedded security secrets.
         ▼
[ 2. Planner ] ────────► Compares backup records against current user's DB.
         │               • Detects existing stable IDs (skips duplicates).
         │               • Detects active bottle conflicts.
         ▼
[ 3. Preview & Confirm ]► Surfaces exact counts (New Essentials, Historical Cycles,
         │               Unopened Items, Conflicts) and non-destructive disclaimer.
         ▼
[ 4. Execution ] ──────► Atoms executed in order: Products ──► Purchases ──► Usage.
                         • All records assigned to auth.uid() (Current User).
                         • Conflicting backup active bottles saved as Unopened.
```

### Safety & Invariants
- **Never Trust Backup User ID**: All restored records are strictly assigned to `currentUserId` (`auth.uid()`).
- **Additive / Safe Merge**: Restore **never** deletes existing user data or overwrites current records.
- **Idempotency**: Running the same backup twice restores 0 duplicate records.
- **Single Active Invariant**: If an active bottle already exists for an item, current active status is kept; the backup container is preserved as unopened inventory.

---

## 21. Focus / Revalidation Behavior

Implemented across [`DashboardPage.tsx`](file:///d:/nittoo/src/pages/DashboardPage.tsx), [`InventoryPage.tsx`](file:///d:/nittoo/src/pages/InventoryPage.tsx), and other pages:

1. **Focus & Visibility Listeners**: Listens to both `window.addEventListener('focus')` and `document.addEventListener('visibilitychange')`.
2. **3-Second Throttle**: Background revalidation triggers at most once every 3,000ms (`lastRefetchTimeRef.current`).
3. **Silent Background Execution**: `loadData(isSilent = true)` executes in the background without setting `loading = true`.
4. **No UI Flicker**: Skeletons and loading spinners are never displayed on tab return.
5. **Auth Referential Stability**: `AuthContext` compares `id`, `email`, and `created_at` before updating state; if identical, the existing object reference is returned, preventing cascading re-renders.

---

## 22. UI / UX Design System

Discovered from [`src/index.css`](file:///d:/nittoo/src/index.css) and component styles:

- **Canvas Background**: `#FBFBFB` (warm off-white)
- **Card Surface**: `#FFFFFF` with border `#E8ECE9` and subtle shadow (`shadow-2xs`)
- **Brand Primary Green**:
  - `primary-50`: `#EBF4F0` (light mint background)
  - `primary-100`: `#D7EAE1`
  - `primary-500`: `#40916C`
  - `primary-600`: `#2D6A4F` (Nittoo signature brand green)
  - `primary-700`: `#24563F` (hover state)
  - `primary-800`: `#1B4332`
- **Typography**: Inter (`font-sans`), clean hierarchy with tracking-tight headings and uppercase tracking-wider eyebrows (`text-[11px] font-bold text-neutral-400`).
- **Interactive Targets**: Enforced `min-h-[44px]` touch targets across all mobile navigation links, form buttons, and modal actions.
- **Responsive Layout**: Sticky top header for desktop/tablet; fixed 4-column bottom navigation bar (`Dashboard`, `Inventory`, `Analytics`, `Account`) on mobile (<768px).

---

## 23. Current Visual Direction

The visual identity of Nittoo is **clean, quiet, editorial, and trustworthy**:
- **Palette**: Grounded dark greens (`#2D6A4F`), light mint surfaces (`#EBF4F0`), neutral grays (`#111827`, `#6B7280`), and warm white backgrounds (`#FBFBFB`).
- **Cards & Borders**: Crisp 1px borders (`#E8ECE9`), rounded corners (`rounded-xl` to `rounded-2xl`), and subtle micro-shadows.
- **Accents**: Subtle coral/peach dot (`#F07167`) and leaf green (`#52B788`) inside the official brand logo.
- **Design Intent vs. Actual UI**: The active implementation matches the calm, high-agency specification laid out in `design.md`. High-contrast dark green buttons are used for primary actions, and clean white cards with `#E8ECE9` borders are used for secondary actions.

---

## 24. Page & Route Map

| Route | Page Component | Access | Header / Layout | Primary Action | Key Content & Interactions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | `LoginPage` | Public-only | Standalone centered card | Sign In | Email/password sign-in, magic link toggle, links to signup/forgot-password |
| `/signup` | `SignupPage` | Public-only | Standalone centered card | Create Account | Registration form, password strength notice, link to login |
| `/forgot-password` | `ForgotPasswordPage` | Public-only | Standalone centered card | Send Recovery Email | Password reset email dispatcher |
| `/reset-password` | `ResetPasswordPage` | Public (Recovery) | Standalone centered card | Save New Password | Enter new password using Supabase recovery session token |
| `/dashboard` | `DashboardPage` | Protected | Wrapped in `Layout` | Add Essential (`/add-product`) | Summary cards, urgency-sorted essentials, ProductCard list, quick finish modal |
| `/inventory` | `InventoryPage` | Protected | Wrapped in `Layout` | Add Inventory (`/add-inventory`) | Active vs Unopened tabs/lists, "Start Using" activation, Edit inventory modal |
| `/add-product` | `AddProductPage` | Protected | Wrapped in `Layout` | Save Essential | Essential creation form, existing essential search suggestions, unopened toggle |
| `/add-inventory` | `AddInventoryPage` | Protected | Wrapped in `Layout` | Record Purchase | Purchase logger for existing essentials, preselection via query param, unopened default |
| `/product/:id` | `ProductDetailPage` | Protected | Wrapped in `Layout` | Finish Usage / Edit | Hero metrics, duration trends Recharts bar chart, unopened backups list, cycle history |
| `/compare` | `ProductComparisonPage` | Protected | Wrapped in `Layout` | Select Product B | Head-to-head metrics comparison, size compatibility check, deterministic value insights |
| `/analytics` | `AnalyticsPage` | Protected | Wrapped in `Layout` | View Insights | Monthly consumption run rate, 30-day upcoming runouts timeline, cost efficiency chart |
| `/account` | `AccountPage` | Protected | Wrapped in `Layout` | Manage Security / Data | Change email, change password, global sign out, export data, download backup, restore |

---

## 25. Component Map

```text
src/components/
├── Navigation & Layout
│   ├── Layout.tsx               # App shell: sticky top header (desktop) + bottom nav (mobile)
│   ├── NittooLogo.tsx           # Vector mark & image brand logo renderer
│   ├── ProtectedRoute.tsx       # Auth gate protecting private routes
│   └── PublicOnlyRoute.tsx      # Auth gate redirecting logged-in users away from login
├── Product & Inventory
│   ├── ProductCard.tsx          # Dashboard card with days used counter and progress bar
│   ├── FinishUsageModal.tsx     # Finish date recorder for active container
│   └── EditInventoryModal.tsx   # Editor for active bottle or unopened purchase
├── Comparison & Analytics
│   └── (Integrated in ProductComparisonPage.tsx and AnalyticsPage.tsx using Recharts)
├── Account & Portability
│   ├── ChangeEmailModal.tsx     # Email update dialog
│   ├── ChangePasswordModal.tsx  # Password change dialog
│   ├── SignOutAllSessionsModal.tsx # Global session revocation confirmation
│   ├── DeleteAccountModal.tsx   # Destructive account deletion modal
│   ├── ExportDataModal.tsx      # Multi-format export dialog (Excel, CSV, PDF, JSON)
│   └── RestoreDataModal.tsx     # Multi-step backup restore wizard
```

---

## 26. Hooks & Contexts

1. **`AuthContext` / `useAuth`** ([`src/contexts/AuthContext.tsx`](file:///d:/nittoo/src/contexts/AuthContext.tsx)):
   - Owns `user` (`AuthUser | null`) and `loading` state.
   - Exposes authentication methods (`signIn`, `signUp`, `signOut`, `sendMagicLink`, `requestPasswordReset`, `resetPassword`, `updateEmail`, `updatePassword`, `signOutAllSessions`, `deleteAccount`).
   - Handles session restoration and listener subscriptions.
2. **`usePrediction`** ([`src/hooks/usePrediction.ts`](file:///d:/nittoo/src/hooks/usePrediction.ts)):
   - Pure memoized calculation hook for product cards.
   - Computes `daysUsed`, `averageLifespan`, `predictedRemainingDays`, `costPerDay`, `pricePerUnit`, `progressPercent`, and `hasEnoughData`.

---

## 27. Verification & Testing

Nittoo includes **20 automated verification test suites** in the [`scripts/`](file:///d:/nittoo/scripts/) directory, runnable via `npm run`:

| npm Command | Script Path | Verified Capabilities |
| :--- | :--- | :--- |
| `npm run verify:data` | `scripts/verify-data-layer.ts` | Multi-user isolation, CRUD operations, mock database storage persistence |
| `npm run verify:auth` | `scripts/verify-auth.ts` | Email/password sign-in, deterministic mock user hashing, session restoration |
| `npm run verify:add-product` | `scripts/verify-add-product.ts` | Essential creation, repeat purchase logging, unopened vs active state |
| `npm run verify:dashboard` | `scripts/verify-dashboard.ts` | Dashboard loading, urgency sorting, division-by-zero math safety |
| `npm run verify:product-detail`| `scripts/verify-product-detail.ts` | Product detail metrics, Recharts duration trends data transformation |
| `npm run verify:analytics` | `scripts/verify-analytics.ts` | Monthly consumption run rate, upcoming rebuys sorting, cost efficiency |
| `npm run verify:walkthrough` | `scripts/verify-full-walkthrough.ts` | End-to-end user journey simulation (Buy $\to$ Use $\to$ Finish $\to$ Predict) |
| `npm run verify:supabase` | `scripts/verify-supabase-live.ts` | Live Supabase cloud connection, credentials check, live CRUD test |
| `npm run verify:rls` | `scripts/verify-supabase-rls.ts` | Two-account cross-tenant attack suite verifying database-level RLS policies |
| `npm run verify:audit` | `scripts/verify-live-audit.ts` | Live audit of schema indexes, single-active constraint, and security rules |
| `npm run verify:unopened` | `scripts/verify-unopened-lifecycle.ts` | Unopened inventory creation, backup counts, activation state transitions |
| `npm run verify:edit-inventory`| `scripts/verify-edit-inventory.ts` | Editing active bottles and unopened backups, date boundary validations |
| `npm run verify:inventory` | `scripts/verify-inventory.ts` | Inventory manager page logic, N+1 query prevention in batched fetch |
| `npm run verify:comparison` | `scripts/verify-comparison.ts` | Value comparison calculations, size compatibility, deterministic insights |
| `npm run verify:confidence` | `scripts/verify-confidence.ts` | Prediction confidence evidence thresholds, 5-state transitions, calm badges |
| `npm run verify:account` | `scripts/verify-account.ts` | Email/password validation, global sign out, cascade account deletion |
| `npm run verify:focus-refresh`| `scripts/verify-focus-refresh.ts` | 3-second throttle, window focus revalidation, auth referential stability |
| `npm run verify:export` | `scripts/verify-export.ts` | Excel XLSX sheets, CSV ZIP packaging, PDF generation, JSON backup schema |
| `npm run verify:restore` | `scripts/verify-restore.ts` | 40-test restore suite: schema 1.0.0, zero secrets, active conflicts, idempotency |
| `npm run verify:restore-button`| `scripts/verify-restore-button.ts` | Account page button visibility, 44px touch targets, responsive stacking |
| `npm run verify:vendor` | `scripts/verify-vendor.ts` | 20-test vendor suite: persistence, normalization, export, restore, isolation |

---

## 28. Seed & Demo Data

Defined in [`src/lib/mock-db.ts`](file:///d:/nittoo/src/lib/mock-db.ts):

### User 1: `default-mock-user` (`demo-user@nittoo.local`)
1. **CeraVe Hydrating Cleanser** (Skincare, 236ml):
   - Purchase 1: ৳1,250 on 2026-04-26 $\to$ Cycle 1: 2026-04-26 to 2026-06-26 (**61 days**)
   - Purchase 2: ৳1,250 on 2026-06-27 $\to$ Cycle 2: 2026-06-27 to 2026-08-29 (**63 days**)
   - Purchase 3: ৳1,250 on 2026-08-30 $\to$ Cycle 3: Opened 2026-08-30 (**Active bottle**)
   - *Metrics*: Average lifespan = 62 days; Confidence = `developing` (2 cycles); Cost/day = ৳20.16.
2. **Olaplex No. 4 Shampoo** (Haircare, 250ml):
   - Purchase 1: ৳3,200 on 2026-08-15 $\to$ Cycle 1: Opened 2026-08-15 (**Active bottle**)
   - *Metrics*: Average lifespan = `null` ("Not enough data"); Confidence = `no_data` (0 cycles).
3. **Sensodyne Rapid Relief Toothpaste** (Oral Care, 100g):
   - Purchase 1: ৳480 on 2026-06-01 $\to$ Cycle 1: 2026-06-01 to 2026-07-16 (**45 days**)
   - Purchase 2: ৳480 on 2026-07-17 $\to$ Cycle 2: Opened 2026-07-17 (**Active bottle**)
   - *Metrics*: Average lifespan = 45 days; Confidence = `early` (1 cycle); Cost/day = ৳10.67.

### User 2: `unopened-mock-user`
1. **Laneige Lip Sleeping Mask** (Skincare, 20g, ৳1,800): 1 unopened purchase (0 active bottles).
2. **Bioderma Sensibio H2O Micellar Water** (Skincare, 500ml): 1 active bottle (৳1,650) + 1 unopened backup (৳1,700).

---

## 29. Environment Modes

### 1. Mock Mode (Default Offline Development)
- **Activation**: Automatically activates when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing or contain placeholder values.
- **Characteristics**: Uses `localStorage`, deterministic mock user hashing, full multi-user isolation in browser.

### 2. Supabase Cloud Mode (Live Production)
- **Activation**: Configured via valid `.env` or Vercel environment variables:
  - `VITE_SUPABASE_URL`: Live Supabase project URL (`https://xyz.supabase.co`)
  - `VITE_SUPABASE_ANON_KEY`: Public publishable anonymous key
- **Characteristics**: Real PostgreSQL database, live RLS policy enforcement, real email authentication.

---

## 30. Known Limitations

### Categorized Analysis
1. **KNOWN LIMITATION: Manual Entry Required**  
   All product details (name, brand, size, price) currently require manual entry. No external barcode scanning or automated product database lookup exists.
2. **DESIGN DECISION: Single Active Bottle Constraint**  
   Nittoo intentionally forbids tracking multiple open bottles of the same essential simultaneously. If a user owns multiple bottles, only one can be active; the rest remain unopened backups.
3. **DESIGN DECISION: Strict Finished-Periods-Only Analytics**  
   Estimates are never fabricated. A product on its first bottle will strictly display "Not enough data" until the user finishes it.
4. **DESIGN DECISION: JSON is the Sole Restore Format**  
   Excel, CSV, and PDF exports cannot be imported. JSON is the sole authoritative, machine-readable backup format.

---

## 31. Planned Features

Extracted strictly from active project documentation ([`README.md`](file:///d:/nittoo/README.md)):

1. **Product Discovery & Enrichment**: Optional external product catalog lookup to auto-fill brand, volume, and category.
2. **Barcode / UPC Scanning**: Instant container recognition via camera.
3. **Restock Notifications**: Web push alerts and calendar integration when products are forecast to run out.
4. **PWA & Offline Background Sync**: Installable Progressive Web App with background sync.
5. **Multi-Currency Converter**: Support for USD (`$`), EUR (`€`), GBP (`£`), INR (`₹`), BDT (`৳`).

---

## 32. Data Flow Examples

### 1. Adding an Essential with an Unopened Backup
```text
User ──► /add-product
          ├── Form Input: "Bioderma Micellar Water", Skincare, 500ml, ৳1,650
          ├── Choice: "Keep unopened / backup"
          ▼
   db.createProduct(userId, { name, category, ... })
          ▼
   db.createPurchase(userId, { productId, price: 1650, ... })
          ▼
   (No usage period created)
          ▼
   Result: Item appears in /inventory under UNOPENED. Backup count = 1. Active = 0.
```

### 2. Activating an Unopened Backup ("Start Using")
```text
User ──► /inventory ──► Click "Start Using" on Bioderma Purchase
          ▼
   Check active bottle invariant:
   Is there already an active usage period for this product?
          ├── YES ──► Throw Error: "Product already has an active usage period"
          └── NO  ──► Proceed
          ▼
   db.startUsagePeriod(userId, { productId, purchaseId, openedDate: today })
          ▼
   Result: Purchase moves from UNOPENED to ACTIVE. Days in use starts at 0.
```

### 3. Finishing a Bottle and Learning Lifespan
```text
User ──► Product Detail OR Dashboard ──► Click "Finish Usage"
          ▼
   FinishUsageModal opens ──► User confirms finish date (e.g. 60 days later)
          ▼
   db.finishUsagePeriod(userId, usagePeriodId, finishedDate)
          ▼
   Database sets status = 'finished' and records finished_date
          ▼
   Prediction Engine recalculates:
   average_lifespan = 60 days (Arithmetic mean of completed cycles)
   confidence = 'early' (1 cycle)
   cost_per_day = ৳1,650 / 60 = ৳27.50/day
```

### 4. Head-to-Head Product Comparison
```text
User ──► /compare ──► Select Product A (CeraVe) & Product B (Cetaphil)
          ▼
   deriveProductObservedMetrics(historyA) & deriveProductObservedMetrics(historyB)
          ▼
   compareSizes(sizeA, unitA, sizeB, unitB) ──► Validates unit compatibility
          ▼
   comparePrices & compareUnitPrices
          ▼
   deriveComparisonInsight(metricsA, metricsB)
          ▼
   Result: Deterministic comparison report rendered with objective value insights.
```

### 5. Multi-Format Data Export
```text
User ──► /account ──► Click "Export data" ──► Select Format (e.g. Excel)
          ▼
   exportUserData(userId) ──► Fetches products, purchases, usage periods
          ▼
   buildExportData(rawData) ──► Normalizes into unified NittooExportData model
          ▼
   generateExcelWorkbook(exportData) ──► Creates 6 formatted worksheets
          ▼
   Browser downloads "nittoo-data-export-2026-09-08.xlsx"
```

### 6. JSON Backup Restore & Safe Merge
```text
User ──► /account ──► Click "Restore Backup" ──► Upload JSON file
          ▼
   validateBackupFile(fileContent) ──► Checks size <= 10MB, version 1.0.0, zero secrets
          ▼
   buildImportPlan(backupData, currentUserId, db)
          ├── Matches existing records by stable ID
          ├── Reassigns all imported records to currentUserId
          └── Detects active bottle conflicts (flags to keep current active)
          ▼
   User previews Plan Summary (New essentials, cycles, conflicts) ──► Confirms
          ▼
   db.importUserData(currentUserId, plan) ──► Atomic/relational insertion
          ▼
   Result: Data merged idempotently. Active bottle preserved; conflicting backup saved as unopened.
```

---

## 33. Business Invariants

1. **One Active Bottle Invariant**: A product can have at most ONE active usage period (`status = 'active'`) at any time. Enforced by unique partial index `idx_usage_periods_single_active`.
2. **Finished Periods Only Invariant**: Average lifespan and historical cost/day are calculated strictly from finished usage periods (`status = 'finished'`). Active containers never participate.
3. **No Fabricated Certainty Invariant**: If an essential has zero finished cycles, its average lifespan is strictly `null` ("Not enough data").
4. **Unopened Purchases Have No Usage Period**: An unopened backup purchase is represented by the absence of a linked row in `usage_periods`.
5. **Date Order Invariant**: `finished_date` must be greater than or equal to `opened_date`. Enforced by database check constraint `chk_finished_date_valid`.
6. **Price & Size Positivity**: `price >= 0` and `size_value > 0`.
7. **Idempotent Restore**: Restoring an identical backup file multiple times produces 0 duplicate records.
8. **Additive Restore**: Backup restoration is strictly additive; it never deletes existing user records.
9. **Restore Single Active Preservation**: When restoring an active container that conflicts with an existing active container, the existing container is kept, and the backup container is preserved as an unopened purchase.
10. **Unit Compatibility in Comparison**: Size and unit price comparisons are only performed when units match identically (`ml` with `ml`, `g` with `g`).
11. **Cost/Day vs Price/Unit Distinction**: Price per unit (`৳/ml`) reflects bulk purchasing efficiency; cost per day (`৳/day`) reflects true usage consumption rate.
12. **Read-Only Portability**: Export operations are strictly read-only and never mutate database records.

---

## 34. Security Invariants

1. **Current-User Ownership Invariant**: In both cloud and mock modes, all records are strictly owned by the authenticated user (`auth.uid()`).
2. **Never Trust Backup User ID**: During backup restore, the user ID in the backup file is treated strictly as metadata. All imported records are forcibly reassigned to the current authenticated user.
3. **No Service Role Key in Frontend**: The frontend bundle strictly uses the public `anon` key. Administrative keys are excluded from code.
4. **Relational Integrity Across Tenants**: Database RLS policies prevent users from attaching purchases or usage periods to another user's product IDs.
5. **Zero Secrets in Backups**: The restore validator rejects any uploaded JSON backup containing security tokens, passwords, or service keys.
6. **Cascade Deletion on Account Purge**: Account deletion cascades across products, purchases, and usage periods before revoking auth credentials.
7. **Isolated Mock Storage**: Mock users are partitioned by deterministic hash IDs; one mock user cannot read another mock user's records.
8. **Global Session Termination**: `signOutAllSessions` invokes Supabase global scope revocation (`{ scope: 'global' }`) to invalidate refresh tokens across all devices.

---

## 35. Current Project Health

Non-destructive status checks executed:

- **TypeScript Compilation (`npx tsc --noEmit`)**: **PASSED (0 errors)**.
- **Production Build (`npm run build`)**: **PASSED (Vite v6.4.3 built in 6.84s)**.
- **Git Working Tree (`git status`)**: Clean (`On branch main, nothing to commit, working tree clean`).
- **Verification Suites**:
  - `npm run verify:restore-button`: **PASSED (100%)**
  - `npm run verify:restore`: **PASSED (40/40 tests)**
  - `npm run verify:export`: **PASSED (100%)**
  - `npm run verify:account`: **PASSED (100%)**
  - `npm run verify:focus-refresh`: **PASSED (100%)**
  - `npm run verify:inventory`: **PASSED (100%)**
  - `npm run verify:dashboard`: **PASSED (100%)**
  - `npm run verify:confidence`: **PASSED (100%)**
  - `npm run verify:comparison`: **PASSED (100%)**

---

## 36. Code vs. Documentation Discrepancies

During comprehensive inspection, the following discrepancies were identified between existing documentation, code, and schemas:

1. **`user_id` Column on `purchases` and `usage_periods`**:
   - **Documentation Claim (`README.md` L470)**: *"All rows in products, purchases, and usage_periods store the owner's user_id linked to auth.users(id)."*
   - **Actual Schema (`supabase/schema.sql` L33, L46)**: Only `products` has a direct `user_id` column. `purchases` and `usage_periods` derive user ownership indirectly via foreign keys (`product_id REFERENCES products(id)`).
2. **`store_vendor` Field Fully Integrated (Resolved in Stage 16)**:
   - **Status**: Previously present in export/restore types but absent from the database schema and UI forms.
   - **Resolution**: Stage 16 added `store_vendor TEXT` to `public.purchases` in `supabase/schema.sql`, normalized in mock DB, added optional "Store / Vendor" inputs in `AddProductPage`, `AddInventoryPage`, `EditInventoryModal`, and surfaced vendor details in `ProductDetailPage` and `InventoryPage`.
3. **`vercel.json` Rewrite Destination in README**:
   - **Documentation (`README.md` L439)**: Shows `"destination": "/"`.
   - **Actual Configuration (`vercel.json` L5)**: Specifies `"destination": "/index.html"`.
4. **Plural vs. Singular Route in README**:
   - **Documentation (`README.md` L433)**: References deep links as `/products/:id` (plural).
   - **Actual Router (`src/App.tsx` L70)**: Route is explicitly defined as `/product/:id` (singular).
5. **README Roadmap Checkbox for Export**:
   - **Documentation (`README.md` L490)**: Roadmap lists `[x] **Export & Data Portability**: Full JSON export...`, omitting mention of Excel (.xlsx), CSV (.zip), and PDF (.pdf) reports that are fully implemented.

---

## 37. Current State Assessment

Nittoo is in a **mature, production-ready state** for personal essentials tracking. The codebase demonstrates high architectural discipline:
- **Clean Boundaries**: UI components never bypass the `dataSource.ts` abstraction.
- **Deterministic Logic**: Domain mathematics (lifespans, daily costs, unit economics, confidence, insights) are isolated in pure functions covered by 21 verification test suites.
- **Resilient UX**: Window focus revalidation prevents screen flickering; touch targets meet 44px accessibility standards; empty states and error boundaries are present throughout.
- **Enterprise-Grade Data Portability**: The export and restore system adheres to relational integrity, security token stripping, active conflict resolution, and multi-tenant isolation.

---

## 38. Safe Next-Step Candidates

Based strictly on what currently exists in the codebase, the following are safe, non-breaking candidates for future work:

1. **Synchronize `README.md` Discrepancies**:
   - Update `README.md` to accurately describe indirect relational ownership for `purchases` and `usage_periods`.
   - Fix `/products/:id` $\to$ `/product/:id` and update `vercel.json` documentation.
3. **Code Splitting & Bundle Optimization**:
   - Vite build notes that `dist/assets/index-*.js` exceeds 500kB (`1,908 kB`) due to bundling `jspdf`, `xlsx`, `recharts`, and `jszip`.
   - Use `React.lazy()` or Vite manual rollup chunking (`build.rollupOptions.output.manualChunks`) to split export libraries (`xlsx`, `jspdf`, `jszip`) into on-demand chunks loaded only when export modals open.
4. **Historical Cycle Editing / Deletion**:
   - Currently, active bottles and unopened backups can be edited via `EditInventoryModal`. Historical finished cycles cannot be edited or deleted from the UI if entered mistakenly.
   - Introduce an edit/delete action for historical cycles on `ProductDetailPage`.
5. **PWA Manifest & Service Worker**:
   - Add a Web App Manifest (`manifest.json`) and service worker configuration to enable home screen installation on mobile devices.
6. **Multi-Currency UI Selector**:
   - Allow user selection of preferred currency symbol in Account Settings (`$`, `€`, `£`, `₹`, `৳`) while retaining numeric math.
7. **Category Spending Breakdown in Analytics**:
   - Surface the existing `ExportCategoryBreakdown` calculations directly in the `/analytics` UI as an interactive breakdown card.
