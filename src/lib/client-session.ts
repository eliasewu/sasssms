/**
 * Client-side helper for the access/refresh token model. This file is imported
 * by "use client" components only — it must NOT pull in any server-only module
 * (@/db, next/server, pg, etc.).
 *
 * The access token lives 15 minutes. While the dashboard is open we refresh it
 * proactively (before it expires), and on a 401 we attempt one silent refresh
 * before redirecting to login — so a valid refresh token keeps the user
 * "stayed in" without re-entering their password.
 */
export async function refreshAuthSession(kind: "tenant" | "super"): Promise<boolean> {
  try {
    const res = await fetch(kind === "tenant" ? "/api/auth/refresh" : "/api/super/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
