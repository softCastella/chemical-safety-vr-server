import webPush from "web-push";

function requirePushSetting(name, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required when ENABLE_SERVER_ADMIN_PUSH is true.`);
  }
  return value.trim();
}

export function createServerAdminPushService({
  enabled,
  vapidPublicKey,
  vapidPrivateKey,
  subject,
  webPushImpl = webPush,
}) {
  if (!enabled) {
    return Object.freeze({ enabled: false, publicKey: "", send: async () => ({ skipped: true }) });
  }

  const publicKey = requirePushSetting("WEB_PUSH_VAPID_PUBLIC_KEY", vapidPublicKey);
  const privateKey = requirePushSetting("WEB_PUSH_VAPID_PRIVATE_KEY", vapidPrivateKey);
  const resolvedSubject = requirePushSetting("WEB_PUSH_SUBJECT", subject);
  webPushImpl.setVapidDetails(resolvedSubject, publicKey, privateKey);

  return Object.freeze({
    enabled: true,
    publicKey,
    async send(subscription, payload) {
      await webPushImpl.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        { TTL: 300, urgency: "high" },
      );
      return { skipped: false };
    },
  });
}

export function isExpiredPushSubscriptionError(error) {
  return error?.statusCode === 404 || error?.statusCode === 410;
}
