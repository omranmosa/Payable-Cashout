import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs";
import type { User } from "@shared/schema";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const SessionStore = MemoryStore(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

async function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  req.currentUser = user;
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: Function) => {
    if (!req.currentUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.currentUser.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      store: new SessionStore({ checkPeriod: 86400000 }),
      secret: process.env.SESSION_SECRET || "payables-cashout-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 24 * 60 * 60 * 1000 },
    })
  );

  // ───── Auth ─────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "All fields required" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ name, email, password: hashed, role: "counterparty" });
      req.session.userId = user.id;
      return res.json({ id: user.id, name: user.name, email: user.email, role: user.role, counterpartyId: user.counterpartyId, vendorMasterId: user.vendorMasterId });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      return res.json({ id: user.id, name: user.name, email: user.email, role: user.role, counterpartyId: user.counterpartyId, vendorMasterId: user.vendorMasterId });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
    const u = req.currentUser!;
    return res.json({ id: u.id, name: u.name, email: u.email, role: u.role, counterpartyId: u.counterpartyId, vendorMasterId: u.vendorMasterId });
  });

  // ───── Dashboard ─────
  app.get("/api/dashboard", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      let opts: { counterpartyId?: string; vendorMasterId?: string } = {};
      if (user.role === "counterparty" && user.counterpartyId) {
        opts.counterpartyId = user.counterpartyId;
      } else if (user.role === "vendor" && user.vendorMasterId) {
        opts.vendorMasterId = user.vendorMasterId;
      }
      const stats = await storage.getDashboardStats(opts);
      return res.json(stats);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Counterparties (admin CRUD) ─────
  app.get("/api/counterparties", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      if (user.role === "counterparty" && user.counterpartyId) {
        const cp = await storage.getCounterparty(user.counterpartyId);
        return res.json(cp ? [cp] : []);
      }
      if (user.role === "vendor") {
        return res.json([]);
      }
      const list = await storage.getCounterparties();
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/counterparties/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const cp = await storage.getCounterparty(req.params.id);
      if (!cp) return res.status(404).json({ message: "Counterparty not found" });
      const user = req.currentUser!;
      if (user.role === "counterparty" && user.counterpartyId !== cp.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      return res.json(cp);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/counterparties", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { name, type, notificationEmails, webhookUrl, webhookSecret } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const cp = await storage.createCounterparty({
        name,
        type: type || "RESTAURANT",
        notificationEmails: notificationEmails || null,
        webhookUrl: webhookUrl || null,
        webhookSecret: webhookSecret || null,
      });
      return res.json(cp);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/counterparties/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const updates: any = {};
      const { name, type, notificationEmails, webhookUrl, webhookSecret } = req.body;
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (notificationEmails !== undefined) updates.notificationEmails = notificationEmails;
      if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl;
      if (webhookSecret !== undefined) updates.webhookSecret = webhookSecret;
      const cp = await storage.updateCounterparty(req.params.id, updates);
      return res.json(cp);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Vendor Masters (admin CRUD) ─────
  app.get("/api/vendor-masters", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      if (user.role === "vendor" && user.vendorMasterId) {
        const vm = await storage.getVendorMaster(user.vendorMasterId);
        return res.json(vm ? [vm] : []);
      }
      const list = await storage.getVendorMasters();
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/vendor-masters/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const vm = await storage.getVendorMaster(req.params.id);
      if (!vm) return res.status(404).json({ message: "Vendor master not found" });
      return res.json(vm);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/vendor-masters", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { legalName, crn, iban, beneficiary, bankName } = req.body;
      if (!legalName || !crn) return res.status(400).json({ message: "Legal name and CRN are required" });
      const existing = await storage.getVendorMasterByCrn(crn);
      if (existing) return res.status(400).json({ message: "CRN already exists" });
      const vm = await storage.createVendorMaster({
        legalName,
        crn,
        iban: iban || null,
        beneficiary: beneficiary || null,
        bankName: bankName || null,
      });
      return res.json(vm);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/vendor-masters/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const updates: any = {};
      const { legalName, crn, iban, beneficiary, bankName } = req.body;
      if (legalName !== undefined) updates.legalName = legalName;
      if (crn !== undefined) updates.crn = crn;
      if (iban !== undefined) updates.iban = iban;
      if (beneficiary !== undefined) updates.beneficiary = beneficiary;
      if (bankName !== undefined) updates.bankName = bankName;
      const vm = await storage.updateVendorMaster(req.params.id, updates);
      return res.json(vm);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Vendor-Counterparty Mappings ─────
  app.get("/api/vendor-counterparty-mappings", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      const { counterpartyId, vendorMasterId } = req.query;
      if (user.role === "counterparty" && user.counterpartyId) {
        const mappings = await storage.getVendorCounterpartyMappingsByCounterparty(user.counterpartyId);
        return res.json(mappings);
      }
      if (user.role === "vendor" && user.vendorMasterId) {
        const mappings = await storage.getVendorCounterpartyMappingsByVendorMaster(user.vendorMasterId);
        return res.json(mappings);
      }
      if (counterpartyId) {
        const mappings = await storage.getVendorCounterpartyMappingsByCounterparty(counterpartyId as string);
        return res.json(mappings);
      }
      if (vendorMasterId) {
        const mappings = await storage.getVendorCounterpartyMappingsByVendorMaster(vendorMasterId as string);
        return res.json(mappings);
      }
      const all: any[] = [];
      const cps = await storage.getCounterparties();
      for (const cp of cps) {
        const ms = await storage.getVendorCounterpartyMappingsByCounterparty(cp.id);
        all.push(...ms);
      }
      return res.json(all);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/vendor-counterparty-mappings", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { counterpartyId, counterpartyVendorRef, crn, vendorMasterId } = req.body;
      if (!counterpartyId || !crn) {
        return res.status(400).json({ message: "counterpartyId and crn are required" });
      }
      let resolvedVmId = vendorMasterId || null;
      if (!resolvedVmId && crn) {
        const vm = await storage.getVendorMasterByCrn(crn);
        if (vm) resolvedVmId = vm.id;
      }
      const mapping = await storage.createVendorCounterpartyMapping({
        counterpartyId,
        counterpartyVendorRef: counterpartyVendorRef || null,
        vendorMasterId: resolvedVmId,
        crn,
        status: resolvedVmId ? "VERIFIED" : "UNVERIFIED",
      });
      return res.json(mapping);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/vendor-counterparty-mappings/:id/status", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: "Status required" });
      const mapping = await storage.updateVendorCounterpartyMappingStatus(req.params.id, status);
      return res.json(mapping);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Vendor Pricing Schedules & Tiers (admin) ─────
  app.get("/api/vendor-pricing/:vendorMasterId", requireAuth, async (req: Request, res: Response) => {
    try {
      const schedules = await storage.getVendorPricingSchedulesByVendorMaster(req.params.vendorMasterId);
      const result = [];
      for (const s of schedules) {
        const tiers = await storage.getVendorPricingTiersBySchedule(s.id);
        result.push({ ...s, tiers });
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/vendor-pricing", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { vendorMasterId, effectiveFrom, floorSarPerDelivery, pricingPeriodType, tiers } = req.body;
      if (!vendorMasterId || !effectiveFrom || !floorSarPerDelivery) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const schedule = await storage.createVendorPricingSchedule({
        vendorMasterId,
        effectiveFrom,
        floorSarPerDelivery: String(floorSarPerDelivery),
        pricingPeriodType: pricingPeriodType || "MONTHLY",
      });
      if (Array.isArray(tiers)) {
        for (const t of tiers) {
          await storage.createVendorPricingTier({
            scheduleId: schedule.id,
            fromDeliveries: t.fromDeliveries,
            toDeliveries: t.toDeliveries ?? null,
            sarPerDelivery: String(t.sarPerDelivery),
          });
        }
      }
      const createdTiers = await storage.getVendorPricingTiersBySchedule(schedule.id);
      return res.json({ ...schedule, tiers: createdTiers });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/vendor-pricing-tiers/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await storage.deleteVendorPricingTier(req.params.id);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Delivery Records ─────
  app.get("/api/delivery-records", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      const { counterpartyId, vendorMasterId, status } = req.query;

      if (user.role === "vendor" && user.vendorMasterId) {
        const records = await storage.getDeliveryRecordsByVendorMaster(user.vendorMasterId);
        return res.json(records);
      }
      if (user.role === "counterparty" && user.counterpartyId) {
        const records = await storage.getDeliveryRecordsByCounterparty(user.counterpartyId);
        return res.json(records);
      }
      if (vendorMasterId) {
        const records = await storage.getDeliveryRecordsByVendorMaster(vendorMasterId as string);
        return res.json(records);
      }
      if (counterpartyId) {
        const records = await storage.getDeliveryRecordsByCounterparty(counterpartyId as string);
        return res.json(records);
      }
      const all: any[] = [];
      const cps = await storage.getCounterparties();
      for (const cp of cps) {
        const recs = await storage.getDeliveryRecordsByCounterparty(cp.id);
        all.push(...recs);
      }
      return res.json(all);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/delivery-records/outstanding", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      if (user.role === "vendor" && user.vendorMasterId) {
        const records = await storage.getOutstandingDeliveryRecordsByVendorMaster(user.vendorMasterId);
        return res.json(records);
      }
      const { vendorMasterId } = req.query;
      if (vendorMasterId) {
        const records = await storage.getOutstandingDeliveryRecordsByVendorMaster(vendorMasterId as string);
        return res.json(records);
      }
      return res.status(400).json({ message: "vendorMasterId required" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/delivery-records", requireAuth, requireRole("admin", "counterparty"), async (req: Request, res: Response) => {
    try {
      const { externalDeliveryId, counterpartyId, restaurantId, vendorMasterId, deliveryDate, amountEarned, rawData } = req.body;
      if (!counterpartyId || !vendorMasterId || !deliveryDate) {
        return res.status(400).json({ message: "counterpartyId, vendorMasterId, deliveryDate required" });
      }
      const user = req.currentUser!;
      if (user.role === "counterparty" && user.counterpartyId !== counterpartyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const record = await storage.createDeliveryRecord({
        externalDeliveryId: externalDeliveryId || null,
        counterpartyId,
        restaurantId: restaurantId || null,
        vendorMasterId,
        deliveryDate,
        amountEarned: amountEarned ? String(amountEarned) : null,
        status: "OUTSTANDING",
        rawData: rawData || null,
      });
      return res.json(record);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/delivery-records/bulk", requireAuth, requireRole("admin", "counterparty"), async (req: Request, res: Response) => {
    try {
      const { records } = req.body;
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ message: "records array required" });
      }
      const user = req.currentUser!;
      const created = [];
      for (const r of records) {
        if (user.role === "counterparty" && user.counterpartyId !== r.counterpartyId) {
          continue;
        }
        const record = await storage.createDeliveryRecord({
          externalDeliveryId: r.externalDeliveryId || null,
          counterpartyId: r.counterpartyId,
          restaurantId: r.restaurantId || null,
          vendorMasterId: r.vendorMasterId,
          deliveryDate: r.deliveryDate,
          amountEarned: r.amountEarned ? String(r.amountEarned) : null,
          status: "OUTSTANDING",
          rawData: r.rawData || null,
        });
        created.push(record);
      }
      return res.json({ created: created.length, records: created });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Cashouts ─────
  app.get("/api/cashouts", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      let cashoutList;
      if (user.role === "vendor" && user.vendorMasterId) {
        cashoutList = await storage.getCashoutsByVendorMaster(user.vendorMasterId);
      } else if (user.role === "counterparty" && user.counterpartyId) {
        cashoutList = await storage.getCashoutsByCounterparty(user.counterpartyId);
      } else if (user.role === "admin") {
        cashoutList = await storage.getCashouts();
      } else {
        return res.json([]);
      }
      const enriched = [];
      for (const c of cashoutList) {
        const vm = await storage.getVendorMaster(c.vendorMasterId);
        const allocations = await storage.getCashoutAllocationsByCashout(c.id);
        enriched.push({
          ...c,
          vendorName: vm?.legalName || "Unknown",
          vendorCrn: vm?.crn || "",
          allocationsCount: allocations.length,
        });
      }
      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/cashouts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const cashout = await storage.getCashout(req.params.id);
      if (!cashout) return res.status(404).json({ message: "Cashout not found" });
      const user = req.currentUser!;
      if (user.role === "vendor" && user.vendorMasterId !== cashout.vendorMasterId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const vm = await storage.getVendorMaster(cashout.vendorMasterId);
      const allocations = await storage.getCashoutAllocationsByCashout(cashout.id);
      const deliveries = await storage.getCashoutDeliveriesByCashout(cashout.id);
      const deliveryIds = deliveries.map(d => d.deliveryRecordId);
      const deliveryRecords = deliveryIds.length > 0 ? await storage.getDeliveryRecordsByIds(deliveryIds) : [];

      const enrichedAllocations = [];
      for (const a of allocations) {
        const cp = await storage.getCounterparty(a.counterpartyId);
        enrichedAllocations.push({
          ...a,
          counterpartyName: cp?.name || "Unknown",
        });
      }

      return res.json({
        ...cashout,
        vendorName: vm?.legalName || "Unknown",
        vendorCrn: vm?.crn || "",
        allocations: enrichedAllocations,
        deliveryRecords,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cashouts", requireAuth, requireRole("admin", "vendor"), async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      const { deliveryRecordIds } = req.body;

      if (!Array.isArray(deliveryRecordIds) || deliveryRecordIds.length === 0) {
        return res.status(400).json({ message: "deliveryRecordIds array required" });
      }

      const deliveries = await storage.getDeliveryRecordsByIds(deliveryRecordIds);
      if (deliveries.length !== deliveryRecordIds.length) {
        return res.status(400).json({ message: "Some delivery records not found" });
      }

      const nonOutstanding = deliveries.filter(d => d.status !== "OUTSTANDING");
      if (nonOutstanding.length > 0) {
        return res.status(400).json({ message: "All deliveries must be OUTSTANDING" });
      }

      const vendorMasterId = deliveries[0].vendorMasterId;
      const allSameVendor = deliveries.every(d => d.vendorMasterId === vendorMasterId);
      if (!allSameVendor) {
        return res.status(400).json({ message: "All deliveries must belong to the same vendor" });
      }

      if (user.role === "vendor" && user.vendorMasterId !== vendorMasterId) {
        return res.status(403).json({ message: "Forbidden: deliveries don't belong to your vendor" });
      }

      const deliveryCount = deliveries.length;
      const cashoutAmount = deliveries.reduce((sum, d) => sum + Number(d.amountEarned || 0), 0);

      const tier = await storage.getActivePricingTier(vendorMasterId, deliveryCount);
      const schedules = await storage.getVendorPricingSchedulesByVendorMaster(vendorMasterId);
      const latestSchedule = schedules.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
      const floorRate = latestSchedule ? Number(latestSchedule.floorSarPerDelivery) : 2.5;
      const sarPerDelivery = tier ? Math.max(Number(tier.sarPerDelivery), floorRate) : floorRate;

      const feeTotal = sarPerDelivery * deliveryCount;
      const netPaidToVendor = cashoutAmount - feeTotal;

      if (netPaidToVendor <= 0) {
        return res.status(400).json({ message: "Fee exceeds cashout amount - insufficient delivery value" });
      }

      const cashout = await storage.createCashout({
        vendorMasterId,
        cashoutAmount: String(cashoutAmount.toFixed(2)),
        deliveriesCount: deliveryCount,
        sarPerDeliveryApplied: String(sarPerDelivery.toFixed(4)),
        feeTotal: String(feeTotal.toFixed(2)),
        netPaidToVendor: String(netPaidToVendor.toFixed(2)),
        status: "REQUESTED",
        pricingPeriodStart: null,
        pricingPeriodEnd: null,
        paymentReference: null,
        paymentMethod: null,
      });

      for (const d of deliveries) {
        await storage.createCashoutDelivery({
          cashoutId: cashout.id,
          deliveryRecordId: d.id,
        });
      }

      await storage.updateDeliveryRecordStatusBatch(deliveryRecordIds, "IN_CASHOUT");

      const counterpartyGroups = new Map<string, typeof deliveries>();
      for (const d of deliveries) {
        const arr = counterpartyGroups.get(d.counterpartyId) || [];
        arr.push(d);
        counterpartyGroups.set(d.counterpartyId, arr);
      }

      for (const [cpId, cpDeliveries] of counterpartyGroups) {
        const cpDeliveryCount = cpDeliveries.length;
        const cpCashoutPortion = cpDeliveries.reduce((sum, d) => sum + Number(d.amountEarned || 0), 0);
        const cpFeePortion = sarPerDelivery * cpDeliveryCount;
        const cpTotalPayable = cpCashoutPortion;

        await storage.createCashoutAllocation({
          cashoutId: cashout.id,
          counterpartyId: cpId,
          deliveriesCount: cpDeliveryCount,
          cashoutAmountPortion: String(cpCashoutPortion.toFixed(2)),
          feePortion: String(cpFeePortion.toFixed(2)),
          totalPayableToUs: String(cpTotalPayable.toFixed(2)),
          expectedPayDate: null,
        });
      }

      const vm = await storage.getVendorMaster(vendorMasterId);
      return res.json({
        ...cashout,
        vendorName: vm?.legalName || "Unknown",
        vendorCrn: vm?.crn || "",
        allocationsCount: counterpartyGroups.size,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Cashout Status Transitions ─────
  app.post("/api/cashouts/:id/counterparty-approve", requireAuth, requireRole("counterparty"), async (req: Request, res: Response) => {
    try {
      const cashout = await storage.getCashout(req.params.id);
      if (!cashout) return res.status(404).json({ message: "Cashout not found" });
      if (cashout.status !== "REQUESTED") {
        return res.status(400).json({ message: "Cashout must be in REQUESTED status" });
      }
      const user = req.currentUser!;
      const allocations = await storage.getCashoutAllocationsByCashout(cashout.id);
      const hasAllocation = allocations.some(a => a.counterpartyId === user.counterpartyId);
      if (!hasAllocation) {
        return res.status(403).json({ message: "Forbidden: no allocation for your counterparty" });
      }
      await storage.updateCashoutStatus(cashout.id, "COUNTERPARTY_APPROVED");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cashouts/:id/counterparty-reject", requireAuth, requireRole("counterparty"), async (req: Request, res: Response) => {
    try {
      const cashout = await storage.getCashout(req.params.id);
      if (!cashout) return res.status(404).json({ message: "Cashout not found" });
      if (cashout.status !== "REQUESTED") {
        return res.status(400).json({ message: "Cashout must be in REQUESTED status" });
      }
      const user = req.currentUser!;
      const allocations = await storage.getCashoutAllocationsByCashout(cashout.id);
      const hasAllocation = allocations.some(a => a.counterpartyId === user.counterpartyId);
      if (!hasAllocation) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.updateCashoutStatus(cashout.id, "REJECTED");
      const deliveryCDs = await storage.getCashoutDeliveriesByCashout(cashout.id);
      const drIds = deliveryCDs.map(cd => cd.deliveryRecordId);
      await storage.updateDeliveryRecordStatusBatch(drIds, "OUTSTANDING");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cashouts/:id/admin-approve", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const cashout = await storage.getCashout(req.params.id);
      if (!cashout) return res.status(404).json({ message: "Cashout not found" });
      if (cashout.status !== "REQUESTED" && cashout.status !== "COUNTERPARTY_APPROVED") {
        return res.status(400).json({ message: "Cashout must be REQUESTED or COUNTERPARTY_APPROVED" });
      }
      await storage.updateCashoutStatus(cashout.id, "ADMIN_APPROVED");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cashouts/:id/admin-reject", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const cashout = await storage.getCashout(req.params.id);
      if (!cashout) return res.status(404).json({ message: "Cashout not found" });
      if (cashout.status === "PAID_OUT" || cashout.status === "SETTLED") {
        return res.status(400).json({ message: "Cannot reject after payout" });
      }
      await storage.updateCashoutStatus(cashout.id, "REJECTED");
      const deliveryCDs = await storage.getCashoutDeliveriesByCashout(cashout.id);
      const drIds = deliveryCDs.map(cd => cd.deliveryRecordId);
      await storage.updateDeliveryRecordStatusBatch(drIds, "OUTSTANDING");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cashouts/:id/mark-payout", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const cashout = await storage.getCashout(req.params.id);
      if (!cashout) return res.status(404).json({ message: "Cashout not found" });
      if (cashout.status !== "ADMIN_APPROVED") {
        return res.status(400).json({ message: "Cashout must be ADMIN_APPROVED" });
      }
      const { paymentReference, paymentMethod } = req.body;
      await storage.updateCashoutStatus(cashout.id, "PAID_OUT", {
        paymentReference: paymentReference || null,
        paymentMethod: paymentMethod || null,
      });
      await storage.createLedgerEntry({
        cashoutId: cashout.id,
        type: "payout",
        amount: cashout.netPaidToVendor,
        date: new Date().toISOString().split("T")[0],
        method: paymentMethod || null,
        reference: paymentReference || null,
        notes: null,
      });

      const allocations = await storage.getCashoutAllocationsByCashout(cashout.id);
      for (const alloc of allocations) {
        const cp = await storage.getCounterparty(alloc.counterpartyId);
        if (cp) {
          await storage.createNotificationAttempt({
            cashoutId: cashout.id,
            counterpartyId: cp.id,
            channel: cp.webhookUrl ? "webhook" : "email",
            status: "pending",
            retries: 0,
            responseCode: null,
            lastAttemptAt: null,
            payload: {
              cashoutId: cashout.id,
              counterpartyId: cp.id,
              deliveriesCount: alloc.deliveriesCount,
              totalPayable: alloc.totalPayableToUs,
            },
          });
        }
      }

      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cashouts/:id/mark-settled", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const cashout = await storage.getCashout(req.params.id);
      if (!cashout) return res.status(404).json({ message: "Cashout not found" });
      if (cashout.status !== "PAID_OUT") {
        return res.status(400).json({ message: "Cashout must be PAID_OUT first" });
      }
      await storage.updateCashoutStatus(cashout.id, "SETTLED");
      const deliveryCDs = await storage.getCashoutDeliveriesByCashout(cashout.id);
      const drIds = deliveryCDs.map(cd => cd.deliveryRecordId);
      await storage.updateDeliveryRecordStatusBatch(drIds, "SETTLED");

      const { amount, method, reference } = req.body;
      await storage.createLedgerEntry({
        cashoutId: cashout.id,
        type: "settlement",
        amount: amount || cashout.cashoutAmount,
        date: new Date().toISOString().split("T")[0],
        method: method || null,
        reference: reference || null,
        notes: null,
      });

      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Pricing estimate for vendor ─────
  app.get("/api/pricing-estimate", requireAuth, async (req: Request, res: Response) => {
    try {
      const { vendorMasterId, deliveryCount } = req.query;
      if (!vendorMasterId || !deliveryCount) {
        return res.status(400).json({ message: "vendorMasterId and deliveryCount required" });
      }
      const count = Number(deliveryCount);
      const tier = await storage.getActivePricingTier(vendorMasterId as string, count);
      const schedules = await storage.getVendorPricingSchedulesByVendorMaster(vendorMasterId as string);
      const latestSchedule = schedules.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
      const floorRate = latestSchedule ? Number(latestSchedule.floorSarPerDelivery) : 2.5;
      const sarPerDelivery = tier ? Math.max(Number(tier.sarPerDelivery), floorRate) : floorRate;
      const totalFee = sarPerDelivery * count;
      return res.json({
        sarPerDelivery: sarPerDelivery.toFixed(4),
        totalFee: totalFee.toFixed(2),
        deliveryCount: count,
        tierLabel: tier ? `${tier.fromDeliveries}-${tier.toDeliveries ?? '∞'}` : "default",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Ledger (admin) ─────
  app.get("/api/admin/ledger", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const entries = await storage.getLedgerEntries();
      const enriched = [];
      for (const entry of entries) {
        let vendorName = "Unknown";
        let cashoutStatus = "unknown";
        if (entry.cashoutId) {
          const cashout = await storage.getCashout(entry.cashoutId);
          if (cashout) {
            cashoutStatus = cashout.status;
            const vm = await storage.getVendorMaster(cashout.vendorMasterId);
            vendorName = vm?.legalName || "Unknown";
          }
        }
        enriched.push({
          ...entry,
          vendorName,
          cashoutStatus,
        });
      }
      return res.json({ entries: enriched });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/ledger", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { cashoutId, type, amount, date, method, reference } = req.body;
      if (!cashoutId || !type || !amount || !date) {
        return res.status(400).json({ message: "Missing data" });
      }
      const entry = await storage.createLedgerEntry({
        cashoutId,
        type,
        amount: String(amount),
        date,
        method: method || null,
        reference: reference || null,
        notes: null,
      });
      return res.json(entry);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Notifications (admin) ─────
  app.get("/api/notifications/:cashoutId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const attempts = await storage.getNotificationAttemptsByCashout(req.params.cashoutId);
      return res.json(attempts);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── Counterparty settlement (financing view for counterparty) ─────
  app.get("/api/settlements", requireAuth, requireRole("counterparty"), async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      if (!user.counterpartyId) return res.json([]);
      const cashoutList = await storage.getCashoutsByCounterparty(user.counterpartyId);
      const financed = cashoutList.filter(c => ["PAID_OUT", "SETTLED"].includes(c.status));
      const result = [];
      for (const c of financed) {
        const vm = await storage.getVendorMaster(c.vendorMasterId);
        const allocations = await storage.getCashoutAllocationsByCashout(c.id);
        const myAlloc = allocations.find(a => a.counterpartyId === user.counterpartyId);
        result.push({
          id: c.id,
          vendorName: vm?.legalName || "Unknown",
          vendorCrn: vm?.crn || "",
          cashoutAmount: c.cashoutAmount,
          feeTotal: c.feeTotal,
          netPaidToVendor: c.netPaidToVendor,
          myPortion: myAlloc?.cashoutAmountPortion || "0",
          myFee: myAlloc?.feePortion || "0",
          myTotalPayable: myAlloc?.totalPayableToUs || "0",
          status: c.status,
          paidOutAt: c.paidOutAt,
          createdAt: c.createdAt,
        });
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ───── File uploads serve ─────
  app.use("/uploads", requireAuth, (req: Request, res: Response, next: any) => {
    const filePath = path.join(uploadsDir, req.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
    return res.sendFile(filePath);
  });

  return httpServer;
}
