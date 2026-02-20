# Payables Cashout

## Overview
Delivery financing platform. Vendors request early payment (cashout) on deliveries across multiple counterparties (restaurants/aggregators). The system uses CRN-based vendor master mapping, per-delivery SAR tiered pricing, multi-counterparty cashout allocations, and automated notifications. Three user roles: admin (full access), counterparty (approve/reject cashouts for own data), vendor (initiate cashouts for own deliveries).

## Architecture
- **Frontend**: React + Vite + Tailwind + shadcn/ui + wouter routing + TanStack Query
- **Backend**: Express.js with session-based auth (bcryptjs)
- **Database**: PostgreSQL with Drizzle ORM
- **File Upload**: multer (stored in /uploads)

## Key Files
- `shared/schema.ts` - Drizzle table definitions (users, vendorMasters, counterparties, vendorCounterpartyMappings, deliveryRecords, cashouts, cashoutAllocations, cashoutDeliveries, vendorPricingSchedules, vendorPricingTiers, ledgerEntries, notificationAttempts)
- `server/routes.ts` - All API endpoints with role-based middleware
- `server/storage.ts` - Database storage layer (IStorage interface + DatabaseStorage)
- `server/seed.ts` - Seed data (3 users, 2 counterparties, 3 vendor masters, 4 mappings, 2 pricing schedules, 18 deliveries)
- `client/src/App.tsx` - Main app with auth, role-based routing
- `client/src/lib/auth.tsx` - Auth context/provider
- `client/src/components/app-sidebar.tsx` - Role-aware sidebar navigation
- `client/src/pages/` - All page components

## Database Schema
- **vendorMasters**: legalName, crn (unique), iban, beneficiary, bankName
- **counterparties**: name, type (RESTAURANT/AGGREGATOR), notificationEmails, webhookUrl
- **vendorCounterpartyMappings**: counterpartyId, vendorMasterId, crn, counterpartyVendorRef, status (VERIFIED/UNVERIFIED)
- **vendorPricingSchedules**: vendorMasterId, effectiveFrom, floorSarPerDelivery, pricingPeriodType
- **vendorPricingTiers**: scheduleId, fromDeliveries, toDeliveries, sarPerDelivery
- **deliveryRecords**: counterpartyId, vendorMasterId, deliveryDate, amountEarned, status (OUTSTANDING/IN_CASHOUT/SETTLED)
- **cashouts**: vendorMasterId, cashoutAmount, deliveriesCount, sarPerDeliveryApplied, feeTotal, netPaidToVendor, status
- **cashoutAllocations**: cashoutId, counterpartyId, deliveriesCount, cashoutAmountPortion, feePortion, totalPayableToUs
- **cashoutDeliveries**: cashoutId, deliveryRecordId
- **ledgerEntries**: cashoutId, type, amount, date, method, reference
- **notificationAttempts**: cashoutId, counterpartyId, channel, status, retries
- **users**: email, password, name, role, counterpartyId, vendorMasterId

## Auth & Roles
- Email + password with bcrypt hashing
- Express-session with memory store
- Three roles: **admin**, **counterparty**, **vendor**
- Users table has `counterpartyId` and `vendorMasterId` to link users to entities

### Role Permissions
| Feature | Admin | Counterparty | Vendor |
|---------|-------|-------------|--------|
| Dashboard | Yes (all data) | Yes (own counterparty) | Vendor Dashboard |
| Counterparties | Yes (CRUD) | Own only | No |
| Vendor Masters | Yes (CRUD + pricing) | No | Own only |
| Vendor Mappings | Yes (CRUD + verify) | View own | View own |
| Delivery Records | Yes (all) | Own counterparty | Own vendor |
| Create Cashouts | No | No | Yes (request cashout) |
| Approve Cashouts | Admin approve | Counterparty approve/reject | No |
| View Cashouts | Yes (all) | Own counterparty | Own vendor |
| Settlements | No | Yes (own) | No |
| Admin Ledger | Yes | No | No |

### Demo Accounts
- Admin: admin@payables.com / password123
- Counterparty: counterparty@payables.com / password123
- Vendor: vendor@payables.com / password123

## Sidebar Navigation by Role
- **Admin**: Dashboard, Counterparties, Vendor Masters, Vendor Mappings, Delivery Records, Cashouts, Admin Ledger
- **Counterparty**: Dashboard, Delivery Records, Cashouts, Settlements
- **Vendor**: Dashboard, My Deliveries, Cashouts, Request Cashout

## Pricing System
- Per-delivery SAR pricing with tiered schedules (not percentage-based)
- Admin creates pricing schedules per vendor master with tiers: fromDeliveries/toDeliveries brackets
- Each tier has a sarPerDelivery rate
- Schedule has a floorSarPerDelivery minimum
- Fee = sarPerDelivery * deliveryCount (floor rate enforced)
- GET /api/pricing-estimate?vendorMasterId=X&deliveryCount=N returns real-time estimate

## Cashout Flow
1. Vendor navigates to /cashouts/new
2. Sees outstanding deliveries with checkboxes
3. Selects deliveries, system shows estimated fee and net payout
4. Vendor submits request → status: REQUESTED
5. Counterparty approves → status: COUNTERPARTY_APPROVED
6. Admin approves → status: ADMIN_APPROVED
7. Admin marks payout → status: PAID_OUT (notifications sent, ledger entry created)
8. Admin marks settled → status: SETTLED (deliveries marked SETTLED)

Status flow: REQUESTED → COUNTERPARTY_APPROVED → ADMIN_APPROVED → PAID_OUT → SETTLED
Rejection possible at: REQUESTED (by counterparty), any pre-payout (by admin)

## API Endpoints
- Auth: POST /api/auth/login, /api/auth/register, /api/auth/logout, GET /api/auth/me
- Dashboard: GET /api/dashboard
- Counterparties: GET/POST /api/counterparties, GET/PUT /api/counterparties/:id
- Vendor Masters: GET/POST /api/vendor-masters, GET/PUT /api/vendor-masters/:id
- Mappings: GET/POST /api/vendor-counterparty-mappings, PUT /api/vendor-counterparty-mappings/:id/status
- Pricing: GET /api/vendor-pricing/:vendorMasterId, POST /api/vendor-pricing, DELETE /api/vendor-pricing-tiers/:id
- Deliveries: GET /api/delivery-records, GET /api/delivery-records/outstanding, POST /api/delivery-records, POST /api/delivery-records/bulk
- Cashouts: GET/POST /api/cashouts, GET /api/cashouts/:id
- Cashout Actions: POST /api/cashouts/:id/{counterparty-approve,counterparty-reject,admin-approve,admin-reject,mark-payout,mark-settled}
- Pricing Estimate: GET /api/pricing-estimate?vendorMasterId=X&deliveryCount=N
- Ledger: GET/POST /api/admin/ledger
- Settlements: GET /api/settlements
- Notifications: GET /api/notifications/:cashoutId

## Recent Changes
- Complete schema migration: restaurants/vendors/invoices/offers → counterparties/vendorMasters/deliveryRecords/cashouts (Feb 20, 2026)
- Per-delivery SAR tiered pricing replaces percentage-based fees (Feb 20, 2026)
- Multi-counterparty cashout allocations (Feb 20, 2026)
- CRN-based vendor master mapping with verification flow (Feb 20, 2026)
- Notification system for counterparties on payout (Feb 20, 2026)
- Complete frontend rewrite with new pages for all entities (Feb 20, 2026)
