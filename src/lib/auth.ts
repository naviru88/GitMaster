/* ============================================================
   Auth Utilities — JWT session with httpOnly cookies
   ============================================================ */

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';

// ---- Constants ----
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'gitmaster-jwt-secret-change-in-production',
);
const COOKIE_NAME = 'gitmaster_session';
const TOKEN_EXPIRY = '7d'; // 7 days

// ---- Password helpers ----
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

// ---- JWT helpers ----
export interface SessionPayload {
  userId: string;
  email: string;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: (payload.userId as string) || '',
      email: (payload.email as string) || '',
    };
  } catch {
    return null;
  }
}

// ---- Cookie helpers ----
export function createSessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
}

export function deleteSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ---- Get authenticated user from request ----
export async function getAuthUser(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  const payload = await verifyToken(cookie.value);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true },
  });

  return user;
}

// Helper to require auth (returns user or throws 401 Response)
export async function requireAuth(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    throw new AuthError('Authentication required. Please log in.', 401);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
