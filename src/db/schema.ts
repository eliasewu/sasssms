import {
  pgTable, serial, varchar, text, timestamp, boolean, integer, decimal,
} from "drizzle-orm/pg-core";

// ── Platform Super Admin ──
export const superAdmins = pgTable("super_admins", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Tenants ──
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  schemaName: varchar("schema_name", { length: 100 }).notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  balance: decimal("balance", { precision: 12, scale: 4 }).default("0").notNull(),
  maxTps: integer("max_tps").default(0),
  maxConcurrentCalls: integer("max_concurrent_calls").default(10),
  smppEnabled: boolean("smpp_enabled").default(true).notNull(),
  httpEnabled: boolean("http_enabled").default(true).notNull(),
  rcsEnabled: boolean("rcs_enabled").default(true).notNull(),
  flashSmsEnabled: boolean("flash_sms_enabled").default(true).notNull(),
  voiceOtpEnabled: boolean("voice_otp_enabled").default(true).notNull(),
  ottEnabled: boolean("ott_enabled").default(true).notNull(),
  businessApiEnabled: boolean("business_api_enabled").default(true).notNull(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  packageType: varchar("package_type", { length: 50 }).default("starter"),
  packagePrice: decimal("package_price", { precision: 10, scale: 2 }).default("0"),
  monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }).default("0"),
  licenseKey: varchar("license_key", { length: 100 }),
  smsCounter: integer("sms_counter").default(0),
  smsLimit: integer("sms_limit").default(0),
  packageExpiresAt: timestamp("package_expires_at"),
  smppServerIp: varchar("smpp_server_ip", { length: 100 }),
  smppServerPort: integer("smpp_server_port").default(2775),
  costPerSms: decimal("cost_per_sms", { precision: 10, scale: 6 }).default("0.00025").notNull(),
  smsValidUntil: timestamp("sms_valid_until"),
  lastRechargeAt: timestamp("last_recharge_at"),
  lastRechargeAmount: decimal("last_recharge_amount", { precision: 10, scale: 2 }),
  accountExpiresAt: timestamp("account_expires_at"),
  emailVerified: boolean("email_verified").default(false),
  phoneVerified: boolean("phone_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Packages ──
export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }).default("0"),
  smsCredits: integer("sms_credits").default(0),
  freeSmsPerMonth: boolean("free_sms_per_month").default(false),
  features: text("features"),
  requiresLicense: boolean("requires_license").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Payment Gateway Config ──
export const paymentConfig = pgTable("payment_config", {
  id: serial("id").primaryKey(),
  method: varchar("method", { length: 50 }).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  credentials: text("credentials"),
  qrCodeUrl: text("qr_code_url"),
  walletAddress: text("wallet_address"),
  network: varchar("network", { length: 50 }),
  minAmount: decimal("min_amount", { precision: 10, scale: 2 }).default("25"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Payment Transactions (public, cross-tenant) ──
export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  amount: decimal("amount", { precision: 12, scale: 4 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).default("PENDING").notNull(),
  packageType: varchar("package_type", { length: 50 }),
  smsAmount: integer("sms_amount").default(0),
  metadata: text("metadata"),
  transactionId: varchar("transaction_id", { length: 255 }),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  clientEmail: varchar("client_email", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Email Accounts (managed by super admin) ──
export const emailAccounts = pgTable("email_accounts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  department: varchar("department", { length: 50 }),
  diskQuotaMB: integer("disk_quota_mb").default(500),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Email Account Audit Log ──
export const emailAccountAuditLog = pgTable("email_account_audit_log", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  accountEmail: varchar("account_email", { length: 255 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(), // create, update, delete, password_reset, toggle_active
  changes: text("changes"), // JSON summary of what changed
  adminId: integer("admin_id").notNull(),
  adminName: varchar("admin_name", { length: 255 }).notNull(),
  adminEmail: varchar("admin_email", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Platform Settings ──
export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
});

// ── Infrastructure Tables ──

// Login sessions — tracks every login/logout for audits
export const loginSessions = pgTable("login_sessions", {
  id: serial("id").primaryKey(),
  userType: varchar("user_type", { length: 20 }).notNull(),
  userId: integer("user_id").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  tokenHash: varchar("token_hash", { length: 100 }),
  loginAt: timestamp("login_at").defaultNow().notNull(),
  logoutAt: timestamp("logout_at"),
});

// Audit log — generic CRUD audit trail (public schema)
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: integer("entity_id"),
  action: varchar("action", { length: 20 }).notNull(),
  changedBy: varchar("changed_by", { length: 255 }),
  oldData: text("old_data"),
  newData: text("new_data"),
  ipAddress: varchar("ip_address", { length: 50 }),
  tenantId: integer("tenant_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// CDR deleted items — soft-delete archive
export const cdrDeletedItems = pgTable("cdr_deleted_items", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: integer("entity_id").notNull(),
  entityName: varchar("entity_name", { length: 255 }),
  entityData: text("entity_data"),
  deletedBy: varchar("deleted_by", { length: 255 }),
  tenantId: integer("tenant_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// MCC traffic statistics — per-tenant traffic aggregation
export const mccTrafficStats = pgTable("mcc_traffic_stats", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  mcc: varchar("mcc", { length: 10 }).notNull(),
  countryCode: varchar("country_code", { length: 10 }),
  countryName: varchar("country_name", { length: 100 }),
  messageCount: integer("message_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  failedCount: integer("failed_count").default(0),
  totalCost: decimal("total_cost", { precision: 12, scale: 6 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── MCC/MNC Database ──
export const mccMncDatabase = pgTable("mcc_mnc_database", {
  id: serial("id").primaryKey(),
  mcc: varchar("mcc", { length: 10 }).notNull(),
  mnc: varchar("mnc", { length: 10 }),
  countryCode: varchar("country_code", { length: 10 }).notNull(),
  countryName: varchar("country_name", { length: 100 }).notNull(),
  networkName: varchar("network_name", { length: 100 }),
  networkType: varchar("network_type", { length: 50 }),
  language: varchar("language", { length: 50 }).default("English"),
});

// ── Proxy Config (global, per tenant) ──
export const proxyConfig = pgTable("proxy_config", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  proxyType: varchar("proxy_type", { length: 50 }).default("residential"),
  host: varchar("host", { length: 255 }).notNull(),
  port: integer("port").notNull(),
  username: varchar("username", { length: 255 }),
  password: varchar("password", { length: 255 }),
  protocol: varchar("protocol", { length: 20 }).default("socks5"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Tenant-level tables (reference, created per-schema via raw SQL) ──

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  clientCode: varchar("client_code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  country: varchar("country", { length: 100 }),
  address: text("address"),
  connectionType: varchar("connection_type", { length: 100 }),
  smppUsername: varchar("smpp_username", { length: 100 }),
  smppPassword: varchar("smpp_password", { length: 100 }),
  smppAllowedIp: varchar("smpp_allowed_ip", { length: 255 }),
  smppPort: integer("smpp_port").default(2775),
  smppSystemType: varchar("smpp_system_type", { length: 50 }),
  maxTps: integer("max_tps"),
  billingMode: varchar("billing_mode", { length: 50 }).default("prepaid"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  balance: decimal("balance", { precision: 12, scale: 4 }).default("0").notNull(),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 4 }).default("0"),
  ratePerSms: decimal("rate_per_sms", { precision: 10, scale: 6 }).default("0.00025").notNull(),
  routePlanId: integer("route_plan_id"),
  isActive: boolean("is_active").default(true).notNull(),
  enableHttpApi: boolean("enable_http_api").default(false),
  httpApiKey: varchar("http_api_key", { length: 255 }),
  forceDlr: boolean("force_dlr").default(false),
  dlrTimeoutMode: varchar("dlr_timeout_mode", { length: 50 }),
  dlrTimeout: integer("dlr_timeout"),
  dlrCallbackUrl: text("dlr_callback_url"),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  supplierCode: varchar("supplier_code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  connectionType: varchar("connection_type", { length: 50 }).notNull(),
  host: varchar("host", { length: 255 }),
  port: integer("port").default(2775),
  username: varchar("username", { length: 255 }),
  password: varchar("password", { length: 255 }),
  systemId: varchar("system_id", { length: 100 }),
  systemType: varchar("system_type", { length: 50 }),
  smppVersion: varchar("smpp_version", { length: 20 }).default("3.4"),
  bindType: varchar("bind_type", { length: 20 }).default("TRX"),
  addressTon: integer("address_ton").default(0),
  addressNpi: integer("address_npi").default(0),
  addressRange: varchar("address_range", { length: 100 }),
  inboundMode: boolean("inbound_mode").default(false),
  apiUrl: text("api_url"),
  apiKey: text("api_key"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  costPerSms: decimal("cost_per_sms", { precision: 10, scale: 6 }).default("0").notNull(),
  initialBalance: decimal("initial_balance", { precision: 12, scale: 4 }).default("0"),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 4 }).default("0"),
  forceDlr: boolean("force_dlr").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  config: text("config"),
  bindStatus: varchar("bind_status", { length: 20 }).default("UNBOUND"),
  lastBindTime: timestamp("last_bind_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trunks = pgTable("trunks", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  supplierId: integer("supplier_id").notNull(),
  connectorId: integer("connector_id"),
  capacity: integer("capacity").default(100).notNull(),
  currentLoad: integer("current_load").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  trunkId: integer("trunk_id").notNull(),
  countryCode: varchar("country_code", { length: 10 }),
  prefix: varchar("prefix", { length: 20 }),
  priority: integer("priority").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const routePlans = pgTable("route_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const routePlanRoutes = pgTable("route_plan_routes", {
  id: serial("id").primaryKey(),
  routePlanId: integer("route_plan_id").notNull(),
  routeId: integer("route_id").notNull(),
  priority: integer("priority").default(1).notNull(),
});

// ── Connectors with region ──
export const connectors = pgTable("connectors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }),
  type: varchar("type", { length: 50 }).notNull(), // HTTP_API, RCS, FLASH_SMS
  region: varchar("region", { length: 50 }).default("global"),
  apiUrl: text("api_url"),
  apiKey: text("api_key"),
  authMethod: varchar("auth_method", { length: 50 }).default("API_KEY"),
  endpoints: text("endpoints"),
  status: varchar("status", { length: 20 }).default("active"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── OTT Devices (with QR pairing) ──
export const ottDevices = pgTable("ott_devices", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  deviceType: varchar("device_type", { length: 50 }).notNull(), // whatsapp, telegram, signal
  phoneNumber: varchar("phone_number", { length: 20 }),
  apiConfig: text("api_config"),
  proxyId: integer("proxy_id"),
  qrCode: text("qr_code"),
  qrSession: text("qr_session"),
  qrExpiresAt: timestamp("qr_expires_at"),
  status: varchar("status", { length: 20 }).default("OFFLINE"),
  lastSeen: timestamp("last_seen"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Message table reference ──
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  sender: varchar("sender", { length: 20 }).notNull(),
  destination: varchar("destination", { length: 20 }).notNull(),
  content: text("content").notNull(),
  status: varchar("status", { length: 20 }).default("QUEUED").notNull(),
  routePlanId: integer("route_plan_id"),
  routeId: integer("route_id"),
  trunkId: integer("trunk_id"),
  supplierId: integer("supplier_id"),
  connectionType: varchar("connection_type", { length: 50 }),
  cost: decimal("cost", { precision: 10, scale: 6 }).default("0"),
  dlrStatus: varchar("dlr_status", { length: 20 }),
  dlrTimestamp: timestamp("dlr_timestamp"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  otpCode: varchar("otp_code", { length: 10 }),
  language: varchar("language", { length: 50 }),
  messageId: varchar("message_id", { length: 100 }),
  campaignId: integer("campaign_id"),
  originalSender: varchar("original_sender", { length: 50 }),
  originalDestination: varchar("original_destination", { length: 50 }),
  originalContent: text("original_content"),
  translationNotes: text("translation_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Other tables ──
export const clientRates = pgTable("client_rates", { id: serial("id").primaryKey(), clientId: integer("client_id").notNull(), countryCode: varchar("country_code", { length: 10 }).notNull(), mcc: varchar("mcc", { length: 10 }), mnc: varchar("mnc", { length: 10 }), rate: decimal("rate", { precision: 10, scale: 6 }).notNull(), isActive: boolean("is_active").default(true).notNull() });
export const supplierRates = pgTable("supplier_rates", { id: serial("id").primaryKey(), supplierId: integer("supplier_id").notNull(), countryCode: varchar("country_code", { length: 10 }).notNull(), mcc: varchar("mcc", { length: 10 }), mnc: varchar("mnc", { length: 10 }), cost: decimal("cost", { precision: 10, scale: 6 }).notNull(), isActive: boolean("is_active").default(true).notNull() });
export const routeMaps = pgTable("route_maps", { id: serial("id").primaryKey(), name: varchar("name", { length: 255 }).notNull(), description: text("description"), rules: text("rules"), isActive: boolean("is_active").default(true).notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
export const smsInbox = pgTable("sms_inbox", { id: serial("id").primaryKey(), sender: varchar("sender", { length: 20 }).notNull(), destination: varchar("destination", { length: 20 }).notNull(), content: text("content").notNull(), supplierId: integer("supplier_id"), receivedAt: timestamp("received_at").defaultNow().notNull(), isRead: boolean("is_read").default(false) });
export const campaigns = pgTable("campaigns", { id: serial("id").primaryKey(), name: varchar("name", { length: 255 }).notNull(), clientId: integer("client_id").notNull(), sender: varchar("sender", { length: 20 }).notNull(), content: text("content").notNull(), recipients: text("recipients"), totalCount: integer("total_count").default(0), sentCount: integer("sent_count").default(0), deliveredCount: integer("delivered_count").default(0), failedCount: integer("failed_count").default(0), status: varchar("status", { length: 20 }).default("DRAFT"), scheduledAt: timestamp("scheduled_at"), startedAt: timestamp("started_at"), completedAt: timestamp("completed_at"), createdAt: timestamp("created_at").defaultNow().notNull() });
export const invoices = pgTable("invoices", { id: serial("id").primaryKey(), clientId: integer("client_id").notNull(), invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(), amount: decimal("amount", { precision: 12, scale: 4 }).notNull(), tax: decimal("tax", { precision: 12, scale: 4 }).default("0"), totalAmount: decimal("total_amount", { precision: 12, scale: 4 }).notNull(), status: varchar("status", { length: 20 }).default("DRAFT").notNull(), periodStart: timestamp("period_start").notNull(), periodEnd: timestamp("period_end").notNull(), dueDate: timestamp("due_date").notNull(), notes: text("notes"), createdAt: timestamp("created_at").defaultNow().notNull() });
export const payments = pgTable("payments", { id: serial("id").primaryKey(), clientId: integer("client_id").notNull(), invoiceId: integer("invoice_id"), amount: decimal("amount", { precision: 12, scale: 4 }).notNull(), paymentMethod: varchar("payment_method", { length: 50 }), transactionId: varchar("transaction_id", { length: 255 }), status: varchar("status", { length: 20 }).default("PENDING"), notes: text("notes"), createdAt: timestamp("created_at").defaultNow().notNull() });
export const voiceOtpConfig = pgTable("voice_otp_config", { id: serial("id").primaryKey(), countryGroup: varchar("country_group", { length: 255 }).notNull(), prefixes: varchar("prefixes", { length: 500 }), primaryLanguage: varchar("primary_language", { length: 50 }).notNull(), secondaryLanguage: varchar("secondary_language", { length: 50 }), primaryAudioCount: integer("primary_audio_count").default(0), secondaryAudioCount: integer("secondary_audio_count").default(0), isActive: boolean("is_active").default(true).notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
export const voiceOtpAudio = pgTable("voice_otp_audio", { id: serial("id").primaryKey(), configId: integer("config_id").notNull(), language: varchar("language", { length: 50 }).notNull(), digit: varchar("digit", { length: 5 }).notNull(), fileName: varchar("file_name", { length: 255 }), fileUrl: text("file_url"), createdAt: timestamp("created_at").defaultNow().notNull() });
export const voiceOtpSipConfig = pgTable("voice_otp_sip_config", { id: serial("id").primaryKey(), name: varchar("name", { length: 255 }).notNull(), sipHost: varchar("sip_host", { length: 255 }), sipPort: integer("sip_port").default(5060), sipUsername: varchar("sip_username", { length: 255 }), sipPassword: varchar("sip_password", { length: 255 }), callerId: varchar("caller_id", { length: 50 }), maxRetries: integer("max_retries").default(3), timeout: integer("timeout").default(30), isActive: boolean("is_active").default(true).notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
// ── Super Admin Default Voice OTP Audio (seeded to new tenants) ──
export const voiceOtpDefaultAudio = pgTable("voice_otp_default_audio", {
  id: serial("id").primaryKey(),
  language: varchar("language", { length: 50 }).notNull(),
  digit: varchar("digit", { length: 5 }).notNull(),
  fileName: varchar("file_name", { length: 255 }),
  fileUrl: text("file_url"),
  audioType: varchar("audio_type", { length: 10 }).default("wav"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voiceOtpCallLogs = pgTable("voice_otp_call_logs", { id: serial("id").primaryKey(), destination: varchar("destination", { length: 20 }).notNull(), otpCode: varchar("otp_code", { length: 10 }), language: varchar("language", { length: 50 }), status: varchar("status", { length: 20 }), attemptCount: integer("attempt_count").default(1), duration: integer("duration"), sipConfigId: integer("sip_config_id"), audioPlaylist: text("audio_playlist"), attemptLog: text("attempt_log"), callSid: varchar("call_sid", { length: 100 }), sipConfigName: varchar("sip_config_name", { length: 255 }), country: varchar("country", { length: 100 }), mcc: varchar("mcc", { length: 10 }), createdAt: timestamp("created_at").defaultNow().notNull() });
export const socialApiConfig = pgTable("social_api_config", { id: serial("id").primaryKey(), platform: varchar("platform", { length: 50 }).notNull(), name: varchar("name", { length: 255 }).notNull(), apiKey: text("api_key"), apiSecret: text("api_secret"), phoneNumber: varchar("phone_number", { length: 20 }), webhookUrl: text("webhook_url"), proxyId: integer("proxy_id"), isActive: boolean("is_active").default(true).notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
export const businessApiConnect = pgTable("business_api_connect", { id: serial("id").primaryKey(), name: varchar("name", { length: 255 }).notNull(), provider: varchar("provider", { length: 100 }).notNull(), apiUrl: text("api_url"), credentials: text("credentials"), proxyId: integer("proxy_id"), isActive: boolean("is_active").default(true).notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
export const ipWhitelist = pgTable("ip_whitelist", { id: serial("id").primaryKey(), ipAddress: varchar("ip_address", { length: 50 }).notNull(), description: varchar("description", { length: 255 }), clientId: integer("client_id"), isActive: boolean("is_active").default(true).notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
export const numberValidation = pgTable("number_validation", { id: serial("id").primaryKey(), phoneNumber: varchar("phone_number", { length: 20 }).notNull(), countryCode: varchar("country_code", { length: 10 }), networkName: varchar("network_name", { length: 100 }), lineType: varchar("line_type", { length: 50 }), isValid: boolean("is_valid"), validatedAt: timestamp("validated_at").defaultNow().notNull() });
export const emailTemplates = pgTable("email_templates", { id: serial("id").primaryKey(), name: varchar("name", { length: 255 }).notNull(), subject: varchar("subject", { length: 255 }).notNull(), body: text("body").notNull(), type: varchar("type", { length: 50 }), isActive: boolean("is_active").default(true).notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
export const alerts = pgTable("alerts", { id: serial("id").primaryKey(), type: varchar("type", { length: 50 }).notNull(), title: varchar("title", { length: 255 }).notNull(), message: text("message").notNull(), severity: varchar("severity", { length: 20 }).default("info"), isRead: boolean("is_read").default(false), createdAt: timestamp("created_at").defaultNow().notNull() });
export const integrations = pgTable("integrations", { id: serial("id").primaryKey(), type: varchar("type", { length: 50 }).notNull(), name: varchar("name", { length: 255 }).notNull(), webhookUrl: text("webhook_url"), config: text("config"), isActive: boolean("is_active").default(true).notNull(), createdAt: timestamp("created_at").defaultNow().notNull() });
export const users = pgTable("users", { id: serial("id").primaryKey(), name: varchar("name", { length: 255 }).notNull(), email: varchar("email", { length: 255 }).notNull(), passwordHash: text("password_hash").notNull(), roleId: integer("role_id"), isActive: boolean("is_active").default(true).notNull(), lastLogin: timestamp("last_login"), createdAt: timestamp("created_at").defaultNow().notNull() });
export const roles = pgTable("roles", { id: serial("id").primaryKey(), name: varchar("name", { length: 100 }).notNull(), permissions: text("permissions"), createdAt: timestamp("created_at").defaultNow().notNull() });
export const translations = pgTable("translations", { id: serial("id").primaryKey(), key: varchar("key", { length: 255 }).notNull(), language: varchar("language", { length: 10 }).notNull(), value: text("value").notNull() });

// ── SMS Translation Engine ──
export const translationProfiles = pgTable("translation_profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  targetField: varchar("target_field", { length: 20 }).notNull(), // SENDER, BODY, DESTINATION
  mode: varchar("mode", { length: 20 }).notNull(), // FIXED, RANDOM
  matchPattern: text("match_pattern").default(".*").notNull(),
  replacementFixed: text("replacement_fixed"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const translationPoolItems = pgTable("translation_pool_items", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  replacementValue: text("replacement_value").notNull(),
});

export const translationAssignments = pgTable("translation_assignments", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  clientId: integer("client_id"),
  supplierId: integer("supplier_id"),
  priority: integer("priority").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});
