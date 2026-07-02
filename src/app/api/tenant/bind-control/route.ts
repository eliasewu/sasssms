import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";
import { isClientSessionActive, closeClientSession } from "@/lib/smpp-server";
import { isSupplierConnected, disconnectSupplier, connectToSupplier } from "@/lib/smpp-client";

// Bind or unbind a client or supplier
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { entityType, entityId, action } = body; // entityType: "clients" | "suppliers", action: "BIND" | "UNBIND"

  if (!entityType || !entityId || !action) {
    return NextResponse.json({ error: "entityType, entityId, action required" }, { status: 400 });
  }

  const table = entityType === "clients" ? "clients" : "suppliers";

  // Get current entity
  const oldResult = await tenantQuery(tenant.schemaName, `SELECT * FROM ${table} WHERE id = $1`, [entityId]);
  if (oldResult.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entity = oldResult.rows[0];

  if (action === "BIND") {
    // ── BIND: Verify real SMPP connection exists before claiming BOUND ──
    if (entityType === "clients") {
      // For clients: check if there's an active SMPP session (ESME connected to our SMSC)
      const hasSession = isClientSessionActive(entityId, tenant.schemaName);
      if (!hasSession) {
        // Try to verify credentials: check if SMPP username/password are configured
        if (!entity.smpp_username) {
          return NextResponse.json({
            success: false,
            error: "No SMPP credentials configured. Set smpp_username and smpp_password first.",
            entity: { id: entityId, name: entity.name, bindStatus: "UNBOUND" },
          }, { status: 400 });
        }
        return NextResponse.json({
          success: false,
          error: `Client "${entity.name}" has no active SMPP session. The ESME client must connect to our SMSC server at port 2775 first.`,
          entity: { id: entityId, name: entity.name, bindStatus: "UNBOUND" },
        }, { status: 400 });
      }

      // Update DB to reflect real bound state
      await tenantQuery(
        tenant.schemaName,
        `UPDATE ${table} SET bind_status = $1, last_bind_time = NOW(), updated_at = NOW() WHERE id = $2`,
        ["BOUND", entityId]
      );
    } else {
      // For suppliers: attempt to establish a real SMPP connection
      const host = entity.host;
      const port = entity.port || 2775;
      const username = entity.username || entity.system_id || "";
      const password = entity.password || "";

      if (!host || !username) {
        return NextResponse.json({
          success: false,
          error: "Supplier missing SMPP host or username. Configure connection details first.",
          entity: { id: entityId, name: entity.name, bindStatus: "UNBOUND" },
        }, { status: 400 });
      }

      // Check if already connected
      const alreadyConnected = isSupplierConnected(tenant.tenantId, entityId);
      if (alreadyConnected) {
        // Already has real connection - just sync DB
        await tenantQuery(
          tenant.schemaName,
          `UPDATE suppliers SET bind_status = $1, last_bind_time = NOW(), updated_at = NOW() WHERE id = $2`,
          ["BOUND", entityId]
        );
      } else {
        // Attempt real SMPP connection
        const connected = await connectToSupplier(
          tenant.tenantId,
          tenant.schemaName,
          entityId,
          host,
          port,
          username,
          password,
          entity.bind_type || "transceiver",
          entity.system_type || "SMSC",
          entity.smpp_version || "3.4"
        );

        if (!connected) {
          return NextResponse.json({
            success: false,
            error: `Failed to bind to supplier SMPP at ${host}:${port}. Check credentials and ensure the remote SMSC is reachable.`,
            entity: { id: entityId, name: entity.name || entity.supplier_code, bindStatus: "BIND_FAILED" },
          }, { status: 400 });
        }
      }
    }
  } else {
    // ── UNBIND: Close real connection and update DB ──
    if (entityType === "clients") {
      closeClientSession(entityId, tenant.schemaName);
    } else {
      disconnectSupplier(tenant.tenantId, entityId);
    }

    await tenantQuery(
      tenant.schemaName,
      `UPDATE ${table} SET bind_status = $1, updated_at = NOW() WHERE id = $2`,
      ["UNBOUND", entityId]
    );
  }

  // Get updated entity for response
  const updatedResult = await tenantQuery(tenant.schemaName, `SELECT bind_status FROM ${table} WHERE id = $1`, [entityId]);
  const realStatus = updatedResult.rows[0]?.bind_status || "UNBOUND";

  // Audit log
  await auditLog(
    table, entityId, action === "BIND" ? "BIND" : "UNBIND",
    tenant.email, { bind_status: entity.bind_status }, { bind_status: realStatus }, tenant.tenantId
  );

  return NextResponse.json({
    success: true,
    realBindStatus: realStatus,
    entity: { id: entityId, name: entity.name || entity.supplier_code, bindStatus: realStatus },
    message: `${entity.name || entity.supplier_code} ${action === "BIND" ? "bound" : "unbound"} successfully`,
  });
}

// GET endpoint: Return REAL bind status by cross-referencing DB with active sessions
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType"); // "clients" | "suppliers"

  if (!entityType) {
    return NextResponse.json({ error: "entityType required (clients or suppliers)" }, { status: 400 });
  }
  if (entityType !== "clients" && entityType !== "suppliers") {
    return NextResponse.json({ error: "Invalid entityType. Must be 'clients' or 'suppliers'." }, { status: 400 });
  }

  const table = entityType;
  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT id, COALESCE(name, supplier_code, 'Unknown') as name, bind_status FROM ${table} ORDER BY id`
  );

  // Cross-reference DB status with real active connections
  const entities = result.rows.map((row: Record<string,unknown>) => {
    let realStatus: string;

    if (entityType === "clients") {
      const hasSession = isClientSessionActive(row.id as number, tenant.schemaName);
      realStatus = hasSession ? "BOUND" : "UNBOUND";
    } else {
      const isConnected = isSupplierConnected(tenant.tenantId, row.id as number);
      realStatus = isConnected ? "BOUND" : "UNBOUND";
    }

    return {
      id: row.id,
      name: row.name,
      dbStatus: row.bind_status,
      realStatus,
    };
  });

  return NextResponse.json({ entities, realTime: new Date().toISOString() });
}
