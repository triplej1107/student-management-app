import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import type { SessionData } from "./types";

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    "SESSION_SECRET이 설정되지 않았거나 32자 미만입니다. .env.local을 확인하세요."
  );
}

export const sessionOptions: SessionOptions = {
  cookieName: "yjm_session",
  password: secret,
  ttl: 60 * 60 * 24 * 30, // 30 days
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
