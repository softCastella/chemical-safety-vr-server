const dayMilliseconds = 24 * 60 * 60 * 1000;

export function createStarlightAnalyticsRetentionMonitor({
  repository,
  retentionDays = 90,
  intervalMs = 6 * 60 * 60 * 1000,
  now = Date.now,
  schedule = setInterval,
  cancel = clearInterval,
} = {}) {
  if (!repository?.deleteEventsBefore) {
    throw new Error("Starlight analytics retention requires deleteEventsBefore().");
  }

  let timer = null;

  async function purge() {
    const cutoff = new Date(now() - retentionDays * dayMilliseconds);
    return repository.deleteEventsBefore(cutoff);
  }

  return {
    async start() {
      if (timer) return;
      await purge();
      timer = schedule(() => {
        purge().catch((error) => {
          console.error("Starlight analytics retention cleanup failed.", {
            code: error?.code ?? "UNKNOWN",
            message: error?.message ?? "Unknown error",
          });
        });
      }, intervalMs);
      timer?.unref?.();
    },
    stop() {
      if (!timer) return;
      cancel(timer);
      timer = null;
    },
    purge,
  };
}
