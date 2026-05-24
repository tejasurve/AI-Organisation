// lib/platform/vault/secrets.ts
//
// Local encrypted secret store. Plaintext keys never leave the server.
//
//   File: .simulation/secrets.json (git-ignored)
//   Format: { [key: SecretKey]: { encrypted: string, updatedAt: number } }
//
// SecretKey is the *provider name*, not the actual value:
//   gemini, anthropic, openai, cursor, github, stitch
//
// On first run, if a `STITCH_API_KEY` is present in the environment we seed
// the Stitch slot so the Designer flow lights up out-of-the-box. We never
// hard-code a real key in source — put yours in `.env.local`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { decrypt, encrypt, masked } from "./crypto.ts";

export type SecretKey =
  | "gemini"
  | "anthropic"
  | "openai"
  | "cursor"
  | "github"
  | "stitch";

export const SECRET_KEYS: readonly SecretKey[] = [
  "gemini",
  "anthropic",
  "openai",
  "cursor",
  "github",
  "stitch",
] as const;

const DIR = resolve(process.cwd(), ".simulation");
const FILE = join(DIR, "secrets.json");

interface StoredSecret {
  encrypted: string;
  updatedAt: number;
}

type Store = Record<SecretKey, StoredSecret | undefined>;

/**
 * Read the optional Stitch seed from the environment. Returning `null`
 * here is the deliberate fall-back; the platform still runs (Designer
 * stage will surface a clean "Stitch not configured" message until the
 * user sets a key via the Settings drawer).
 */
function seedStitchFromEnv(): string | null {
  const v = process.env.STITCH_API_KEY?.trim();
  return v && v.length > 0 ? v : null;
}

let cache: Store | null = null;

function ensureDir(): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

function load(): Store {
  if (cache) return cache;
  ensureDir();
  if (!existsSync(FILE)) {
    cache = {} as Store;
    const seed = seedStitchFromEnv();
    if (seed) setSecret("stitch", seed);
    return cache!;
  }
  try {
    const raw = readFileSync(FILE, "utf-8");
    cache = JSON.parse(raw) as Store;
  } catch {
    cache = {} as Store;
  }
  if (!cache!.stitch) {
    const seed = seedStitchFromEnv();
    if (seed) setSecret("stitch", seed);
  }
  return cache!;
}

function persist(): void {
  ensureDir();
  writeFileSync(FILE, JSON.stringify(cache ?? {}, null, 2), { mode: 0o600 });
}

export function setSecret(key: SecretKey, value: string): void {
  if (!cache) cache = (load() as Store) ?? ({} as Store);
  cache[key] = { encrypted: encrypt(value), updatedAt: Date.now() };
  persist();
}

export function deleteSecret(key: SecretKey): void {
  if (!cache) load();
  if (cache?.[key]) {
    delete cache[key];
    persist();
  }
}

export function getSecret(key: SecretKey): string | null {
  const s = load();
  const v = s[key];
  if (!v) return null;
  try {
    return decrypt(v.encrypted);
  } catch {
    return null;
  }
}

export function hasSecret(key: SecretKey): boolean {
  return getSecret(key) !== null;
}

export interface SecretStatus {
  key: SecretKey;
  configured: boolean;
  preview: string | null;
  updatedAt: number | null;
}

export function listSecretStatuses(): SecretStatus[] {
  const s = load();
  return SECRET_KEYS.map((k) => {
    const v = getSecret(k);
    return {
      key: k,
      configured: v !== null,
      preview: v ? masked(v) : null,
      updatedAt: s[k]?.updatedAt ?? null,
    };
  });
}
