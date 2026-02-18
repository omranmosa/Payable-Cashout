# Payables Cashout

## Overview
Invoice financing platform for restaurants. Users upload vendor invoices via CSV, the system checks eligibility, allows creating cashout offers (early payment with fees), generates assignment notice PDFs, and tracks payouts/repayments in an admin ledger.

## Architecture
- **Frontend**: React + Vite + Tailwind + shadcn/ui + wouter routing + TanStack Query
- **Backend**: Express.js with session-based auth (bcryptjs)
- **Database**: PostgreSQL with Drizzle ORM
- **PDF**: pdf-lib for Assignment Notice generation
- **CSV**: papaparse for client-side CSV parsing

## Key Files
- `shared/schema.ts` - All Drizzle table definitions (users, restaurants, vendors, invoices, offers, offerAssignments, ledgerEntries, feeRates)
- `server/routes.ts` - All API endpoints with role-based middleware
- `server/storage.ts` - Database storage layer
- `server/eligibility.ts` - Invoice eligibility rules engine
- `server/pdf.ts` - PDF generation for assignment notices
- `server/seed.ts` - Seed data (3 users, 1 restaurant, 5 vendors, 17 invoices, 3 default fee rates)
- `client/src/App.tsx` - Main app with auth, role-based routing
- `client/src/lib/auth.tsx` - Auth context/provider
- `client/src/components/app-sidebar.tsx` - Role-aware sidebar navigation
- `client/src/pages/` - All page components

## Auth & Roles
- Email + password with bcrypt hashing
- Express-session with memory store
- Three roles: **admin**, **restaurant**, **vendor**
- Users table has `restaurantId` and `vendorId` to link users to entities

### Role Permissions
| Feature | Admin | Restaurant | Vendor |
|---------|-------|------------|--------|
| Dashboard | Yes (all data) | Yes (own restaurant, no recent offers) | Vendor Dashboard |
| Upload Invoices | Yes | Yes (own restaurant) | No |
| Vendor Invoices | Yes (all) | Yes (own restaurant) | My Invoices (read-only) |
| Create Offers | Yes | No | No |
| View Offers | Yes (all) | No (403 blocked) | Cashouts (own vendor) |
| Financing | No | Yes (financed items + repayment upload) | No |
| Fee Rates | Yes (CRUD) | No | No |
| Admin Ledger | Yes | No | No |

### Demo Accounts
- Admin: admin@payables.com / password123
- Restaurant: restaurant@payables.com / password123
- Vendor: vendor@payables.com / password123

## Sidebar Navigation by Role
- **Admin**: Dashboard, Invoices, Vendors, Offers, Fee Rates, Admin Ledger
- **Restaurant**: Dashboard, Invoices, Vendors, Financing
- **Vendor**: Vendor Dashboard, My Invoices, Cashouts

## Eligibility Rules
- amount_remaining > 0
- due_date within next 45 days (not past due)
- status must be APPROVED or VALIDATED (if provided)
- hold_flag must be false (if provided)

## Fee Rate System
- Admin manages fee rate brackets via /fee-rates page
- Each bracket has: minDays, maxDays, ratePer30d, label
- Default seeded rates: 0-15 days (2.0%), 16-30 days (1.5%), 31-45 days (1.2%)
- Fee calculation uses per-invoice matching to rate brackets by days-to-due
- Fallback rate: restaurant's defaultRatePer30d or 1.5% if no bracket matches

## Fee Calculation
- Per-invoice fee = invoiceAmount * matchedRate * (daysTodue / 30)
- Total fee scaled by proportion: (advanceAmount / totalEligible) * sumOfInvoiceFees
- Vendor dashboard shows estimated fee and net cashout in real-time

## Recent Changes
- Initial MVP build (Feb 2026)
- Added role-based access control with admin, restaurant, vendor roles (Feb 2026)
- Added feeRates table with admin CRUD and management page (Feb 2026)
- Removed restaurant access to offers; created Financing page with repayment upload (Feb 2026)
- Renamed vendor "Offers" to "Cashouts" with net amount display (Feb 2026)
- Updated fee calculation to use admin-managed rate brackets by tenor (Feb 2026)
- Backend: /api/offers returns 403 for restaurant role (Feb 2026)
