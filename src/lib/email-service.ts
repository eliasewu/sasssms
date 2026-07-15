import nodemailer from "nodemailer";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "elias.ewu@gmail.com";
const SMTP_HOST = process.env.SMTP_HOST || "mail.net2app.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "noreply@net2app.com";
const SMTP_PASS = process.env.SMTP_PASS || "";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Send payment notification to super admin when a tenant makes a payment
 */
export async function notifyAdminNewPayment(payload: {
  tenantName: string;
  tenantEmail: string;
  amount: string;
  paymentMethod: string;
  transactionId: number;
  gatewayLabel?: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Net2APP Payments" <${SMTP_USER}>`,
      to: SUPER_ADMIN_EMAIL,
      subject: `💰 New Payment: $${payload.amount} from ${payload.tenantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a73e8;">New Payment Received</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Tenant:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payload.tenantName} (${payload.tenantEmail})</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 18px; color: #0d904f;">$${payload.amount}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Method:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payload.paymentMethod}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Gateway:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payload.gatewayLabel || "N/A"}</td></tr>
            <tr><td style="padding: 8px;"><strong>Transaction ID:</strong></td><td style="padding: 8px;">#${payload.transactionId}</td></tr>
          </table>
          <p style="color: #666; margin-top: 20px;">Please review and approve this payment in the super admin dashboard.</p>
          <a href="https://net2app.com/super/dashboard/payments" style="display: inline-block; background: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Review Payment</a>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send admin payment notification:", e);
    return false;
  }
}

/**
 * Send payment confirmation to client after super admin approval
 */
export async function notifyClientPaymentApproved(payload: {
  clientEmail: string;
  clientName: string;
  amount: string;
  paymentMethod: string;
  transactionId: number;
  smsAdded?: number;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Net2APP Billing" <${SMTP_USER}>`,
      to: payload.clientEmail,
      subject: `✅ Payment Approved: $${payload.amount} - Net2APP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d904f;">Payment Approved! 🎉</h2>
          <p>Dear ${payload.clientName},</p>
          <p>Your payment of <strong>$${payload.amount}</strong> via ${payload.paymentMethod} has been approved.</p>
          ${payload.smsAdded ? `<p><strong>${payload.smsAdded.toLocaleString()} SMS credits</strong> have been added to your account.</p>` : ""}
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Transaction:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">#${payload.transactionId}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">$${payload.amount}</td></tr>
            <tr><td style="padding: 8px;"><strong>Method:</strong></td><td style="padding: 8px;">${payload.paymentMethod}</td></tr>
          </table>
          <p style="color: #666;">Thank you for choosing Net2APP!</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send client payment confirmation:", e);
    return false;
  }
}

/**
 * Send payment rejection notification to client
 */
export async function notifyClientPaymentRejected(payload: {
  clientEmail: string;
  clientName: string;
  amount: string;
  paymentMethod: string;
  reason?: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Net2APP Billing" <${SMTP_USER}>`,
      to: payload.clientEmail,
      subject: `Payment Review: $${payload.amount} - Net2APP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d93025;">Payment Needs Attention</h2>
          <p>Dear ${payload.clientName},</p>
          <p>Your payment of <strong>$${payload.amount}</strong> via ${payload.paymentMethod} requires additional verification.</p>
          ${payload.reason ? `<p><strong>Reason:</strong> ${payload.reason}</p>` : ""}
          <p style="color: #666;">Please contact support or upload proof of payment in your dashboard.</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send client payment rejection:", e);
    return false;
  }
}

/**
 * Send email notification to tenant when super admin replies to their support ticket
 */
export async function notifyTenantTicketReply(payload: {
  tenantEmail: string;
  tenantName: string;
  ticketId: number;
  ticketSubject: string;
  replyMessage: string;
  adminName: string;
}): Promise<boolean> {
  try {
    const preview = payload.replyMessage.length > 200
      ? payload.replyMessage.slice(0, 200) + "..."
      : payload.replyMessage;

    await transporter.sendMail({
      from: `"Net2APP Support" <${SMTP_USER}>`,
      to: payload.tenantEmail,
      subject: `🔔 Support Reply: ${payload.ticketSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a73e8;">New Reply to Your Support Ticket</h2>
          <p>Dear ${payload.tenantName},</p>
          <p><strong>${payload.adminName}</strong> from Net2APP Support has replied to your ticket:</p>
          <div style="background: #f5f5f5; border-left: 4px solid #1a73e8; padding: 12px 16px; margin: 15px 0; border-radius: 4px;">
            <p style="margin: 0; color: #333;"><strong>Ticket #${payload.ticketId}: ${payload.ticketSubject}</strong></p>
            <p style="margin: 10px 0 0 0; color: #555; white-space: pre-wrap;">${preview}</p>
          </div>
          <p style="color: #666;">You can view the full reply and respond in your dashboard.</p>
          <a href="https://net2app.com/dashboard/support-tickets" style="display: inline-block; background: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Ticket</a>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">Thank you for using Net2APP!</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send support ticket reply notification:", e);
    return false;
  }
}

/**
 * Send welcome email to newly created email account
 */
export async function sendWelcomeEmail(payload: {
  email: string;
  name: string;
  password: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Net2APP Mail" <${SMTP_USER}>`,
      to: payload.email,
      subject: `Welcome to Net2APP Mail — Your Account Details`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a73e8;">Welcome to Net2APP Mail!</h2>
          <p>Dear ${payload.name},</p>
          <p>Your email account has been created.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: #f5f5f5; padding: 12px; border-radius: 8px;">
            <tr><td style="padding: 6px;"><strong>Email:</strong></td><td style="padding: 6px;">${payload.email}</td></tr>
            <tr><td style="padding: 6px;"><strong>Password:</strong></td><td style="padding: 6px; font-family: monospace;">${payload.password}</td></tr>
            <tr><td style="padding: 6px;"><strong>IMAP/SMTP:</strong></td><td style="padding: 6px;">mail.net2app.com</td></tr>
          </table>
          <p style="color: #666; font-size: 12px;">Please change your password after first login.</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send welcome email:", e);
    return false;
  }
}
