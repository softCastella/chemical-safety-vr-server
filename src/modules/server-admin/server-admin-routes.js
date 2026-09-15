import express from "express";
import { verifyPassword } from "./password.js";
import { collectServerOverview } from "./server-status.js";

const COOKIE = "tyche_admin_session";
const attempts = new Map();
const cookies = (header = "") => Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key]) => key));
const clientIp = (request) => request.ip?.replace(/^::ffff:/, "") || "unknown";

function readPushSubscription(body) {
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  let parsedEndpoint;
  try { parsedEndpoint = new URL(endpoint); } catch { parsedEndpoint = null; }
  if (parsedEndpoint?.protocol !== "https:" || endpoint.length > 2048 ||
      typeof p256dh !== "string" || p256dh.length < 16 || p256dh.length > 255 ||
      typeof auth !== "string" || auth.length < 8 || auth.length > 255) {
    return null;
  }
  return { endpoint, p256dh, auth };
}

function readAlertOccurrences(keys) {
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > 100) return null;
  const occurrences = [];
  for (const value of new Set(keys)) {
    const match = typeof value === "string" && value.match(/^((?:system|security):[^@]{1,220})@(\d{1,18})$/);
    const generation = match ? Number(match[2]) : 0;
    if (!match || !Number.isSafeInteger(generation) || generation < 1) return null;
    occurrences.push({ alertKey: match[1], generation });
  }
  return occurrences;
}

export function createServerAdminRouter({ repository, countryLookupService, pushService }) {
  const router = express.Router();
  const authenticate = async (request, response, next, loginDestination = null) => {
    try {
      const session = await repository.findSession(cookies(request.headers.cookie)[COOKIE]);
      if (!session) {
        if (loginDestination) {
          return response.redirect(302, `/server/login?next=${encodeURIComponent(loginDestination)}`);
        }
        return response.status(401).json({ error: "Authentication required." });
      }
      request.serverAdmin = session;
      next();
    } catch (error) { next(error); }
  };
  const requireAdmin = (request, response, next) => authenticate(request, response, next);
  const requireAdminPage = (destination) => (request, response, next) => (
    authenticate(request, response, next, destination)
  );
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
  router.get("/push-config", requireAdmin, (_request, response) => {
    response.set("Cache-Control", "no-store");
    response.json({ enabled: pushService.enabled, publicKey: pushService.publicKey });
  });
  router.post("/push-subscriptions", requireAdmin, async (request, response, next) => {
    try {
      if (!pushService.enabled) return response.status(503).json({ error: "Push notifications are disabled." });
      const subscription = readPushSubscription(request.body);
      if (!subscription) return response.status(400).json({ error: "Invalid push subscription." });
      const result = await repository.savePushSubscription({
        adminId: request.serverAdmin.admin_id,
        ...subscription,
        userAgent: request.get("user-agent"),
      });
      response.status(201).json(result);
    } catch (error) { next(error); }
  });
  router.delete("/push-subscriptions", requireAdmin, async (request, response, next) => {
    try {
      const subscription = readPushSubscription(request.body);
      if (!subscription) return response.status(400).json({ error: "Invalid push subscription." });
      await repository.removePushSubscription({
        adminId: request.serverAdmin.admin_id,
        endpoint: subscription.endpoint,
      });
      response.status(204).end();
    } catch (error) { next(error); }
  });
  router.post("/push-test", requireAdmin, async (request, response, next) => {
    try {
      if (!pushService.enabled) return response.status(503).json({ error: "Push notifications are disabled." });
      const subscription = readPushSubscription(request.body);
      if (!subscription) return response.status(400).json({ error: "Invalid push subscription." });
      await pushService.send(subscription, {
        title: "서버 알림 연결 완료",
        body: "새로운 서버 이상 상태와 비정상 접속만 이 휴대폰으로 알려드립니다.",
        tag: "server-admin-push-test",
        url: "/server",
      });
      response.status(204).end();
    } catch (error) { next(error); }
  });
  router.post("/alerts/acknowledge", requireAdmin, async (request, response, next) => {
    try {
      const occurrences = readAlertOccurrences(request.body?.keys);
      if (!occurrences) return response.status(400).json({ error: "Invalid alert keys." });
      await repository.acknowledgeAlertOccurrences(request.serverAdmin.admin_id, occurrences);
      response.status(204).end();
    } catch (error) { next(error); }
  });
  router.get("/overview", requireAdmin, async (request, response, next) => {
    try {
      const enrichedSecurityEvents = await countryLookupService.enrichEvents(
        await repository.recentSecurityEvents(),
      );
      const overview = await collectServerOverview({ securityEvents: enrichedSecurityEvents, trustedIps: await repository.listTrustedIps(), currentIp: clientIp(request) });
      const systemAlerts = overview.alertItems.map((alert) => ({ key: `system:${alert.id}`, message: alert.message }));
      await repository.syncSystemAlertOccurrences(systemAlerts);
      const occurrenceKeys = [
        ...systemAlerts.map((alert) => alert.key),
        ...overview.securityEvents.map((event) => `security:${event.id}`),
      ];
      const generations = await repository.listAlertOccurrenceGenerations(occurrenceKeys);
      const occurrenceKey = (key) => `${key}@${generations.get(key) ?? 1}`;
      const alertItems = overview.alertItems.map((alert) => ({ ...alert, occurrenceKey: occurrenceKey(`system:${alert.id}`) }));
      const securityEvents = overview.securityEvents.map((event) => ({ ...event, occurrenceKey: occurrenceKey(`security:${event.id}`) }));
      const acknowledgedAlertKeys = await repository.listAcknowledgedAlertOccurrences(request.serverAdmin.admin_id, occurrenceKeys);
      response.json({ ...overview, alertItems, securityEvents, acknowledgedAlertKeys, pushEnabled: pushService.enabled, currentUser: { username: request.serverAdmin.username, role: request.serverAdmin.role } });
    }
    catch (error) { next(error); }
  });
  router.get("/security-events", requireAdmin, async (request, response, next) => {
    try {
      const page = Number.parseInt(request.query.page, 10) || 1;
      if (page < 1 || page > 100000) return response.status(400).json({ error: "Invalid page." });
      const result = await repository.listSecurityEvents({ page, pageSize: 20 });
      response.json({
        ...result,
        items: await countryLookupService.enrichEvents(result.items),
      });
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
  return { router, requireAdmin, requireAdminPage };
}
