import { Role, type User } from "@prisma/client";
import { addDays } from "date-fns";
import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { portalRoutes, SESSION_COOKIE_NAME, SESSION_TTL_DAYS } from "@/lib/constants";

type SessionUser = User & {
  clientProfile: {
    id: string;
    businessName: string;
  } | null;
};

function makeSessionToken() {
  return randomBytes(32).toString("hex");
}

export async function hashPassword(value: string) {
  return hash(value, 12);
}

export async function verifyPassword(value: string, passwordHash: string) {
  return compare(value, passwordHash);
}

export async function createSession(userId: string) {
  const token = makeSessionToken();
  const expiresAt = addDays(new Date(), SESSION_TTL_DAYS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  store.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          clientProfile: {
            select: {
              id: true,
              businessName: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    store.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return session.user as SessionUser;
}

export async function requireUser(requiredRole?: Role) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (requiredRole && user.role !== requiredRole) {
    redirect(portalRoutes[user.role]);
  }

  return user;
}

export async function requireUserForRoute(requiredRole?: Role) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  if (requiredRole && user.role !== requiredRole) {
    return { error: "Forbidden", status: 403 as const };
  }

  return { user };
}
