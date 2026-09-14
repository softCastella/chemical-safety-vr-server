const visibleEventTypes = new Set([
  "session_started", "scene_loaded", "mode_session_started", "flow_state_changed",
  "ppe_grab_attempted", "ppe_grab_selected_without_attempt", "ppe_inspection_started", "ppe_choice_resolved",
  "quiz_answer_resolved", "mode_session_completed",
]);

export function toDashboardPlaySession(session, rawEvents) {
  const events = [...rawEvents].sort((left, right) => left.sequence - right.sequence);
  const attempts = new Map(events
    .filter((event) => event.eventType === "ppe_grab_attempted" && event.attemptId)
    .map((event) => [event.attemptId, event]));
  const resolutions = new Map(events
    .filter((event) => event.eventType === "ppe_grab_attempt_resolved" && event.attemptId)
    .map((event) => [event.attemptId, event]));
  let modeRunIndex = 0;
  const grabSelections = [];
  for (const event of events) {
    if (event.eventType === "mode_session_started") modeRunIndex += 1;
    if (event.eventType === "ppe_grab_selected_without_attempt") {
      grabSelections.push({
        sequence: event.sequence,
        timestampUtc: event.timestampUtc,
        itemType: event.itemType ?? null,
        attemptSequence: null,
        mode: event.mode ?? null,
        workPlan: event.workPlan ?? null,
        modeRunIndex,
      });
    }
    if (event.eventType !== "ppe_grab_attempt_resolved" || event.attemptOutcome !== "selected") continue;
    const attempt = attempts.get(event.attemptId);
    grabSelections.push({
      sequence: event.sequence,
      timestampUtc: event.timestampUtc,
      itemType: event.itemType ?? attempt?.itemType ?? null,
      attemptSequence: attempt?.sequence ?? null,
      mode: event.mode ?? attempt?.mode ?? null,
      workPlan: event.workPlan ?? attempt?.workPlan ?? null,
      modeRunIndex,
    });
  }
  return {
    sessionId: session.sessionId,
    key: session.sessionId.slice(0, 8),
    participantId: session.participantId,
    appVersion: session.appVersion,
    status: session.status,
    startedAtUtc: session.startedAtUtc,
    eventCount: events.length,
    grabAttempts: events.filter((event) => event.eventType === "ppe_grab_attempted").map((event) => {
      const resolved = resolutions.get(event.attemptId);
      return {
        sequence: event.sequence,
        timestampUtc: event.timestampUtc,
        itemType: event.itemType ?? resolved?.itemType ?? null,
        outcome: resolved?.attemptOutcome ?? null,
        resolvedSequence: resolved?.sequence ?? null,
      };
    }),
    grabSelections,
    events: events.filter((event) => visibleEventTypes.has(event.eventType)).map((event) => ({
      sequence: event.sequence,
      timestampUtc: event.timestampUtc,
      eventType: event.eventType,
      mode: event.mode ?? undefined,
      workPlan: event.workPlan ?? undefined,
      flowState: event.eventType === "flow_state_changed" ? event.flowState : undefined,
      itemType: event.eventType.startsWith("ppe_") ? event.itemType : undefined,
      scene: event.eventType === "scene_loaded" ? event.scene : undefined,
      quizQuestionIndex: event.eventType === "quiz_answer_resolved" ? event.quizQuestionIndex : undefined,
      quizCorrect: event.eventType === "quiz_answer_resolved" ? event.quizCorrect : undefined,
    })),
  };
}
