/**
 * Supplier Health Check API
 * GET /api/tenant/suppliers/health
 *
 * Returns real-time health status for all SMPP suppliers including:
 *   - bind_status (BOUND / UNBOUND / BIND_FAILED)
 *   - uptime_seconds (time since last successful bind)
 *   - last_bind_time
 *   - bind_error (last error message)
 *   - live_session (whether TCP session is active in memory)
 *   - summary stats (total, bound, unbound, health_pct)
 */
import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { isSupplierServerSessionActive } from "@/lib/smpp-server";
import { isSupplierConnected } from "@/lib/smpp-client";

export const dynamic = "force-dynamic";

interface SupplierHealth {
  id: number;
  name: string;
  connection_mode: string;
  connection_type: string;
  bind_status: string;
  uptime_seconds: number | null;
  last_bind_time: string | null;
  bind_error: string | null;
  live_session: boolean;
  is_active: boolean;
}

interface HealthResponse {
  suppliers: SupplierHealth[];
  summary: {
    total: number;
    bound: number;
    unbound: number;
    failed: number;
    health_pct: number;
  };
  checked_at: string;
}

export async function GET(request: Request): Promise<NextResponse> {
  const tenant = getTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await tenantQuery(
      tenant.schemaName,
      `SELECT id, name, connection_type, connection_mode, bind_status,
              last_bind_time, bind_error, is_active
       FROM suppliers
       WHERE connection_type = 'SMPP' AND deleted_at IS NULL
       ORDER BY id ASC`
    );

    const now = new Date();
    const suppliers: SupplierHealth[] = result.rows.map((row: any) => {
      const lastBind: Date | null = row.last_bind_time ? new Date(row.last_bind_time) : null;
      const uptimeSeconds: number | null =
        lastBind && row.bind_status === "BOUND"
          ? Math.floor((now.getTime() - lastBind.getTime()) / 1000)
          : null;

      // Check live session based on connection mode
      let liveSession = false;
      if (row.bind_status === "BOUND") {
        if (row.connection_mode === "SERVER") {
          liveSession = isSupplierServerSessionActive(tenant.tenantId, row.id);
        } else {
          liveSession = isSupplierConnected(tenant.tenantId, row.id);
        }
      }

      return {
        id: row.id,
        name: row.name,
        connection_mode: row.connection_mode || "CLIENT",
        connection_type: row.connection_type,
        bind_status: row.bind_status || "UNBOUND",
        uptime_seconds: uptimeSeconds,
        last_bind_time: row.last_bind_time ? new Date(row.last_bind_time).toISOString() : null,
        bind_error: row.bind_error || null,
        live_session: liveSession,
        is_active: row.is_active,
      };
    });

    const active = suppliers.filter((s) => s.is_active);
    const bound = active.filter((s) => s.bind_status === "BOUND").length;
    const unbound = active.filter((s) => s.bind_status === "UNBOUND").length;
    const failed = active.filter(
      (s) => s.bind_status !== "BOUND" && s.bind_status !== "UNBOUND"
    ).length;

    const healthPct = active.length > 0
      ? Math.round((bound / active.length) * 100)
      : 0;

    const response: HealthResponse = {
      suppliers,
      summary: {
        total: active.length,
        bound,
        unbound,
        failed,
        health_pct: healthPct,
      },
      checked_at: now.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[SupplierHealth] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve supplier health status" },
      { status: 500 }
    );
  }
}
