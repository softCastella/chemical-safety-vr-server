const columns = [
  "event_id", "event_name", "anonymous_user_id", "session_id", "platform", "occurred_at",
  "screen_id", "overlay_id", "stage_id", "puzzle_id", "locale", "source", "medium",
  "campaign", "content", "term", "elapsed_screen_time", "elapsed_play_time",
  "remaining_cells", "mistake_count", "hint_count", "target_id", "target_type",
  "is_interactive", "x_ratio", "y_ratio", "viewport_width", "viewport_height", "properties_json",
];

function eventValues(event) {
  return columns.map((column) => {
    if (column === "properties_json") return JSON.stringify(event.properties ?? {});
    if (column === "is_interactive") return event.is_interactive === null ? null : Number(event.is_interactive);
    return event[column] ?? null;
  });
}
function parseRow(row) {
  const properties = typeof row.properties_json === "string"
    ? JSON.parse(row.properties_json || "{}")
    : (row.properties_json ?? {});
  return {
    ...row,
    occurred_at: new Date(row.occurred_at).toISOString(),
    is_interactive: row.is_interactive === null ? null : Boolean(row.is_interactive),
    properties,
  };
}

export function createStarlightAnalyticsRepository(pool) {
  return {
    async insertEvents(events) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const placeholders = events.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
        const [result] = await connection.execute(
          `INSERT IGNORE INTO starlight_analytics_events (${columns.join(",")}) VALUES ${placeholders}`,
          events.flatMap(eventValues),
        );
        await connection.commit();
        return Number(result.affectedRows ?? 0);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async hasAnyEvents() {
      const [rows] = await pool.execute("SELECT EXISTS(SELECT 1 FROM starlight_analytics_events LIMIT 1) AS present");
      return Boolean(rows[0]?.present);
    },

    async deleteEventsBefore(cutoff) {
      const [result] = await pool.execute(
        "DELETE FROM starlight_analytics_events WHERE received_at < ?",
        [cutoff],
      );
      return Number(result.affectedRows ?? 0);
    },

    async listEvents({ dateFrom, dateTo, platform, locale, source, campaign, stageId }) {
      const where = ["occurred_at >= ?", "occurred_at < DATE_ADD(?, INTERVAL 1 DAY)"];
      const params = [dateFrom, dateTo];
      for (const [column, item] of [
        ["platform", platform], ["locale", locale], ["source", source],
        ["campaign", campaign], ["stage_id", stageId],
      ]) {
        if (item !== null && item !== undefined && item !== "") {
          where.push(`${column} = ?`);
          params.push(item);
        }
      }
      const [rows] = await pool.execute(
        `SELECT * FROM starlight_analytics_events WHERE ${where.join(" AND ")} ORDER BY occurred_at, id`,
        params,
      );
      return rows.map(parseRow);
    },
  };
}
