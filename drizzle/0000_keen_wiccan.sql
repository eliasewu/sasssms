CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"severity" varchar(20) DEFAULT 'info',
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_api_connect" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"api_url" text,
	"credentials" text,
	"proxy_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"client_id" integer NOT NULL,
	"sender" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"recipients" text,
	"total_count" integer DEFAULT 0,
	"sent_count" integer DEFAULT 0,
	"delivered_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'DRAFT',
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"country_code" varchar(10) NOT NULL,
	"mcc" varchar(10),
	"mnc" varchar(10),
	"rate" numeric(10, 6) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_code" varchar(50),
	"name" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"contact_person" varchar(255),
	"email" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"country" varchar(100),
	"address" text,
	"connection_type" varchar(100),
	"smpp_username" varchar(100),
	"smpp_password" varchar(100),
	"smpp_allowed_ip" varchar(255),
	"smpp_port" integer DEFAULT 2775,
	"smpp_system_type" varchar(50),
	"max_tps" integer,
	"billing_mode" varchar(50) DEFAULT 'prepaid',
	"currency" varchar(10) DEFAULT 'USD',
	"balance" numeric(12, 4) DEFAULT '0' NOT NULL,
	"credit_limit" numeric(12, 4) DEFAULT '0',
	"rate_per_sms" numeric(10, 6) DEFAULT '0.00025' NOT NULL,
	"route_plan_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"enable_http_api" boolean DEFAULT false,
	"http_api_key" varchar(255),
	"force_dlr" boolean DEFAULT false,
	"dlr_timeout_mode" varchar(50),
	"dlr_timeout" integer,
	"dlr_callback_url" text,
	"webhook_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider" varchar(255),
	"type" varchar(50) NOT NULL,
	"region" varchar(50) DEFAULT 'global',
	"api_url" text,
	"api_key" text,
	"auth_method" varchar(50) DEFAULT 'API_KEY',
	"endpoints" text,
	"status" varchar(20) DEFAULT 'active',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"type" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"webhook_url" text,
	"config" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"tax" numeric(12, 4) DEFAULT '0',
	"total_amount" numeric(12, 4) NOT NULL,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_whitelist" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" varchar(50) NOT NULL,
	"description" varchar(255),
	"client_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcc_mnc_database" (
	"id" serial PRIMARY KEY NOT NULL,
	"mcc" varchar(10) NOT NULL,
	"mnc" varchar(10),
	"country_code" varchar(10) NOT NULL,
	"country_name" varchar(100) NOT NULL,
	"network_name" varchar(100),
	"network_type" varchar(50),
	"language" varchar(50) DEFAULT 'English'
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"sender" varchar(20) NOT NULL,
	"destination" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"status" varchar(20) DEFAULT 'QUEUED' NOT NULL,
	"route_plan_id" integer,
	"route_id" integer,
	"trunk_id" integer,
	"supplier_id" integer,
	"connection_type" varchar(50),
	"cost" numeric(10, 6) DEFAULT '0',
	"dlr_status" varchar(20),
	"dlr_timestamp" timestamp,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"otp_code" varchar(10),
	"language" varchar(50),
	"message_id" varchar(100),
	"campaign_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_validation" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"country_code" varchar(10),
	"network_name" varchar(100),
	"line_type" varchar(50),
	"is_valid" boolean,
	"validated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ott_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"device_type" varchar(50) NOT NULL,
	"phone_number" varchar(20),
	"api_config" text,
	"proxy_id" integer,
	"qr_code" text,
	"qr_session" text,
	"qr_expires_at" timestamp,
	"status" varchar(20) DEFAULT 'OFFLINE',
	"last_seen" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"monthly_fee" numeric(10, 2) DEFAULT '0',
	"sms_credits" integer DEFAULT 0,
	"free_sms_per_month" boolean DEFAULT false,
	"features" text,
	"requires_license" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"method" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"credentials" text,
	"qr_code_url" text,
	"wallet_address" text,
	"network" varchar(50),
	"min_amount" numeric(10, 2) DEFAULT '25',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"invoice_id" integer,
	"amount" numeric(12, 4) NOT NULL,
	"payment_method" varchar(50),
	"transaction_id" varchar(255),
	"status" varchar(20) DEFAULT 'PENDING',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "proxy_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"proxy_type" varchar(50) DEFAULT 'residential',
	"host" varchar(255) NOT NULL,
	"port" integer NOT NULL,
	"username" varchar(255),
	"password" varchar(255),
	"protocol" varchar(20) DEFAULT 'socks5',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"permissions" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"rules" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_plan_routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"route_plan_id" integer NOT NULL,
	"route_id" integer NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"trunk_id" integer NOT NULL,
	"country_code" varchar(10),
	"prefix" varchar(20),
	"priority" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_inbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender" varchar(20) NOT NULL,
	"destination" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"supplier_id" integer,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "social_api_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"api_key" text,
	"api_secret" text,
	"phone_number" varchar(20),
	"webhook_url" text,
	"proxy_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "super_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "supplier_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"country_code" varchar(10) NOT NULL,
	"mcc" varchar(10),
	"mnc" varchar(10),
	"cost" numeric(10, 6) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_code" varchar(50),
	"name" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"contact_person" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"connection_type" varchar(50) NOT NULL,
	"host" varchar(255),
	"port" integer DEFAULT 2775,
	"username" varchar(255),
	"password" varchar(255),
	"system_id" varchar(100),
	"system_type" varchar(50),
	"smpp_version" varchar(20) DEFAULT '3.4',
	"bind_type" varchar(20) DEFAULT 'TRX',
	"address_ton" integer DEFAULT 0,
	"address_npi" integer DEFAULT 0,
	"address_range" varchar(100),
	"inbound_mode" boolean DEFAULT false,
	"api_url" text,
	"api_key" text,
	"currency" varchar(10) DEFAULT 'USD',
	"cost_per_sms" numeric(10, 6) DEFAULT '0' NOT NULL,
	"initial_balance" numeric(12, 4) DEFAULT '0',
	"credit_limit" numeric(12, 4) DEFAULT '0',
	"force_dlr" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" text,
	"bind_status" varchar(20) DEFAULT 'UNBOUND',
	"last_bind_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"schema_name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"balance" numeric(12, 4) DEFAULT '0' NOT NULL,
	"max_tps" integer DEFAULT 0,
	"smpp_enabled" boolean DEFAULT true NOT NULL,
	"http_enabled" boolean DEFAULT true NOT NULL,
	"rcs_enabled" boolean DEFAULT true NOT NULL,
	"flash_sms_enabled" boolean DEFAULT true NOT NULL,
	"voice_otp_enabled" boolean DEFAULT true NOT NULL,
	"ott_enabled" boolean DEFAULT true NOT NULL,
	"business_api_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"package_type" varchar(50) DEFAULT 'starter',
	"package_price" numeric(10, 2) DEFAULT '0',
	"monthly_fee" numeric(10, 2) DEFAULT '0',
	"license_key" varchar(100),
	"sms_counter" integer DEFAULT 0,
	"sms_limit" integer DEFAULT 0,
	"package_expires_at" timestamp,
	"smpp_server_ip" varchar(100),
	"smpp_server_port" integer DEFAULT 2775,
	"cost_per_sms" numeric(10, 6) DEFAULT '0.00025' NOT NULL,
	"sms_valid_until" timestamp,
	"last_recharge_at" timestamp,
	"last_recharge_amount" numeric(10, 2),
	"account_expires_at" timestamp,
	"email_verified" boolean DEFAULT false,
	"phone_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_email_unique" UNIQUE("email"),
	CONSTRAINT "tenants_schema_name_unique" UNIQUE("schema_name")
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"language" varchar(10) NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"supplier_id" integer NOT NULL,
	"connector_id" integer,
	"capacity" integer DEFAULT 100 NOT NULL,
	"current_load" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_otp_audio" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_id" integer NOT NULL,
	"language" varchar(50) NOT NULL,
	"digit" varchar(5) NOT NULL,
	"file_name" varchar(255),
	"file_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_otp_call_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"destination" varchar(20) NOT NULL,
	"otp_code" varchar(10),
	"language" varchar(50),
	"status" varchar(20),
	"attempt_count" integer DEFAULT 1,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_otp_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_group" varchar(255) NOT NULL,
	"prefixes" varchar(500),
	"primary_language" varchar(50) NOT NULL,
	"secondary_language" varchar(50),
	"primary_audio_count" integer DEFAULT 0,
	"secondary_audio_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_otp_sip_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"sip_host" varchar(255),
	"sip_port" integer DEFAULT 5060,
	"sip_username" varchar(255),
	"sip_password" varchar(255),
	"caller_id" varchar(50),
	"max_retries" integer DEFAULT 3,
	"timeout" integer DEFAULT 30,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
