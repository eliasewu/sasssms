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

    // Validate supplier ownership: must exist in tenant's schema, be active,
    // have connection_type='ANDROID_SMS' and connection_mode='SERVER'
    let smppUsername = `android_${deviceId.substring(0, 20)}`;
    try {
      await pool.query(`SET search_path TO "${schemaName}"`);
      const { rows: suppRows } = await pool.query(
        `SELECT id, username, connection_type, connection_mode, is_active, name
         FROM suppliers WHERE id = $1`,
        [supplierId]
      );
      await pool.query(`SET search_path TO public`);

      if (suppRows.length === 0) {
        return NextResponse.json(
          { error: "Supplier not found. Create an ANDROID_SMS supplier first." },
          { status: 404 }
        );
      }

      const supplier = suppRows[0];

      if (!supplier.is_active) {
        return NextResponse.json(
          { error: `Supplier "${supplier.name}" is inactive. Activate it first.` },
          { status: 400 }
        );
      }

      if (supplier.connection_type !== "ANDROID_SMS") {
        return NextResponse.json(
          { error: `Supplier "${supplier.name}" has connection_type "${supplier.connection_type}", not "ANDROID_SMS". Update the supplier settings.` },
          { status: 400 }
        );
      }

      if (supplier.connection_mode !== "SERVER") {
        return NextResponse.json(
          { error: `Supplier "${supplier.name}" has connection_mode "${supplier.connection_mode}", not "SERVER". The Android app binds as a server-mode supplier.` },
          { status: 400 }
        );
      }

      if (supplier.username) {
        smppUsername = supplier.username;
      }
    } catch (err) {
      console.error("[android-gateway] Supplier lookup error:", err);
      return NextResponse.json(
        { error: "Internal server error. Could not verify supplier." },
        { status: 500 }
      );
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
