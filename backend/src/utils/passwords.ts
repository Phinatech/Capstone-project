/**
 * Password hashing.
 *
 * Replaces the FNV-1a checksum that was in the frontend (F-3). FNV-1a is a
 * 32-bit non-cryptographic hash: it is fast *by design*, has no salt and no
 * work factor, and a leaked `localStorage` dump could be brute-forced with a
 * laptop. It also produced only 8 hex characters, so the entire password space
 * collided into 4 billion values.
 *
 * scrypt is used instead because it is in `node:crypto` — no native build
 * dependency, no extra package in the tree — and it is memory-hard, which is
 * what makes GPU cracking expensive. The parameters here need no tuning for a
 * deployment of this size.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/** CPU/memory cost. 2^15 with r=8 needs ~32 MB and ~100 ms per hash. */
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAXMEM = 64 * 1024 * 1024;

const PREFIX = "scrypt";

/**
 * Hashes a password into a self-describing string, e.g.
 * `scrypt$32768$8$1$<salt hex>$<hash hex>`. The parameters travel with the
 * hash so they can be raised later without invalidating existing passwords.
 *
 * Cost is deliberately spent here rather than in a constant-time compare:
 * every hash pays it once, and verification re-derives it per attempt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: MAXMEM
  });
  return [PREFIX, COST, BLOCK_SIZE, PARALLELISM, salt.toString("hex"), derived.toString("hex")].join("$");
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false — never throws — for anything malformed, so a corrupted or
 * truncated record cannot be mistaken for a match, and so callers do not have
 * to distinguish "wrong password" from "unusable hash".
 */
export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const [prefix, costRaw, blockRaw, parallelRaw, saltHex, hashHex] = stored.split("$");
  // Destructuring rather than indexing: it both proves the shape and gives
  // TypeScript non-optional bindings to work with.
  if (prefix !== PREFIX || !costRaw || !blockRaw || !parallelRaw || !saltHex || !hashHex) return false;

  const cost = Number(costRaw);
  const blockSize = Number(blockRaw);
  const parallelism = Number(parallelRaw);
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");

  if (!Number.isInteger(cost) || cost < 2 || cost > 2 ** 22) return false;
  if (!Number.isInteger(blockSize) || blockSize < 1 || blockSize > 64) return false;
  if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 16) return false;
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(password, salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelism,
      maxmem: Math.max(MAXMEM, 128 * cost * blockSize * 2)
    });
  } catch {
    // A hostile record could ask for an impossible work factor; treat it as a
    // failed verification rather than crashing the request.
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** True when `stored` was produced at a weaker cost than we now require. */
export function needsRehash(stored: string | undefined): boolean {
  if (!stored) return true;
  const [prefix, cost] = stored.split("$");
  return prefix !== PREFIX || Number(cost) < COST;
}
