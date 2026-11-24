import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Login for the private /pro area: one shared password (PRO_PASSWORD env var)
// and a cookie. There are no user accounts.
//
// The cookie does not hold the password. It holds an HMAC keyed by the
// password, so it cannot be forged without knowing the password, and changing
// PRO_PASSWORD signs every browser out.
//
// Every /pro page AND every /pro Server Action must check the session itself
// (requireProSession / hasProSession): a layout check alone does not protect
// the pages or actions under it.

export const PRO_LOGIN_PATH = "/pro/login";
export const PRO_HOME_PATH = "/pro";

const COOKIE_NAME = "pro_session";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_MESSAGE = "thaigoldtracker-pro-session-v1";
/** A shorter PRO_PASSWORD is treated as "not set": the area stays locked. */
const MIN_PASSWORD_LENGTH = 8;
/** Every wrong password costs this long - slows down guessing. */
const WRONG_PASSWORD_DELAY_MS = 1500;

function configuredPassword(): string | null {
  const value = process.env.PRO_PASSWORD?.trim() ?? "";
  return value.length >= MIN_PASSWORD_LENGTH ? value : null;
}

/** False until PRO_PASSWORD is set (to at least 8 characters). */
export function isProConfigured(): boolean {
  return configuredPassword() !== null;
}

function sessionToken(password: string): string {
  return createHmac("sha256", password).update(SESSION_MESSAGE).digest("hex");
}

/** Constant-time comparison of two strings of any length. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function hasProSession(): Promise<boolean> {
  const password = configuredPassword();
  if (!password) return false;
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  return typeof cookie === "string" && safeEqual(cookie, sessionToken(password));
}

/** For pages and Server Actions: sends anyone who is not logged in to the login page. */
export async function requireProSession(): Promise<void> {
  if (!(await hasProSession())) redirect(PRO_LOGIN_PATH);
}

/**
 * Checks a submitted password and, if right, sets the session cookie.
 * Only callable from a Server Action (it writes a cookie).
 */
export async function logInWithPassword(submitted: string): Promise<boolean> {
  const password = configuredPassword();
  if (!password || !safeEqual(submitted.trim(), password)) {
    await new Promise((resolve) => setTimeout(resolve, WRONG_PASSWORD_DELAY_MS));
    return false;
  }

  (await cookies()).set(COOKIE_NAME, sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Only ever sent to /pro pages, never with the public site's requests.
    path: PRO_HOME_PATH,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return true;
}

/** Only callable from a Server Action. */
export async function logOut(): Promise<void> {
  // Deleting needs the same path the cookie was set with.
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: PRO_HOME_PATH,
    maxAge: 0,
  });
}
