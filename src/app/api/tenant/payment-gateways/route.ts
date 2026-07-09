import { NextResponse } from "next/server";
import { pool } from "@/db";

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT id, method, label, is_active, credentials, qr_code_url, wallet_address, network, min_amount, created_at FROM payment_config LIMIT 100"
      );
      return NextResponse.json({ gateways: result.rows });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ gateways: [] });
  }
}
