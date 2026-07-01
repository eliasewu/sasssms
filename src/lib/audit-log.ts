/**
 * Email Account Audit Logger
 * Records create, update, delete, password_reset, toggle_active actions
 * with timestamp and admin identity.
 */
import { db } from "@/db";
import { emailAccountAuditLog } from "@/db/schema";

export interface AuditAdmin {
  adminId: number;
  adminName: string;
  adminEmail: string;
}

export type AuditAction = "create" | "update" | "delete" | "password_reset" | "toggle_active";

export async function logAudit(
  admin: AuditAdmin,
  action: AuditAction,
  accountId: number,
  accountEmail: string,
  changes?: Record<string, unknown>
) {
  try {
    await db.insert(emailAccountAuditLog).values({
      accountId,
      accountEmail: accountEmail.toLowerCase(),
      action,
      changes: changes ? JSON.stringify(changes) : null,
      adminId: admin.adminId,
      adminName: admin.adminName,
      adminEmail: admin.adminEmail,
    });
  } catch (err) {
    console.error("[audit-log] Failed to write audit entry:", err);
  }
}
