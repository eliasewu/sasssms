-- Email Accounts (managed by super admin)
CREATE TABLE IF NOT EXISTS "email_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "name" varchar(255) NOT NULL,
  "department" varchar(50),
  "disk_quota_mb" integer DEFAULT 500,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Email Account Audit Log
CREATE TABLE IF NOT EXISTS "email_account_audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "account_email" varchar(255) NOT NULL,
  "action" varchar(20) NOT NULL,
  "changes" text,
  "admin_id" integer NOT NULL,
  "admin_name" varchar(255) NOT NULL,
  "admin_email" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Payment Transactions (public, cross-tenant)
CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "amount" numeric(12, 4) NOT NULL,
  "payment_method" varchar(50) NOT NULL,
  "status" varchar(30) DEFAULT 'PENDING' NOT NULL,
  "package_type" varchar(50),
  "sms_amount" integer DEFAULT 0,
  "metadata" text,
  "transaction_id" varchar(255),
  "approved_by" integer,
  "approved_at" timestamp,
  "notes" text,
  "client_email" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- SMS Translation Engine
CREATE TABLE IF NOT EXISTS "translation_profiles" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "target_field" varchar(20) NOT NULL,
  "mode" varchar(20) NOT NULL,
  "match_pattern" text DEFAULT '.*' NOT NULL,
  "replacement_fixed" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "translation_pool_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "profile_id" integer NOT NULL,
  "replacement_value" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "translation_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "profile_id" integer NOT NULL,
  "client_id" integer,
  "supplier_id" integer,
  "priority" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);

-- Login Sessions — tracks every login/logout
CREATE TABLE IF NOT EXISTS "login_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_type" varchar(20) NOT NULL,
  "user_id" integer NOT NULL,
  "email" varchar(255) NOT NULL,
  "ip_address" varchar(50),
  "user_agent" text,
  "token_hash" varchar(100),
  "login_at" timestamp DEFAULT now() NOT NULL,
  "logout_at" timestamp
);

-- Audit Log — generic CRUD audit trail
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_type" varchar(100) NOT NULL,
  "entity_id" integer,
  "action" varchar(20) NOT NULL,
  "changed_by" varchar(255),
  "old_data" text,
  "new_data" text,
  "ip_address" varchar(50),
  "tenant_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- CDR Deleted Items — soft-delete archive
CREATE TABLE IF NOT EXISTS "cdr_deleted_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_type" varchar(100) NOT NULL,
  "entity_id" integer NOT NULL,
  "entity_name" varchar(255),
  "entity_data" text,
  "deleted_by" varchar(255),
  "tenant_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- MCC Traffic Statistics — per-tenant traffic aggregation
CREATE TABLE IF NOT EXISTS "mcc_traffic_stats" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "mcc" varchar(10) NOT NULL,
  "country_code" varchar(10),
  "country_name" varchar(100),
  "message_count" integer DEFAULT 0,
  "delivered_count" integer DEFAULT 0,
  "failed_count" integer DEFAULT 0,
  "total_cost" numeric(12, 6) DEFAULT '0',
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
