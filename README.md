# Nittoo

<div align="center">

**Track what you use. Know what it costs.**

A modern, high-precision personal essentials tracker for everyday consumables: skincare, haircare, oral care, household supplies, and daily essentials.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![RLS Verified](https://img.shields.io/badge/Security-RLS_Verified-2D6A4F?logo=shield)](docs/supabase-rls-checklist.md)

</div>

---

## 📌 Table of Contents

- [The Nittoo Philosophy](#-the-nittoo-philosophy)
- [Key Features](#-key-features)
- [Product Lifecycle & User Flow](#-product-lifecycle--user-flow)
- [Calculation & Prediction Engine](#-calculation--prediction-engine)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started Locally](#-getting-started-locally)
- [Supabase Configuration & Schema](#-supabase-configuration--schema)
- [Automated Verification & Test Suite](#-automated-verification--test-suite)
- [Deployment (Vercel)](#-deployment-vercel)
- [Security & Row Level Security (RLS)](#-security--row-level-security-rls)
- [Product Roadmap](#-product-roadmap)

---

## 💡 The Nittoo Philosophy

Traditional inventory applications ask warehouse-style questions:
> *"How many units do I currently have in stock?"*

For everyday personal consumables (facewash, shampoo, sunscreen, toothpaste, dish soap, moisturizer), that question is rarely helpful. Nittoo was built around **real consumption behavior** to answer the questions that actually matter:

1. **"How long does this bottle or container actually last me?"**
2. **"What is its true cost per day to use?"**
3. **"When will I run out and need to rebuy?"**
4. **"What is my true monthly consumption budget across all my essentials?"**

Nittoo replaces guesswork with data-driven personal consumption intelligence.

---

## ✨ Key Features

### 🧴 100% Free-Form Product Modeling
- No restrictive product catalogs, arbitrary categories, or forced brand lists.
- Track **any consumable**: local apothecary items, imported cosmetics, household cleaning supplies, prescription ointments, or daily groceries.
- Custom quantities and units (`ml`, `g`, `oz`, `count`, `fl oz`, `units`).

### 🔄 Repeat Purchases Without Duplication
- Buy the same product again? Log a repeat purchase with its new purchase date, price, and store under the existing product record.
- Preserves full price history and lifetime expenditure without cluttering your product list.

### ⏱️ Strict Finished-Periods-Only Lifespan Analytics
- Nittoo calculates average lifespan using **only completed usage cycles**.
- Zero fabricated metrics: if a product is on its first bottle and has never been finished before, Nittoo displays **"Not enough data"** rather than inventing a number.
- When multiple bottles are completed, average lifespan is computed as the arithmetic mean of all finished cycles.

### 🔮 Intelligent Run-Out Forecasting & Overdue Alerts
- Calculates days used so far for active containers.
- Compares active usage against historical average lifespan to predict remaining days.
- If a container exceeds its historical lifespan, Nittoo flags it as **Overdue** with prominent visual indicators on the dashboard and product detail views.

### 📊 Unit Economics vs. Cost Per Day
- **Cost Per Day**: Purchase price divided by lifespan in days (`৳/day`). Reflects actual usage value.
- **Price Per Unit**: Purchase price divided by package volume/weight (`৳/ml`, `৳/g`). Reflects bulk buying efficiency.
- Nittoo strictly separates these two metrics so users never confuse packaging density with daily cost.

### 📈 Cross-Product Consumption Analytics
- **Estimated Monthly Run Rate**: Normalized 30-day consumption expenditure across all active essentials (`(price ÷ lifespan) × 30`).
- **Upcoming Rebuys Timeline**: Products predicted to run out within 30 days, sorted with overdue items first.
- **Cost Efficiency Leaderboard**: Ranked comparison of most cost-effective vs. least cost-effective essentials.
- **Visual Cost-Per-Day Comparison**: Interactive bar chart powered by Recharts.

### ⚖️ Personal Product Comparison & Value Intelligence
- **Head-to-Head Value Comparison**: Select any reference essential and compare against any other tracked product.
- **Strict Observed vs. Predicted Isolation**: Historical observed metrics (lifespan, cost/day, monthly consumption) are strictly grounded in completed cycles. Predictions for currently active containers are displayed solely as non-historical context.
- **Package Size & Unit Price Economics**: Calculates price per unit (`৳/ml`, `৳/g`) and validates unit compatibility to prevent false comparisons across mismatched units.
- **Deterministic Value Insight Engine**: Produces objective, evidence-based conclusions without subjective marketing claims (no "better" or "superior"). Early or limited data is prominently flagged.

### 🛡️ Multi-Tenant Security & Dual Storage Engine
- **Cloud Mode**: Backed by live Supabase PostgreSQL with strict Row Level Security (RLS). Each user's data is strictly isolated at the database engine level.
- **Development Mock Mode**: Built-in, zero-dependency offline mock database in `localStorage` with deterministic user isolation for offline development and testing.

---

## 🔄 Product Lifecycle & Domain Model

Nittoo strictly distinguishes between product definitions, physical acquisitions, ongoing consumption, and historical analytics:

```text
ESSENTIALS          INVENTORY               USAGE                HISTORY
(What you track)    (What you own)          (What you consume)   (What you finished)

Product ───┬───────► Active Bottle ────────► Usage Period ─────► Finished Cycle
           │         (Purchase #1)           (status: active)     (status: finished)
           │
           ├───────► Unopened Backup #1 ───► [Waiting in Inventory]
           │         (Purchase #2)
           │
           └───────► Unopened Backup #2 ───► [Waiting in Inventory]
                     (Purchase #3)
```

### Core Concepts & Domain Definitions

| Concept | Definition | Underlying Data Model |
| :--- | :--- | :--- |
| **Essential** | A product the user tracks (e.g., CeraVe Cleanser, Olaplex Shampoo). | `products` table |
| **Inventory** | Physical purchases the user currently owns (active + unopened). | `purchases` without finished usage |
| **Active** | The single bottle or container currently being consumed. | `usage_periods` with `status = 'active'` (max 1 per product) |
| **Unopened** | Physical purchases owned but not yet started (stored backups). | `purchases` with no linked `usage_periods` |
| **History** | Completed consumption cycles used for lifespans and unit economics. | `usage_periods` with `status = 'finished'` |
| **Prediction** | Data-driven runout forecasts derived strictly from finished history. | Pure math pipeline (`calculatePredictedRemainingDays`) |

```text
[ Buy Essential ]
        │
        ▼
[ Add to Nittoo ] ──► (Optionally start using immediately or keep unopened)
        │
        ▼
[ Start Using ] ────► Opens an active usage period (one active bottle at a time)
        │
        ▼
[ Track Usage ] ────► Live counter: "Day 34 in use" • Real-time runout estimate
        │
        ▼
[ Finish Bottle ] ──► Records finished date • Closes cycle • Computes cycle lifespan
        │
        ▼
[ Activate Backup ] ─► Start using waiting unopened backup from /inventory
        │
        ▼
[ Analyze & Forecast ] ──► Updates average lifespan, cost/day, and portfolio run rate
```

---

## 📐 Calculation & Prediction Engine

All business logic is isolated in pure, deterministic TypeScript modules (`src/lib/prediction.ts`, `src/lib/analytics.ts`, `src/lib/dateUtils.ts`).

### 1. Usage Duration (Days)
For any completed container:
$$\text{duration} = \max(0, \text{finished\_date} - \text{opened\_date})$$

### 2. Historical Average Lifespan
Calculated strictly across $N$ finished usage periods ($N \ge 1$):
$$\text{average\_lifespan} = \frac{1}{N} \sum_{i=1}^{N} \text{duration}_i$$
*If $N = 0$, returns `null` ("Not enough data").*

### 3. Current Days Used
$$\text{days\_used} = \max(0, \text{today} - \text{opened\_date})$$

### 4. Predicted Remaining Days
$$\text{predicted\_remaining} = \text{round}(\text{average\_lifespan} - \text{days\_used})$$
- $\text{predicted\_remaining} > 7$: Normal active status.
- $0 \le \text{predicted\_remaining} \le 7$: Warning / Restock soon.
- $\text{predicted\_remaining} < 0$: **Overdue** by $|\text{predicted\_remaining}|$ days.

### 5. Cost Per Day
$$\text{cost\_per\_day} = \frac{\text{purchase\_price}}{\text{average\_lifespan}}$$

### 6. Price Per Unit
$$\text{price\_per\_unit} = \frac{\text{purchase\_price}}{\text{size\_value}}$$

### 7. Normalized Monthly Consumption Run Rate
Standardized to a 30-day month across all active products with historical lifespan data:
$$\text{monthly\_consumption} = \sum_{\text{eligible products}} \left( \frac{\text{latest\_purchase\_price}}{\text{average\_lifespan}} \times 30 \right)$$

---

## 🏛️ System Architecture

Nittoo uses a clean **Data Source Abstraction Pattern** that decouples the frontend user interface from the underlying database:

```text
                     ┌──────────────────────────────┐
                     │          Nittoo UI           │
                     │  (Pages, Components, Forms)  │
                     └──────────────┬───────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │   src/lib/dataSource.ts      │
                     │  (Unified Interface / Proxy) │
                     └──────┬────────────────┬──────┘
                            │                │
          [isSupabaseConfigured === true]    [isSupabaseConfigured === false]
                            │                │
                            ▼                ▼
             ┌─────────────────────────┐   ┌─────────────────────────┐
             │     src/lib/db.ts       │   │   src/lib/mock-db.ts    │
             │   (Live Supabase DB)    │   │  (Mock Storage Adapter) │
             └────────────┬────────────┘   └────────────┬────────────┘
                          │                             │
                          ▼                             ▼
                 PostgreSQL (Cloud)            Browser LocalStorage
              Row-Level Security (RLS)         Deterministic User IDs
```

### Core Database Entities

1. **`products`**: Represents a user essential (name, brand, category, size, unit, favorite flag).
2. **`purchases`**: Represents financial acquisition events (product ID, price, purchase date, store).
3. **`usage_periods`**: Represents container lifecycles (product ID, opened date, finished date, status: `'active' | 'finished'`).

### Database Constraints & Integrity Rules
- **Single Active Period**: A partial unique index (`idx_usage_periods_single_active`) enforces at the database level that a product can **never** have more than one `active` usage period simultaneously.
- **Date Chronology**: A check constraint (`chk_finished_date_valid`) ensures `finished_date >= opened_date`.
- **Cascade Deletes**: Deleting a product automatically cascades to its purchases and usage records.

---

## 💻 Tech Stack

| Domain | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | 19.0.0 | Modern component hierarchy, hooks, state |
| **Language** | TypeScript | ~5.7.2 | End-to-end type safety, strict mode |
| **Build Tool & Dev Server** | Vite | ^6.2.0 | Instant HMR, optimized production rollup |
| **Styling** | Tailwind CSS | ^4.0.9 | Utility-first responsive design, modern token system |
| **Routing** | React Router | ^7.3.0 | Client-side routing, protected and public route guards |
| **Data Visualization** | Recharts | ^2.15.1 | Responsive SVG charts for cost-per-day analytics |
| **Cloud Database & Auth** | Supabase | ^2.49.1 | PostgreSQL 15, Supabase Auth, Row Level Security |
| **Verification & Testing** | tsx | ^4.23.13 | High-speed TypeScript test execution |
| **Hosting & CDN** | Vercel | Production | Edge deployment with SPA rewrite rules |

---

## 📁 Project Directory Structure

```text
nittoo/
├── public/                    # Static web assets & favicons
├── scripts/                   # Automated verification & audit test suite
│   ├── verify-add-product.ts  # Add-product flow & validation
│   ├── verify-analytics.ts    # Analytics, rankings, and run-rate calculations
│   ├── verify-auth.ts         # Multi-user deterministic authentication
│   ├── verify-dashboard.ts    # Dashboard metrics, filters, and overdue sorting
│   ├── verify-data-layer.ts   # Core CRUD & relation isolation
│   ├── verify-full-walkthrough.ts # End-to-end user lifecycle simulation
│   ├── verify-live-audit.ts   # 9-domain comprehensive live architecture audit
│   ├── verify-product-detail.ts # Bottle finishing, repeat buys, and history
│   ├── verify-supabase-live.ts  # Live Supabase connection & schema tests
│   └── verify-supabase-rls.ts   # Two-account multi-tenant security audit
├── src/
│   ├── components/            # Reusable UI components (Layout, ProtectedRoute, etc.)
│   ├── contexts/              # AuthContext (session restoration & auth actions)
│   ├── hooks/                 # Custom React hooks (useAuth)
│   ├── lib/                   # Business logic, engines, and database abstraction
│   │   ├── analytics.ts       # Cross-product analytics & efficiency ranking engine
│   │   ├── dataSource.ts      # Storage proxy switching between Mock & Supabase
│   │   ├── dateUtils.ts       # Deterministic date parsing, formatting, and diffing
│   │   ├── db.ts              # Real Supabase database implementation
│   │   ├── mock-db.ts         # In-memory / localStorage multi-user mock engine
│   │   ├── prediction.ts      # Lifespan, remaining days, and cost-per-day engine
│   │   └── supabase.ts        # Supabase client initializer & config detection
│   ├── pages/                 # Application view components
│   │   ├── AccountPage.tsx    # User settings, session info, and data reset
│   │   ├── AddProductPage.tsx # Product creation & initial usage opening
│   │   ├── AnalyticsPage.tsx  # Global consumption analytics & cost comparison
│   │   ├── DashboardPage.tsx  # Main dashboard with active essentials & alerts
│   │   ├── ForgotPasswordPage.tsx # Password recovery link dispatch
│   │   ├── LoginPage.tsx      # Sign in (Email/Password & Magic Link)
│   │   ├── ProductDetailPage.tsx # Product overview, bottle lifecycle & history
│   │   ├── ResetPasswordPage.tsx # Password reset form
│   │   └── SignupPage.tsx     # Account registration
│   ├── types/                 # Shared TypeScript interfaces & types
│   ├── App.tsx                # Route definitions & app providers
│   ├── index.css              # Global styles & Tailwind v4 theme directives
│   └── main.tsx               # Application bootstrap entry point
├── supabase/
│   └── schema.sql             # Production PostgreSQL schema, indexes & RLS policies
├── docs/                      # Architectural docs & verification checklists
├── .env.example               # Environment variable templates
├── package.json               # Dependencies, scripts, and project metadata
├── tsconfig.json              # TypeScript compiler configuration
├── vercel.json                # Vercel SPA routing rewrite configuration
├── vite.config.ts             # Vite build & server configuration
└── README.md                  # Project documentation
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later

### 1. Clone the Repository
```bash
git clone https://github.com/TahmidShafi/nittoo.git
cd nittoo
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Nittoo works out of the box in **Mock Mode** without any configuration. To connect to your real cloud Supabase instance, create a `.env` file in the project root:

```env
# Supabase Cloud Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key

# Optional Credentials for Automated RLS Verification Scripts
TEST_USER_A_EMAIL=nittoo-test-a@example.com
TEST_USER_A_PASSWORD=YourPasswordA123!
TEST_USER_B_EMAIL=nittoo-test-b@example.com
TEST_USER_B_PASSWORD=YourPasswordB123!
```

> ⚠️ **Security Notice**: Never commit your `.env` file. It is ignored by `.gitignore`.

### 4. Run Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 5. Typecheck & Build
```bash
# Verify TypeScript strict compliance
npx tsc --noEmit

# Compile production bundle
npm run build
```

---

## 🗄️ Supabase Configuration & Schema

To connect Nittoo to a live Supabase backend:

1. **Create a Supabase Project**: Create a new project at [supabase.com](https://supabase.com).
2. **Apply Database Schema**: Open the **SQL Editor** in your Supabase dashboard, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
   - This creates tables: `products`, `purchases`, `usage_periods`.
   - Enables Row Level Security (RLS) on all tables.
   - Sets up cascade foreign keys and partial unique indexes.
3. **Configure Auth Settings**:
   - In **Authentication > Providers > Email**, enable Email provider.
   - For rapid testing, you can disable "Confirm email" or use auto-confirmed test accounts.
4. **Copy API Credentials**:
   - In **Project Settings > API**, copy the **Project URL** and **anon / public** API key into your `.env` file.

---

## 🧪 Automated Verification & Test Suite

Nittoo was engineered with a strict quality-gate methodology. Every stage has a dedicated automated verification script that tests real business logic, database constraints, and security boundaries.

Run any verification script with `npm run`:

| Command | Focus Area | What It Validates |
| :--- | :--- | :--- |
| `npm run verify:auth` | Authentication | Deterministic mock IDs, session persistence, logout, multi-user isolation |
| `npm run verify:data` | Data Layer | CRUD operations, foreign key cascades, storage adapter abstraction |
| `npm run verify:add-product` | Product Creation | Free-form inputs, instant usage opening, purchase logging |
| `npm run verify:dashboard` | Dashboard Engine | Filtering, search, overdue categorization, runout sort order |
| `npm run verify:product-detail` | Lifecycle Operations | Bottle finish flow, repeat purchases, timeline calculations |
| `npm run verify:analytics` | Consumption Intelligence | 30-day run rate, upcoming rebuys sort order, efficiency rankings |
| `npm run verify:walkthrough` | End-to-End Simulation | Complete user journey from signup to multiple bottle lifecycles |
| `npm run verify:supabase` | Cloud Integration | Live database connectivity, table schema verification, client detection |
| `npm run verify:unopened` | Unopened Lifecycle | Storage, backup purchases, separate purchase/usage, and activation |
| `npm run verify:edit-inventory` | Edit Current Inventory | In-place metadata, purchase, and opened date editing without duplication |
| `npm run verify:inventory` | Inventory Management UX | Derived inventory query, Active vs Unopened sections, Add Inventory flow |
| `npm run verify:comparison` | Product Comparison & Value Intelligence | 1-on-1 personal comparison, unit economics, observed vs predicted isolation, deterministic insights |
| `npm run verify:rls` | Security & RLS | **Two-account live RLS audit**: verifies Account B cannot read, write, update, or delete Account A's data |
| `npm run verify:audit` | 9-Domain Full Audit | 100% comprehensive production audit across all 9 architectural domains |

### Running the Live Two-Account RLS Audit
```bash
npm run verify:rls
```
*Tests complete tenant isolation using two real authenticated Supabase accounts against the live cloud database.*

---

## 🌐 Deployment (Vercel)

Nittoo is pre-configured for zero-friction deployment on [Vercel](https://vercel.com).

### 1. Push to GitHub
Ensure your repository is committed and pushed to GitHub:
```bash
git push origin main
```

### 2. Import to Vercel
1. Log into your Vercel dashboard and click **Add New > Project**.
2. Select your `nittoo` GitHub repository.
3. Keep default build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `tsc -b && vite build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 3. Configure Production Environment Variables
In Vercel's **Project Settings > Environment Variables**, add:
- `VITE_SUPABASE_URL`: Your live Supabase URL (`https://xyz.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Your live Supabase public anon key

### 4. SPA Route Rewrites (`vercel.json`)
The included [`vercel.json`](vercel.json) handles client-side routing so deep links (such as `/products/:id`, `/analytics`, and `/login`) resolve correctly:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ]
}
```

---

## 🔒 Security & Row Level Security (RLS)

Nittoo adheres to the principle of least privilege:

1. **Database-Level Ownership**: All rows in `products`, `purchases`, and `usage_periods` store the owner's `user_id` linked to `auth.users(id)`.
2. **PostgreSQL RLS Policies**:
   ```sql
   -- Example RLS Policy from schema.sql
   CREATE POLICY "Users can only read own products"
     ON products FOR SELECT
     USING (auth.uid() = user_id);
   ```
3. **Anon Key Exclusivity**: The frontend client uses strictly the Supabase anonymous/publishable key. The administrative `service_role` key is **never** included in frontend builds or code.
4. **Relational Tamper Protection**: An attacker cannot link a purchase or usage period to another user's product ID because the database RLS policies enforce ownership across relational foreign keys.

---

## 🗺️ Product Roadmap

- [ ] **Product Discovery & Enrichment**: Optional external product lookup to auto-fill brand, volume, and category while preserving manual entry flexibility.
- [ ] **Barcode / UPC Scanning**: Instant container recognition via device camera.
- [ ] **Restock Notifications**: Web push notifications and calendar export when an essential is predicted to run out.
- [ ] **PWA & Offline Sync**: Installable progressive web app with background sync.
- [ ] **Multi-Currency Support**: Support for USD (`$`), EUR (`€`), GBP (`£`), INR (`₹`), BDT (`৳`), and customizable localized currencies.
- [ ] **Export & Data Portability**: Full JSON and CSV export of lifetime consumption history.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with precision for conscious consumption.

**[Nittoo on GitHub](https://github.com/TahmidShafi/nittoo)**

</div>
