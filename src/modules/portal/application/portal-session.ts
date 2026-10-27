import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "@/config/env";
import { prisma } from "@/infrastructure/db/client";

const PORTAL_COOKIE = "ferraro_portal";
const PORTAL_SESSION_SECONDS = 4 * 60 * 60;

interface PortalSessionPayload {
  linkId: string;
  binding: string;
  exp: number;
}

function sign(value: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(value)
    .digest("base64url");
}

export function encodePortalSession(payload: PortalSessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function sessionBinding(tokenHash: string, passwordHash: string | null) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${tokenHash}:${passwordHash ?? "unprotected"}`)
    .digest("base64url");
}

export function decodePortalSession(
  value: string,
): PortalSessionPayload | null {
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra) return null;
  const actual = Buffer.from(signature);
  const expected = Buffer.from(sign(encoded));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<PortalSessionPayload>;
    if (
      typeof parsed.linkId !== "string" ||
      typeof parsed.binding !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Math.floor(Date.now() / 1_000)
    )
      return null;
    return parsed as PortalSessionPayload;
  } catch {
    return null;
  }
}

export async function setPortalSession(link: {
  id: string;
  tokenHash: string;
  passwordHash: string | null;
  expiresAt: Date | null;
}) {
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const linkExpiry = link.expiresAt
    ? Math.floor(link.expiresAt.getTime() / 1_000)
    : Number.POSITIVE_INFINITY;
  const exp = Math.min(nowSeconds + PORTAL_SESSION_SECONDS, linkExpiry);
  const store = await cookies();
  store.set(
    PORTAL_COOKIE,
    encodePortalSession({
      linkId: link.id,
      binding: sessionBinding(link.tokenHash, link.passwordHash),
      exp,
    }),
    {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(0, exp - nowSeconds),
    },
  );
}

export async function getPortalSession() {
  const store = await cookies();
  const payload = decodePortalSession(store.get(PORTAL_COOKIE)?.value ?? "");
  if (!payload) return null;
  const now = new Date();
  const link = await prisma.clientShareLink.findFirst({
    where: {
      id: payload.linkId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      clientId: true,
      tokenHash: true,
      passwordHash: true,
    },
  });
  if (!link) return null;
  const actual = Buffer.from(payload.binding);
  const expected = Buffer.from(
    sessionBinding(link.tokenHash, link.passwordHash),
  );
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  return { id: link.id, clientId: link.clientId };
}
