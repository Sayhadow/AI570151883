import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2:${DIGEST}:${ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, digest, iterationText, salt, hash] = storedHash.split(":");

  if (scheme !== "pbkdf2" || !digest || !iterationText || !salt || !hash) {
    return false;
  }

  const derived = pbkdf2Sync(password, salt, Number(iterationText), KEY_LENGTH, digest).toString("hex");
  return timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hash, "hex"));
}

