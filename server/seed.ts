import { db } from "./db";
import { users, restaurants, vendors, invoices } from "@shared/schema";
import { checkEligibility } from "./eligibility";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) return;

  console.log("Seeding database...");

  const hashedPw = await bcrypt.hash("password123", 10);

  const [restaurant] = await db
    .insert(restaurants)
    .values({
      name: "Metro Bistro Group",
      defaultRatePer30d: "0.015",
      bankName: "Chase Bank",
      bankAccountNumber: "****4521",
      bankRoutingNumber: "021000021",
      bankAccountName: "Metro Bistro Group LLC",
    })
    .returning();

  const vendorNames = [
    "Sysco Foods",
    "US Foods",
    "Performance Foodservice",
    "Gordon Food Service",
    "Ben E. Keith",
  ];

  const createdVendors = [];
  for (const name of vendorNames) {
    const [v] = await db
      .insert(vendors)
      .values({ restaurantId: restaurant.id, name })
      .returning();
    createdVendors.push(v);
  }

  const [adminUser] = await db
    .insert(users)
    .values({
      name: "Admin User",
      email: "admin@payables.com",
      password: hashedPw,
      role: "admin",
    })
    .returning();

  const [restaurantUser] = await db
    .insert(users)
    .values({
      name: "Jane Smith",
      email: "restaurant@payables.com",
      password: hashedPw,
      role: "restaurant",
      restaurantId: restaurant.id,
    })
    .returning();

  const [vendorUser] = await db
    .insert(users)
    .values({
      name: "Mike Chen",
      email: "vendor@payables.com",
      password: hashedPw,
      role: "vendor",
      vendorId: createdVendors[0].id,
    })
    .returning();

  const now = new Date();
  const addDays = (d: Date, days: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  };

  const invoiceData = [
    { vendor: 0, num: "INV-2024-001", days: 15, amount: 12500.00, status: "APPROVED", hold: false },
    { vendor: 0, num: "INV-2024-002", days: 30, amount: 8750.50, status: "APPROVED", hold: false },
    { vendor: 0, num: "INV-2024-003", days: 7, amount: 3200.00, status: "VALIDATED", hold: false },
    { vendor: 0, num: "INV-2024-004", days: 60, amount: 15000.00, status: "APPROVED", hold: false },
    { vendor: 0, num: "INV-2024-005", days: 20, amount: 6800.00, status: "PENDING", hold: false },
    { vendor: 1, num: "INV-2024-010", days: 10, amount: 22000.00, status: "APPROVED", hold: false },
    { vendor: 1, num: "INV-2024-011", days: 25, amount: 9500.00, status: "APPROVED", hold: false },
    { vendor: 1, num: "INV-2024-012", days: 40, amount: 14200.00, status: "VALIDATED", hold: false },
    { vendor: 1, num: "INV-2024-013", days: 5, amount: 4800.00, status: "APPROVED", hold: true },
    { vendor: 2, num: "INV-2024-020", days: 12, amount: 18500.00, status: "APPROVED", hold: false },
    { vendor: 2, num: "INV-2024-021", days: 35, amount: 7300.00, status: "VALIDATED", hold: false },
    { vendor: 2, num: "INV-2024-022", days: -5, amount: 5100.00, status: "APPROVED", hold: false },
    { vendor: 3, num: "INV-2024-030", days: 18, amount: 11200.00, status: "APPROVED", hold: false },
    { vendor: 3, num: "INV-2024-031", days: 28, amount: 16800.00, status: "APPROVED", hold: false },
    { vendor: 4, num: "INV-2024-040", days: 22, amount: 9900.00, status: "VALIDATED", hold: false },
    { vendor: 4, num: "INV-2024-041", days: 8, amount: 5500.00, status: "APPROVED", hold: false },
    { vendor: 4, num: "INV-2024-042", days: 45, amount: 13700.00, status: "APPROVED", hold: false },
  ];

  for (const inv of invoiceData) {
    const dueDate = addDays(now, inv.days).toISOString().split("T")[0];
    const eligible = checkEligibility({
      amountRemaining: inv.amount,
      dueDate,
      status: inv.status,
      holdFlag: inv.hold,
    });

    await db.insert(invoices).values({
      restaurantId: restaurant.id,
      vendorId: createdVendors[inv.vendor].id,
      invoiceNumber: inv.num,
      dueDate,
      amountRemaining: String(inv.amount),
      status: inv.status,
      holdFlag: inv.hold,
      isEligible: eligible,
      rawData: {
        invoice_number: inv.num,
        due_date: dueDate,
        amount_remaining: inv.amount,
        status: inv.status,
        hold_flag: inv.hold,
        vendor_name: vendorNames[inv.vendor],
      },
    });
  }

  console.log("Seed data inserted successfully.");
  console.log("Demo accounts:");
  console.log("  Admin:      admin@payables.com / password123");
  console.log("  Restaurant: restaurant@payables.com / password123");
  console.log("  Vendor:     vendor@payables.com / password123");
}
