import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ENTRY_COOKIE_MAX_AGE } from "@/lib/entry/constants";

/** 再編集用トークン（Cookie に保存する値） */
export function generateEditToken(): string {
  return randomBytes(32).toString("base64url");
}

/** DB にはトークン本体ではなくハッシュを保存する */
export function hashEditToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const entryCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ENTRY_COOKIE_MAX_AGE,
};
