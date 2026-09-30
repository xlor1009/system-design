import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findOrCreateUser, getUser, sessionFromUser } from "@/lib/db";
import type { Session } from "@/lib/types";

const COOKIE = "sl_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function groupPassword(): string {
  return process.env.GROUP_PASSWORD ?? "changeme";
}

export function verifyGroupPassword(password: string): boolean {
  return password === groupPassword();
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.userId || !parsed.displayName) return null;
    const user = getUser(parsed.userId);
    if (!user) return null;
    return sessionFromUser(user);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function loginResponse(password: string, displayName: string): NextResponse {
  const name = displayName.trim();
  if (!verifyGroupPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  if (!name || name.length > 64) {
    return NextResponse.json({ error: "Display name required" }, { status: 400 });
  }

  const user = findOrCreateUser(name);
  const session = sessionFromUser(user);
  const res = NextResponse.json({ ok: true, session });
  res.cookies.set(COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export function logoutResponse(): NextResponse {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
