// lib/db/client.ts
//
// Storage adapter for the signups table. The Drizzle schema in
// ./schema/signups.ts remains the single source of truth for the row shape
// (we type rows as Signup = typeof signups.$inferSelect), but rows are stored
// in an in-memory Map so the demo runs with zero database setup.
//
// Upgrade to real Postgres + Drizzle (the CTO's target stack) is a one-file
// swap:
//
//   1. npm install drizzle-orm postgres
//   2. Replace the in-memory Map below with:
//        import { drizzle } from "drizzle-orm/postgres-js";
//        import postgres from "postgres";
//        import * as schema from "./schema";
//        const sql = postgres(process.env.DATABASE_URL!);
//        export const db = drizzle(sql, { schema });
//      and rewrite findSignupByEmail / insertSignup to use db.select / db.insert.
//   3. Run `drizzle-kit generate` against ./schema to produce the SQL migration.

import type { Signup } from "./schema/signups";

const rows = new Map<string, Signup>(); // email-lowered → row

export function findSignupByEmail(email: string): Signup | undefined {
  return rows.get(email.toLowerCase());
}

export function insertSignup(row: Signup): Signup {
  rows.set(row.email.toLowerCase(), row);
  return row;
}

export function listSignups(): Signup[] {
  return Array.from(rows.values()).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export function countSignups(): number {
  return rows.size;
}

export function clearSignups(): void {
  rows.clear();
}
