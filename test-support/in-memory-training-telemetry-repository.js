import { conflict, notFound } from "../src/lib/app-error.js";

function clone(value) {
  return structuredClone(value);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function contiguousSequence(events) {
  let expected = 1;
  for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
    if (event.sequence !== expected) break;
    expected += 1;
  }
  return expected - 1;
}

export function createInMemoryTrainingTelemetryRepository() {
  const sessions = new Map();
  const participants = new Map();
  let nextParticipantId = 1;

  function resolveParticipant(input) {
    const identityType = input.metaUserId ? "meta" : "anonymous";
    const identityValue = input.metaUserId ?? input.clientInstanceId;
    const key = `${input.sourceProject}:${identityType}:${identityValue}`;
    let participant = participants.get(key);
    if (!participant) {
      const timestamp = new Date().toISOString();
      participant = {
        participantId: nextParticipantId++,
        sourceProject: input.sourceProject,
        identityType,
        identityTypes: [identityType],
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
      };
      participants.set(key, participant);
    } else {
      participant.lastSeenAt = new Date().toISOString();
    }
    return participant;
  }

  return {
    async createSession(input) {
      const participant = resolveParticipant(input);
      const existing = sessions.get(input.sessionId);
      if (existing) {
        if (!same(existing.input, input)) {
          throw conflict("sessionId is already used by a different session payload.");
        }
        return { ...clone(existing.session), created: false };
      }
      const timestamp = new Date().toISOString();
      const session = {
        sessionId: input.sessionId,
        schemaVersion: input.schemaVersion,
        sourceProject: input.sourceProject,
        participantId: participant.participantId,
        status: "open",
        startedAtUtc: input.startedAtUtc,
        endedAtUtc: null,
        endReason: null,
        appVersion: input.appVersion,
        scene: input.scene,
        mode: input.mode,
        workPlan: input.workPlan,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      sessions.set(input.sessionId, { input: clone(input), session, events: [] });
      return { ...clone(session), created: true };
    },

    async saveEvents(sessionId, events) {
      const stored = sessions.get(sessionId);
      if (!stored) throw notFound("Training telemetry session not found.");
      if (stored.session.status !== "open") {
        throw conflict("Completed training telemetry sessions cannot accept new events.");
      }
      let accepted = 0;
      let duplicates = 0;
      const nextEvents = clone(stored.events);
      for (const event of events) {
        const collision = nextEvents.find((candidate) =>
          candidate.eventId === event.eventId || candidate.sequence === event.sequence);
        if (collision) {
          if (!same(collision, event)) {
            throw conflict("eventId or sequence is already used by different event data.");
          }
          duplicates += 1;
        } else {
          nextEvents.push(clone(event));
          accepted += 1;
        }
      }
      stored.events = nextEvents;
      stored.session.updatedAt = new Date().toISOString();
      return {
        accepted,
        duplicates,
        rejected: 0,
        acceptedThroughSequence: contiguousSequence(nextEvents),
      };
    },

    async completeSession(sessionId, completion) {
      const stored = sessions.get(sessionId);
      if (!stored) throw notFound("Training telemetry session not found.");
      if (stored.session.schemaVersion !== completion.schemaVersion) {
        throw conflict("schemaVersion does not match the existing session.");
      }
      if (Date.parse(completion.endedAtUtc) < Date.parse(stored.session.startedAtUtc)) {
        throw conflict("endedAtUtc must not be earlier than startedAtUtc.");
      }
      if (stored.session.status === "completed") {
        if (stored.session.endedAtUtc !== completion.endedAtUtc ||
            stored.session.endReason !== completion.reason) {
          throw conflict("The session is already completed with different data.");
        }
        return clone(stored.session);
      }
      stored.session.status = "completed";
      stored.session.endedAtUtc = completion.endedAtUtc;
      stored.session.endReason = completion.reason;
      stored.session.updatedAt = new Date().toISOString();
      return clone(stored.session);
    },

    async listSessions({ limit, participantId }) {
      return [...sessions.values()]
        .filter((stored) => participantId === null || stored.session.participantId === participantId)
        .sort((left, right) => right.session.startedAtUtc.localeCompare(left.session.startedAtUtc))
        .slice(0, limit)
        .map((stored) => ({ ...clone(stored.session), eventCount: stored.events.length }));
    },

    async findSession(sessionId) {
      const stored = sessions.get(sessionId);
      return stored
        ? {
            ...clone(stored.session),
            eventCount: stored.events.length,
            events: clone(stored.events).sort((left, right) => left.sequence - right.sequence),
          }
        : null;
    },

    async listParticipants(limit) {
      return [...participants.values()]
        .sort((left, right) => right.participantId - left.participantId)
        .slice(0, limit)
        .map((participant) => ({
          ...clone(participant),
          sessionCount: [...sessions.values()].filter(
            (stored) => stored.session.participantId === participant.participantId,
          ).length,
        }));
    },

    async findParticipant(participantId) {
      const participant = [...participants.values()].find(
        (candidate) => candidate.participantId === participantId,
      );
      if (!participant) return null;
      const participantSessions = await this.listSessions({ limit: 100, participantId });
      return {
        ...clone(participant),
        sessionCount: participantSessions.length,
        sessions: participantSessions,
      };
    },
  };
}
