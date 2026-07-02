import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Clear the httpOnly cookie from the server side
  response.cookies.set("webmail_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
