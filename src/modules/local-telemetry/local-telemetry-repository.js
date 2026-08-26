import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

function lastValue(events, field) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const value = events[index]?.[field];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function uniqueValues(events, field, excluded = new Set()) {
  return [...new Set(
    events
      .map((event) => event?.[field])
      .filter((value) => value && !excluded.has(value)),
  )];
}

function summarize(fileName, events, invalidLines) {
  const ended = events.findLast((event) => event.eventType === "session_ended");
  const resolvedGrabs = events.filter(
    (event) => event.eventType === "ppe_grab_attempt_resolved",
  );
  return {
    sessionId: lastValue(events, "sessionId"),
    sourceFile: fileName,
    startedAt: events[0]?.timestampUtc ?? null,
    endedAt: ended?.timestampUtc ?? null,
    endNote: ended?.note ?? null,
    metaUserId: lastValue(events, "metaAppScopedUserId"),
    metaAgeCategory: lastValue(events, "metaAgeCategory"),
    modes: uniqueValues(events, "mode"),
    workPlans: uniqueValues(events, "workPlan", new Set(["None"])),
    lastFlowState: lastValue(events, "flowState"),
    eventCount: events.length,
    invalidLineCount: invalidLines.length,
    invalidLineNumbers: invalidLines,
    courseCompleted: events.some(
      (event) => event.eventType === "flow_state_changed" && event.flowState === "Completed",
    ),
    requiredPpeCompleted: events.some(
      (event) => event.requiredPpeCheck === "complete",
    ),
    ppeChoiceCount: events.filter(
      (event) => event.eventType === "ppe_choice_resolved",
    ).length,
    grabAttemptCount: events.filter(
      (event) => event.eventType === "ppe_grab_attempted",
    ).length,
    grabSuccessCount: resolvedGrabs.filter(
      (event) => event.attemptOutcome === "selected",
    ).length,
    grabFailureCount: resolvedGrabs.filter(
      (event) => event.attemptOutcome && event.attemptOutcome !== "selected",
    ).length,
  };
}

async function parseSessionFile(directory, fileName) {
  const content = await readFile(path.join(directory, fileName), "utf8");
  const events = [];
  const parseErrors = [];
  content.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) {
      return;
    }
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      parseErrors.push({
        lineNumber: index + 1,
        rawLine: line,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return {
    summary: summarize(
      fileName,
      events,
      parseErrors.map((error) => error.lineNumber),
    ),
    events,
    parseErrors,
  };
}

export function createLocalTelemetryRepository(directory) {
  const resolvedDirectory = path.resolve(directory || ".");

  async function readSessions() {
    let entries;
    try {
      entries = await readdir(resolvedDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const files = entries
      .filter((entry) => entry.isFile() && /^session-.*\.jsonl$/i.test(entry.name))
      .map((entry) => entry.name);
    const sessions = await Promise.all(
      files.map((fileName) => parseSessionFile(resolvedDirectory, fileName)),
    );
    return sessions.sort((left, right) =>
      String(right.summary.startedAt).localeCompare(String(left.summary.startedAt)));
  }

  return {
    async list() {
      const sessions = await readSessions();
      return sessions.map((session) => structuredClone(session.summary));
    },

    async findBySessionId(sessionId) {
      const sessions = await readSessions();
      const session = sessions.find((item) => item.summary.sessionId === sessionId);
      return session ? structuredClone(session) : null;
    },
  };
}
