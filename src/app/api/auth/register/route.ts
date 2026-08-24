import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, signToken, createSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 },
      );
    }

    const hashed = await hashPassword(password);
    const user = await db.user.create({
      data: { name: name.trim(), email: normalizedEmail, password: hashed },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const token = await signToken({ userId: user.id, email: user.email });

    return NextResponse.json(user, {
      status: 201,
      headers: { 'Set-Cookie': createSessionCookie(token) },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
