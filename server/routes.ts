import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { checkEligibility } from "./eligibility";
import { generateAssignmentNoticePdf } from "./pdf";
import bcrypt from "bcryptjs";
import session from "express-session";
import MemoryStore from "memorystore";

const SessionStore = MemoryStore(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
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
      const user = await storage.createUser({ name, email, password: hashed });
      req.session.userId = user.id;
      return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
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
      return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
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
    return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {});
    return res.json({ ok: true });
  });

  // Dashboard
  app.get("/api/dashboard", requireAuth, async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      const allOffers = await storage.getOffers();
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

  // Restaurants
  app.get("/api/restaurants", requireAuth, async (_req: Request, res: Response) => {
    try {
      const rests = await storage.getRestaurants();
      return res.json(rests);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Vendors
  app.get("/api/restaurants/:id/vendors", requireAuth, async (req: Request, res: Response) => {
    try {
      const restaurantId = req.params.id;
      let actualId = restaurantId;
      if (restaurantId === "default") {
        const rests = await storage.getRestaurants();
        if (rests.length === 0) return res.json([]);
        actualId = rests[0].id;
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
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });
      return res.json(vendor);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/vendors/:id/invoices", requireAuth, async (req: Request, res: Response) => {
    try {
      const invs = await storage.getInvoices(req.params.id);
      return res.json(invs);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // CSV Upload
  app.post("/api/invoices/upload", requireAuth, async (req: Request, res: Response) => {
    try {
      let { restaurantId, mapping, rows } = req.body;
      if (!restaurantId || !mapping || !rows) {
        return res.status(400).json({ message: "Missing data" });
      }

      if (restaurantId === "default" || !restaurantId) {
        const rests = await storage.getRestaurants();
        if (rests.length === 0) {
          return res.status(400).json({ message: "No restaurant configured" });
        }
        restaurantId = rests[0].id;
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
  app.get("/api/offers", requireAuth, async (_req: Request, res: Response) => {
    try {
      const allOffers = await storage.getOffers();
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
      const offer = await storage.getOffer(req.params.id);
      if (!offer) return res.status(404).json({ message: "Offer not found" });

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

  app.post("/api/offers", requireAuth, async (req: Request, res: Response) => {
    try {
      const { restaurantId, vendorId, invoiceIds, advanceAmount } = req.body;
      if (!restaurantId || !vendorId || !invoiceIds?.length || !advanceAmount) {
        return res.status(400).json({ message: "Missing data" });
      }

      const selectedInvoices = await storage.getInvoicesByIds(invoiceIds);
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
      const rate = Number(restaurant?.defaultRatePer30d || "0.015");

      let totalWeightedAmount = 0;
      let weightedDaysSum = 0;

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
      }

      const weightedDays =
        totalWeightedAmount > 0
          ? weightedDaysSum / totalWeightedAmount
          : 0;

      const feeAmount = advanceAmount * rate * (weightedDays / 30);
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
        status: "pending",
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

  app.post("/api/offers/:id/accept", requireAuth, async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      if (offer.status !== "pending") {
        return res.status(400).json({ message: "Offer already processed" });
      }
      await storage.updateOfferStatus(offer.id, "accepted", new Date());
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // PDF generation
  app.get("/api/offers/:id/pdf", async (req: Request, res: Response) => {
    try {
      const offer = await storage.getOffer(req.params.id);
      if (!offer) return res.status(404).json({ message: "Offer not found" });

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

  // Ledger
  app.get("/api/admin/ledger", requireAuth, async (_req: Request, res: Response) => {
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

  app.post("/api/admin/ledger", requireAuth, async (req: Request, res: Response) => {
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
