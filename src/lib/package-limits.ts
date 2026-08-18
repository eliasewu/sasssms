// Package SMS quota rules.
//
//   - starter      → pay-as-you-go credits (tenants.sms_limit column)
//   - professional → 10,000,000 SMS per month
//   - enterprise   → unlimited (no cap for the duration of the plan)
//
// `smsLimit = 0` is the sentinel the payment-approval flow writes for Enterprise
// upgrades to mean "unlimited". Code that reads the limit must resolve it through
// this helper instead of doing `smsLimit - smsCounter` directly, otherwise an
// Enterprise tenant (smsLimit 0) would show "0 free SMS".

export const PROFESSIONAL_SMS_LIMIT = 10_000_000;

export interface SmsQuota {
  packageType: string;
  unlimited: boolean;
  /** Total allowed SMS; 0 when unlimited. */
  total: number;
  used: number;
  /** Remaining SMS; Infinity when unlimited. */
  remaining: number;
}

export function resolveSmsQuota(
  packageType: string | null | undefined,
  smsLimit: number | null | undefined,
  smsCounter: number | null | undefined
): SmsQuota {
  const pkg = (packageType || "starter").toLowerCase();
  const used = smsCounter || 0;

  if (pkg === "enterprise") {
    return { packageType: pkg, unlimited: true, total: 0, used, remaining: Number.POSITIVE_INFINITY };
  }

  if (pkg === "professional") {
    return {
      packageType: pkg,
      unlimited: false,
      total: PROFESSIONAL_SMS_LIMIT,
      used,
      remaining: Math.max(0, PROFESSIONAL_SMS_LIMIT - used),
    };
  }

  const total = smsLimit || 0;
  return { packageType: pkg, unlimited: false, total, used, remaining: Math.max(0, total - used) };
}
