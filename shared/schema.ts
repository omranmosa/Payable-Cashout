import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vendorMasters = pgTable("vendor_masters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legalName: text("legal_name").notNull(),
  crn: text("crn").notNull().unique(),
  iban: text("iban"),
  beneficiary: text("beneficiary"),
  bankName: text("bank_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVendorMasterSchema = createInsertSchema(vendorMasters).omit({ id: true, createdAt: true });
export type InsertVendorMaster = z.infer<typeof insertVendorMasterSchema>;
export type VendorMaster = typeof vendorMasters.$inferSelect;

export const counterparties = pgTable("counterparties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("RESTAURANT"),
  notificationEmails: text("notification_emails").array(),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCounterpartySchema = createInsertSchema(counterparties).omit({ id: true, createdAt: true });
export type InsertCounterparty = z.infer<typeof insertCounterpartySchema>;
export type Counterparty = typeof counterparties.$inferSelect;

export const vendorCounterpartyMappings = pgTable("vendor_counterparty_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  counterpartyId: varchar("counterparty_id").notNull().references(() => counterparties.id),
  counterpartyVendorRef: text("counterparty_vendor_ref"),
  vendorMasterId: varchar("vendor_master_id").references(() => vendorMasters.id),
  crn: text("crn"),
  status: text("status").notNull().default("UNVERIFIED"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVendorCounterpartyMappingSchema = createInsertSchema(vendorCounterpartyMappings).omit({ id: true, createdAt: true });
export type InsertVendorCounterpartyMapping = z.infer<typeof insertVendorCounterpartyMappingSchema>;
export type VendorCounterpartyMapping = typeof vendorCounterpartyMappings.$inferSelect;

export const vendorPricingSchedules = pgTable("vendor_pricing_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorMasterId: varchar("vendor_master_id").notNull().references(() => vendorMasters.id),
  pricingPeriodType: text("pricing_period_type").notNull().default("MONTHLY"),
  effectiveFrom: date("effective_from").notNull(),
  floorSarPerDelivery: numeric("floor_sar_per_delivery", { precision: 10, scale: 4 }).notNull(),
});

export const insertVendorPricingScheduleSchema = createInsertSchema(vendorPricingSchedules).omit({ id: true });
export type InsertVendorPricingSchedule = z.infer<typeof insertVendorPricingScheduleSchema>;
export type VendorPricingSchedule = typeof vendorPricingSchedules.$inferSelect;

export const vendorPricingTiers = pgTable("vendor_pricing_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").notNull().references(() => vendorPricingSchedules.id),
  fromDeliveries: integer("from_deliveries").notNull(),
  toDeliveries: integer("to_deliveries"),
  sarPerDelivery: numeric("sar_per_delivery", { precision: 10, scale: 4 }).notNull(),
});

export const insertVendorPricingTierSchema = createInsertSchema(vendorPricingTiers).omit({ id: true });
export type InsertVendorPricingTier = z.infer<typeof insertVendorPricingTierSchema>;
export type VendorPricingTier = typeof vendorPricingTiers.$inferSelect;

export const deliveryRecords = pgTable("delivery_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalDeliveryId: text("external_delivery_id"),
  counterpartyId: varchar("counterparty_id").notNull().references(() => counterparties.id),
  restaurantId: varchar("restaurant_id"),
  vendorMasterId: varchar("vendor_master_id").notNull().references(() => vendorMasters.id),
  deliveryDate: date("delivery_date").notNull(),
  amountEarned: numeric("amount_earned", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("OUTSTANDING"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeliveryRecordSchema = createInsertSchema(deliveryRecords).omit({ id: true, createdAt: true });
export type InsertDeliveryRecord = z.infer<typeof insertDeliveryRecordSchema>;
export type DeliveryRecord = typeof deliveryRecords.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("counterparty"),
  counterpartyId: varchar("counterparty_id").references(() => counterparties.id),
  vendorMasterId: varchar("vendor_master_id").references(() => vendorMasters.id),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  role: true,
  counterpartyId: true,
  vendorMasterId: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const cashouts = pgTable("cashouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorMasterId: varchar("vendor_master_id").notNull().references(() => vendorMasters.id),
  cashoutAmount: numeric("cashout_amount", { precision: 12, scale: 2 }).notNull(),
  deliveriesCount: integer("deliveries_count").notNull(),
  sarPerDeliveryApplied: numeric("sar_per_delivery_applied", { precision: 10, scale: 4 }).notNull(),
  feeTotal: numeric("fee_total", { precision: 12, scale: 2 }).notNull(),
  netPaidToVendor: numeric("net_paid_to_vendor", { precision: 12, scale: 2 }).notNull(),
  pricingPeriodStart: date("pricing_period_start"),
  pricingPeriodEnd: date("pricing_period_end"),
  status: text("status").notNull().default("REQUESTED"),
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  paidOutAt: timestamp("paid_out_at"),
  paymentReference: text("payment_reference"),
  paymentMethod: text("payment_method"),
});

export const insertCashoutSchema = createInsertSchema(cashouts).omit({ id: true, createdAt: true, acceptedAt: true, paidOutAt: true });
export type InsertCashout = z.infer<typeof insertCashoutSchema>;
export type Cashout = typeof cashouts.$inferSelect;

export const cashoutAllocations = pgTable("cashout_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cashoutId: varchar("cashout_id").notNull().references(() => cashouts.id),
  counterpartyId: varchar("counterparty_id").notNull().references(() => counterparties.id),
  deliveriesCount: integer("deliveries_count").notNull(),
  cashoutAmountPortion: numeric("cashout_amount_portion", { precision: 12, scale: 2 }).notNull(),
  feePortion: numeric("fee_portion", { precision: 12, scale: 2 }).notNull(),
  totalPayableToUs: numeric("total_payable_to_us", { precision: 12, scale: 2 }).notNull(),
  expectedPayDate: date("expected_pay_date"),
});

export const insertCashoutAllocationSchema = createInsertSchema(cashoutAllocations).omit({ id: true });
export type InsertCashoutAllocation = z.infer<typeof insertCashoutAllocationSchema>;
export type CashoutAllocation = typeof cashoutAllocations.$inferSelect;

export const cashoutDeliveries = pgTable("cashout_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cashoutId: varchar("cashout_id").notNull().references(() => cashouts.id),
  deliveryRecordId: varchar("delivery_record_id").notNull().references(() => deliveryRecords.id),
});

export const insertCashoutDeliverySchema = createInsertSchema(cashoutDeliveries).omit({ id: true });
export type InsertCashoutDelivery = z.infer<typeof insertCashoutDeliverySchema>;
export type CashoutDelivery = typeof cashoutDeliveries.$inferSelect;

export const ledgerEntries = pgTable("ledger_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cashoutId: varchar("cashout_id").references(() => cashouts.id),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  method: text("method"),
  reference: text("reference"),
  notes: text("notes"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntries).omit({ id: true, createdAt: true });
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;

export const notificationAttempts = pgTable("notification_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cashoutId: varchar("cashout_id").notNull().references(() => cashouts.id),
  counterpartyId: varchar("counterparty_id").notNull().references(() => counterparties.id),
  channel: text("channel").notNull(),
  status: text("status").notNull().default("pending"),
  retries: integer("retries").notNull().default(0),
  responseCode: integer("response_code"),
  lastAttemptAt: timestamp("last_attempt_at"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationAttemptSchema = createInsertSchema(notificationAttempts).omit({ id: true, createdAt: true });
export type InsertNotificationAttempt = z.infer<typeof insertNotificationAttemptSchema>;
export type NotificationAttempt = typeof notificationAttempts.$inferSelect;
