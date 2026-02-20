import {
  type User,
  type InsertUser,
  type VendorMaster,
  type InsertVendorMaster,
  type Counterparty,
  type InsertCounterparty,
  type VendorCounterpartyMapping,
  type InsertVendorCounterpartyMapping,
  type VendorPricingSchedule,
  type InsertVendorPricingSchedule,
  type VendorPricingTier,
  type InsertVendorPricingTier,
  type DeliveryRecord,
  type InsertDeliveryRecord,
  type Cashout,
  type InsertCashout,
  type CashoutAllocation,
  type InsertCashoutAllocation,
  type CashoutDelivery,
  type InsertCashoutDelivery,
  type LedgerEntry,
  type InsertLedgerEntry,
  type NotificationAttempt,
  type InsertNotificationAttempt,
  users,
  vendorMasters,
  counterparties,
  vendorCounterpartyMappings,
  vendorPricingSchedules,
  vendorPricingTiers,
  deliveryRecords,
  cashouts,
  cashoutAllocations,
  cashoutDeliveries,
  ledgerEntries,
  notificationAttempts,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, inArray, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // VendorMasters
  getVendorMasters(): Promise<VendorMaster[]>;
  getVendorMaster(id: string): Promise<VendorMaster | undefined>;
  getVendorMasterByCrn(crn: string): Promise<VendorMaster | undefined>;
  createVendorMaster(vm: InsertVendorMaster): Promise<VendorMaster>;
  updateVendorMaster(id: string, vm: Partial<InsertVendorMaster>): Promise<VendorMaster>;

  // Counterparties
  getCounterparties(): Promise<Counterparty[]>;
  getCounterparty(id: string): Promise<Counterparty | undefined>;
  createCounterparty(cp: InsertCounterparty): Promise<Counterparty>;
  updateCounterparty(id: string, cp: Partial<InsertCounterparty>): Promise<Counterparty>;

  // VendorCounterpartyMappings
  getVendorCounterpartyMappingsByCounterparty(counterpartyId: string): Promise<VendorCounterpartyMapping[]>;
  getVendorCounterpartyMappingsByVendorMaster(vendorMasterId: string): Promise<VendorCounterpartyMapping[]>;
  createVendorCounterpartyMapping(m: InsertVendorCounterpartyMapping): Promise<VendorCounterpartyMapping>;
  updateVendorCounterpartyMappingStatus(id: string, status: string): Promise<VendorCounterpartyMapping>;
  getVendorCounterpartyMappingByCounterpartyAndCrn(counterpartyId: string, crn: string): Promise<VendorCounterpartyMapping | undefined>;

  // VendorPricingSchedules + Tiers
  getVendorPricingSchedulesByVendorMaster(vendorMasterId: string): Promise<VendorPricingSchedule[]>;
  createVendorPricingSchedule(s: InsertVendorPricingSchedule): Promise<VendorPricingSchedule>;
  getVendorPricingTiersBySchedule(scheduleId: string): Promise<VendorPricingTier[]>;
  createVendorPricingTier(t: InsertVendorPricingTier): Promise<VendorPricingTier>;
  deleteVendorPricingTier(id: string): Promise<void>;

  // DeliveryRecords
  getDeliveryRecordsByVendorMaster(vendorMasterId: string): Promise<DeliveryRecord[]>;
  getDeliveryRecordsByCounterparty(counterpartyId: string): Promise<DeliveryRecord[]>;
  getOutstandingDeliveryRecordsByVendorMaster(vendorMasterId: string): Promise<DeliveryRecord[]>;
  getDeliveryRecordsByIds(ids: string[]): Promise<DeliveryRecord[]>;
  createDeliveryRecord(dr: InsertDeliveryRecord): Promise<DeliveryRecord>;
  updateDeliveryRecordStatusBatch(ids: string[], status: string): Promise<void>;

  // Cashouts
  getCashouts(): Promise<Cashout[]>;
  getCashout(id: string): Promise<Cashout | undefined>;
  getCashoutsByVendorMaster(vendorMasterId: string): Promise<Cashout[]>;
  getCashoutsByCounterparty(counterpartyId: string): Promise<Cashout[]>;
  createCashout(c: InsertCashout): Promise<Cashout>;
  updateCashoutStatus(id: string, status: string, extra?: Partial<Cashout>): Promise<Cashout>;

  // CashoutAllocations
  getCashoutAllocationsByCashout(cashoutId: string): Promise<CashoutAllocation[]>;
  createCashoutAllocation(a: InsertCashoutAllocation): Promise<CashoutAllocation>;

  // CashoutDeliveries
  getCashoutDeliveriesByCashout(cashoutId: string): Promise<CashoutDelivery[]>;
  createCashoutDelivery(cd: InsertCashoutDelivery): Promise<CashoutDelivery>;

  // LedgerEntries
  getLedgerEntries(): Promise<LedgerEntry[]>;
  getLedgerEntriesByCashout(cashoutId: string): Promise<LedgerEntry[]>;
  createLedgerEntry(entry: InsertLedgerEntry): Promise<LedgerEntry>;

  // NotificationAttempts
  getNotificationAttemptsByCashout(cashoutId: string): Promise<NotificationAttempt[]>;
  createNotificationAttempt(na: InsertNotificationAttempt): Promise<NotificationAttempt>;
  updateNotificationAttempt(id: string, na: Partial<InsertNotificationAttempt>): Promise<NotificationAttempt>;

  // Dashboard
  getDashboardStats(opts?: { counterpartyId?: string; vendorMasterId?: string }): Promise<{
    totalOutstandingDeliveries: number;
    totalOutstandingAmount: number;
    totalCashoutsRequested: number;
    totalCashoutsPaidOut: number;
  }>;

  // Outstanding deliveries grouped by counterparty+vendorMaster
  getOutstandingDeliveriesByCounterpartyAndVendorMaster(
    counterpartyId: string,
    vendorMasterId: string
  ): Promise<DeliveryRecord[]>;

  // Active pricing tier for vendor master given delivery count
  getActivePricingTier(vendorMasterId: string, deliveryCount: number): Promise<VendorPricingTier | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // VendorMasters
  async getVendorMasters(): Promise<VendorMaster[]> {
    return db.select().from(vendorMasters).orderBy(desc(vendorMasters.createdAt));
  }

  async getVendorMaster(id: string): Promise<VendorMaster | undefined> {
    const [vm] = await db.select().from(vendorMasters).where(eq(vendorMasters.id, id));
    return vm;
  }

  async getVendorMasterByCrn(crn: string): Promise<VendorMaster | undefined> {
    const [vm] = await db.select().from(vendorMasters).where(eq(vendorMasters.crn, crn));
    return vm;
  }

  async createVendorMaster(vm: InsertVendorMaster): Promise<VendorMaster> {
    const [created] = await db.insert(vendorMasters).values(vm).returning();
    return created;
  }

  async updateVendorMaster(id: string, vm: Partial<InsertVendorMaster>): Promise<VendorMaster> {
    const [updated] = await db.update(vendorMasters).set(vm).where(eq(vendorMasters.id, id)).returning();
    return updated;
  }

  // Counterparties
  async getCounterparties(): Promise<Counterparty[]> {
    return db.select().from(counterparties).orderBy(desc(counterparties.createdAt));
  }

  async getCounterparty(id: string): Promise<Counterparty | undefined> {
    const [cp] = await db.select().from(counterparties).where(eq(counterparties.id, id));
    return cp;
  }

  async createCounterparty(cp: InsertCounterparty): Promise<Counterparty> {
    const [created] = await db.insert(counterparties).values(cp).returning();
    return created;
  }

  async updateCounterparty(id: string, cp: Partial<InsertCounterparty>): Promise<Counterparty> {
    const [updated] = await db.update(counterparties).set(cp).where(eq(counterparties.id, id)).returning();
    return updated;
  }

  // VendorCounterpartyMappings
  async getVendorCounterpartyMappingsByCounterparty(counterpartyId: string): Promise<VendorCounterpartyMapping[]> {
    return db.select().from(vendorCounterpartyMappings).where(eq(vendorCounterpartyMappings.counterpartyId, counterpartyId));
  }

  async getVendorCounterpartyMappingsByVendorMaster(vendorMasterId: string): Promise<VendorCounterpartyMapping[]> {
    return db.select().from(vendorCounterpartyMappings).where(eq(vendorCounterpartyMappings.vendorMasterId, vendorMasterId));
  }

  async createVendorCounterpartyMapping(m: InsertVendorCounterpartyMapping): Promise<VendorCounterpartyMapping> {
    const [created] = await db.insert(vendorCounterpartyMappings).values(m).returning();
    return created;
  }

  async updateVendorCounterpartyMappingStatus(id: string, status: string): Promise<VendorCounterpartyMapping> {
    const [updated] = await db
      .update(vendorCounterpartyMappings)
      .set({ status })
      .where(eq(vendorCounterpartyMappings.id, id))
      .returning();
    return updated;
  }

  async getVendorCounterpartyMappingByCounterpartyAndCrn(
    counterpartyId: string,
    crn: string
  ): Promise<VendorCounterpartyMapping | undefined> {
    const [mapping] = await db
      .select()
      .from(vendorCounterpartyMappings)
      .where(
        and(
          eq(vendorCounterpartyMappings.counterpartyId, counterpartyId),
          eq(vendorCounterpartyMappings.crn, crn)
        )
      );
    return mapping;
  }

  // VendorPricingSchedules
  async getVendorPricingSchedulesByVendorMaster(vendorMasterId: string): Promise<VendorPricingSchedule[]> {
    return db.select().from(vendorPricingSchedules).where(eq(vendorPricingSchedules.vendorMasterId, vendorMasterId));
  }

  async createVendorPricingSchedule(s: InsertVendorPricingSchedule): Promise<VendorPricingSchedule> {
    const [created] = await db.insert(vendorPricingSchedules).values(s).returning();
    return created;
  }

  // VendorPricingTiers
  async getVendorPricingTiersBySchedule(scheduleId: string): Promise<VendorPricingTier[]> {
    return db.select().from(vendorPricingTiers).where(eq(vendorPricingTiers.scheduleId, scheduleId));
  }

  async createVendorPricingTier(t: InsertVendorPricingTier): Promise<VendorPricingTier> {
    const [created] = await db.insert(vendorPricingTiers).values(t).returning();
    return created;
  }

  async deleteVendorPricingTier(id: string): Promise<void> {
    await db.delete(vendorPricingTiers).where(eq(vendorPricingTiers.id, id));
  }

  // DeliveryRecords
  async getDeliveryRecordsByVendorMaster(vendorMasterId: string): Promise<DeliveryRecord[]> {
    return db.select().from(deliveryRecords).where(eq(deliveryRecords.vendorMasterId, vendorMasterId)).orderBy(desc(deliveryRecords.createdAt));
  }

  async getDeliveryRecordsByCounterparty(counterpartyId: string): Promise<DeliveryRecord[]> {
    return db.select().from(deliveryRecords).where(eq(deliveryRecords.counterpartyId, counterpartyId)).orderBy(desc(deliveryRecords.createdAt));
  }

  async getOutstandingDeliveryRecordsByVendorMaster(vendorMasterId: string): Promise<DeliveryRecord[]> {
    return db
      .select()
      .from(deliveryRecords)
      .where(
        and(
          eq(deliveryRecords.vendorMasterId, vendorMasterId),
          eq(deliveryRecords.status, "OUTSTANDING")
        )
      )
      .orderBy(desc(deliveryRecords.createdAt));
  }

  async getDeliveryRecordsByIds(ids: string[]): Promise<DeliveryRecord[]> {
    if (ids.length === 0) return [];
    return db.select().from(deliveryRecords).where(inArray(deliveryRecords.id, ids));
  }

  async createDeliveryRecord(dr: InsertDeliveryRecord): Promise<DeliveryRecord> {
    const [created] = await db.insert(deliveryRecords).values(dr).returning();
    return created;
  }

  async updateDeliveryRecordStatusBatch(ids: string[], status: string): Promise<void> {
    if (ids.length === 0) return;
    await db.update(deliveryRecords).set({ status }).where(inArray(deliveryRecords.id, ids));
  }

  // Cashouts
  async getCashouts(): Promise<Cashout[]> {
    return db.select().from(cashouts).orderBy(desc(cashouts.createdAt));
  }

  async getCashout(id: string): Promise<Cashout | undefined> {
    const [c] = await db.select().from(cashouts).where(eq(cashouts.id, id));
    return c;
  }

  async getCashoutsByVendorMaster(vendorMasterId: string): Promise<Cashout[]> {
    return db.select().from(cashouts).where(eq(cashouts.vendorMasterId, vendorMasterId)).orderBy(desc(cashouts.createdAt));
  }

  async getCashoutsByCounterparty(counterpartyId: string): Promise<Cashout[]> {
    const allocations = await db
      .select({ cashoutId: cashoutAllocations.cashoutId })
      .from(cashoutAllocations)
      .where(eq(cashoutAllocations.counterpartyId, counterpartyId));
    const cashoutIds = allocations.map((a) => a.cashoutId);
    if (cashoutIds.length === 0) return [];
    return db.select().from(cashouts).where(inArray(cashouts.id, cashoutIds)).orderBy(desc(cashouts.createdAt));
  }

  async createCashout(c: InsertCashout): Promise<Cashout> {
    const [created] = await db.insert(cashouts).values(c).returning();
    return created;
  }

  async updateCashoutStatus(id: string, status: string, extra?: Partial<Cashout>): Promise<Cashout> {
    const updates: any = { status, ...extra };
    if (status === "COUNTERPARTY_APPROVED" || status === "ADMIN_APPROVED") {
      updates.acceptedAt = new Date();
    }
    if (status === "PAID_OUT") {
      updates.paidOutAt = new Date();
    }
    const [updated] = await db.update(cashouts).set(updates).where(eq(cashouts.id, id)).returning();
    return updated;
  }

  // CashoutAllocations
  async getCashoutAllocationsByCashout(cashoutId: string): Promise<CashoutAllocation[]> {
    return db.select().from(cashoutAllocations).where(eq(cashoutAllocations.cashoutId, cashoutId));
  }

  async createCashoutAllocation(a: InsertCashoutAllocation): Promise<CashoutAllocation> {
    const [created] = await db.insert(cashoutAllocations).values(a).returning();
    return created;
  }

  // CashoutDeliveries
  async getCashoutDeliveriesByCashout(cashoutId: string): Promise<CashoutDelivery[]> {
    return db.select().from(cashoutDeliveries).where(eq(cashoutDeliveries.cashoutId, cashoutId));
  }

  async createCashoutDelivery(cd: InsertCashoutDelivery): Promise<CashoutDelivery> {
    const [created] = await db.insert(cashoutDeliveries).values(cd).returning();
    return created;
  }

  // LedgerEntries
  async getLedgerEntries(): Promise<LedgerEntry[]> {
    return db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt));
  }

  async getLedgerEntriesByCashout(cashoutId: string): Promise<LedgerEntry[]> {
    return db.select().from(ledgerEntries).where(eq(ledgerEntries.cashoutId, cashoutId));
  }

  async createLedgerEntry(entry: InsertLedgerEntry): Promise<LedgerEntry> {
    const [created] = await db.insert(ledgerEntries).values(entry).returning();
    return created;
  }

  // NotificationAttempts
  async getNotificationAttemptsByCashout(cashoutId: string): Promise<NotificationAttempt[]> {
    return db.select().from(notificationAttempts).where(eq(notificationAttempts.cashoutId, cashoutId));
  }

  async createNotificationAttempt(na: InsertNotificationAttempt): Promise<NotificationAttempt> {
    const [created] = await db.insert(notificationAttempts).values(na).returning();
    return created;
  }

  async updateNotificationAttempt(id: string, na: Partial<InsertNotificationAttempt>): Promise<NotificationAttempt> {
    const [updated] = await db.update(notificationAttempts).set(na).where(eq(notificationAttempts.id, id)).returning();
    return updated;
  }

  // Dashboard stats
  async getDashboardStats(opts?: { counterpartyId?: string; vendorMasterId?: string }): Promise<{
    totalOutstandingDeliveries: number;
    totalOutstandingAmount: number;
    totalCashoutsRequested: number;
    totalCashoutsPaidOut: number;
  }> {
    let deliveryQuery = db.select().from(deliveryRecords).where(eq(deliveryRecords.status, "OUTSTANDING"));
    let allDeliveries: DeliveryRecord[];

    if (opts?.counterpartyId && opts?.vendorMasterId) {
      allDeliveries = await db
        .select()
        .from(deliveryRecords)
        .where(
          and(
            eq(deliveryRecords.status, "OUTSTANDING"),
            eq(deliveryRecords.counterpartyId, opts.counterpartyId),
            eq(deliveryRecords.vendorMasterId, opts.vendorMasterId)
          )
        );
    } else if (opts?.counterpartyId) {
      allDeliveries = await db
        .select()
        .from(deliveryRecords)
        .where(
          and(
            eq(deliveryRecords.status, "OUTSTANDING"),
            eq(deliveryRecords.counterpartyId, opts.counterpartyId)
          )
        );
    } else if (opts?.vendorMasterId) {
      allDeliveries = await db
        .select()
        .from(deliveryRecords)
        .where(
          and(
            eq(deliveryRecords.status, "OUTSTANDING"),
            eq(deliveryRecords.vendorMasterId, opts.vendorMasterId)
          )
        );
    } else {
      allDeliveries = await db
        .select()
        .from(deliveryRecords)
        .where(eq(deliveryRecords.status, "OUTSTANDING"));
    }

    const totalOutstandingDeliveries = allDeliveries.length;
    const totalOutstandingAmount = allDeliveries.reduce(
      (sum, d) => sum + Number(d.amountEarned || 0),
      0
    );

    let cashoutList: Cashout[];
    if (opts?.vendorMasterId) {
      cashoutList = await db.select().from(cashouts).where(eq(cashouts.vendorMasterId, opts.vendorMasterId));
    } else if (opts?.counterpartyId) {
      const allocations = await db
        .select({ cashoutId: cashoutAllocations.cashoutId })
        .from(cashoutAllocations)
        .where(eq(cashoutAllocations.counterpartyId, opts.counterpartyId));
      const cashoutIds = allocations.map((a) => a.cashoutId);
      cashoutList = cashoutIds.length > 0
        ? await db.select().from(cashouts).where(inArray(cashouts.id, cashoutIds))
        : [];
    } else {
      cashoutList = await db.select().from(cashouts);
    }

    const totalCashoutsRequested = cashoutList
      .filter((c) => c.status === "REQUESTED")
      .reduce((sum, c) => sum + Number(c.cashoutAmount), 0);

    const totalCashoutsPaidOut = cashoutList
      .filter((c) => c.status === "PAID_OUT" || c.status === "SETTLED")
      .reduce((sum, c) => sum + Number(c.cashoutAmount), 0);

    return {
      totalOutstandingDeliveries,
      totalOutstandingAmount,
      totalCashoutsRequested,
      totalCashoutsPaidOut,
    };
  }

  // Outstanding deliveries by counterparty + vendorMaster
  async getOutstandingDeliveriesByCounterpartyAndVendorMaster(
    counterpartyId: string,
    vendorMasterId: string
  ): Promise<DeliveryRecord[]> {
    return db
      .select()
      .from(deliveryRecords)
      .where(
        and(
          eq(deliveryRecords.counterpartyId, counterpartyId),
          eq(deliveryRecords.vendorMasterId, vendorMasterId),
          eq(deliveryRecords.status, "OUTSTANDING")
        )
      )
      .orderBy(desc(deliveryRecords.deliveryDate));
  }

  // Active pricing tier for a vendor master given delivery count
  async getActivePricingTier(vendorMasterId: string, deliveryCount: number): Promise<VendorPricingTier | undefined> {
    const schedules = await db
      .select()
      .from(vendorPricingSchedules)
      .where(eq(vendorPricingSchedules.vendorMasterId, vendorMasterId))
      .orderBy(desc(vendorPricingSchedules.effectiveFrom));

    if (schedules.length === 0) return undefined;

    const latestSchedule = schedules[0];
    const tiers = await db
      .select()
      .from(vendorPricingTiers)
      .where(eq(vendorPricingTiers.scheduleId, latestSchedule.id));

    return tiers.find((t) => {
      const from = t.fromDeliveries;
      const to = t.toDeliveries;
      if (to === null) return deliveryCount >= from;
      return deliveryCount >= from && deliveryCount <= to;
    });
  }
}

export const storage = new DatabaseStorage();
