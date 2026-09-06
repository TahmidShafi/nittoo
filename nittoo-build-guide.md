# Nittoo — Full Build Plan (Stages 0–7)

## Goal

Build **Nittoo**, a personal essentials tracker, in `D:\nittoo\`.

Core lifecycle:

**Buy → Add → Start Using → Track → Finish → Analyze → Predict**

Nittoo helps users understand:

* How long everyday products actually last.
* How much they cost.
* Their estimated cost per day of use.
* Historical usage patterns.
* Which products may run out soon.
* Estimated future consumption costs.

Examples include:

* Facewash
* Shampoo
* Toothpaste
* Sunscreen
* Moisturizer
* Household essentials

Follow the staged order defined below. Execute stages **one at a time**, and do not begin the next stage until the current stage passes its verification gate.

---

# Locked Decisions

* **TypeScript**

  * Use `.tsx` and `.ts`.
  * Use the Vite `react-ts` template.

* **No Supabase project exists yet**

  * Use placeholder environment variables.
  * Generate the SQL schema as a file for later application in the Supabase SQL Editor.
  * Real Supabase authentication and RLS verification happen after a project exists.

* **Dev-only mock data layer**

  * Use the same data-layer API as the real Supabase implementation.
  * Use `localStorage`, not pure in-memory storage, so data survives browser refreshes.
  * Automatically select mock mode when Supabase environment variables are placeholders or missing.
  * Swapping to Supabase later should require changing only the data-source selection layer.

* **Mock authentication**

  * Any valid email/password can create a mock session.
  * Mock users must have isolated data.
  * Different mock accounts must not see each other's products.

* **npm** as the package manager.

* **Tailwind CSS v4**

  * Use `@tailwindcss/vite`.
  * Use the `@theme` CSS approach.
  * Do not create or rely on a Tailwind v3 configuration file.

* **React Router** for navigation.

* **Recharts** for charts.

* **Currency**

  * Default: `BDT`.
  * Multi-currency is out of scope for Phase 1.

* **Stages 0–7**

  * Complete all stages, including the Stage 7 polish pass.
  * Stage 7 does not add new features.

---

# Core Product Rules

## Prediction Logic

Predictions must use **finished usage periods only**.

For a product:

```text
Finished usage periods
        ↓
Calculate duration of each
        ↓
Average lifespan
        ↓
Compare with current days used
        ↓
Predicted remaining days
```

Formula:

```text
duration_days = finished_date − opened_date
```

```text
average_lifespan =
average(duration_days of finished usage periods)
```

```text
predicted_remaining =
average_lifespan − current_days_used
```

If there are **zero finished usage periods**:

> **Not enough data**

Never invent or fabricate a prediction.

---

## Cost Per Day

Cost per day must only be calculated when there is sufficient finished usage history.

```text
cost_per_day =
purchase_price ÷ lifespan_days
```

For historical completed purchases, use that usage period's actual duration.

For estimates based on historical behavior, use:

```text
purchase_price ÷ average_finished_lifespan
```

If no finished lifespan exists:

> **Not enough data**

---

## Price Per Unit

If product size information exists, calculate this separately:

```text
price_per_unit =
purchase_price ÷ size_value
```

Example:

```text
৳1,200 ÷ 200 ml
= ৳6/ml
```

This must **never** be labeled as cost per day.

---

## Date Handling

Dates are stored as ISO strings:

```text
YYYY-MM-DD
```

All date differences must be calculated consistently using UTC-safe logic to avoid timezone-related off-by-one-day errors.

Create shared date utilities rather than duplicating date calculations across pages.

---

# Architecture Rules

The UI must never directly communicate with Supabase or the mock database.

Required architecture:

```text
Pages / Components
        ↓
Hooks / Feature Logic
        ↓
dataSource.ts
        ↓
 ┌───────────────┬────────────────┐
 │               │                │
Mock DB      Supabase DB     Shared Types
localStorage    PostgreSQL
```

Pages and components must never directly import:

```text
db.ts
mock-db.ts
```

They should only access data through:

```text
dataSource.ts
```

This prevents mock/real implementation drift.

---

# Recommended Folder Structure

```text
src/
│
├── components/
│   ├── ui/
│   └── shared/
│
├── pages/
│
├── hooks/
│   ├── useAuth.ts
│   └── usePrediction.ts
│
├── lib/
│   ├── types.ts
│   ├── db.ts
│   ├── mock-db.ts
│   ├── dataSource.ts
│   ├── prediction.ts
│   ├── dateUtils.ts
│   └── supabase.ts
│
├── contexts/
│   └── AuthContext.tsx
│
├── App.tsx
└── main.tsx
```

Keep the structure clean. Do not create unnecessary abstraction layers.

---

# Stage 0 — Project Scaffold

## Tasks

### 1. Create the Project

Scaffold a Vite `react-ts` project in:

```text
D:\nittoo
```

The directory already contains the build guide.

Create the project in place while preserving existing files.

---

### 2. Install Dependencies

Install:

```text
tailwindcss
@tailwindcss/vite
react-router-dom
@supabase/supabase-js
recharts
```

Use npm.

Do not add unnecessary dependencies.

---

### 3. Configure Tailwind CSS v4

Use:

```text
@tailwindcss/vite
```

Configure theme values through CSS using:

```css
@theme
```

Do not use old Tailwind v3 configuration patterns.

---

### 4. Environment Variables

Create:

```text
.env
.env.example
```

Use:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Do not include real secrets.

Ensure `.env` is ignored by Git.

---

### 5. Create Required Folders

```text
src/components
src/pages
src/lib
src/hooks
src/contexts
```

---

### 6. Global Design System

Create a minimal global visual foundation.

Design direction:

* Neutral background.
* Premium but calm.
* One primary accent color:

```text
#2D6A4F
```

* Inter font from Google Fonts.
* Clear typography hierarchy.
* Generous whitespace.
* Subtle borders.
* Soft shadows.
* Avoid excessive gradients.
* Avoid excessive glassmorphism.
* Avoid excessive pill-shaped UI.

Nittoo should feel closer to:

> Linear + Notion + a premium personal analytics app

than a logistics or inventory management dashboard.

---

### 7. Routing Stubs

Create routes for:

```text
/login
/dashboard
/product/:id
/add-product
/analytics
```

Create basic placeholder pages only.

Do not build actual features yet.

---

## Stage 0 Gate

Before finishing:

```text
npm run dev
```

must successfully serve the application.

Also verify:

```text
tsc --noEmit
```

and:

```text
npm run build
```

both pass successfully.

---

# Stage 1 — Data Layer + Database Schema

## Goal

Build the complete data architecture before building UI features.

---

## 1. Supabase Schema

Create:

```text
supabase/schema.sql
```

Generate SQL for the following tables.

---

### Products

```text
id
user_id
name
category
brand
size_value
size_unit
created_at
```

Requirements:

* UUID primary key.
* `user_id` references `auth.users`.
* Product belongs to one user.
* `brand` nullable.
* `size_value` nullable.
* `size_unit` nullable.
* `created_at` defaults to now.

---

### Purchases

```text
id
product_id
purchase_date
price
currency
created_at
```

Requirements:

* UUID primary key.
* `product_id` references `products`.
* Default currency: `BDT`.
* Price must be greater than or equal to zero.
* Add an index on `product_id`.

---

### Usage Periods

```text
id
product_id
purchase_id
opened_date
finished_date
status
created_at
```

Requirements:

* UUID primary key.
* `product_id` references `products`.
* `purchase_id` references `purchases`.
* `finished_date` nullable.
* Default status: `active`.
* Allowed statuses:

```text
active
finished
```

Constraints:

```text
finished_date >= opened_date
```

when `finished_date` exists.

Add indexes on:

```text
product_id
purchase_id
status
```

---

## 2. Row Level Security

Enable RLS on all three tables.

Follow the guide's ownership model:

* `products` are owned directly through `user_id`.
* `purchases` ownership is determined through the linked product.
* `usage_periods` ownership is determined through the linked product.

Users must only be able to:

* SELECT their own data.
* INSERT data associated with their own products.
* UPDATE their own data.
* DELETE their own data.

Ensure policies cannot be bypassed by referencing another user's product.

Generate clear SQL policies using `auth.uid()`.

---

## 3. Shared Types

Create:

```text
src/lib/types.ts
```

Include:

```text
Product
Purchase
UsagePeriod
UsageStatus
```

Dates must use:

```text
YYYY-MM-DD
```

as strings.

Create shared result and input types where useful.

---

## 4. Real Supabase Data Layer

Create:

```text
src/lib/db.ts
```

Implement:

```text
createProduct
createPurchase
startUsagePeriod
finishUsagePeriod
getActiveProducts
getProductHistory
```

Use Supabase JS.

All functions should:

* Return consistent data structures.
* Throw or return structured errors consistently.
* Never expose raw database implementation details to UI components.
* Respect the current authenticated user where applicable.

---

## 5. Mock Database

Create:

```text
src/lib/mock-db.ts
```

Requirements:

* Same TypeScript interface as `db.ts`.
* Persist data using `localStorage`.
* Seed initial data only when storage is empty.
* Seed 2–3 realistic products.
* Include:

  * At least one product with finished usage history.
  * At least one active product with no finished history.
  * Enough data to demonstrate prediction and analytics logic.

Mock data must be isolated by mock user.

Example concept:

```text
mock user A
→ sees only user A's data

mock user B
→ sees only user B's data
```

---

## 6. Shared Data Interface

Create a shared interface that both:

```text
db.ts
mock-db.ts
```

must implement.

TypeScript should enforce parity.

---

## 7. Data Source Selection

Create:

```text
src/lib/dataSource.ts
```

This is the **single selection point**.

Behavior:

```text
Valid Supabase environment variables
        ↓
Use real Supabase data layer

Missing/placeholder environment variables
        ↓
Use mock data layer
```

All pages and components must access the database through this layer.

---

## Stage 1 Gate

Verify:

* TypeScript passes.
* Build passes.
* Mock functions can:

  * Create a product.
  * Create a purchase.
  * Start usage.
  * Finish usage.
  * Retrieve active products.
  * Retrieve product history.
* Data survives browser refresh.
* SQL schema is complete and ready for future application.

Do not apply the SQL yet because no Supabase project exists.

---

# Stage 2 — Authentication

## Goal

Build authentication with identical UI behavior in both mock and future Supabase modes.

---

## 1. Auth Context

Create:

```text
useAuth
```

Expose:

```text
user
loading
signIn
signUp
signOut
sendMagicLink
```

---

## 2. Supabase Auth

Prepare support for:

* Email/password sign in.
* Email/password sign up.
* Magic link.

The real implementation will activate once valid Supabase credentials exist.

---

## 3. Mock Auth

When in mock mode:

* Any valid email/password can create or restore a mock user session.
* Persist the session.
* Generate a deterministic mock user identity.
* Isolate mock data between different users.

Logging out should clear only the session, not delete the user's stored data.

---

## 4. Login Page

Build:

```text
/login
```

Requirements:

* Centered card.
* Minimal.
* Premium.
* Generous whitespace.
* Email/password form.
* Toggle for magic-link mode.
* Clear error states.
* Clear loading states.

---

## 5. Route Protection

Rules:

```text
Unauthenticated user
→ redirect to /login

Authenticated user visiting /login
→ redirect to /dashboard
```

---

## 6. Shared Header

Add a minimal shared header with:

* Nittoo branding.
* Logout.

Full navigation comes in Stage 7.

---

## Stage 2 Gate

Verify in mock mode:

```text
Login
↓
Dashboard
↓
Logout
↓
Login page
```

Verify:

* Session persistence.
* Correct redirects.
* Different mock users have isolated data.

---

# Stage 3 — Add Product Flow

## Goal

Implement Nittoo's core creation flow.

```text
Buy
↓
Add Product
↓
Create Purchase
↓
Start Usage
```

---

## Page

```text
/add-product
```

Use a single-column form.

---

## Fields

Required:

* Product name.
* Category.
* Purchase price.
* Purchase date.
* Opened date.

Optional:

* Brand.
* Size.

Categories:

```text
Skincare
Haircare
Oral Care
Household
Other
```

Size unit options:

```text
ml
g
count
```

Defaults:

```text
Purchase date = today
Opened date = today
```

Both must remain editable.

---

## Submit Flow

On successful submission:

```text
createProduct
↓
createPurchase
↓
startUsagePeriod
↓
redirect /dashboard
```

Create records in dependency order.

If a later operation fails:

* Show a clear error.
* Do not silently claim success.
* Handle partial creation gracefully.

Transactions are out of scope for Phase 1.

---

## Duplicate Product Detection

As the user types the product name:

* Search the user's existing products.
* Show matching suggestions.
* Allow the user to select an existing product.

If selected:

```text
Do not create duplicate product
↓
Create new purchase
↓
Start new usage period
```

---

## Stage 3 Gate

Verify:

* New product can be created.
* Existing product can be selected.
* Purchase is created correctly.
* Active usage period is created.
* Dashboard displays the new product.
* Data survives refresh in mock mode.

---

# Stage 4 — Dashboard

## Goal

Build Nittoo's main daily-use experience.

---

## Page

```text
/dashboard
```

Display active products in a responsive card grid.

---

## Each Product Card

Show:

* Product name.
* Category.
* Days used so far.
* Predicted days remaining.
* Progress bar.
* Cost per day when sufficient data exists.
* Price per unit when available.
* Mark as Finished action.

---

## Days Used

Calculate:

```text
today − opened_date
```

Use shared UTC-safe date utilities.

---

## Prediction

Use the shared prediction engine.

Only use:

```text
finished usage periods
```

If zero finished periods exist:

> **Not enough data**

Do not fabricate estimates.

---

## Progress Bar

When an average lifespan exists:

```text
days_used / average_lifespan
```

Clamp visual progress appropriately.

If no average lifespan exists:

* Do not show misleading percentage progress.
* Use a neutral/indeterminate visual state instead.

---

## Cost Per Day

When lifespan data exists:

```text
purchase price ÷ lifespan days
```

or:

```text
purchase price ÷ average finished lifespan
```

depending on the metric being displayed.

If insufficient history:

> **Not enough data**

If size exists, show a separate:

```text
Price per unit
```

metric.

---

## Mark as Finished

Button behavior:

```text
Click
↓
Confirm dialog
↓
finished_date = today
status = finished
↓
Refresh dashboard data
```

---

## Sorting

Sort products by:

1. Soonest predicted run-out.
2. Products without predictions afterward.

---

## Empty State

If no active products:

> **No active products yet. Start tracking your first essential.**

Include:

```text
Add Product
```

button linking to:

```text
/add-product
```

---

## Shared Prediction Hook

Create reusable logic so Stages 5 and 6 use the same calculations.

Avoid duplicating prediction formulas.

---

## Stage 4 Gate

Verify against mock data:

* Days used calculation.
* Average lifespan.
* Predicted remaining days.
* Products without history show "Not enough data".
* Sorting is correct.
* Marking a product finished updates the UI.
* No division-by-zero errors.

---

# Stage 5 — Product Detail & History

## Page

```text
/product/:id
```

This should feel like a personal analytics report.

---

## Header

Display:

* Product name.
* Category.
* Brand.

---

## Summary Statistics

Show:

* Average duration.
* Average cost per day.
* Total spent.
* Number of purchases.

Only calculate metrics when enough valid data exists.

---

## Usage History

Display a timeline or structured list.

Each usage period shows:

* Purchase date.
* Opened date.
* Finished date.
* Active status when unfinished.
* Duration.
* Purchase price.
* Cost per day when calculable.

---

## Active Usage

If an active usage period exists:

Show it prominently near the top.

Include:

* Days used.
* Predicted remaining days.
* Progress visualization.

---

## Duration Trend Chart

Use Recharts.

Show finished usage durations across time.

Requirements:

* Handle zero history.
* Handle one data point.
* Handle many data points.
* Never crash on missing data.

---

## Stage 5 Gate

Verify rendering for:

```text
0 finished periods
1 finished period
multiple finished periods
active usage
no active usage
```

No crashes or misleading fabricated metrics.

---

# Stage 6 — Analytics

## Page

```text
/analytics
```

This is a cross-product insight page.

It should feel insight-driven, not like a spreadsheet.

---

# Primary Metric

Use the label:

## Estimated Monthly Consumption Cost

Formula:

```text
price ÷ average lifespan × 30
```

Calculate across eligible products with valid finished usage history.

This is an estimated consumption cost.

It is **not** the same as actual purchase spending.

---

# Most Cost-Efficient Products

Rank products by:

```text
lowest cost per day
```

---

# Least Cost-Efficient Products

Rank products by:

```text
highest cost per day
```

Exclude products without sufficient usage data.

---

# Upcoming Purchases

Show products predicted to run out within:

```text
30 days
```

Sort soonest first.

Display:

* Product.
* Predicted finish date.
* Predicted days remaining.
* Estimated next purchase cost.

For estimated next purchase cost:

Use the user's historical purchase prices when available.

A simple MVP estimate can use:

```text
average historical purchase price
```

Clearly label it as an estimate.

---

# Cost Per Day Chart

Use Recharts.

Create a simple bar chart comparing eligible products.

Do not include products with invalid or missing cost/day data.

---

# Layout Priority

Order:

```text
Upcoming Purchases
↓
Estimated Monthly Consumption Cost
↓
Cost Efficiency Lists
↓
Cost/Day Comparison Chart
```

Lead with actionable information.

---

## Stage 6 Gate

Using mock seed data:

* Manually verify calculations.
* Verify sorting.
* Verify products with no history are excluded where appropriate.
* Verify predicted dates.
* Verify chart values.

No fabricated numbers.

---

# Stage 7 — Polish Pass

## Rule

Do not add new features.

Only refine what already exists.

---

## 1. Loading States

Use skeleton loaders on all data-fetching pages.

Do not rely primarily on generic spinners.

Pages include:

```text
Dashboard
Product Detail
Analytics
```

---

## 2. Empty States

Use helpful copy.

Examples should explain:

* What the user is seeing.
* Why the area is empty.
* What action they should take.

---

## 3. Responsive Design

Test:

```text
375px mobile width
```

and desktop.

Check:

* Navigation.
* Forms.
* Cards.
* Charts.
* Tables/lists.
* Modals/dialogs.

No horizontal overflow.

---

## 4. Motion

Add subtle transitions:

```text
150–200ms
ease
```

Examples:

* Card hover.
* Button interactions.
* Page entry.

Do not use flashy animations.

Nittoo should feel:

> Calm, smooth, premium, fast.

---

## 5. Shared Navigation

Add a polished shared navigation layout.

Include:

* Dashboard.
* Add Product.
* Analytics.
* User menu.
* Logout.

Choose sidebar or top navigation based on the existing UI architecture.

Mobile navigation must remain clean and usable.

---

## 6. Supabase RLS Verification Checklist

A real Supabase project does not yet exist.

Do not pretend RLS has been tested.

Instead create a checklist for later verification:

```text
1. Create two test accounts.

2. Sign in as Account A.

3. Create products, purchases, and usage periods.

4. Sign out.

5. Sign in as Account B.

6. Confirm Account B cannot SELECT Account A's data.

7. Attempt to access Account A's row IDs directly.

8. Confirm RLS blocks unauthorized access.

9. Create Account B's own data.

10. Confirm Account A cannot see Account B's data.
```

---

## Stage 7 Gate

Verify:

```text
tsc --noEmit
```

passes.

Verify:

```text
npm run build
```

passes.

Perform a full manual walkthrough in mock mode:

```text
Login
↓
Dashboard
↓
Add Product
↓
Create Product
↓
Refresh
↓
Verify persistence
↓
View Product Detail
↓
Finish Product
↓
Check History
↓
Check Analytics
↓
Logout
↓
Login Again
```

Also verify:

* Mobile width at 375px.
* Empty states.
* Seeded states.
* Loading states.
* Navigation.
* No console errors.

---

# Risks and Mitigations

## No Supabase Transactions

The Add Product flow creates:

```text
Product
↓
Purchase
↓
Usage Period
```

sequentially.

A mid-operation failure may leave partial data.

### Mitigation

* Create in dependency order.
* Surface clear errors.
* Do not falsely report success.
* Accept this limitation for Phase 1.

---

## Mock / Real Data Drift

### Mitigation

* Shared TypeScript interface.
* Both implementations must satisfy the same API.
* All pages use `dataSource.ts`.
* No page imports mock or Supabase implementations directly.

---

## Date / Timezone Bugs

### Mitigation

* Store `YYYY-MM-DD`.
* Use UTC-safe date calculations.
* Centralize date logic.

---

## Prediction Errors

### Mitigation

* Finished periods only.
* Guard against zero values.
* Never divide by zero.
* Show "Not enough data" when history is insufficient.

---

## Tailwind Version Confusion

### Mitigation

Use:

```text
Tailwind v4
@tailwindcss/vite
@theme
```

Do not mix in Tailwind v3 instructions.

---

# Validation Plan

After every stage:

```text
tsc --noEmit
```

```text
npm run build
```

Then manually test the stage's functionality using mock mode.

Final validation:

* Full navigation walkthrough.
* Login/logout.
* Data persistence.
* Add product flow.
* Finish flow.
* Product history.
* Analytics.
* 375px responsive check.
* Empty vs seeded states.
* No console errors.

---

# Post-Supabase Creation Checklist

Once a real Supabase project exists:

```text
1. Create Supabase project.

2. Apply:
   supabase/schema.sql

3. Configure:
   VITE_SUPABASE_URL

4. Configure:
   VITE_SUPABASE_ANON_KEY

5. Restart development server.

6. Confirm dataSource.ts switches to the real implementation.

7. Test signup.

8. Test login.

9. Test logout.

10. Test CRUD operations.

11. Test product lifecycle.

12. Test two-account RLS isolation.

13. Confirm no mock data is used in production mode.
```

---

# Out of Scope

Do not add:

* Multi-currency.
* Deployment.
* Automated test frameworks.
* Additional authentication providers.
* Receipt scanning.
* Barcode scanning.
* AI features.
* Inventory quantity management.
* Social features.
* Complex notifications.

Focus on making the core Nittoo experience excellent first:

> **Track what you use. Know how long it lasts. Understand what it costs.**
