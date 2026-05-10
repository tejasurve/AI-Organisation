import { cookies } from "next/headers";

export interface Session {
  retailerId: string;
}

export const SESSION_COOKIE = "pharmacy-session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function getSession(): Session | null {
  const c = cookies().get(SESSION_COOKIE);
  if (!c) return null;
  return { retailerId: c.value };
}

export function getSessionOrThrow(): Session {
  const s = getSession();
  if (!s) throw new Error("getSessionOrThrow: no pharmacy-session cookie");
  return s;
}
