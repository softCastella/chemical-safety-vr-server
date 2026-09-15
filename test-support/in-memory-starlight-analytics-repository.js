export function createInMemoryStarlightAnalyticsRepository() {
  const events = new Map();
  return {
    async insertEvents(items) {
      let inserted = 0;
      for (const item of items) {
        if (events.has(item.event_id)) continue;
        events.set(item.event_id, { ...item, occurred_at: item.occurred_at.toISOString() });
        inserted += 1;
      }
      return inserted;
    },
    async hasAnyEvents() { return events.size > 0; },
    async listEvents({ dateFrom, dateTo, platform, locale, source, campaign, stageId }) {
      return [...events.values()].filter((event) => {
        const day = event.occurred_at.slice(0, 10);
        return day >= dateFrom && day <= dateTo
          && (!platform || event.platform === platform)
          && (!locale || event.locale === locale)
          && (!source || event.source === source)
          && (!campaign || event.campaign === campaign)
          && (!stageId || event.stage_id === stageId);
      });
    },
    events,
  };
}
