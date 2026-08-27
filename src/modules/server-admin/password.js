import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const OPTIONS = Object.freeze({ N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

export async function hashPassword(password, { minimumLength = 12 } = {}) {
  if (typeof password !== "string" || password.length < minimumLength || password.length > 256) {
    throw new Error(`Password must be between ${minimumLength} and 256 characters.`);
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, OPTIONS);
  return `scrypt$${OPTIONS.N}$${OPTIONS.r}$${OPTIONS.p}$${salt.toString("base64")}$${Buffer.from(derived).toString("base64")}`;
}

export async function verifyPassword(password, encoded) {
  try {
    const [algorithm, n, r, p, saltValue, hashValue] = encoded.split("$");
    if (algorithm !== "scrypt") return false;
    const expected = Buffer.from(hashValue, "base64");
    const derived = Buffer.from(await scrypt(password, Buffer.from(saltValue, "base64"), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    }));
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}
