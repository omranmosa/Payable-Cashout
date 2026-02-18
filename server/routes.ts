import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { checkEligibility } from "./eligibility";
import { generateAssignmentNoticePdf } from "./pdf";
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

  // Auth routes
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
      const user = await storage.createUser({ name, email, password: hashed, role: "restaurant" });
      req.session.userId = user.id;
      return res.json({ id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId, vendorId: user.vendorId });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      return res.json({ id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId, vendorId: user.vendorId });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    return res.json({ id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId, vendorId: user.vendorId });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {});
    return res.json({ ok: true });
  });

  // Dashboard - admin and restaurant only
  app.get("/api/dashboard", requireAuth, requireRole("admin", "restaurant"), async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      const stats = await storage.getDashboardStats(user.role === "restaurant" ? user.restaurantId || undefined : undefined);
      const allOffers = user.role === "restaurant" && user.restaurantId
        ? await storage.getOffersByRestaurant(user.restaurantId)
        : await storage.getOffers();
      const recentOffers = [];
      for (const o of allOffers.slice(0, 5)) {
        const vendor = await storage.getVendor(o.vendorId);
        recentOffers.push({
          id: o.id,
          vendorName: vendor?.name || "Unknown",
          advanceAmount: o.advanceAmount,
          status: o.status,
          createdAt: o.createdAt,
        });
      }
      return res.json({ ...stats, recentOffers });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Vendor dashboard
  app.get("/api/vendor/dashboard", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      if (!user.vendorId) {
        return res.json({ totalAssigned: 0, eligibleCashout: 0, estimatedFee: 0, netCashout: 0, pendingCashouts: 0, paidOut: 0, invoiceCount: 0, recentCashouts: [] });
      }
      const vendorOffers = await storage.getOffersByVendor(user.vendorId);
      const invs = await storage.getInvoices(user.vendorId);
      const rates = await storage.getFeeRates();

      const totalAssigned = invs.reduce((s, i) => s + Number(i.amountRemaining), 0);
      const eligibleInvs = invs.filter(i => i.isEligible);
      const eligibleCashout = eligibleInvs.reduce((s, i) => s + Number(i.amountRemaining), 0);

      let estimatedFee = 0;
      for (const inv of eligibleInvs) {
        const daysTodue = Math.max(0, Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        const matchingRate = rates.find(r => daysTodue >= r.minDays && daysTodue <= r.maxDays);
        const rate = matchingRate ? Number(matchingRate.ratePer30d) : 0.015;
        const amt = Number(inv.amountRemaining);
        estimatedFee += amt * rate * (daysTodue / 30);
      }

      const netCashout = eligibleCashout - estimatedFee;
      const pendingCashouts = vendorOffers.filter(o => ["draft", "vendor_accepted"].includes(o.status)).length;
      const paidOut = vendorOffers
        .filter(o => ["payout_sent", "repaid", "closed"].includes(o.status))
        .reduce((s, o) => s + Number(o.advanceAmount), 0);

      const recentCashouts = [];
      for (const o of vendorOffers.slice(0, 5)) {
        const restaurant = await storage.getRestaurant(o.restaurantId);
        recentCashouts.push({
          id: o.id,
          restaurantName: restaurant?.name || "Unknown",
          advanceAmount: o.advanceAmount,
          feeAmount: o.feeAmount,
          netPayout: String((Number(o.advanceAmount) - Number(o.feeAmount)).toFixed(2)),
          status: o.status,
          createdAt: o.createdAt,
        });
      }

      return res.json({
        totalAssigned,
        eligibleCashout,
        estimatedFee: Number(estimatedFee.toFixed(2)),
        netCashout: Number(netCashout.toFixed(2)),
        pendingCashouts,
        paidOut,
        invoiceCount: invs.length,
        recentCashouts,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Restaurants
  app.get("/api/restaurants", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      if (user.role === "restaurant" && user.restaurantId) {
        const r = await storage.getRestaurant(user.restaurantId);
        return res.json(r ? [r] : []);
      }
      const rests = await storage.getRestaurants();
      return res.json(rests);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/restaurants", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { name, defaultRatePer30d, bankName, bankAccountNumber, bankRoutingNumber, bankAccountName } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const restaurant = await storage.createRestaurant({
        name,
        defaultRatePer30d: defaultRatePer30d || "0.015",
        bankName: bankName || null,
        bankAccountNumber: bankAccountNumber || null,
        bankRoutingNumber: bankRoutingNumber || null,
        bankAccountName: bankAccountName || null,
      });
      return res.json(restaurant);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Vendors
  app.get("/api/vendors", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const allVendors = await storage.getAllVendors();
      const result = [];
      for (const v of allVendors) {
        const restaurant = await storage.getRestaurant(v.restaurantId);
        result.push({
          ...v,
          restaurantName: restaurant?.name || "Unknown",
        });
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/vendors", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { name, restaurantId } = req.body;
      if (!name || !restaurantId) return res.status(400).json({ message: "Name and restaurant are required" });
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) return res.status(400).json({ message: "Restaurant not found" });
      const vendor = await storage.createVendor({ name, restaurantId });
      return res.json(vendor);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/restaurants/:id/vendors", requireAuth, requireRole("admin", "restaurant"), async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      let actualId = req.params.id as string;
      if (actualId === "default") {
        if (user.role === "restaurant" && user.restaurantId) {
          actualId = user.restaurantId;
        } else {
          const rests = await storage.getRestaurants();
          if (rests.length === 0) return res.json([]);
          actualId = rests[0].id;
        }
      }
      if (user.role === "restaurant" && user.restaurantId && actualId !== user.restaurantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const vdrs = await storage.getVendors(actualId);
      const result = [];
      for (const v of vdrs) {
        const invs = await storage.getInvoices(v.id);
        result.push({
          id: v.id,
          name: v.name,
          invoiceCount: invs.length,
          eligibleCount: invs.filter((i) => i.isEligible).length,
          totalAmount: invs.reduce((s, i) => s + Number(i.amountRemaining), 0),
        });
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/vendors/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const vendor = await storage.getVendor(req.params.id as string);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });
      const user = req.currentUser!;
      if (user.role === "vendor" && user.vendorId !== vendor.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role === "restaurant" && user.restaurantId && vendor.restaurantId !== user.restaurantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      return res.json(vendor);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/vendors/:id/invoices", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      const vendor = await storage.getVendor(req.params.id as string);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });
      if (user.role === "vendor" && user.vendorId !== vendor.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role === "restaurant" && user.restaurantId && vendor.restaurantId !== user.restaurantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const invs = await storage.getInvoices(req.params.id as string);
      return res.json(invs);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // CSV Upload - admin and restaurant only
  app.post("/api/invoices/upload", requireAuth, requireRole("admin", "restaurant"), async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      let { restaurantId, mapping, rows } = req.body;
      if (!restaurantId || !mapping || !rows) {
        return res.status(400).json({ message: "Missing data" });
      }

      if (restaurantId === "default" || !restaurantId) {
        if (user.role === "restaurant" && user.restaurantId) {
          restaurantId = user.restaurantId;
        } else {
          const rests = await storage.getRestaurants();
          if (rests.length === 0) {
            return res.status(400).json({ message: "No restaurant configured" });
          }
          restaurantId = rests[0].id;
        }
      }

      if (user.role === "restaurant" && user.restaurantId && restaurantId !== user.restaurantId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      let count = 0;
      for (const row of rows) {
        const vendorName = row[mapping.vendor_name] || "Unknown Vendor";
        const vendor = await storage.getOrCreateVendor(restaurantId, vendorName);

        const invoiceNumber = row[mapping.invoice_number] || "";
        const dueDate = row[mapping.due_date] || "";
        const amountRemaining = row[mapping.amount_remaining] || "0";
        const status = mapping.status ? row[mapping.status] || null : null;
        const holdFlagRaw = mapping.hold_flag ? row[mapping.hold_flag] : null;
        const holdFlag =
          holdFlagRaw === true ||
          holdFlagRaw === "true" ||
          holdFlagRaw === "1" ||
          holdFlagRaw === "yes";

        const parsedAmount = parseFloat(
          String(amountRemaining).replace(/[,$]/g, "")
        );

        let parsedDate = dueDate;
        try {
          const d = new Date(dueDate);
          if (!isNaN(d.getTime())) {
            parsedDate = d.toISOString().split("T")[0];
          } else {
            parsedDate = new Date().toISOString().split("T")[0];
          }
        } catch {
          parsedDate = new Date().toISOString().split("T")[0];
        }

        const eligible = checkEligibility({
          amountRemaining: parsedAmount,
          dueDate: parsedDate,
          status,
          holdFlag,
        });

        await storage.createInvoice({
          restaurantId,
          vendorId: vendor.id,
          invoiceNumber,
          dueDate: parsedDate,
          amountRemaining: String(parsedAmount),
          status,
          holdFlag,
          rawData: row,
          isEligible: eligible,
        });

        count++;
      }

      return res.json({ count });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Offers
  app.get("/api/offers", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      if (user.role === "restaurant") {
        return res.status(403).json({ message: "Restaurant users do not have access to offers" });
      }
      let allOffers;
      if (user.role === "vendor" && user.vendorId) {
        allOffers = await storage.getOffersByVendor(user.vendorId);
      } else {
        allOffers = await storage.getOffers();
      }
      const result = [];
      for (const o of allOffers) {
        const vendor = await storage.getVendor(o.vendorId);
        const restaurant = await storage.getRestaurant(o.restaurantId);
        result.push({
          id: o.id,
          vendorName: vendor?.name || "Unknown",
          restaurantName: restaurant?.name || "Unknown",
          advanceAmount: o.advanceAmount,
          feeAmount: o.feeAmount,
          status: o.status,
          createdAt: o.createdAt,
        });
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/offers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id as string);
      if (!offer) return res.status(404).json({ message: "Offer not found" });

      const user = req.currentUser!;
      if (user.role === "restaurant" && user.restaurantId && offer.restaurantId !== user.restaurantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role === "vendor" && user.vendorId && offer.vendorId !== user.vendorId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const vendor = await storage.getVendor(offer.vendorId);
      const restaurant = await storage.getRestaurant(offer.restaurantId);
      const assignments = await storage.getOfferAssignments(offer.id);

      const assignmentDetails = [];
      for (const a of assignments) {
        const inv = await storage.getInvoice(a.invoiceId);
        assignmentDetails.push({
          invoiceNumber: inv?.invoiceNumber || "",
          assignedAmount: a.assignedAmount,
          dueDate: inv?.dueDate || "",
        });
      }

      return res.json({
        ...offer,
        restaurantName: restaurant?.name || "Unknown",
        vendorName: vendor?.name || "Unknown",
        assignments: assignmentDetails,
        restaurant: {
          bankName: restaurant?.bankName,
          bankAccountNumber: restaurant?.bankAccountNumber,
          bankRoutingNumber: restaurant?.bankRoutingNumber,
          bankAccountName: restaurant?.bankAccountName,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/offers", requireAuth, requireRole("admin", "vendor"), async (req: Request, res: Response) => {
    try {
      const { restaurantId, vendorId, invoiceIds, advanceAmount } = req.body;
      if (!restaurantId || !vendorId || !invoiceIds?.length || !advanceAmount) {
        return res.status(400).json({ message: "Missing data" });
      }

      const user = req.currentUser!;
      if (user.role === "vendor" && user.vendorId && vendorId !== user.vendorId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const vendor = await storage.getVendor(vendorId);
      if (!vendor) return res.status(400).json({ message: "Vendor not found" });
      if (vendor.restaurantId !== restaurantId) {
        return res.status(400).json({ message: "Restaurant/vendor mismatch" });
      }

      const selectedInvoices = await storage.getInvoicesByIds(invoiceIds);
      const allBelongToVendor = selectedInvoices.every(i => i.vendorId === vendorId);
      if (!allBelongToVendor) {
        return res.status(400).json({ message: "Some invoices do not belong to the selected vendor" });
      }
      const eligible = selectedInvoices.filter((i) => i.isEligible);
      if (eligible.length === 0) {
        return res.status(400).json({ message: "No eligible invoices" });
      }

      const totalEligible = eligible.reduce(
        (s, i) => s + Number(i.amountRemaining),
        0
      );
      if (advanceAmount > totalEligible) {
        return res
          .status(400)
          .json({ message: "Advance exceeds eligible total" });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      const allRates = await storage.getFeeRates();
      const fallbackRate = Number(restaurant?.defaultRatePer30d || "0.015");

      let totalWeightedAmount = 0;
      let weightedDaysSum = 0;
      let feeAmount = 0;

      for (const inv of eligible) {
        const daysTodue = Math.max(
          0,
          Math.ceil(
            (new Date(inv.dueDate).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        );
        const amt = Number(inv.amountRemaining);
        totalWeightedAmount += amt;
        weightedDaysSum += amt * daysTodue;
        const matchingRate = allRates.find(r => daysTodue >= r.minDays && daysTodue <= r.maxDays);
        const rate = matchingRate ? Number(matchingRate.ratePer30d) : fallbackRate;
        feeAmount += amt * rate * (daysTodue / 30);
      }

      const weightedDays =
        totalWeightedAmount > 0
          ? weightedDaysSum / totalWeightedAmount
          : 0;

      const proportion = advanceAmount / totalWeightedAmount;
      feeAmount = feeAmount * proportion;
      const totalRepayment = advanceAmount + feeAmount;

      const maxDueDate = eligible.reduce((max, inv) => {
        const d = new Date(inv.dueDate);
        return d > max ? d : max;
      }, new Date(eligible[0].dueDate));

      const offer = await storage.createOffer({
        restaurantId,
        vendorId,
        advanceAmount: String(advanceAmount),
        feeAmount: String(feeAmount.toFixed(2)),
        totalRepayment: String(totalRepayment.toFixed(2)),
        weightedDays: String(weightedDays.toFixed(2)),
        status: "draft",
        repaymentDate: maxDueDate.toISOString().split("T")[0],
      });

      let remaining = advanceAmount;
      for (const inv of eligible) {
        const amt = Math.min(remaining, Number(inv.amountRemaining));
        if (amt <= 0) break;
        await storage.createOfferAssignment({
          offerId: offer.id,
          invoiceId: inv.id,
          assignedAmount: String(amt.toFixed(2)),
        });
        remaining -= amt;
      }

      return res.json(offer);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/offers/:id/vendor-accept", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id as string);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      const user = req.currentUser!;
      if (user.vendorId !== offer.vendorId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (offer.status !== "draft") {
        return res.status(400).json({ message: "Offer is not in draft status" });
      }
      await storage.updateOfferStatus(offer.id, "vendor_accepted", new Date());
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/offers/:id/vendor-reject", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id as string);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      const user = req.currentUser!;
      if (user.vendorId !== offer.vendorId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (offer.status !== "draft") {
        return res.status(400).json({ message: "Offer is not in draft status" });
      }
      await storage.updateOfferStatus(offer.id, "vendor_rejected");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/offers/:id/restaurant-approve", requireAuth, requireRole("admin", "restaurant"), async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id as string);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      const user = req.currentUser!;
      if (user.role === "restaurant" && user.restaurantId && offer.restaurantId !== user.restaurantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (offer.status !== "vendor_accepted") {
        return res.status(400).json({ message: "Offer must be vendor-accepted first" });
      }
      await storage.updateOfferStatus(offer.id, "restaurant_approved");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/offers/:id/restaurant-reject", requireAuth, requireRole("admin", "restaurant"), async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id as string);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      const user = req.currentUser!;
      if (user.role === "restaurant" && user.restaurantId && offer.restaurantId !== user.restaurantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (offer.status !== "vendor_accepted") {
        return res.status(400).json({ message: "Offer must be vendor-accepted first" });
      }
      await storage.updateOfferStatus(offer.id, "vendor_rejected");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/offers/:id/mark-payout", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id as string);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      if (offer.status !== "restaurant_approved") {
        return res.status(400).json({ message: "Offer must be restaurant-approved first" });
      }
      await storage.updateOfferStatus(offer.id, "payout_sent");
      await storage.createLedgerEntry({
        offerId: offer.id,
        type: "payout",
        amount: offer.advanceAmount,
        date: new Date().toISOString().split("T")[0],
        method: req.body?.method || null,
        reference: req.body?.reference || null,
        notes: req.body?.notes || null,
      });
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/offers/:id/mark-repaid", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id as string);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      if (offer.status !== "payout_sent") {
        return res.status(400).json({ message: "Payout must be sent first" });
      }
      await storage.updateOfferStatus(offer.id, "repaid");
      await storage.createLedgerEntry({
        offerId: offer.id,
        type: "repayment",
        amount: offer.totalRepayment,
        date: new Date().toISOString().split("T")[0],
        method: req.body?.method || null,
        reference: req.body?.reference || null,
        notes: req.body?.notes || null,
      });
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Restaurant Financing - shows financed items with split
  app.get("/api/financing", requireAuth, requireRole("restaurant"), async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      if (!user.restaurantId) return res.json([]);
      const allOffers = await storage.getOffersByRestaurant(user.restaurantId);
      const financed = allOffers.filter(o => ["payout_sent", "repaid", "closed"].includes(o.status));
      const result = [];
      for (const o of financed) {
        const vendor = await storage.getVendor(o.vendorId);
        const ledger = await storage.getLedgerEntriesByOffer(o.id);
        const repayments = ledger.filter(e => e.type === "repayment");
        const totalRepaid = repayments.reduce((s, e) => s + Number(e.amount), 0);
        result.push({
          id: o.id,
          vendorName: vendor?.name || "Unknown",
          advanceAmount: o.advanceAmount,
          feeAmount: o.feeAmount,
          totalRepayment: o.totalRepayment,
          totalRepaid: String(totalRepaid.toFixed(2)),
          repaymentDate: o.repaymentDate,
          status: o.status,
          createdAt: o.createdAt,
        });
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.use("/uploads", requireAuth, (req: Request, res: Response, next: any) => {
    const filePath = path.join(uploadsDir, req.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
    return res.sendFile(filePath);
  });

  // Restaurant repayment upload
  app.post("/api/financing/:offerId/repayment", requireAuth, requireRole("restaurant"), upload.single("file"), async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      const offer = await storage.getOffer(req.params.offerId as string);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      if (user.restaurantId && offer.restaurantId !== user.restaurantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (offer.status !== "payout_sent") {
        return res.status(400).json({ message: "Offer is not awaiting repayment" });
      }
      const { amount, reference, method } = req.body || {};
      if (!amount) {
        return res.status(400).json({ message: "Amount is required" });
      }
      const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
      await storage.createLedgerEntry({
        offerId: offer.id,
        type: "repayment",
        amount: String(Number(amount).toFixed(2)),
        date: new Date().toISOString().split("T")[0],
        method: method || "bank_transfer",
        reference: reference || null,
        notes: `Submitted by restaurant`,
        fileUrl,
      });
      await storage.updateOfferStatus(offer.id, "repaid");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Fee Rates - admin only
  app.get("/api/fee-rates", requireAuth, async (_req: Request, res: Response) => {
    try {
      const rates = await storage.getFeeRates();
      return res.json(rates);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/fee-rates", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { label, minDays, maxDays, ratePer30d } = req.body;
      if (!label || minDays === undefined || maxDays === undefined || !ratePer30d) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const rate = await storage.createFeeRate({
        label,
        minDays: Number(minDays),
        maxDays: Number(maxDays),
        ratePer30d: String(ratePer30d),
      });
      return res.json(rate);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/fee-rates/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { label, minDays, maxDays, ratePer30d } = req.body;
      const updates: any = {};
      if (label !== undefined) updates.label = label;
      if (minDays !== undefined) updates.minDays = Number(minDays);
      if (maxDays !== undefined) updates.maxDays = Number(maxDays);
      if (ratePer30d !== undefined) updates.ratePer30d = String(ratePer30d);
      const rate = await storage.updateFeeRate(req.params.id as string, updates);
      return res.json(rate);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/fee-rates/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await storage.deleteFeeRate(req.params.id as string);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // PDF generation
  app.get("/api/offers/:id/pdf", requireAuth, async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id as string);
      if (!offer) return res.status(404).json({ message: "Offer not found" });

      const user = req.currentUser!;
      if (user.role === "restaurant" && user.restaurantId && offer.restaurantId !== user.restaurantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role === "vendor" && user.vendorId && offer.vendorId !== user.vendorId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const vendor = await storage.getVendor(offer.vendorId);
      const restaurant = await storage.getRestaurant(offer.restaurantId);
      const assignments = await storage.getOfferAssignments(offer.id);

      const assignmentDetails = [];
      for (const a of assignments) {
        const inv = await storage.getInvoice(a.invoiceId);
        assignmentDetails.push({
          invoiceNumber: inv?.invoiceNumber || "",
          assignedAmount: a.assignedAmount,
          dueDate: inv?.dueDate || "",
        });
      }

      const pdfBuffer = await generateAssignmentNoticePdf({
        restaurantName: restaurant?.name || "Unknown",
        vendorName: vendor?.name || "Unknown",
        assignments: assignmentDetails,
        advanceAmount: offer.advanceAmount,
        feeAmount: offer.feeAmount,
        totalRepayment: offer.totalRepayment,
        repaymentDate: offer.repaymentDate,
        bank: {
          bankName: restaurant?.bankName || null,
          bankAccountNumber: restaurant?.bankAccountNumber || null,
          bankRoutingNumber: restaurant?.bankRoutingNumber || null,
          bankAccountName: restaurant?.bankAccountName || null,
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="assignment-notice-${offer.id.slice(0, 8)}.pdf"`
      );
      return res.send(pdfBuffer);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Ledger - admin only
  app.get("/api/admin/ledger", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const entries = await storage.getLedgerEntries();
      const allOffers = await storage.getOffers();
      const allLedger = await storage.getLedgerEntries();

      const enriched = [];
      for (const entry of entries) {
        const offer = await storage.getOffer(entry.offerId);
        const vendor = offer ? await storage.getVendor(offer.vendorId) : null;

        const repayments = allLedger
          .filter((e) => e.offerId === entry.offerId && e.type === "repayment")
          .reduce((s, e) => s + Number(e.amount), 0);

        const isOverdue =
          offer?.status === "accepted" &&
          offer?.repaymentDate &&
          new Date(offer.repaymentDate) < new Date() &&
          Number(offer.totalRepayment) > repayments;

        enriched.push({
          ...entry,
          vendorName: vendor?.name || "Unknown",
          offerStatus: offer?.status || "unknown",
          totalRepayment: offer?.totalRepayment || "0",
          totalPaid: String(repayments),
          isOverdue: !!isOverdue,
        });
      }

      const offersList = [];
      for (const o of allOffers) {
        const v = await storage.getVendor(o.vendorId);
        offersList.push({
          id: o.id,
          vendorName: v?.name || "Unknown",
          status: o.status,
        });
      }

      return res.json({ entries: enriched, offers: offersList });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/ledger", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { offerId, type, amount, date, method, reference } = req.body;
      if (!offerId || !type || !amount || !date) {
        return res.status(400).json({ message: "Missing data" });
      }
      const entry = await storage.createLedgerEntry({
        offerId,
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

  return httpServer;
}
