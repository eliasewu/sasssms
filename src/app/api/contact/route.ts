import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "mail.net2app.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "noreply@net2app.com";
const SMTP_PASS = process.env.SMTP_PASS || "";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// ── In-memory rate limiter: max 3 submissions per IP per 60s ──
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitBuckets.delete(key);
    }
  }
}, 300_000);

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  bucket.count++;
  return { allowed: true, retryAfter: 0 };
}

function sanitize(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown";

    // ── Rate limit check ──
    const { allowed, retryAfter } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Too many requests. Please wait ${retryAfter} seconds before submitting again.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Reset": String(Math.ceil((Date.now() + retryAfter * 1000) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { name, email, phone, company, subject, message } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Name, email, subject, and message are required." },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.length < 10) {
      return NextResponse.json(
        { error: "Message must be at least 10 characters." },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: "Message must not exceed 5000 characters." },
        { status: 400 }
      );
    }

    // Sanitize inputs for HTML email
    const sName = sanitize(name);
    const sEmail = sanitize(email);
    const sPhone = phone ? sanitize(phone) : "";
    const sCompany = company ? sanitize(company) : "";
    const sSubject = sanitize(subject);
    const sMessage = sanitize(message);

    const adminEmails = ["admin@net2app.com", "elias.ewu@gmail.com"];
    const phoneRow = sPhone
      ? `<tr><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${sPhone}</td></tr>`
      : "";
    const companyRow = sCompany
      ? `<tr><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Company:</strong></td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${sCompany}</td></tr>`
      : "";
    const ipRow = ip && ip !== "unknown"
      ? `<p style="color: #94a3b8; font-size: 11px; margin-top: 12px;">IP: ${ip}</p>`
      : "";

    await transporter.sendMail({
      from: `"Net2APP Contact" <${SMTP_USER}>`,
      to: adminEmails.join(","),
      replyTo: sEmail,
      subject: `📬 Contact Form: ${sSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2563eb, #4f46e5); padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 20px;">📬 New Contact Form Submission</h2>
          </div>
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 100px;"><strong>Name:</strong></td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${sName}</td></tr>
              <tr><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${sEmail}" style="color: #2563eb;">${sEmail}</a></td></tr>
              ${phoneRow}
              ${companyRow}
              <tr><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;"><strong>Subject:</strong></td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${sSubject}</td></tr>
            </table>
            <div style="margin-top: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
              <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;"><strong>Message:</strong></p>
              <p style="color: #0f172a; margin: 0; line-height: 1.6; white-space: pre-wrap;">${sMessage}</p>
            </div>
            ${ipRow}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 11px; text-align: center;">Sent via Net2APP Contact Form</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Thank you! Your message has been sent. We'll get back to you shortly.",
    });
  } catch (e) {
    console.error("Contact form error:", e);
    return NextResponse.json(
      { error: "Failed to send message. Please try again later or email us directly." },
      { status: 500 }
    );
  }
}
