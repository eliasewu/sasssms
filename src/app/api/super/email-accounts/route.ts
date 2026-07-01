import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { emailAccounts, superAdmins } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email-service";
import { logAudit, AuditAction } from "@/lib/audit-log";

async function getAdminActor(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return null;
  // Fetch admin name from database
  const [record] = await db.select({ name: superAdmins.name }).from(superAdmins).where(eq(superAdmins.id, admin.adminId));
  return {
    adminId: admin.adminId,
    adminName: record?.name || admin.email,
    adminEmail: admin.email,
  };
}

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(emailAccounts).orderBy(desc(emailAccounts.id));
  return NextResponse.json({ accounts: result });
}

export async function POST(request: Request) {
  const actor = await getAdminActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { email, name, password, department, diskQuotaMB } = body;

  if (!email || !name || !password) {
    return NextResponse.json({ error: "Email, name, and password are required" }, { status: 400 });
  }

  // Validate email domain
  if (!email.endsWith("@net2app.com")) {
    return NextResponse.json({ error: "Email must be @net2app.com domain" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const [account] = await db.insert(emailAccounts).values({
    email: email.toLowerCase().trim(),
    passwordHash,
    name,
    department: department || null,
    diskQuotaMB: diskQuotaMB || 500,
    isActive: true,
  }).returning();

  // Audit log
  logAudit(actor, "create", account.id, account.email, {
    name: account.name,
    department: account.department,
    diskQuotaMB: account.diskQuotaMB,
  }).catch(() => {});

  // Send welcome email with credentials
  sendWelcomeEmail({
    email: account.email,
    name: account.name,
    password,
  }).catch(() => {});

  return NextResponse.json({ account: { ...account, passwordHash: undefined } }, { status: 201 });
}

export async function PUT(request: Request) {
  const actor = await getAdminActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const accountId = url.searchParams.get("id");
  if (!accountId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await request.json();
  const updateData: Record<string, unknown> = {};
  const changes: Record<string, unknown> = {};
  let action: AuditAction = "update";

  if (body.isActive !== undefined) {
    updateData.isActive = body.isActive;
    changes.isActive = body.isActive;
    action = "toggle_active";
  }
  if (body.diskQuotaMB !== undefined) {
    updateData.diskQuotaMB = body.diskQuotaMB;
    changes.diskQuotaMB = body.diskQuotaMB;
  }
  if (body.department !== undefined) {
    updateData.department = body.department;
    changes.department = body.department;
  }
  if (body.name !== undefined) {
    updateData.name = body.name;
    changes.name = body.name;
  }

  // Handle password reset
  let newPassword: string | null = null;
  if (body.password !== undefined && String(body.password).length >= 8) {
    updateData.passwordHash = await hashPassword(String(body.password));
    newPassword = String(body.password);
    action = "password_reset";
    changes.passwordReset = true;
  }

  await db.update(emailAccounts).set(updateData).where(eq(emailAccounts.id, parseInt(accountId)));

  // Get account email for audit log
  const [account] = await db.select({ email: emailAccounts.email }).from(emailAccounts).where(eq(emailAccounts.id, parseInt(accountId)));

  // Audit log
  logAudit(actor, action, parseInt(accountId), account?.email || "unknown", changes).catch(() => {});

  if (newPassword) {
    return NextResponse.json({ success: true, passwordReset: true });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const actor = await getAdminActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Get account info before deleting for audit
  const [account] = await db.select({ email: emailAccounts.email, name: emailAccounts.name }).from(emailAccounts).where(eq(emailAccounts.id, parseInt(id)));

  await db.delete(emailAccounts).where(eq(emailAccounts.id, parseInt(id)));

  // Audit log
  if (account) {
    logAudit(actor, "delete", parseInt(id), account.email, { name: account.name }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
