import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getSelfIp, serverLabel } from "@/lib/server-ips";
import { getTenantFromRequest } from "@/lib/auth";

/**
 * POST /api/tenant/android-gateway/register
 *
 * Called by the Android app after first login. Registers the device so
 * the platform knows this phone is available as an SMS gateway.
 *
 * Body: { deviceId, deviceName, phoneNumber, appVersion, supplierId }
 * Auth: tenant session cookie
 */
export async function POST(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId, deviceName, phoneNumber, appVersion, supplierId } = body;

    if (!deviceId || !supplierId) {
      return NextResponse.json(
        { error: "deviceId and supplierId are required" },
        { status: 400 }
      );
    }

    const tenantId = tenant.tenantId;
    const schemaName = tenant.schemaName;

    // Look up the actual supplier SMPP username for the device record
    let smppUsername = `android_${deviceId.substring(0, 20)}`;
    try {
      await pool.query(`SET search_path TO "${schemaName}"`);
      const { rows: suppRows } = await pool.query(
        `SELECT username FROM suppliers WHERE id = $1`,
        [supplierId]
      );
      await pool.query(`SET search_path TO public`);
      if (suppRows.length > 0 && suppRows[0].username) {
        smppUsername = suppRows[0].username;
      }
    } catch {
      // Fall back to generated username
    }

    const serverIp = await getSelfIp();

    // Upsert device registration
    const result = await pool.query(
      `INSERT INTO android_gateway_devices
         (tenant_id, schema_name, supplier_id, device_name, phone_number,
          device_id, smpp_username, server_ip, bind_status, app_version,
          last_seen, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UNBOUND', $9, NOW(), NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         tenant_id = $1, schema_name = $2, supplier_id = $3,
         device_name = $4, phone_number = $5,
         server_ip = $8, app_version = $9,
         last_seen = NOW(), updated_at = NOW()
       RETURNING id`,
      [
        tenantId, schemaName, supplierId, deviceName || null,
        phoneNumber || null, deviceId, smppUsername,
        serverIp, appVersion || null,
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      serverIp,
      serverLabel: serverLabel(serverIp),
      tenantId,
      schemaName,
      message: `Device registered on ${serverLabel(serverIp)}`,
    });
  } catch (error: unknown) {
    console.error("[android-gateway/register] Error:", error);
    return NextResponse.json(
      { error: "Registration failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tenant/android-gateway/status
 *
 * Returns the current device registration status and which servers it's
 * connected to. Used by the app to verify registration was successful.
 */
export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const devices = await pool.query(
      `SELECT id, device_id, device_name, phone_number, supplier_id,
              smpp_username, server_ip, bind_status, last_seen,
              sms_sent_count, sms_received_count, app_version
       FROM android_gateway_devices
       WHERE tenant_id = $1
       ORDER BY last_seen DESC NULLS LAST`,
      [tenant.tenantId]
    );

    return NextResponse.json({
      tenantId: tenant.tenantId,
      devices: devices.rows,
      total: devices.rows.length,
    });
  } catch (error: unknown) {
    console.error("[android-gateway/status] Error:", error);
    return NextResponse.json(
      { error: "Status check failed" },
      { status: 500 }
    );
  }
}
