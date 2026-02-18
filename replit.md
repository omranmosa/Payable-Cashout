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
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - Database storage layer
- `server/eligibility.ts` - Invoice eligibility rules engine
- `server/pdf.ts` - PDF generation for assignment notices
- `server/seed.ts` - Seed data (17 invoices across 5 vendors, 1 restaurant)
- `client/src/App.tsx` - Main app with auth, sidebar, routing
- `client/src/lib/auth.tsx` - Auth context/provider
- `client/src/pages/` - All page components

## Auth
- Email + password with bcrypt hashing
- Express-session with memory store
- Demo login: demo@payables.com / password123

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
