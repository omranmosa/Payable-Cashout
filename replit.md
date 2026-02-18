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
- `shared/schema.ts` - All Drizzle table definitions (users, restaurants, vendors, invoices, offers, offerAssignments, ledgerEntries)
- `server/routes.ts` - All API endpoints with role-based middleware
- `server/storage.ts` - Database storage layer
- `server/eligibility.ts` - Invoice eligibility rules engine
- `server/pdf.ts` - PDF generation for assignment notices
- `server/seed.ts` - Seed data (3 users, 1 restaurant, 5 vendors, 17 invoices)
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
| Dashboard | Yes (all data) | Yes (own restaurant) | Vendor Dashboard |
| Upload Invoices | Yes | Yes (own restaurant) | No |
| Vendor Invoices | Yes (all) | Yes (own restaurant) | My Invoices (read-only) |
| Create Offers | Yes | Yes (own restaurant) | No |
| Accept Offers | Yes | Yes (own restaurant) | No |
| View Offers | Yes (all) | Yes (own) | Yes (own vendor) |
| Admin Ledger | Yes | No | No |

### Demo Accounts
- Admin: admin@payables.com / password123
- Restaurant: restaurant@payables.com / password123
- Vendor: vendor@payables.com / password123

## Eligibility Rules
- amount_remaining > 0
- due_date within next 45 days (not past due)
- status must be APPROVED or VALIDATED (if provided)
- hold_flag must be false (if provided)

## Fee Calculation
- fee = advanceAmount * rate * (weightedDays / 30)
- weightedDays = sum(invoiceAmount * daysTodue) / sum(invoiceAmount)
- default rate: 1.5% per 30 days

## Recent Changes
- Initial MVP build (Feb 2026)
- Added role-based access control with admin, restaurant, vendor roles (Feb 2026)
