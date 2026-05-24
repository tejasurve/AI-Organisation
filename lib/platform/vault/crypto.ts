// lib/platform/vault/crypto.ts
//
// AES-256-GCM with a key derived deterministically from the local install
// fingerprint. Threat model: keep keys out of plaintext on disk so a stolen
// repo (or screen-share) doesn't immediately leak provider tokens. NOT a
// substitute for OS keychain on production — this is a local-dev convenience.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { hostname, userInfo } from "node:os";

const ALGO = "aes-256-gcm";
const SALT_LEN = 16;
const NONCE_LEN = 12;
const TAG_LEN = 16;

function installPassphrase(): string {
  // Stable per-install: machine + UNIX uid. Reinstall on a different machine
  // and the blob becomes opaque, which is the right failure mode.
  const u = userInfo();
  return `ai-organisation::${hostname()}::${u.uid}::${u.username}`;
}

function deriveKey(salt: Buffer): Buffer {
  return scryptSync(installPassphrase(), salt, 32);
}

export function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const key = deriveKey(salt);
  const cipher = createCipheriv(ALGO, key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, nonce, tag, enc]).toString("base64");
}

export function decrypt(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const salt = buf.subarray(0, SALT_LEN);
  const nonce = buf.subarray(SALT_LEN, SALT_LEN + NONCE_LEN);
  const tag = buf.subarray(SALT_LEN + NONCE_LEN, SALT_LEN + NONCE_LEN + TAG_LEN);
  const enc = buf.subarray(SALT_LEN + NONCE_LEN + TAG_LEN);
  const key = deriveKey(salt);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

/** Show only last 4 chars; useful for UI confirmation without leaking. */
export function masked(key: string): string {
  if (key.length <= 6) return "•".repeat(key.length);
  return `${"•".repeat(Math.max(4, key.length - 4))}${key.slice(-4)}`;
}
