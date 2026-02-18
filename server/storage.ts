import {
  type User,
  type InsertUser,
  type Restaurant,
  type InsertRestaurant,
  type Vendor,
  type InsertVendor,
  type Invoice,
  type InsertInvoice,
  type Offer,
  type InsertOffer,
  type OfferAssignment,
  type InsertOfferAssignment,
  type LedgerEntry,
  type InsertLedgerEntry,
  type FeeRate,
  type InsertFeeRate,
  users,
  restaurants,
  vendors,
  invoices,
  offers,
  offerAssignments,
  ledgerEntries,
  feeRates,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | undefined>;
  createRestaurant(r: InsertRestaurant): Promise<Restaurant>;

  getVendors(restaurantId: string): Promise<Vendor[]>;
  getAllVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(v: InsertVendor): Promise<Vendor>;
  getOrCreateVendor(restaurantId: string, name: string): Promise<Vendor>;

  getInvoices(vendorId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(inv: InsertInvoice): Promise<Invoice>;
  getInvoicesByIds(ids: string[]): Promise<Invoice[]>;

  getOffers(): Promise<Offer[]>;
  getOffersByRestaurant(restaurantId: string): Promise<Offer[]>;
  getOffersByVendor(vendorId: string): Promise<Offer[]>;
  getOffer(id: string): Promise<Offer | undefined>;
  createOffer(offer: InsertOffer): Promise<Offer>;
  updateOfferStatus(id: string, status: string, acceptedAt?: Date): Promise<void>;

  getOfferAssignments(offerId: string): Promise<OfferAssignment[]>;
  createOfferAssignment(a: InsertOfferAssignment): Promise<OfferAssignment>;

  getLedgerEntries(): Promise<LedgerEntry[]>;
  createLedgerEntry(entry: InsertLedgerEntry): Promise<LedgerEntry>;
  getLedgerEntriesByOffer(offerId: string): Promise<LedgerEntry[]>;

  getDashboardStats(restaurantId?: string): Promise<{
    totalOwed: number;
    eligibleOwed: number;
    financedOutstanding: number;
    overdue: number;
  }>;

  getFeeRates(): Promise<FeeRate[]>;
  getFeeRate(id: string): Promise<FeeRate | undefined>;
  createFeeRate(rate: InsertFeeRate): Promise<FeeRate>;
  updateFeeRate(id: string, rate: Partial<InsertFeeRate>): Promise<FeeRate>;
  deleteFeeRate(id: string): Promise<void>;
  getFeeRateForDays(days: number): Promise<FeeRate | undefined>;
}

export class DatabaseStorage implements IStorage {
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

  async getRestaurants(): Promise<Restaurant[]> {
    return db.select().from(restaurants);
  }

  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    const [r] = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return r;
  }

  async createRestaurant(r: InsertRestaurant): Promise<Restaurant> {
    const [rest] = await db.insert(restaurants).values(r).returning();
    return rest;
  }

  async getVendors(restaurantId: string): Promise<Vendor[]> {
    return db.select().from(vendors).where(eq(vendors.restaurantId, restaurantId));
  }

  async getAllVendors(): Promise<Vendor[]> {
    return db.select().from(vendors);
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const [v] = await db.select().from(vendors).where(eq(vendors.id, id));
    return v;
  }

  async createVendor(v: InsertVendor): Promise<Vendor> {
    const [vendor] = await db.insert(vendors).values(v).returning();
    return vendor;
  }

  async getOrCreateVendor(restaurantId: string, name: string): Promise<Vendor> {
    const existing = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.restaurantId, restaurantId), eq(vendors.name, name)));
    if (existing.length > 0) return existing[0];
    const [v] = await db
      .insert(vendors)
      .values({ restaurantId, name })
      .returning();
    return v;
  }

  async getInvoices(vendorId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.vendorId, vendorId));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
    return inv;
  }

  async createInvoice(inv: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(inv).returning();
    return invoice;
  }

  async getInvoicesByIds(ids: string[]): Promise<Invoice[]> {
    if (ids.length === 0) return [];
    return db.select().from(invoices).where(inArray(invoices.id, ids));
  }

  async getOffers(): Promise<Offer[]> {
    return db.select().from(offers).orderBy(desc(offers.createdAt));
  }

  async getOffersByRestaurant(restaurantId: string): Promise<Offer[]> {
    return db.select().from(offers).where(eq(offers.restaurantId, restaurantId)).orderBy(desc(offers.createdAt));
  }

  async getOffersByVendor(vendorId: string): Promise<Offer[]> {
    return db.select().from(offers).where(eq(offers.vendorId, vendorId)).orderBy(desc(offers.createdAt));
  }

  async getOffer(id: string): Promise<Offer | undefined> {
    const [o] = await db.select().from(offers).where(eq(offers.id, id));
    return o;
  }

  async createOffer(offer: InsertOffer): Promise<Offer> {
    const [o] = await db.insert(offers).values(offer).returning();
    return o;
  }

  async updateOfferStatus(id: string, status: string, acceptedAt?: Date): Promise<void> {
    const updates: any = { status };
    if (acceptedAt) updates.acceptedAt = acceptedAt;
    await db.update(offers).set(updates).where(eq(offers.id, id));
  }

  async getOfferAssignments(offerId: string): Promise<OfferAssignment[]> {
    return db.select().from(offerAssignments).where(eq(offerAssignments.offerId, offerId));
  }

  async createOfferAssignment(a: InsertOfferAssignment): Promise<OfferAssignment> {
    const [oa] = await db.insert(offerAssignments).values(a).returning();
    return oa;
  }

  async getLedgerEntries(): Promise<LedgerEntry[]> {
    return db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt));
  }

  async createLedgerEntry(entry: InsertLedgerEntry): Promise<LedgerEntry> {
    const [le] = await db.insert(ledgerEntries).values(entry).returning();
    return le;
  }

  async getLedgerEntriesByOffer(offerId: string): Promise<LedgerEntry[]> {
    return db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.offerId, offerId));
  }

  async getDashboardStats(restaurantId?: string) {
    const allInvoices = restaurantId
      ? await db.select().from(invoices).where(eq(invoices.restaurantId, restaurantId))
      : await db.select().from(invoices);
    const allOffers = restaurantId
      ? await db.select().from(offers).where(eq(offers.restaurantId, restaurantId))
      : await db.select().from(offers);
    const allLedger = await db.select().from(ledgerEntries);

    const totalOwed = allInvoices.reduce(
      (sum, inv) => sum + Number(inv.amountRemaining),
      0
    );
    const eligibleOwed = allInvoices
      .filter((inv) => inv.isEligible)
      .reduce((sum, inv) => sum + Number(inv.amountRemaining), 0);

    const acceptedOffers = allOffers.filter((o) => ["admin_approved", "payout_sent", "repaid", "closed"].includes(o.status));
    const repayments = allLedger.filter((e) => e.type === "repayment");

    let financedOutstanding = 0;
    let overdue = 0;

    for (const offer of acceptedOffers) {
      const totalRepayment = Number(offer.totalRepayment);
      const paid = repayments
        .filter((r) => r.offerId === offer.id)
        .reduce((sum, r) => sum + Number(r.amount), 0);
      const remaining = totalRepayment - paid;
      if (remaining > 0) {
        financedOutstanding += remaining;
        if (offer.repaymentDate && new Date(offer.repaymentDate) < new Date()) {
          overdue += remaining;
        }
      }
    }

    return { totalOwed, eligibleOwed, financedOutstanding, overdue };
  }

  async getFeeRates(): Promise<FeeRate[]> {
    return db.select().from(feeRates).orderBy(feeRates.minDays);
  }

  async getFeeRate(id: string): Promise<FeeRate | undefined> {
    const [rate] = await db.select().from(feeRates).where(eq(feeRates.id, id));
    return rate;
  }

  async createFeeRate(rate: InsertFeeRate): Promise<FeeRate> {
    const [created] = await db.insert(feeRates).values(rate).returning();
    return created;
  }

  async updateFeeRate(id: string, rate: Partial<InsertFeeRate>): Promise<FeeRate> {
    const [updated] = await db.update(feeRates).set(rate).where(eq(feeRates.id, id)).returning();
    return updated;
  }

  async deleteFeeRate(id: string): Promise<void> {
    await db.delete(feeRates).where(eq(feeRates.id, id));
  }

  async getFeeRateForDays(days: number): Promise<FeeRate | undefined> {
    const allRates = await this.getFeeRates();
    return allRates.find(r => days >= r.minDays && days <= r.maxDays);
  }
}

export const storage = new DatabaseStorage();
