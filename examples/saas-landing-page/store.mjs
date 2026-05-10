// examples/saas-landing-page/store.mjs
//
// In-memory store mirroring the AI-generated Drizzle schema in
//   generated/t-signup-storage-1/lib/db/schema/signups.ts
//
// Row shape (intentionally identical to the Drizzle table columns):
//   { id: string (uuid), email: string, source: string, createdAt: string (ISO) }
//
// Dedup key: lowercased email (matches the unique(email) constraint).
//
// This file deliberately uses no SQL and no dependencies so the demo runs with
// `node server.mjs` only. Swapping it out for the real Drizzle table is a
// straight one-file replacement: same insert/find signatures, same row shape.

import { randomUUID } from "node:crypto";

const rows = new Map(); // emailLower → row

export function insertSignup({ email, source }) {
  const key = email.toLowerCase();
  const existing = rows.get(key);
  if (existing) {
    return { row: existing, status: "duplicate" };
  }
  const row = {
    id: randomUUID(),
    email,
    source: source || "landing-v1",
    createdAt: new Date().toISOString(),
  };
  rows.set(key, row);
  return { row, status: "queued" };
}

export function listSignups() {
  return Array.from(rows.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
}

export function countSignups() {
  return rows.size;
}

export function clearSignups() {
  rows.clear();
}
