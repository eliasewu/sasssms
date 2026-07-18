import { pool } from "@/db";

/**
 * First-time payment promo: +100,000 bonus SMS on first payment of 250,000+
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
  const bonusSms = 100_000;
  const minAmount = 250_000; // minimum payment amount to qualify

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
