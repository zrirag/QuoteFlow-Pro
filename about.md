# QuoteFlow Pro — Corporate Quotation Management Platform

QuoteFlow Pro is an end-to-end, enterprise-grade corporate quotation platform. It streamlines the lifecycle of corporate proposals from internal draft creation, manager review workflows, version history rollback, Google Drive document archiving, and PDF/Excel/CSV exports, to secure client portals featuring interactive commenting, digital e-signatures, and mock Stripe checkouts.

The application incorporates a rule-based **AI Intelligence Layer** that audits quotations for anomalies, offers item recommendations, suggests optimal pricing guidelines, and provides executives with high-level deal insights.

---

## 🛠️ Technology Stack

### Backend
* **Framework**: Django & Django REST Framework (DRF)
* **Database**: PostgreSQL (Production) / SQLite (Development/Testing)
* **Authentication**: JWT (JSON Web Tokens via `djangorestframework-simplejwt`)
* **Libraries**: 
  - `reportlab` (Dynamic PDF document rendering)
  - `openpyxl` / `pandas` (Excel and CSV analytical exports)
  - `google-api-python-client` (Google Drive OAuth and document uploads)

### Frontend
* **Core**: React 18, Vite, TypeScript
* **State Management**: Zustand
* **Routing**: React Router DOM
* **Styling**: Vanilla CSS with custom theme variables (J.P. Morgan corporate aesthetic: minimalist, dark-gray accents, white grids, border-lines)
* **Icons**: Lucide React

---

## 🚀 Key Modules & Features

### 1. Dynamic Quotation Builder (`/builder`)
* **Dynamic Table**: Create line items with unit prices, quantity modifiers, and custom discounts.
* **Auto Calculations**: Calculates subtotals, discount rate deductions, GST taxes, and grand totals in real-time.
* **Audit Warn Panel**: Checks draft structures for missing client properties, invalid expiration ranges, discount cap flags, or incorrect math calculations.
* **Price Advisor**: Offers unit price guidelines based on historical database averages. Click on the advisor badge to apply recommendations instantly.
* **Templates Selector**: Allows loading seeded templates (e.g. IT Consulting, Software Build, SaaS Platform) in one click to populate line items and defaults.
* **Add-on Recommendations**: Suggests matching line items based on co-occurrence analysis from past quotation transactions.
* **Internal Chat & View Logs**: Allows responding to client portal comments and viewing client access timestamps, IP addresses, and user-agents in real-time.

### 2. Secure Client Portal (`/share/:id?token=...`)
* **Secure Tokens**: Outward links are protected using cryptographically secure access tokens.
* **Link Expiration**: Default validity window of 30 days. Expired links return a clean corporate "Link Expired" screen.
* **Digital Signatures**: Hand-drawn signature canvas validating signer name, email, and timestamp, changing status to `Client Signed`.
* **Mock Stripe Checkout**: Integrated payment interface with auto-formatting inputs (`MM/YY` dates, card spaces) and strict validations, changing status to `Paid`.

### 3. Versioning & Google Drive Archiving
* **Version Rollback**: Quotation updates create incremental immutable backups. You can rollback to any previous version number at any time.
* **Google Drive Sync**: Connects via Google OAuth. Allows managers to upload finalized quotation PDFs to a designated corporate Drive folder in one click.

### 4. Executive Analytics Dashboard (`/dashboard`)
* **Live KPI Metrics**: Displays Total Approved Value, Active Quotes, Pending Approvals, and estimated Win Rate.
* **AI Deal Intelligence Feed**:
  - **Revenue Leakage**: Total leakage from discounts and average discount rates.
  - **Stale Deal Alerts**: Flags quotations approved but unsigned for $>5$ days.
  - **Win Probability**: Estimates conversion rates based on discount margins and comments volume.

---

## 📁 Database Architecture (Models)

1. **`User`**: Custom user model representing corporate hierarchy: `Employee`, `Manager`, `HR`, and `Admin`.
2. **`Quotation`**: Keeps general metadata (number, dates, status: `Draft`, `Pending Approval`, `Approved`, `Client Signed`, `Paid`, `Rejected`, `Revision Requested`).
3. **`ClientInfo`**: Client demographics (company name, email, phone, address).
4. **`LineItem`**: Detail rows containing description, quantity, unit price, and total amount.
5. **`QuotationTemplate`**: Pre-seeded quotation configurations.
6. **`QuotationVersion`**: Serialized JSON snapshot of a quotation representing its revision history.
7. **`QuotationViewLog`**: Tracking client page hits.
8. **`InternalComment` & `PublicComment`**: Conversation logs.

---

## ⚙️ How to Run Locally

### 1. Backend Setup
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Activate virtual environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
3. Apply migrations and seed data:
   ```bash
   python manage.py migrate
   python seed.py
   ```
4. Run server:
   ```bash
   python manage.py runserver
   ```

### 2. Frontend Setup
1. Open a new terminal in the project root folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start React/Vite development server:
   ```bash
   npm run dev
   ```
