import { pool } from "@/db";

/**
 * First-time payment promo: bonus SMS on first payment meeting min threshold.
 * Both bonus amount and min threshold are configurable via platform_settings.
 * 
 * Returns the total SMS to add (base + promo bonus if applicable).
 * Call this BEFORE updating payment_transactions status to COMPLETED.
 */
export async function computeFirstPaymentBonus(
  tenantId: number,
  paymentAmount: string | number,
  baseSmsAmount: number
): Promise<{
  totalSms: number;
  bonusSms: number;
  isFirstPayment: boolean;
}> {
  let bonusSms = 100_000;       // fallback default
  let minAmount = 250_000;       // fallback default

  try {
    // Read promo config from platform_settings
    const { rows } = await pool.query(
      `SELECT key, value FROM platform_settings WHERE key IN ('first_payment_bonus_sms','first_payment_min_amount','limited_promo_active')`
    );
    for (const row of rows) {
      if (row.key === 'first_payment_bonus_sms') bonusSms = parseInt(row.value) || 100_000;
      if (row.key === 'first_payment_min_amount') minAmount = parseFloat(row.value) || 250_000;
      if (row.key === 'limited_promo_active' && row.value !== 'true') return { totalSms: baseSmsAmount, bonusSms: 0, isFirstPayment: false };
    }
  } catch { /* use fallback defaults */ }

  try {
    // Check if this is the tenant's first COMPLETED payment
    const result = await pool.query(
      `SELECT COUNT(*) as cnt FROM payment_transactions 
       WHERE tenant_id = $1 AND status = 'COMPLETED'`,
      [tenantId]
    );

    const completedCount = parseInt(result.rows[0]?.cnt || "0");

    if (completedCount === 0) {
      const amount = typeof paymentAmount === "string" 
        ? parseFloat(paymentAmount) 
        : paymentAmount;

      if (amount >= minAmount) {
        const totalSms = baseSmsAmount + bonusSms;
        console.log(
          `[PAYMENT-PROMO] First payment bonus applied: tenant=${tenantId}, ` +
          `amount=${amount}, baseSMS=${baseSmsAmount}, bonus=${bonusSms}, total=${totalSms}`
        );
        return { totalSms, bonusSms, isFirstPayment: true };
      }
    }
  } catch (err) {
    // Non-fatal: if the check fails, skip the bonus
    console.error("[PAYMENT-PROMO] Failed to check first payment:", err);
  }

  return { totalSms: baseSmsAmount, bonusSms: 0, isFirstPayment: false };
}
