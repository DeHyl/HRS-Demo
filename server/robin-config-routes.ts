/**
 * robin-config-routes.ts
 * API endpoints for Robin agent configuration and AE territory routing.
 * All endpoints require authentication.
 */

import { Router, Request, Response } from "express";
import { storage } from "./storage.js";

const router = Router();

// ─── Robin Config ─────────────────────────────────────────────────────────────

router.get("/config", async (req: Request, res: Response) => {
  try {
    const config = await storage.getRobinConfig();
    // Return defaults if no config exists yet
    res.json(config || {
      id: "default",
      escalationScoreThreshold: 4,
      escalateOnBudget: true,
      escalateOnDeadline: true,
      escalateOnDemo: true,
      autoReplyOnEscalation: true,
      escalationNote: "Based on your inquiry, one of our HRS account executives will also be in touch shortly to discuss next steps.",
      handoffTemplate: null,
      fallbackAeId: null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load Robin config" });
  }
});

router.put("/config", async (req: Request, res: Response) => {
  try {
    const config = await storage.upsertRobinConfig(req.body);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Failed to save Robin config" });
  }
});

// ─── AE Territory Routing ─────────────────────────────────────────────────────

router.get("/routing", async (req: Request, res: Response) => {
  try {
    const routes = await storage.getAeTerritoryRouting();
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: "Failed to load routing rules" });
  }
});

router.post("/routing", async (req: Request, res: Response) => {
  try {
    const route = await storage.upsertAeTerritoryRoute(req.body);
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: "Failed to save routing rule" });
  }
});

router.patch("/routing/:id", async (req: Request, res: Response) => {
  try {
    const route = await storage.upsertAeTerritoryRoute({ ...req.body, id: req.params.id });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: "Failed to update routing rule" });
  }
});

router.delete("/routing/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteAeTerritoryRoute(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete routing rule" });
  }
});

export default router;
