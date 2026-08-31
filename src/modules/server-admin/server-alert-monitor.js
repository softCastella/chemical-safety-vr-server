import { collectServerOverview } from "./server-status.js";
import { isExpiredPushSubscriptionError } from "./server-admin-push.js";

const securityAlert = (event) => ({
  key: `security:${event.id}`,
  eventId: Number(event.id),
  message: `관리자 로그인 실패가 감지되었습니다. (${event.ipAddress})`,
});

const systemAlerts = (overview) =>
  overview.alertItems.map((alert) => ({
    key: `system:${alert.id}`,
    message: alert.message,
  }));

function pushPayload(occurrence) {
  return {
    title: occurrence.source === "security" ? "비정상 접속 알림" : "서버 상태 알림",
    body: occurrence.message,
    tag: `${occurrence.alertKey}@${occurrence.generation}`,
    url: "/server-status",
  };
}

export function createServerAlertMonitor({
  repository,
  pushService,
  intervalMs,
  collectOverview = collectServerOverview,
  logger = console,
}) {
  let timer;
  let running = false;

  async function deliverPending() {
    const pending = await repository.listPendingAlertOccurrences();
    if (pending.length === 0) return;

    const subscriptions = pushService.enabled
      ? await repository.listPushSubscriptions()
      : [];

    const processed = [];
    for (const occurrence of pending) {
      let shouldMarkProcessed = subscriptions.length === 0;
      for (const subscription of subscriptions) {
        try {
          await pushService.send(subscription, pushPayload(occurrence));
          await repository.markPushSubscriptionSucceeded(subscription.id);
          shouldMarkProcessed = true;
        } catch (error) {
          if (isExpiredPushSubscriptionError(error)) {
            await repository.removePushSubscriptionById(subscription.id);
            shouldMarkProcessed = true;
          } else {
            logger.error("Server admin push delivery failed.", {
              alertKey: occurrence.alertKey,
              code: error?.code ?? "UNKNOWN",
              statusCode: error?.statusCode ?? null,
            });
          }
        }
      }
      if (shouldMarkProcessed) processed.push(occurrence);
    }

    await repository.markAlertOccurrencesPushProcessed(processed);
  }

  async function runOnce() {
    if (running) return;
    running = true;
    try {
      const overview = await collectOverview({ securityEvents: [] });
      const alerts = systemAlerts(overview);
      const state = await repository.getAlertMonitorState();

      if (!state.initialized) {
        const existingSecurityEvents = await repository.recentSecurityEvents();
        await repository.initializeAlertMonitor({
          alerts,
          securityEvents: existingSecurityEvents.map(securityAlert),
        });
        return;
      }

      await repository.syncSystemAlertOccurrences(alerts);
      const newSecurityEvents = await repository.listSecurityEventsAfter(
        Number(state.lastSecurityEventId) || 0,
      );
      await repository.syncSecurityAlertOccurrences(
        newSecurityEvents.map(securityAlert),
      );
      await deliverPending();
    } catch (error) {
      logger.error("Server alert monitor failed.", {
        code: error?.code ?? "UNKNOWN",
        message: error?.message ?? "Unknown error",
      });
    } finally {
      running = false;
    }
  }

  return Object.freeze({
    runOnce,
    async start() {
      await runOnce();
      timer = setInterval(runOnce, intervalMs);
      timer.unref?.();
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  });
}
