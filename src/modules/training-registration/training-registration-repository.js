import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export function createFileTrainingRegistrationRepository(filePath) {
  const resolvedPath = path.resolve(filePath);
  let writeQueue = Promise.resolve();

  async function readRecords() {
    try {
      const content = await readFile(resolvedPath, "utf8");
      return content
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  return {
    async save(record) {
      writeQueue = writeQueue.then(async () => {
        await mkdir(path.dirname(resolvedPath), { recursive: true });
        await appendFile(resolvedPath, `${JSON.stringify(record)}\n`, "utf8");
      });
      await writeQueue;
      return structuredClone(record);
    },

    async findBySessionId(sessionId) {
      await writeQueue;
      const records = await readRecords();
      const record = records.findLast((item) => item.sessionId === sessionId);
      return record ? structuredClone(record) : null;
    },
  };
}
