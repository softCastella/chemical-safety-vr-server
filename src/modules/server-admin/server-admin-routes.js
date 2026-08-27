import express from "express";
import { verifyPassword } from "./password.js";
import { collectServerOverview } from "./server-status.js";

const COOKIE = "tyche_admin_session";
const attempts = new Map();
const cookies = (header = "") => Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key]) => key));
const clientIp = (request) => request.ip?.replace(/^::ffff:/, "") || "unknown";

export function createServerAdminRouter({ repository }) {
  const router = express.Router();
  const requireAdmin = async (request, response, next) => {
    try {
      const session = await repository.findSession(cookies(request.headers.cookie)[COOKIE]);
      if (!session) return response.status(401).json({ error: "Authentication required." });
      request.serverAdmin = session;
      next();
    } catch (error) { next(error); }
  };
  const requireWriteAdmin = (request, response, next) => request.serverAdmin.role === "admin" ? next() : response.status(403).json({ error: "Read-only account." });

  router.post("/login", async (request, response, next) => {
    const ip = clientIp(request);
    const state = attempts.get(ip) ?? { count: 0, resetAt: 0 };
    if (state.resetAt > Date.now() && state.count >= 10) return response.status(429).json({ error: "Too many attempts." });
    try {
      const { username, password } = request.body ?? {};
      const account = typeof username === "string" ? await repository.findAccount(username) : null;
      const locked = account?.locked_until && new Date(account.locked_until) > new Date();
      const expired = account?.expires_at && new Date(account.expires_at) <= new Date();
      const valid = account?.status === "active" && !locked && !expired && await verifyPassword(password, account.password_hash);
      if (!valid) {
        attempts.set(ip, { count: state.count + 1, resetAt: Date.now() + 15 * 60_000 });
        await repository.recordFailure(account?.id ?? null, ip);
        return response.status(401).json({ error: "Invalid credentials." });
      }
      attempts.delete(ip);
      const token = await repository.createSession(account, ip, request.get("user-agent"));
      response.cookie(COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 8 * 60 * 60_000 });
      response.status(204).end();
    } catch (error) { next(error); }
  });

  router.post("/logout", async (request, response, next) => {
    try { await repository.revokeSession(cookies(request.headers.cookie)[COOKIE]); response.clearCookie(COOKIE, { path: "/" }); response.status(204).end(); }
    catch (error) { next(error); }
  });
  router.get("/session", requireAdmin, (request, response) => response.json({ username: request.serverAdmin.username }));
  router.get("/overview", requireAdmin, async (request, response, next) => {
    try { response.json({ ...(await collectServerOverview({ securityEvents: await repository.recentSecurityEvents(), trustedIps: await repository.listTrustedIps(), currentIp: clientIp(request) })), currentUser: { username: request.serverAdmin.username, role: request.serverAdmin.role } }); }
    catch (error) { next(error); }
  });
  router.get("/security-events", requireAdmin, async (request, response, next) => {
    try {
      const page = Number.parseInt(request.query.page, 10) || 1;
      if (page < 1 || page > 100000) return response.status(400).json({ error: "Invalid page." });
      response.json(await repository.listSecurityEvents({ page, pageSize: 20 }));
    } catch (error) { next(error); }
  });
  router.delete("/security-events", requireAdmin, requireWriteAdmin, async (request, response, next) => {
    try {
      if (!Array.isArray(request.body?.ids)) return response.status(400).json({ error: "Invalid security event IDs." });
      const ids = [...new Set(request.body.ids)];
      if (ids.length < 1 || ids.length > 20 || ids.some((id) => !Number.isInteger(id) || id < 1)) return response.status(400).json({ error: "Invalid security event IDs." });
      response.json({ deleted: await repository.deleteSecurityEvents(ids) });
    } catch (error) { next(error); }
  });
  router.post("/trusted-ips", requireAdmin, requireWriteAdmin, async (request, response, next) => {
    try {
      const { label, cidr } = request.body ?? {};
      if (typeof label !== "string" || !/^.{1,64}$/.test(label) || typeof cidr !== "string" || !/^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(cidr)) return response.status(400).json({ error: "Invalid label or IPv4 CIDR." });
      const id = await repository.addTrustedIp({ label: label.trim(), cidr, adminId: request.serverAdmin.admin_id });
      response.status(201).json({ id });
    } catch (error) { next(error); }
  });
  router.delete("/trusted-ips/:id", requireAdmin, requireWriteAdmin, async (request, response, next) => {
    try { const removed = await repository.removeTrustedIp(Number(request.params.id)); response.status(removed ? 204 : 409).end(); }
    catch (error) { next(error); }
  });
  return { router, requireAdmin };
}
