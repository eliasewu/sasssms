import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";
import { isClientSessionActive, closeClientSession, isSupplierServerSessionActive, closeSupplierServerSession } from "@/lib/smpp-server";
import { isSupplierConnected, disconnectSupplier, connectToSupplier } from "@/lib/smpp-client";

// Bind, unbind, or force-rebind a client or supplier
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { entityType, entityId, action } = body; // entityType: "clients" | "suppliers", action: "BIND" | "UNBIND" | "REBIND"

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
      const hasSession = isClientSessionActive(entityId, tenant.schemaName);
      if (!hasSession) {
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

      await tenantQuery(
        tenant.schemaName,
        `UPDATE ${table} SET bind_status = $1, last_bind_time = NOW(), updated_at = NOW() WHERE id = $2`,
        ["BOUND", entityId]
      );
    } else if (entity.connection_mode === "SERVER") {
      const hasSession = isSupplierServerSessionActive(tenant.tenantId, entityId);
      if (!hasSession) {
        return NextResponse.json({
          success: false,
          error: `Supplier "${entity.name || entity.supplier_code}" has not registered yet. The GSM gateway must connect to our SMSC server at port 2775 first.`,
          entity: { id: entityId, name: entity.name || entity.supplier_code, bindStatus: "UNBOUND" },
        }, { status: 400 });
      }

      await tenantQuery(
        tenant.schemaName,
        "UPDATE suppliers SET bind_status = $1, bind_error = NULL, last_bind_time = NOW(), updated_at = NOW() WHERE id = $2",
        ["BOUND", entityId]
      );
    } else {
      // ── CLIENT-mode supplier: we connect to them ──
      // API/HTTP suppliers don't need SMPP binding
      const connType = (entity.connection_type as string) || "SMPP";
      if (connType !== "SMPP") {
        await tenantQuery(
          tenant.schemaName,
          "UPDATE suppliers SET bind_status = $1, updated_at = NOW() WHERE id = $2",
          ["ACTIVE", entityId]
        );
        return NextResponse.json({
          success: true, realBindStatus: "ACTIVE",
          entity: { id: entityId, name: entity.name, bindStatus: "ACTIVE" },
          message: `"${entity.name}" is an API supplier — always active.`,
        });
      }

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

      const alreadyConnected = isSupplierConnected(tenant.tenantId, entityId);
      if (alreadyConnected) {
        await tenantQuery(
          tenant.schemaName,
          `UPDATE suppliers SET bind_status = $1, bind_error = NULL, last_bind_time = NOW(), updated_at = NOW() WHERE id = $2`,
          ["BOUND", entityId]
        );
      } else {
        const connected = await connectToSupplier(
          tenant.tenantId, tenant.schemaName, entityId, host, port, username, password,
          entity.bind_type || "transceiver", entity.system_type || "SMSC", entity.smpp_version || "3.4"
        );

        if (!connected) {
          // Query the bind_error from the supplier row for detailed diagnostics
          const diagResult = await tenantQuery(
            tenant.schemaName,
            `SELECT bind_error FROM suppliers WHERE id = $1`,
            [entityId]
          );
          const bindError = diagResult.rows[0]?.bind_error || "Unknown SMSC rejection";
          return NextResponse.json({
            success: false,
            error: `Failed to bind to supplier SMPP at ${host}:${port}. ${bindError}.`,
            entity: { id: entityId, name: entity.name || entity.supplier_code, bindStatus: "BIND_FAILED" },
          }, { status: 400 });
        }
      }
    }
  } else if (action === "REBIND") {
    // ── REBIND: Force-close old session + immediately reconnect (suppliers) or let client auto-reconnect ──
    if (entityType === "clients") {
      closeClientSession(entityId, tenant.schemaName);
      await tenantQuery(tenant.schemaName, `UPDATE ${table} SET bind_status = $1, updated_at = NOW() WHERE id = $2`, ["UNBOUND", entityId]);
      await auditLog(table, entityId, "REBIND", tenant.email, { bind_status: entity.bind_status }, { bind_status: "UNBOUND" }, tenant.tenantId);
      return NextResponse.json({
        success: true, realBindStatus: "UNBOUND",
        entity: { id: entityId, name: entity.name, bindStatus: "UNBOUND" },
        message: `Session closed for "${entity.name}". The ESME client should auto-reconnect within a few seconds. Refresh to check status.`,
      });
    } else if (entity.connection_mode === "SERVER") {
      closeSupplierServerSession(tenant.tenantId, entityId);
      await tenantQuery(tenant.schemaName, `UPDATE suppliers SET bind_status = $1, bind_error = NULL, updated_at = NOW() WHERE id = $2`, ["UNBOUND", entityId]);
      await auditLog(table, entityId, "REBIND", tenant.email, { bind_status: entity.bind_status }, { bind_status: "UNBOUND" }, tenant.tenantId);
      return NextResponse.json({
        success: true, realBindStatus: "UNBOUND",
        entity: { id: entityId, name: entity.name || entity.supplier_code, bindStatus: "UNBOUND" },
        message: `Session closed for "${entity.name || entity.supplier_code}". The GSM gateway should auto-reconnect shortly. Refresh to check status.`,
      });
    } else {
      // CLIENT-mode supplier: disconnect then immediately reconnect
      const host = entity.host;
      const port = entity.port || 2775;
      const username = entity.username || entity.system_id || "";
      const password = entity.password || "";

      if (!host || !username) {
        return NextResponse.json({
          success: false, error: "Supplier missing SMPP host or username.",
          entity: { id: entityId, name: entity.name || entity.supplier_code, bindStatus: "UNBOUND" },
        }, { status: 400 });
      }

      disconnectSupplier(tenant.tenantId, entityId);
      // Brief delay to let the old connection fully close before reconnecting
      await new Promise(r => setTimeout(r, 300));
      const connected = await connectToSupplier(
        tenant.tenantId, tenant.schemaName, entityId, host, port, username, password,
        entity.bind_type || "transceiver", entity.system_type || "SMSC", entity.smpp_version || "3.4"
      );

      if (!connected) {
        await tenantQuery(tenant.schemaName, `UPDATE suppliers SET bind_status = $1, updated_at = NOW() WHERE id = $2`, ["UNBOUND", entityId]);
        // Query the bind_error that connectToSupplier already wrote
        const diagResult = await tenantQuery(
          tenant.schemaName,
          `SELECT bind_error FROM suppliers WHERE id = $1`,
          [entityId]
        );
        const bindError = diagResult.rows[0]?.bind_error || "Unknown SMSC rejection";
        await auditLog(table, entityId, "REBIND_FAILED", tenant.email, { bind_status: entity.bind_status }, { bind_status: "UNBOUND" }, tenant.tenantId);
        return NextResponse.json({
          success: false, error: `Force rebind failed: disconnected but could not reconnect to ${host}:${port}. ${bindError}.`,
          entity: { id: entityId, name: entity.name || entity.supplier_code, bindStatus: "UNBOUND" },
        }, { status: 400 });
      }

      await auditLog(table, entityId, "REBIND", tenant.email, { bind_status: entity.bind_status }, { bind_status: "BOUND" }, tenant.tenantId);
      return NextResponse.json({
        success: true, realBindStatus: "BOUND",
        entity: { id: entityId, name: entity.name || entity.supplier_code, bindStatus: "BOUND" },
        message: `Force rebind successful — reconnected to ${host}:${port}.`,
      });
    }
  } else {
    // ── UNBIND: Close real connection and update DB ──
    if (entityType === "clients") {
      closeClientSession(entityId, tenant.schemaName);
    } else if (entity.connection_mode === "SERVER") {
      closeSupplierServerSession(tenant.tenantId, entityId);
    } else {
      disconnectSupplier(tenant.tenantId, entityId);
    }

    await tenantQuery(
      tenant.schemaName,
      `UPDATE ${table} SET bind_status = $1${table === "suppliers" ? ", bind_error = NULL" : ""}, updated_at = NOW() WHERE id = $2`,
      ["UNBOUND", entityId]
    );
  }

  // Get updated entity for response
  const updatedResult = await tenantQuery(tenant.schemaName, `SELECT bind_status FROM ${table} WHERE id = $1`, [entityId]);
  const realStatus = updatedResult.rows[0]?.bind_status || "UNBOUND";

  // Audit log (for BIND and UNBIND only; REBIND branches log themselves with early returns)
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
      const dbStatus = (row.bind_status as string) || "UNBOUND";
      realStatus = hasSession ? "BOUND" : (dbStatus === "BOUND" ? "BOUND" : "UNBOUND");
    } else {
      const isClientConnected = isSupplierConnected(tenant.tenantId, row.id as number);
      const isServerBound = isSupplierServerSessionActive(tenant.tenantId, row.id as number);
      const dbStatus = (row.bind_status as string) || "UNBOUND";
      realStatus = (isClientConnected || isServerBound) ? "BOUND" : (dbStatus === "BOUND" ? "BOUND" : "UNBOUND");
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
