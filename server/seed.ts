import { db } from "./db";
import {
  users,
  vendorMasters,
  counterparties,
  vendorCounterpartyMappings,
  deliveryRecords,
  vendorPricingSchedules,
  vendorPricingTiers,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) return;

  console.log("Seeding database...");

  const hashedPw = await bcrypt.hash("password123", 10);

  const [metro] = await db
    .insert(counterparties)
    .values({
      name: "Metro Restaurant Group",
      type: "RESTAURANT",
    })
    .returning();

  const [foodhub] = await db
    .insert(counterparties)
    .values({
      name: "FoodHub Aggregator",
      type: "AGGREGATOR",
      notificationEmails: ["ops@foodhub.sa"],
      webhookUrl: "https://foodhub.sa/webhook/cashout",
    })
    .returning();

  const [sysco] = await db
    .insert(vendorMasters)
    .values({
      legalName: "Sysco Foods",
      crn: "CRN-1010",
      iban: "SA0380000000608010167519",
      beneficiary: "Sysco Foods LLC",
      bankName: "Al Rajhi Bank",
    })
    .returning();

  const [usfoods] = await db
    .insert(vendorMasters)
    .values({
      legalName: "US Foods",
      crn: "CRN-2020",
      iban: "SA1234567890123456789012",
      beneficiary: "US Foods Inc",
    })
    .returning();

  const [freshProduce] = await db
    .insert(vendorMasters)
    .values({
      legalName: "Fresh Produce Co",
      crn: "CRN-3030",
      iban: "SA9876543210987654321098",
      beneficiary: "Fresh Produce Co",
    })
    .returning();

  await db.insert(vendorCounterpartyMappings).values([
    {
      counterpartyId: metro.id,
      vendorMasterId: sysco.id,
      counterpartyVendorRef: "V-001",
      crn: "CRN-1010",
      status: "VERIFIED",
    },
    {
      counterpartyId: metro.id,
      vendorMasterId: usfoods.id,
      counterpartyVendorRef: "V-002",
      crn: "CRN-2020",
      status: "VERIFIED",
    },
    {
      counterpartyId: foodhub.id,
      vendorMasterId: sysco.id,
      counterpartyVendorRef: "FH-SYS",
      crn: "CRN-1010",
      status: "VERIFIED",
    },
    {
      counterpartyId: foodhub.id,
      vendorMasterId: freshProduce.id,
      counterpartyVendorRef: "FH-FPC",
      crn: "CRN-3030",
      status: "UNVERIFIED",
    },
  ]);

  const [syscoSchedule] = await db
    .insert(vendorPricingSchedules)
    .values({
      vendorMasterId: sysco.id,
      pricingPeriodType: "MONTHLY",
      effectiveFrom: "2026-01-01",
      floorSarPerDelivery: "2.50",
    })
    .returning();

  await db.insert(vendorPricingTiers).values([
    {
      scheduleId: syscoSchedule.id,
      fromDeliveries: 1,
      toDeliveries: 100,
      sarPerDelivery: "5.00",
    },
    {
      scheduleId: syscoSchedule.id,
      fromDeliveries: 101,
      toDeliveries: 500,
      sarPerDelivery: "4.00",
    },
    {
      scheduleId: syscoSchedule.id,
      fromDeliveries: 501,
      toDeliveries: null,
      sarPerDelivery: "3.00",
    },
  ]);

  const [usfoodsSchedule] = await db
    .insert(vendorPricingSchedules)
    .values({
      vendorMasterId: usfoods.id,
      pricingPeriodType: "MONTHLY",
      effectiveFrom: "2026-01-01",
      floorSarPerDelivery: "3.00",
    })
    .returning();

  await db.insert(vendorPricingTiers).values([
    {
      scheduleId: usfoodsSchedule.id,
      fromDeliveries: 1,
      toDeliveries: 50,
      sarPerDelivery: "6.00",
    },
    {
      scheduleId: usfoodsSchedule.id,
      fromDeliveries: 51,
      toDeliveries: 200,
      sarPerDelivery: "5.00",
    },
    {
      scheduleId: usfoodsSchedule.id,
      fromDeliveries: 201,
      toDeliveries: null,
      sarPerDelivery: "4.00",
    },
  ]);

  const deliveryData = [
    { counterpartyId: metro.id, vendorMasterId: sysco.id, date: "2026-01-05", amount: "1250.00", status: "OUTSTANDING", extId: "DEL-001" },
    { counterpartyId: metro.id, vendorMasterId: sysco.id, date: "2026-01-08", amount: "2300.00", status: "OUTSTANDING", extId: "DEL-002" },
    { counterpartyId: metro.id, vendorMasterId: sysco.id, date: "2026-01-12", amount: "875.50", status: "OUTSTANDING", extId: "DEL-003" },
    { counterpartyId: metro.id, vendorMasterId: sysco.id, date: "2026-01-18", amount: "3100.00", status: "SETTLED", extId: "DEL-004" },
    { counterpartyId: metro.id, vendorMasterId: sysco.id, date: "2026-01-25", amount: "1500.00", status: "OUTSTANDING", extId: "DEL-005" },
    { counterpartyId: metro.id, vendorMasterId: usfoods.id, date: "2026-01-07", amount: "4200.00", status: "OUTSTANDING", extId: "DEL-006" },
    { counterpartyId: metro.id, vendorMasterId: usfoods.id, date: "2026-01-14", amount: "1800.00", status: "OUTSTANDING", extId: "DEL-007" },
    { counterpartyId: metro.id, vendorMasterId: usfoods.id, date: "2026-01-21", amount: "2650.00", status: "SETTLED", extId: "DEL-008" },
    { counterpartyId: metro.id, vendorMasterId: usfoods.id, date: "2026-01-28", amount: "950.00", status: "OUTSTANDING", extId: "DEL-009" },
    { counterpartyId: foodhub.id, vendorMasterId: sysco.id, date: "2026-01-10", amount: "3500.00", status: "OUTSTANDING", extId: "DEL-010" },
    { counterpartyId: foodhub.id, vendorMasterId: sysco.id, date: "2026-01-15", amount: "2100.00", status: "OUTSTANDING", extId: "DEL-011" },
    { counterpartyId: foodhub.id, vendorMasterId: sysco.id, date: "2026-01-22", amount: "4800.00", status: "SETTLED", extId: "DEL-012" },
    { counterpartyId: foodhub.id, vendorMasterId: sysco.id, date: "2026-02-01", amount: "1650.00", status: "OUTSTANDING", extId: "DEL-013" },
    { counterpartyId: metro.id, vendorMasterId: sysco.id, date: "2026-02-03", amount: "2750.00", status: "OUTSTANDING", extId: "DEL-014" },
    { counterpartyId: metro.id, vendorMasterId: usfoods.id, date: "2026-02-05", amount: "3400.00", status: "OUTSTANDING", extId: "DEL-015" },
    { counterpartyId: foodhub.id, vendorMasterId: sysco.id, date: "2026-02-08", amount: "1900.00", status: "OUTSTANDING", extId: "DEL-016" },
    { counterpartyId: metro.id, vendorMasterId: sysco.id, date: "2026-02-10", amount: "500.00", status: "OUTSTANDING", extId: "DEL-017" },
    { counterpartyId: metro.id, vendorMasterId: usfoods.id, date: "2026-02-12", amount: "2200.00", status: "OUTSTANDING", extId: "DEL-018" },
  ];

  for (const d of deliveryData) {
    await db.insert(deliveryRecords).values({
      externalDeliveryId: d.extId,
      counterpartyId: d.counterpartyId,
      vendorMasterId: d.vendorMasterId,
      deliveryDate: d.date,
      amountEarned: d.amount,
      status: d.status,
    });
  }

  await db.insert(users).values([
    {
      name: "Admin User",
      email: "admin@payables.com",
      password: hashedPw,
      role: "admin",
    },
    {
      name: "Metro Manager",
      email: "counterparty@payables.com",
      password: hashedPw,
      role: "counterparty",
      counterpartyId: metro.id,
    },
    {
      name: "Sysco Rep",
      email: "vendor@payables.com",
      password: hashedPw,
      role: "vendor",
      vendorMasterId: sysco.id,
    },
  ]);

  console.log("Seed data inserted successfully.");
  console.log("Demo accounts:");
  console.log("  Admin:        admin@payables.com / password123");
  console.log("  Counterparty: counterparty@payables.com / password123");
  console.log("  Vendor:       vendor@payables.com / password123");
}
