export function createInMemoryTrainingRegistrationRepository() {
  const records = new Map();
  return {
    async save(record) {
      records.set(record.sessionId, structuredClone(record));
      return structuredClone(record);
    },
    async findBySessionId(sessionId) {
      const record = records.get(sessionId);
      return record ? structuredClone(record) : null;
    },
  };
}
