const funnelSteps = [
  "landing_view", "landing_cta_click", "game_open", "game_ready", "puzzle_start",
  "stage_1_start", "stage_1_clear", "stage_2_start", "stage_2_clear",
  "stage_3_start", "stage_3_clear", "stage_4_start", "stage_4_clear",
  "stage_5_start", "stage_5_clear", "demo_complete", "store_cta_click",
];
const interactionNames = [
  "cell_select", "number_input", "wrong_input", "erase", "memo_toggle", "memo_input",
  "hint_open", "hint_used", "restart", "pause", "resume", "settings_open",
  "language_open", "language_change", "home_click", "next_stage_click", "village_click",
  "store_cta_click",
];

const round = (value, digits = 4) => Number((Number(value) || 0).toFixed(digits));
const ratio = (part, total) => total ? round(part / total) : 0;
const value = (event, key, fallback = null) => event[key] ?? event.properties?.[key] ?? fallback;
const dateOf = (event) => new Date(event.occurred_at);
const usersOf = (rows) => new Set(rows.map((row) => row.anonymous_user_id));
const sessionsOf = (rows) => new Set(rows.map((row) => row.session_id));

function groupBy(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function distribution(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { average: 0, median: 0, p75: 0, p90: 0, samples: 0 };
  return {
    average: round(sorted.reduce((sum, item) => sum + item, 0) / sorted.length, 1),
    median: round(percentile(sorted, 0.5), 1),
    p75: round(percentile(sorted, 0.75), 1),
    p90: round(percentile(sorted, 0.9), 1),
    samples: sorted.length,
  };
}

function aggregateDaily(events) {
  const groups = groupBy(events, (event) => event.occurred_at.slice(0, 10));
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({
    date,
    users: usersOf(rows).size,
    sessions: sessionsOf(rows).size,
    puzzle_starts: rows.filter((row) => row.event_name === "puzzle_start").length,
    stage_clears: rows.filter((row) => /^stage_[1-5]_clear$/.test(row.event_name)).length,
  }));
}

function aggregateFunnel(events) {
  const byUser = groupBy(events, (event) => event.anonymous_user_id);
  const reached = funnelSteps.map((step) => new Map());
  for (const [userId, rows] of byUser) {
    for (const event of rows) {
      const index = funnelSteps.indexOf(event.event_name);
      if (index >= 0 && !reached[index].has(userId)) reached[index].set(userId, dateOf(event));
    }
  }
  const landingUsers = reached[0].size;
  return funnelSteps.map((step, index) => {
    const current = reached[index];
    const next = reached[index + 1];
    const previous = index ? reached[index - 1].size : current.size;
    const nextSize = next?.size ?? current.size;
    return {
      step,
      users: current.size,
      previous_conversion: index ? ratio(current.size, previous) : 1,
      landing_conversion: ratio(current.size, landingUsers),
      dropoff_users: Math.max(0, current.size - nextSize),
      dropoff_rate: ratio(Math.max(0, current.size - nextSize), current.size),
      avg_time_to_next: null,
    };
  }).map((row, index) => {
    if (index === funnelSteps.length - 1) return row;
    const current = reached[index];
    const next = reached[index + 1];
    const intervals = [];
    for (const [userId, stamp] of current) {
      const nextStamp = next.get(userId);
      if (nextStamp && nextStamp >= stamp) intervals.push((nextStamp - stamp) / 1000);
    }
    return { ...row, avg_time_to_next: intervals.length ? round(intervals.reduce((a, b) => a + b, 0) / intervals.length, 1) : null };
  });
}

function aggregatePlay(events) {
  const bySession = groupBy(events, (event) => event.session_id);
  const buckets = Object.fromEntries([
    "session_duration", "active_engagement_time", "game_screen_time", "active_play_time",
    "puzzle_clear_time", "time_to_first_action", "time_to_first_hint", "time_to_exit",
  ].map((key) => [key, []]));
  for (const rows of bySession.values()) {
    rows.sort((a, b) => dateOf(a) - dateOf(b));
    const started = dateOf(rows[0]);
    const ended = dateOf(rows[rows.length - 1]);
    const reportedSession = Math.max(0, ...rows.map((row) => Number(value(row, "session_duration", 0)) || 0));
    buckets.session_duration.push(reportedSession || (ended - started) / 1000);
    const engagement = Math.max(0, ...rows.map((row) => Number(value(row, "active_engagement_time", 0)) || 0));
    if (engagement) buckets.active_engagement_time.push(engagement);
    const activePlay = Math.max(0, ...rows.map((row) => Number(value(row, "elapsed_play_time", 0)) || 0));
    if (activePlay) buckets.active_play_time.push(activePlay);
    for (const row of rows) {
      if (row.event_name === "screen_exit" && row.screen_id === "game") {
        const duration = Number(value(row, "screen_duration", 0));
        if (duration) buckets.game_screen_time.push(duration);
      }
      if (/^stage_[1-5]_clear$/.test(row.event_name)) {
        const duration = Number(value(row, "puzzle_clear_time", 0));
        if (duration) buckets.puzzle_clear_time.push(duration);
      }
    }
    const firstAction = rows.find((row) => row.event_name === "cell_select");
    const firstHint = rows.find((row) => row.event_name === "hint_open" || row.event_name === "hint_used");
    const exit = rows.find((row) => row.event_name === "game_exit");
    if (firstAction) buckets.time_to_first_action.push(Number(value(firstAction, "elapsed_play_time", 0)) || (dateOf(firstAction) - started) / 1000);
    if (firstHint) buckets.time_to_first_hint.push(Number(value(firstHint, "elapsed_play_time", 0)) || (dateOf(firstHint) - started) / 1000);
    if (exit) buckets.time_to_exit.push(Number(value(exit, "elapsed_play_time", 0)) || (dateOf(exit) - started) / 1000);
  }
  return Object.entries(buckets).map(([metric, values]) => ({ metric, ...distribution(values) }));
}

export function starlightBottleneckScore({ clearRate, exitRate, restartRate, p90Time, mistakeRate, hintRate }) {
  return round(Math.min(100,
    (1 - clearRate) * 30 + exitRate * 20 + restartRate * 15
    + Math.min(1, p90Time / 600) * 15 + mistakeRate * 10 + hintRate * 10,
  ), 1);
}

function aggregateStages(events) {
  return [1, 2, 3, 4, 5].map((stage) => {
    const rows = events.filter((event) => event.stage_id === stage);
    const starts = rows.filter((row) => row.event_name === `stage_${stage}_start`);
    const clears = rows.filter((row) => row.event_name === `stage_${stage}_clear`);
    const exits = rows.filter((row) => row.event_name === "game_exit");
    const restarts = rows.filter((row) => row.event_name === "restart");
    const wrong = rows.filter((row) => row.event_name === "wrong_input");
    const hints = rows.filter((row) => row.event_name === "hint_used");
    const memos = rows.filter((row) => ["memo_toggle", "memo_input"].includes(row.event_name));
    const startUsers = usersOf(starts);
    const clearUsers = usersOf(clears);
    const clearTimes = clears.map((row) => Number(value(row, "puzzle_clear_time", 0))).filter(Boolean);
    const timeStats = distribution(clearTimes);
    const clearRate = ratio(clearUsers.size, startUsers.size);
    const exitRate = ratio(usersOf(exits).size, startUsers.size);
    const restartRate = ratio(usersOf(restarts).size, startUsers.size);
    const mistakeRate = ratio(usersOf(wrong).size, startUsers.size);
    const hintRate = ratio(usersOf(hints).size, startUsers.size);
    const score = starlightBottleneckScore({ clearRate, exitRate, restartRate, p90Time: timeStats.p90, mistakeRate, hintRate });
    const clearedAttempts = [...clearUsers].map((userId) => starts.filter((row) => row.anonymous_user_id === userId).length || 1);
    const nextUsers = usersOf(rows.filter((row) => row.event_name === "next_stage_click"));
    return {
      stage,
      start_users: startUsers.size,
      clear_users: clearUsers.size,
      clear_rate: clearRate,
      exit_users: usersOf(exits).size,
      exit_rate: exitRate,
      restart_users: usersOf(restarts).size,
      restart_rate: restartRate,
      average_clear_time: timeStats.average,
      median_clear_time: timeStats.median,
      p90_clear_time: timeStats.p90,
      average_mistakes: clearUsers.size ? round(wrong.length / clearUsers.size, 2) : 0,
      hint_users: usersOf(hints).size,
      hint_rate: hintRate,
      hints_per_user: usersOf(hints).size ? round(hints.length / usersOf(hints).size, 2) : 0,
      memo_users: usersOf(memos).size,
      erase_count: rows.filter((row) => row.event_name === "erase").length,
      attempt_count: starts.length,
      average_attempts_to_clear: clearedAttempts.length ? round(clearedAttempts.reduce((a, b) => a + b, 0) / clearedAttempts.length, 2) : 0,
      next_stage_conversion: ratio(nextUsers.size, clearUsers.size),
      exit_remaining_cells: distribution(exits.map((row) => row.remaining_cells).filter((item) => item !== null)).average,
      exit_elapsed_time: distribution(exits.map((row) => row.elapsed_play_time).filter((item) => item !== null)).average,
      mistake_rate: mistakeRate,
      bottleneck_score: score,
      status: score >= 65 ? "critical" : score >= 45 ? "warning" : "healthy",
    };
  });
}

function aggregateInteractions(events) {
  return interactionNames.map((name) => {
    const rows = events.filter((row) => row.event_name === name);
    const users = usersOf(rows).size;
    return { event: name, count: rows.length, users, per_user: users ? round(rows.length / users, 2) : 0 };
  });
}

function aggregateHeatmap(events) {
  const pointers = events.filter((event) => event.event_name === "pointer_tap" && event.x_ratio !== null && event.y_ratio !== null)
    .sort((a, b) => dateOf(a) - dateOf(b));
  const lastByTarget = new Map();
  const bins = new Map();
  for (const event of pointers) {
    const repeatKey = `${event.anonymous_user_id}|${event.screen_id ?? "unknown"}|${event.target_id ?? "canvas"}`;
    const stamp = dateOf(event);
    const last = lastByTarget.get(repeatKey);
    lastByTarget.set(repeatKey, stamp);
    const linked = value(event, "interaction_kind");
    let category = event.is_interactive === false ? "dead" : "all";
    if (last && stamp - last <= 2000) category = "rage";
    if (linked === "wrong_input") category = "mistake";
    if (["hint_open", "hint_used"].includes(linked)) category = "hint";
    const screen = event.screen_id ?? "unknown";
    const overlay = event.overlay_id ?? "";
    const target = event.target_id ?? "canvas";
    const targetType = event.target_type ?? "surface";
    const xBin = Math.floor(Number(event.x_ratio) * 80);
    const yBin = Math.floor(Number(event.y_ratio) * 140);
    const key = [screen, overlay, event.stage_id ?? "", category, target, targetType, String(event.is_interactive), xBin, yBin].join("|");
    if (!bins.has(key)) bins.set(key, {
      screen_id: screen, overlay_id: event.overlay_id ?? null, stage_id: event.stage_id ?? null,
      category, target_id: target, target_type: targetType, is_interactive: event.is_interactive,
      xTotal: 0, yTotal: 0, elapsedTotal: 0, count: 0, users: new Set(),
    });
    const bin = bins.get(key);
    bin.xTotal += Number(event.x_ratio);
    bin.yTotal += Number(event.y_ratio);
    bin.elapsedTotal += Number(event.elapsed_screen_time ?? 0);
    bin.count += 1;
    bin.users.add(event.anonymous_user_id);
  }
  const points = [...bins.values()].map((bin) => ({
    screen_id: bin.screen_id, overlay_id: bin.overlay_id, stage_id: bin.stage_id,
    x: round(bin.xTotal / bin.count, 5), y: round(bin.yTotal / bin.count, 5),
    count: bin.count, unique_users: bin.users.size, target_id: bin.target_id,
    target_type: bin.target_type, is_interactive: bin.is_interactive,
    average_elapsed_time: round(bin.elapsedTotal / bin.count, 1), category: bin.category,
  }));
  const screenCounts = new Map();
  for (const point of points) {
    const key = `${point.screen_id}|${point.overlay_id ?? ""}`;
    screenCounts.set(key, (screenCounts.get(key) ?? 0) + point.count);
  }
  return {
    screens: [...screenCounts.entries()].map(([key, count]) => {
      const [id, overlay] = key.split("|");
      return { id, overlay_id: overlay || null, label: id.replaceAll("_", " "), events: count };
    }),
    points,
    backgrounds: {},
  };
}

function aggregateExpectation(events) {
  const pointers = events.filter((event) => event.event_name === "pointer_tap");
  return [...groupBy(pointers, (event) => event.screen_id ?? "unknown")].sort(([a], [b]) => a.localeCompare(b)).map(([screen, rows]) => {
    const dead = rows.filter((row) => row.is_interactive === false);
    const userCounts = new Map();
    const targets = new Map();
    for (const row of dead) {
      userCounts.set(row.anonymous_user_id, (userCounts.get(row.anonymous_user_id) ?? 0) + 1);
      const target = row.target_id ?? "canvas";
      targets.set(target, (targets.get(target) ?? 0) + 1);
    }
    return {
      screen_id: screen,
      non_interactive_click_rate: ratio(dead.length, rows.length),
      unique_users: userCounts.size,
      repeat_users: [...userCounts.values()].filter((count) => count > 1).length,
      top_targets: [...targets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([target, count]) => ({ target, count })),
    };
  });
}

function aggregateAcquisition(events) {
  return [...groupBy(events, (event) => `${event.source ?? "direct"}|${event.medium ?? "none"}|${event.campaign ?? "(none)"}`)]
    .map(([key, rows]) => {
      const [source, medium, campaign] = key.split("|");
      const users = usersOf(rows);
      const starts = usersOf(rows.filter((row) => row.event_name === "puzzle_start"));
      const completes = usersOf(rows.filter((row) => row.event_name === "demo_complete"));
      return { source, medium, campaign, users: users.size, start_rate: ratio(starts.size, users.size), complete_rate: ratio(completes.size, users.size) };
    }).sort((a, b) => b.users - a.users);
}

function aggregateRetention(events) {
  const daysByUser = groupBy(events, (event) => event.anonymous_user_id);
  const cohorts = new Map();
  for (const rows of daysByUser.values()) {
    const days = new Set(rows.map((row) => row.occurred_at.slice(0, 10)));
    const cohort = [...days].sort()[0];
    if (!cohorts.has(cohort)) cohorts.set(cohort, []);
    cohorts.get(cohort).push(days);
  }
  return [...cohorts.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([cohort, users]) => {
    const first = new Date(`${cohort}T00:00:00Z`);
    const row = { cohort, users: users.length };
    for (const offset of [1, 7, 30]) {
      row[`d${offset}`] = ratio(users.filter((days) => [...days].some((day) => (new Date(`${day}T00:00:00Z`) - first) / 86400000 === offset)).length, users.length);
    }
    return row;
  });
}

function aggregatePlatforms(events) {
  return ["web", "android"].map((platform) => {
    const rows = events.filter((event) => event.platform === platform);
    return {
      platform, state: rows.length ? "live" : "no_data", users: usersOf(rows).size,
      sessions: sessionsOf(rows).size,
      starts: rows.filter((row) => row.event_name === "puzzle_start").length,
      completes: rows.filter((row) => row.event_name === "demo_complete").length,
    };
  });
}

export function aggregateStarlightEvents(events, { dateFrom, dateTo, hasAnyData = false } = {}) {
  const users = usersOf(events);
  const sessions = sessionsOf(events);
  const puzzleStarts = events.filter((event) => event.event_name === "puzzle_start");
  const demoCompletes = events.filter((event) => event.event_name === "demo_complete");
  const play = aggregatePlay(events);
  return {
    meta: {
      product: "starlight-sudoku", source: "real", data_state: events.length ? "live" : "no_data",
      has_any_data: hasAnyData, from: dateFrom, to: dateTo, generated_at: new Date().toISOString(), event_count: events.length,
    },
    filters: {
      platforms: ["web", "android"],
      locales: [...new Set(events.map((event) => event.locale).filter(Boolean))].sort(),
      sources: [...new Set(events.map((event) => event.source).filter(Boolean))].sort(),
      campaigns: [...new Set(events.map((event) => event.campaign).filter(Boolean))].sort(),
      stages: [...new Set(events.map((event) => event.stage_id).filter(Boolean))].sort(),
    },
    overview: {
      users: users.size, sessions: sessions.size,
      game_opens: events.filter((event) => event.event_name === "game_open").length,
      puzzle_starts: puzzleStarts.length, demo_completes: demoCompletes.length,
      start_rate: ratio(usersOf(puzzleStarts).size, users.size),
      completion_rate: ratio(usersOf(demoCompletes).size, usersOf(events.filter((event) => event.event_name === "landing_view")).size),
      active_play_time: play.find((item) => item.metric === "active_play_time") ?? distribution([]),
    },
    daily: aggregateDaily(events),
    acquisition: aggregateAcquisition(events),
    funnel: aggregateFunnel(events),
    play,
    stages: aggregateStages(events),
    interactions: aggregateInteractions(events),
    heatmap: aggregateHeatmap(events),
    expectation: aggregateExpectation(events),
    retention: aggregateRetention(events),
    platforms: aggregatePlatforms(events),
  };
}
