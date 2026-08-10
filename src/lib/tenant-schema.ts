import { pool } from "@/db";
import { padMnc } from "@/lib/mcc-lookup-client";

export async function createTenantSchema(schemaName: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Ensure global SMPP username index table exists (public schema, shared across tenants)
    await client.query(`CREATE TABLE IF NOT EXISTS smpp_usernames (
      id SERIAL PRIMARY KEY,
      smpp_username VARCHAR(100) NOT NULL UNIQUE,
      tenant_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      schema_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}"`);

    // Helper: wrap query in try-catch for non-fatal failures
    const safeQuery = (sql: string, params?: unknown[]) =>
      client.query(sql, params).catch((e: unknown) => {
        console.error(`Table error in ${schemaName}:`, (e as Error).message);
      });

    // Batch 1 — tables needed before seeding route plans
    await safeQuery(`CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY, client_code VARCHAR(50), name VARCHAR(255) NOT NULL,
      company_name VARCHAR(255), contact_person VARCHAR(255), email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL, country VARCHAR(100), address TEXT,
      connection_type VARCHAR(100), smpp_username VARCHAR(100), smpp_password VARCHAR(100),
      smpp_allowed_ip VARCHAR(255), smpp_port INTEGER DEFAULT 2775, smpp_system_type VARCHAR(50),
      max_tps INTEGER, billing_mode VARCHAR(50) DEFAULT 'prepaid', currency VARCHAR(10) DEFAULT 'USD',
      route_plan_id INTEGER,
      is_active BOOLEAN DEFAULT true, enable_http_api BOOLEAN DEFAULT false,
      http_api_key VARCHAR(255), force_dlr BOOLEAN DEFAULT false,
      charging_mode VARCHAR(50) DEFAULT 'on_submit', dlr_timeout_mode VARCHAR(50),
      dlr_timeout INTEGER DEFAULT 300, dlr_callback_url TEXT, webhook_url TEXT,
      bind_status VARCHAR(20) DEFAULT 'UNBOUND', last_bind_time TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, deleted_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW())`);

    await safeQuery(`CREATE TABLE IF NOT EXISTS client_rates (
      id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL, country_code VARCHAR(10) NOT NULL,
      mcc VARCHAR(10), mnc VARCHAR(10), mccmnc VARCHAR(6), operator_name VARCHAR(255),
      rate DECIMAL(10,6) NOT NULL,
      is_active BOOLEAN DEFAULT true, updated_at TIMESTAMP DEFAULT NOW())`);

    await safeQuery(`CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY, supplier_code VARCHAR(50), name VARCHAR(255) NOT NULL,
      company_name VARCHAR(255), contact_person VARCHAR(255), email VARCHAR(255),
      phone VARCHAR(50), connection_type VARCHAR(50) NOT NULL, connection_mode VARCHAR(20) DEFAULT 'CLIENT',
      host VARCHAR(255), port INTEGER DEFAULT 2775, username VARCHAR(255), password VARCHAR(255),
      system_id VARCHAR(100), system_type VARCHAR(50) DEFAULT 'ESME', smpp_version VARCHAR(20) DEFAULT '3.4',
      bind_type VARCHAR(20) DEFAULT 'TRX', address_ton INTEGER DEFAULT 0, address_npi INTEGER DEFAULT 0,
      address_range VARCHAR(100), inbound_mode BOOLEAN DEFAULT false, api_url TEXT, api_key TEXT,
      currency VARCHAR(10) DEFAULT 'USD',
      force_dlr BOOLEAN DEFAULT false, charging_mode VARCHAR(50) DEFAULT 'on_submit',
      dlr_timeout INTEGER DEFAULT 300, is_active BOOLEAN DEFAULT true, config TEXT,
      bind_status VARCHAR(20) DEFAULT 'UNBOUND', last_bind_time TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, deleted_by VARCHAR(255),
      gsm_device_id INTEGER, connector_id INTEGER, created_at TIMESTAMP DEFAULT NOW())`);

    await safeQuery(`CREATE TABLE IF NOT EXISTS supplier_rates (
      id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL, country_code VARCHAR(10) NOT NULL,
      mcc VARCHAR(10), mnc VARCHAR(10), mccmnc VARCHAR(6), operator_name VARCHAR(255),
      cost DECIMAL(10,6) NOT NULL,
      is_active BOOLEAN DEFAULT true, updated_at TIMESTAMP DEFAULT NOW())`);

    await safeQuery(`CREATE TABLE IF NOT EXISTS trunks (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, supplier_id INTEGER NOT NULL,
      connector_id INTEGER, capacity INTEGER DEFAULT 100, current_load INTEGER DEFAULT 0,
      mcc_allow_list TEXT, mcc_deny_list TEXT,
      is_active BOOLEAN DEFAULT true, updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`);

    await safeQuery(`CREATE TABLE IF NOT EXISTS routes (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, trunk_id INTEGER NOT NULL,
      country_code VARCHAR(10), prefix VARCHAR(20), priority INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT true, updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`);

    await safeQuery(`CREATE TABLE IF NOT EXISTS route_plans (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, description TEXT,
      is_active BOOLEAN DEFAULT true, updated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW())`);

    // route_plan_routes without FK first
    await safeQuery(`CREATE TABLE IF NOT EXISTS route_plan_routes (
      id SERIAL PRIMARY KEY, route_plan_id INTEGER NOT NULL, route_id INTEGER NOT NULL,
      priority INTEGER DEFAULT 1)`);

    // route_trunks — junction table allowing one route to have multiple trunks
    await safeQuery(`CREATE TABLE IF NOT EXISTS route_trunks (
      id SERIAL PRIMARY KEY, route_id INTEGER NOT NULL, trunk_id INTEGER NOT NULL,
      priority INTEGER DEFAULT 1, is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW())`);

    // Seed default route plans so new tenants have routing options immediately.
    // Plain INSERT with try-catch: works with or without a UNIQUE constraint on name.
    const seedPlans = async (name: string) => {
      try {
        await client.query(`INSERT INTO "${schemaName}".route_plans (name, is_active) VALUES ($1, true)`, [name]);
      } catch (e) { 
        console.error(`[${schemaName}] route_plan seed failed for "${name}":`, (e as Error).message);
      }
    };
    await seedPlans('Default Plan');
    await seedPlans('SIM OTP');
    await seedPlans('SIM Marketing');
    await seedPlans('Local Direct OTP');
    await seedPlans('Local Direct Marketing');

    // Batch 2 — all remaining tables can be created in parallel
    await Promise.all([
      safeQuery(`CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL, sender VARCHAR(20) NOT NULL,
      destination VARCHAR(20) NOT NULL, content TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'QUEUED', route_plan_id INTEGER, route_id INTEGER,
      trunk_id INTEGER, supplier_id INTEGER, connection_type VARCHAR(50),
      cost DECIMAL(10,6) DEFAULT 0, supplier_cost DECIMAL(10,6) DEFAULT 0,
      profit DECIMAL(10,6) DEFAULT 0, dlr_status VARCHAR(20), dlr_timestamp TIMESTAMP,
      retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 3,
      otp_code VARCHAR(10), language VARCHAR(50), message_id VARCHAR(100),
      campaign_id INTEGER, log_type VARCHAR(20) DEFAULT 'client',
      submit_result VARCHAR(20), dlr_callback_url TEXT,
      original_sender VARCHAR(50), original_destination VARCHAR(50),
      original_content TEXT, translation_notes TEXT,
      supplier_message_id VARCHAR(255),
      last_dlr_poll_at TIMESTAMP,
      dlr_source VARCHAR(20),
      created_at TIMESTAMP DEFAULT NOW())`),

      // DLR webhook delivery log — records each HTTP DLR push to an external client
      safeQuery(`CREATE TABLE IF NOT EXISTS dlr_webhook_logs (
      id SERIAL PRIMARY KEY,
      message_id VARCHAR(100),
      dlr_status VARCHAR(50),
      pushed_to TEXT,
      http_status INTEGER,
      response TEXT,
      success BOOLEAN DEFAULT false,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS sms_inbox (
      id SERIAL PRIMARY KEY, sender VARCHAR(20) NOT NULL, destination VARCHAR(20) NOT NULL,
      content TEXT NOT NULL, supplier_id INTEGER, received_at TIMESTAMP DEFAULT NOW(),
      is_read BOOLEAN DEFAULT false)`),

      safeQuery(`CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, client_id INTEGER NOT NULL,
      sender VARCHAR(20) NOT NULL, content TEXT NOT NULL, recipients TEXT,
      total_count INTEGER DEFAULT 0, sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'DRAFT', scheduled_at TIMESTAMP,
      started_at TIMESTAMP, completed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY, client_id INTEGER, invoice_number VARCHAR(50) NOT NULL,
      amount DECIMAL(12,4) NOT NULL, tax DECIMAL(12,4) DEFAULT 0,
      total_amount DECIMAL(12,4) NOT NULL, status VARCHAR(20) DEFAULT 'DRAFT',
      period_start TIMESTAMP NOT NULL, period_end TIMESTAMP NOT NULL,
      due_date TIMESTAMP NOT NULL, notes TEXT, created_by VARCHAR(255),
      created_for_type VARCHAR(20), created_for_id INTEGER, created_for_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS supplier_invoices (
      id SERIAL PRIMARY KEY, supplier_id INTEGER, invoice_number VARCHAR(50) NOT NULL,
      amount DECIMAL(12,4) NOT NULL, tax DECIMAL(12,4) DEFAULT 0,
      total_amount DECIMAL(12,4) NOT NULL, status VARCHAR(20) DEFAULT 'DRAFT',
      period_start TIMESTAMP NOT NULL, period_end TIMESTAMP NOT NULL,
      due_date TIMESTAMP NOT NULL, notes TEXT, created_by VARCHAR(255),
      supplier_name VARCHAR(255), created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL, invoice_id INTEGER,
      amount DECIMAL(12,4) NOT NULL, payment_method VARCHAR(50),
      transaction_id VARCHAR(255), status VARCHAR(20) DEFAULT 'PENDING',
      notes TEXT, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS connectors (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, provider VARCHAR(255),
      type VARCHAR(50) NOT NULL, region VARCHAR(50) DEFAULT 'global',
      api_url TEXT, api_key TEXT, auth_method VARCHAR(50) DEFAULT 'API_KEY',
      endpoints TEXT, status VARCHAR(20) DEFAULT 'active',
      is_active BOOLEAN DEFAULT true, updated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS ott_devices (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, device_type VARCHAR(50) NOT NULL,
      phone_number VARCHAR(20), api_config TEXT, proxy_id INTEGER,
      qr_code TEXT, qr_session TEXT, qr_expires_at TIMESTAMP,
      status VARCHAR(20) DEFAULT 'OFFLINE', last_seen TIMESTAMP,
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW(),
      -- Per-device send quotas (daily 250 / monthly 1000 by default)
      daily_limit INTEGER NOT NULL DEFAULT 250,
      monthly_limit INTEGER NOT NULL DEFAULT 1000,
      daily_sent INTEGER NOT NULL DEFAULT 0,
      monthly_sent INTEGER NOT NULL DEFAULT 0,
      daily_reset_date DATE DEFAULT CURRENT_DATE,
      monthly_reset_month VARCHAR(7) DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'))`),

      safeQuery(`CREATE TABLE IF NOT EXISTS proxy_config (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, proxy_type VARCHAR(50) DEFAULT 'residential',
      host VARCHAR(255) NOT NULL, port INTEGER NOT NULL, username VARCHAR(255),
      password VARCHAR(255), protocol VARCHAR(20) DEFAULT 'socks5',
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS voice_otp_config (
      id SERIAL PRIMARY KEY, country_group VARCHAR(255) NOT NULL, prefixes VARCHAR(500),
      primary_language VARCHAR(50) NOT NULL, secondary_language VARCHAR(50),
      primary_audio_count INTEGER DEFAULT 0, secondary_audio_count INTEGER DEFAULT 0,
      play_count INTEGER DEFAULT 3, retry_count INTEGER DEFAULT 1,
      bilingual BOOLEAN DEFAULT false,
      language_mode VARCHAR(20) DEFAULT 'local',
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS voice_otp_audio (
      id SERIAL PRIMARY KEY, config_id INTEGER NOT NULL, language VARCHAR(50) NOT NULL,
      digit VARCHAR(20) NOT NULL, file_name VARCHAR(255), file_url TEXT,
      audio_type VARCHAR(10) DEFAULT 'wav', created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS voice_otp_sip_config (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, sip_host VARCHAR(255),
      sip_port INTEGER DEFAULT 5060, sip_username VARCHAR(255), sip_password VARCHAR(255),
      caller_id VARCHAR(50), caller_id_mode VARCHAR(10) DEFAULT 'otp',
      e164_country_prefix VARCHAR(10), e164_format VARCHAR(10) DEFAULT 'plus',
      max_retries INTEGER DEFAULT 3, timeout INTEGER DEFAULT 30,
      dial_prefix VARCHAR(20),
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS voice_otp_call_logs (
      id SERIAL PRIMARY KEY, destination VARCHAR(20) NOT NULL, otp_code VARCHAR(10),
      language VARCHAR(50), status VARCHAR(20), attempt_count INTEGER DEFAULT 1,
      duration INTEGER, sip_config_id INTEGER, audio_playlist TEXT, attempt_log TEXT,
      call_sid VARCHAR(100), sip_config_name VARCHAR(255),
      country VARCHAR(100), mcc VARCHAR(10), created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS social_api_config (
      id SERIAL PRIMARY KEY, platform VARCHAR(50) NOT NULL, name VARCHAR(255) NOT NULL,
      api_key TEXT, api_secret TEXT, phone_number VARCHAR(20), webhook_url TEXT,
      proxy_id INTEGER, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS business_api_connect (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, provider VARCHAR(100) NOT NULL,
      api_url TEXT, credentials TEXT, proxy_id INTEGER,
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS ip_whitelist (
      id SERIAL PRIMARY KEY, ip_address VARCHAR(50) NOT NULL, description VARCHAR(255),
      client_id INTEGER, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS email_templates (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, subject VARCHAR(255) NOT NULL,
      body TEXT NOT NULL, type VARCHAR(50), is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS smtp_config (
      id SERIAL PRIMARY KEY, host VARCHAR(255) NOT NULL, port INTEGER DEFAULT 587,
      username VARCHAR(255), password VARCHAR(255), from_email VARCHAR(255),
      from_name VARCHAR(255) DEFAULT 'Net2APP', encryption VARCHAR(10) DEFAULT 'tls',
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY, type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL, severity VARCHAR(20) DEFAULT 'info',
      is_read BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS pending_dlrs (
      id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL,
      message_id VARCHAR(100) NOT NULL, supplier_message_id VARCHAR(100),
      status VARCHAR(50) NOT NULL, submit_date VARCHAR(20),
      done_date VARCHAR(20), error_code VARCHAR(10),
      dest VARCHAR(20) NOT NULL, src VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS integrations (
      id SERIAL PRIMARY KEY, type VARCHAR(50) NOT NULL, name VARCHAR(255) NOT NULL,
      webhook_url TEXT, config TEXT, is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL,
      password_hash TEXT NOT NULL, role_id INTEGER, is_active BOOLEAN DEFAULT true,
      last_login TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, permissions TEXT,
      created_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS translations (
      id SERIAL PRIMARY KEY, key VARCHAR(255) NOT NULL, language VARCHAR(10) NOT NULL,
      value TEXT NOT NULL)`),

      safeQuery(`CREATE TABLE IF NOT EXISTS custom_api_connectors (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'HTTP_API',
      send_url_template TEXT NOT NULL, send_method VARCHAR(10) DEFAULT 'GET',
      send_headers TEXT, send_body_template TEXT,
      send_success_condition TEXT, send_message_id_path TEXT,
      dlr_url_template TEXT, dlr_method VARCHAR(10) DEFAULT 'GET',
      dlr_success_condition TEXT, dlr_status_path TEXT,
      dlr_delivered_value VARCHAR(100) DEFAULT 'Delivered',
      dlr_poll_seconds INTEGER DEFAULT 30,
      dlr_timeout_seconds INTEGER DEFAULT 300,
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`),

    // ── MCC/MNC-based Translation Engine ──
      safeQuery(`CREATE TABLE IF NOT EXISTS translation_profiles (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
      target_field VARCHAR(20) NOT NULL DEFAULT 'SENDER',
      mode VARCHAR(20) NOT NULL DEFAULT 'FIXED',
      category VARCHAR(30) DEFAULT 'SID',
      match_pattern TEXT DEFAULT '.*',
      replacement_fixed TEXT,
      mcc VARCHAR(10), mnc VARCHAR(10),
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS translation_pool_items (
      id SERIAL PRIMARY KEY, profile_id INTEGER NOT NULL,
      replacement_value TEXT NOT NULL,
      mccmnc VARCHAR(6),
      updated_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS translation_assignments (
      id SERIAL PRIMARY KEY, profile_id INTEGER NOT NULL,
      client_id INTEGER, supplier_id INTEGER,
      priority INTEGER DEFAULT 1, is_active BOOLEAN DEFAULT true,
      updated_at TIMESTAMP DEFAULT NOW())`),

    // ── OTP Extract & Forward ──
      safeQuery(`CREATE TABLE IF NOT EXISTS otp_extract_rules (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
      mcc VARCHAR(10), mnc VARCHAR(10),
      regex_pattern TEXT NOT NULL, otp_group_index INTEGER DEFAULT 1,
      forward_supplier_id INTEGER, forward_sender VARCHAR(20),
      forward_template TEXT DEFAULT '{otp}', auto_detect BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`),

      safeQuery(`CREATE TABLE IF NOT EXISTS otp_forward_logs (
      id SERIAL PRIMARY KEY, rule_id INTEGER, inbox_message_id INTEGER,
      original_sender VARCHAR(20), original_content TEXT,
      extracted_otp VARCHAR(20), destination VARCHAR(20),
      forward_status VARCHAR(30), forward_message_id VARCHAR(100),
      error_message TEXT, created_at TIMESTAMP DEFAULT NOW())`),

    // ── Blacklist / Content Filter block log ──
      safeQuery(`CREATE TABLE IF NOT EXISTS blocked_sms_log (
      id SERIAL PRIMARY KEY,
      rule_name VARCHAR(255) NOT NULL,
      category VARCHAR(30) NOT NULL,
      destination VARCHAR(20) NOT NULL,
      content TEXT,
      client_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW())`),
    ]);

    // Seed 80+ API connectors into new tenant
    const connectorSQL = `
      INSERT INTO connectors (name, type, provider, region, auth_method, api_url, is_active) VALUES
      ('Twilio_SendGrid','HTTP_API','Twilio','global','API_KEY','https://api.sendgrid.com/v3/mail/send',true),
      ('Vonage_Nexmo','HTTP_API','Vonage','global','API_KEY','https://rest.nexmo.com/sms/json',true),
      ('MessageBird','HTTP_API','MessageBird','global','API_KEY','https://rest.messagebird.com/messages',true),
      ('Sinch','HTTP_API','Sinch','global','API_KEY','https://api.sinch.com/sms/v1',true),
      ('Infobip','HTTP_API','Infobip','global','BASIC','https://api.infobip.com/sms/2/text/advanced',true),
      ('Plivo','HTTP_API','Plivo','global','API_KEY','https://api.plivo.com/v1',true),
      ('Bandwidth','HTTP_API','Bandwidth','global','BASIC','https://messaging.bandwidth.com/api/v2',true),
      ('Telnyx','HTTP_API','Telnyx','global','API_KEY','https://api.telnyx.com/v2/messages',true),
      ('Telesign','HTTP_API','Telesign','global','BASIC','https://rest-api.telesign.com/v1',true),
      ('RouteMobile','HTTP_API','RouteMobile','global','API_KEY','https://api.routemobile.com',true),
      ('Google_Jibe','RCS','Google','global','BASIC','https://rcs.googleapis.com',true),
      ('Mavenir_RCS','RCS','Mavenir','global','API_KEY','https://api.mavenir.com/rcs',true),
      ('Flash_Call_Global','FLASH_SMS','FlashCall','global','API_KEY','https://api.flashcall.com/send',true),
      ('Sinch_Flash','FLASH_SMS','Sinch','global','API_KEY','https://api.sinch.com/sms/v1',true),
      ('ATT_API','HTTP_API','ATT','americas','API_KEY','https://api.att.com/sms',true),
      ('Verizon_GW','HTTP_API','Verizon','americas','API_KEY','https://api.verizon.com/messaging',true),
      ('TMobile_US','HTTP_API','T-Mobile','americas','API_KEY','https://api.t-mobile.com/sms',true),
      ('Bell_Canada','HTTP_API','Bell','americas','BASIC','https://api.bell.ca/sms',true),
      ('Rogers_CA','HTTP_API','Rogers','americas','API_KEY','https://api.rogers.com/messaging',true),
      ('Claro_BR','HTTP_API','Claro','americas','BASIC','https://api.claro.com.br/sms',true),
      ('Vivo_BR','HTTP_API','Vivo','americas','API_KEY','https://api.vivo.com.br/messaging',true),
      ('ATT_RCS','RCS','ATT','americas','API_KEY','https://rcs.att.com',true),
      ('Vodafone_DE','HTTP_API','Vodafone','europe','API_KEY','https://api.vodafone.de/sms',true),
      ('TMobile_DE','HTTP_API','T-Mobile','europe','BASIC','https://api.t-mobile.de/sms',true),
      ('Orange_FR','HTTP_API','Orange','europe','BASIC','https://api.orange.fr/sms',true),
      ('SFR_FR','HTTP_API','SFR','europe','API_KEY','https://api.sfr.fr/messaging',true),
      ('Movistar_ES','HTTP_API','Movistar','europe','BASIC','https://api.movistar.es/sms',true),
      ('TIM_IT','HTTP_API','TIM','europe','BASIC','https://api.tim.it/sms',true),
      ('EE_UK','HTTP_API','EE','europe','API_KEY','https://api.ee.co.uk/sms',true),
      ('Vodafone_UK','HTTP_API','Vodafone','europe','BASIC','https://api.vodafone.co.uk/sms',true),
      ('KPN_NL','HTTP_API','KPN','europe','API_KEY','https://api.kpn.com/sms',true),
      ('Vodafone_RCS_EU','RCS','Vodafone','europe','API_KEY','https://rcs.vodafone.eu',true),
      ('Telekom_RCS','RCS','DeutscheTelekom','europe','BASIC','https://rcs.telekom.de',true),
      ('Swisscom_Flash','FLASH_SMS','Swisscom','europe','API_KEY','https://api.swisscom.ch/flashsms',true),
      ('Etisalat_UAE','HTTP_API','Etisalat','middle_east','API_KEY','https://api.etisalat.ae/sms',true),
      ('Du_UAE','HTTP_API','Du','middle_east','BASIC','https://api.du.ae/sms',true),
      ('STC_Saudi','HTTP_API','STC','middle_east','API_KEY','https://api.stc.com.sa/sms',true),
      ('Zain_KSA','HTTP_API','Zain','middle_east','API_KEY','https://api.zain.sa/sms',true),
      ('Ooredoo_KW','HTTP_API','Ooredoo','middle_east','API_KEY','https://api.ooredoo.com.kw/sms',true),
      ('Omantel','HTTP_API','Omantel','middle_east','BASIC','https://api.omantel.om/sms',true),
      ('Batelco_BH','HTTP_API','Batelco','middle_east','API_KEY','https://api.batelco.com.bh/sms',true),
      ('Etisalat_RCS','RCS','Etisalat','middle_east','API_KEY','https://rcs.etisalat.ae',true),
      ('Mobily_Flash','FLASH_SMS','Mobily','middle_east','API_KEY','https://api.mobily.com.sa/flash',true),
      ('MTN_Nigeria','HTTP_API','MTN','africa','API_KEY','https://api.mtn.ng/sms',true),
      ('Airtel_NG','HTTP_API','Airtel','africa','BASIC','https://api.airtel.ng/sms',true),
      ('Vodacom_SA','HTTP_API','Vodacom','africa','API_KEY','https://api.vodacom.co.za/sms',true),
      ('Safaricom_KE','HTTP_API','Safaricom','africa','API_KEY','https://api.safaricom.co.ke/sms',true),
      ('Orange_Egypt','HTTP_API','Orange','africa','API_KEY','https://api.orange.eg/sms',true),
      ('Vodafone_EG','HTTP_API','Vodafone','africa','API_KEY','https://api.vodafone.eg/sms',true),
      ('Maroc_Telecom','HTTP_API','MarocTelecom','africa','BASIC','https://api.maroc-telecom.ma/sms',true),
      ('MTN_RCS_Africa','RCS','MTN','africa','API_KEY','https://rcs.mtn.africa',true),
      ('Safaricom_Flash','FLASH_SMS','Safaricom','africa','API_KEY','https://api.safaricom.co.ke/flash',true),
      ('Telstra_AU','HTTP_API','Telstra','asia_pacific','API_KEY','https://api.telstra.com/v2/messages',true),
      ('Optus_AU','HTTP_API','Optus','asia_pacific','BASIC','https://api.optus.com.au/sms',true),
      ('Spark_NZ','HTTP_API','Spark','asia_pacific','API_KEY','https://api.sparknz.co.nz/sms',true),
      ('Telkomsel_ID','HTTP_API','Telkomsel','asia_pacific','API_KEY','https://api.telkomsel.com/sms',true),
      ('Globe_PH','HTTP_API','Globe','asia_pacific','BASIC','https://api.globe.com.ph/sms',true),
      ('Singtel_SG','HTTP_API','Singtel','asia_pacific','BASIC','https://api.singtel.com/sms',true),
      ('Maxis_MY','HTTP_API','Maxis','asia_pacific','API_KEY','https://api.maxis.com.my/sms',true),
      ('Telstra_RCS','RCS','Telstra','asia_pacific','API_KEY','https://rcs.telstra.com',true),
      ('GrameenPhone','HTTP_API','GP','bangladesh','API_KEY','https://api.grameenphone.com/sms',true),
      ('Robi_BD','HTTP_API','Robi','bangladesh','BASIC','https://api.robi.com.bd/sms',true),
      ('Banglalink','HTTP_API','Banglalink','bangladesh','API_KEY','https://api.banglalink.net/sms',true),
      ('Teletalk_BD','HTTP_API','Teletalk','bangladesh','API_KEY','https://api.teletalk.com.bd/sms',true),
      ('GP_RCS','RCS','GP','bangladesh','API_KEY','https://rcs.grameenphone.com',true),
      ('BL_Flash','FLASH_SMS','Banglalink','bangladesh','API_KEY','https://api.banglalink.net/flash',true),
      ('GP_Flash','FLASH_SMS','GP','bangladesh','API_KEY','https://api.grameenphone.com/flash',true),
      ('Airtel_IN','HTTP_API','Airtel','india','API_KEY','https://api.airtel.in/sms',true),
      ('Jio_Platform','HTTP_API','Jio','india','BASIC','https://api.jio.com/platform',true),
      ('VI_India','HTTP_API','VodafoneIdea','india','API_KEY','https://api.myvi.in/sms',true),
      ('BSNL_SMS','HTTP_API','BSNL','india','BASIC','https://api.bsnl.in/sms',true),
      ('Jio_RCS','RCS','Jio','india','API_KEY','https://rcs.jio.com',true),
      ('Jio_Flash','FLASH_SMS','Jio','india','API_KEY','https://api.jio.com/flash',true),
      ('Airtel_Flash','FLASH_SMS','Airtel','india','API_KEY','https://api.airtel.in/flash',true),
      ('MTS_Russia','HTTP_API','MTS','russia','API_KEY','https://api.mts.ru/sms',true),
      ('Beeline_RU','HTTP_API','Beeline','russia','BASIC','https://api.beeline.ru/sms',true),
      ('MegaFon_RU','HTTP_API','MegaFon','russia','API_KEY','https://api.megafon.ru/sms',true),
      ('MTS_RCS','RCS','MTS','russia','API_KEY','https://rcs.mts.ru',true),
      ('ChinaMobile','HTTP_API','ChinaMobile','china','API_KEY','https://api.chinamobile.com/sms',true),
      ('ChinaUnicom','HTTP_API','ChinaUnicom','china','BASIC','https://api.chinaunicom.com/sms',true),
      ('CMCC_RCS','RCS','CMCC','china','API_KEY','https://rcs.chinamobile.com',true),
      ('Digicel_FJ','HTTP_API','Digicel','oceania','API_KEY','https://api.digicelfj.com/sms',true),
      ('Vodafone_FJ','HTTP_API','Vodafone','oceania','BASIC','https://api.vodafone.com.fj/sms',true)
      ON CONFLICT DO NOTHING`;
    await client.query(connectorSQL).catch(() => {});

    // Insert default roles (ignore duplicates)
    await client.query(`INSERT INTO roles (name, permissions) VALUES 
      ('Admin', '["*"]'),
      ('Manager', '["clients","suppliers","routes","messages","reports"]'),
      ('Operator', '["messages","reports"]'),
      ('Viewer', '["reports"]')
      ON CONFLICT (name) DO NOTHING`);

    // Insert default SMTP config
    await client.query(`INSERT INTO smtp_config (host, port, from_email, from_name)
      SELECT '', 587, '', 'Net2APP'
      WHERE NOT EXISTS (SELECT 1 FROM smtp_config LIMIT 1)`);

    // Seed default Voice OTP language groups — grouped by LANGUAGE (all prefixes for same language in one group)
    // Language detection is done via MCC database in voice-otp-engine.ts
    await client.query(`
      INSERT INTO voice_otp_config (country_group, prefixes, primary_language, secondary_language, is_active) VALUES
      ('English', '+1,+44,+61,+64,+65,+27,+234,+233,+353,+220,+231,+232,+248,+250,+258,+260,+263,+264,+265,+267,+230,+266,+268,+290', 'English', 'Spanish', true),
      ('Spanish', '+34,+52,+54,+57,+56,+51,+58,+53,+502,+503,+504,+505,+506,+507,+591,+593,+595,+598', 'Spanish', 'English', true),
      ('Arabic', '+966,+971,+962,+20,+213,+216,+218,+249,+253,+963,+964,+965,+967,+968,+970,+973,+974,+212,+222', 'Arabic', 'English', true),
      ('French', '+33,+32,+41,+226,+227,+228,+229,+235,+237,+241,+242,+243,+245,+250,+257,+262,+269,+509,+590,+594,+596,+689,+221,+223,+224,+225', 'French', 'English', true),
      ('Portuguese', '+351,+55,+238,+239,+244,+258,+853,+245,+247', 'Portuguese', 'English', true),
      ('Russian', '+7,+375,+380,+992,+993,+996,+998', 'Russian', 'English', true),
      ('German', '+49,+43,+41,+423,+352', 'German', 'English', true),
      ('Italian', '+39,+378', 'Italian', 'English', true),
      ('Dutch', '+31,+32,+297,+599', 'Dutch', 'English', true),
      ('Turkish', '+90', 'Turkish', 'English', true),
      ('Hindi', '+91', 'Hindi', 'English', true),
      ('Bangla', '+880', 'Bangla', 'English', true),
      ('Urdu', '+92', 'Urdu', 'English', true),
      ('Indonesian', '+62', 'Indonesian', 'English', true),
      ('Malay', '+60,+673', 'Malay', 'English', true),
      ('Filipino', '+63', 'Filipino', 'English', true),
      ('Thai', '+66', 'Thai', 'English', true),
      ('Vietnamese', '+84', 'Vietnamese', 'English', true),
      ('Mandarin', '+86,+886', 'Mandarin', 'English', true),
      ('Japanese', '+81', 'Japanese', 'English', true),
      ('Korean', '+82,+850', 'Korean', 'English', true),
      ('Cantonese', '+852,+853', 'Cantonese', 'English', true),
      ('Swahili', '+254,+255,+250', 'Swahili', 'English', true),
      ('Polish', '+48', 'Polish', 'English', true),
      ('Swedish', '+46', 'Swedish', 'English', true),
      ('Norwegian', '+47', 'Norwegian', 'English', true),
      ('Danish', '+45', 'Danish', 'English', true),
      ('Finnish', '+358', 'Finnish', 'English', true),
      ('Ukrainian', '+380', 'Ukrainian', 'English', true),
      ('Romanian', '+40,+373', 'Romanian', 'English', true),
      ('Czech', '+420', 'Czech', 'English', true),
      ('Hungarian', '+36', 'Hungarian', 'English', true),
      ('Greek', '+30,+357', 'Greek', 'English', true),
      ('Hebrew', '+972', 'Hebrew', 'English', true),
      ('Persian', '+98', 'Persian', 'English', true),
      ('Somali', '+252', 'Somali', 'English', true),
      ('Amharic', '+251', 'Amharic', 'English', true),
      ('Burmese', '+95', 'Burmese', 'English', true),
      ('Khmer', '+855', 'Khmer', 'English', true),
      ('Nepali', '+977', 'Nepali', 'English', true),
      ('Sinhala', '+94', 'Sinhala', 'English', true),
      ('Lao', '+856', 'Lao', 'English', true),
      ('Mongolian', '+976', 'Mongolian', 'English', true),
      ('Georgian', '+995', 'Georgian', 'English', true),
      ('Armenian', '+374', 'Armenian', 'English', true),
      ('Azerbaijani', '+994', 'Azerbaijani', 'English', true),
      ('Kazakh', '+7', 'Kazakh', 'English', true),
      ('Uzbek', '+998', 'Uzbek', 'English', true),
      ('Icelandic', '+354', 'Icelandic', 'English', true),
      ('Estonian', '+372', 'Estonian', 'English', true),
      ('Latvian', '+371', 'Latvian', 'English', true),
      ('Lithuanian', '+370', 'Lithuanian', 'English', true),
      ('Bulgarian', '+359', 'Bulgarian', 'English', true),
      ('Serbian', '+381', 'Serbian', 'English', true),
      ('Croatian', '+385', 'Croatian', 'English', true),
      ('Slovenian', '+386', 'Slovenian', 'English', true),
      ('Slovak', '+421', 'Slovak', 'English', true),
      ('Bosnian', '+387', 'Bosnian', 'English', true),
      ('Macedonian', '+389', 'Macedonian', 'English', true),
      ('Albanian', '+355', 'Albanian', 'English', true),
      ('Maltese', '+356', 'Maltese', 'English', true),
      ('Luxembourgish', '+352', 'Luxembourgish', 'English', true),
      ('Samoan', '+685', 'Samoan', 'English', true),
      ('Tongan', '+676', 'Tongan', 'English', true),
      ('Fijian', '+679', 'Fijian', 'English', true)
      ON CONFLICT DO NOTHING`);

    // ── Seed Sample Translation Profiles for new tenants ──
    // Only seed if no profiles exist yet (first-time setup)
    const { rows: existingProfiles } = await client.query(
      `SELECT 1 FROM "${schemaName}".translation_profiles LIMIT 1`
    );
    if (existingProfiles.length === 0) {
      const seedProfile = async (
        name: string, targetField: string, mode: string, category: string,
        matchPattern: string, replacementFixed: string | null,
        mcc: string | null, mnc: string | null
      ): Promise<number> => {
        const r = await client.query(
          `INSERT INTO "${schemaName}".translation_profiles
           (name, target_field, mode, category, match_pattern, replacement_fixed, mcc, mnc, sort_order, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,true) RETURNING id`,
          [name, targetField, mode, category, matchPattern, replacementFixed, mcc, mnc]
        );
        return r.rows[0].id;
      };
      const assignProfile = async (
        profileId: number, scope: string, entityId: number | null, priority: number
      ) => {
        let cId: number | null = null;
        let sId: number | null = null;
        if (scope === 'client' && entityId) cId = entityId;
        else if (scope === 'supplier' && entityId) sId = entityId;
        await client.query(
          `INSERT INTO "${schemaName}".translation_assignments
           (profile_id, client_id, supplier_id, priority, is_active)
           VALUES ($1,$2,$3,$4,true)`,
          [profileId, cId, sId, priority]
        );
      };
      const addPool = async (profileId: number, items: { value: string; mccmnc?: string }[]) => {
        for (const item of items) {
          await client.query(
            `INSERT INTO "${schemaName}".translation_pool_items
             (profile_id, replacement_value, mccmnc) VALUES ($1,$2,$3)`,
            [profileId, item.value, item.mccmnc || null]
          );
        }
      };

      // 1. SID Translation — replace sender globally
      const p1 = await seedProfile('Sample SID Replace', 'SENDER', 'FIXED', 'SID', '.*', 'MyBrand', null, null);
      await assignProfile(p1, 'both', null, 1);

      // 2. Number Translation — strip +880 for Bangladesh
      const p2 = await seedProfile('Sample BD Number Strip', 'DESTINATION', 'FIXED', 'NUMBER',
        '.*', JSON.stringify({ steps: [{ type:'stripDigits', value:'2' }, { type:'removePrefix', value:'+880' }, { type:'addPrefix', value:'0' }] }),
        '470', null);
      await assignProfile(p2, 'both', null, 1);

      // 3. Content Translation — keyword replace
      const p3 = await seedProfile('Sample Keyword Replace', 'BODY', 'FIXED', 'CONTENT', 'facebook|FB', 'verify', null, null);
      await assignProfile(p3, 'both', null, 1);

      // 4. Random Content — OTP templates with MCC/MNC-tagged pool items
      const p4 = await seedProfile('Sample Random OTP Templates', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '470', null);
      await assignProfile(p4, 'both', null, 1);
      await addPool(p4, [
        // Global templates (apply to all operators in MCC 470 / Bangladesh)
        { value: 'Your OTP code is {{OTP}}. Valid for 5 min.' },
        { value: 'Verification code: {{OTP}}' },
        { value: '{{OTP}} is your one-time password' },
        { value: 'OTP: {{OTP}}. Do not share.' },
        { value: '{{OTP}} is your One Time Password. Use within 5 minutes.' },
        { value: 'Use {{OTP}} to complete verification. OTP expires in 3 mins.' },
        { value: 'Never share {{OTP}} with anyone. Your login code: {{OTP}}' },
        { value: 'Verification OTP: {{OTP}}. Valid for 5 minutes only.' },
        { value: 'Your security code is {{OTP}}. If not requested, ignore.' },
        { value: '{{OTP}} is your login PIN. Do not share this code.' },
        // Operator-specific templates (tagged with MCC/MNC)
        { value: 'GP: {{OTP}} is your Grameenphone verification code.', mccmnc: '470001' },
        { value: 'Robi OTP: {{OTP}} — Valid for 3 minutes', mccmnc: '470002' },
        { value: 'Banglalink: Use {{OTP}} to verify your account', mccmnc: '470003' },
        { value: 'Teletalk: {{OTP}} is your login code', mccmnc: '470004' },
        { value: 'Airtel: Verification code {{OTP}} — Do not share', mccmnc: '470007' },
      ]);

      // 5. Random SID — sender ID pool with operator-targeted items
      const p5 = await seedProfile('Sample Random SID', 'SENDER', 'RANDOM', 'RANDOM_SID', '.*', null, '470', null);
      await assignProfile(p5, 'both', null, 1);
      await addPool(p5, [
        // Global sender IDs (apply to all Bangladesh operators)
        { value: 'BrandSID1' },
        { value: 'BrandSID2' },
        { value: 'BrandSID3' },
        { value: 'MyBrand' },
        { value: 'Net2APP' },
        { value: 'VerifySMS' },
        // Operator-specific sender IDs
        { value: 'GP_OTP', mccmnc: '470001' },
        { value: 'Robi_Secure', mccmnc: '470002' },
        { value: 'BL_Alert', mccmnc: '470003' },
        { value: 'Airtel_BD', mccmnc: '470007' },
      ]);

      // 6. 🇫🇷 French OTP Templates (MCC 208 - France)
      const p6 = await seedProfile('French OTP Templates - MCC 208', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '208', null);
      await assignProfile(p6, 'both', null, 1);
      await addPool(p6, [
        { value: 'Votre code de vérification est {{OTP}}. Valable 5 minutes.' },
        { value: 'Code OTP : {{OTP}}. Ne partagez pas ce code.' },
        { value: '{{OTP}} est votre mot de passe unique. Utilisez-le sous 5 min.' },
        { value: 'Code de sécurité : {{OTP}}. Ignorez si non sollicité.' },
        { value: 'Votre code : {{OTP}}. Valide 3 minutes.' },
      ]);

      // 7. 🇪🇸 Spanish OTP Templates (MCC 214 - Spain)
      const p7 = await seedProfile('Spanish OTP Templates - MCC 214', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '214', null);
      await assignProfile(p7, 'both', null, 1);
      await addPool(p7, [
        { value: 'Su código de verificación es {{OTP}}. Válido por 5 minutos.' },
        { value: 'Código OTP: {{OTP}}. No comparta este código.' },
        { value: '{{OTP}} es su contraseña de un solo uso.' },
        { value: 'Código de seguridad: {{OTP}}. Si no lo solicitó, ignore.' },
        { value: 'Su código: {{OTP}}. Válido 3 minutos.' },
      ]);

      // 8. 🇦🇪 Arabic OTP Templates (MCC 424 - UAE)
      const p8 = await seedProfile('Arabic OTP Templates - MCC 424', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '424', null);
      await assignProfile(p8, 'both', null, 1);
      await addPool(p8, [
        { value: 'رمز التحقق الخاص بك هو {{OTP}}. صالح لمدة 5 دقائق.' },
        { value: 'كلمة المرور لمرة واحدة: {{OTP}}. لا تشارك هذا الرمز.' },
        { value: '{{OTP}} هو رمز التحقق الخاص بك. لا تشاركه.' },
        { value: 'رمز الأمان: {{OTP}}. إذا لم تطلب ذلك، تجاهل.' },
        { value: 'رمز الدخول الخاص بك هو {{OTP}}. صالح لمدة 3 دقائق.' },
      ]);

      // 9. 🇧🇩 Bangla OTP Templates (MCC 470 - Bangladesh)
      const p9 = await seedProfile('Bangla OTP Templates - MCC 470', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '470', null);
      await assignProfile(p9, 'both', null, 1);
      await addPool(p9, [
        { value: 'আপনার OTP কোড হল {{OTP}}। ৫ মিনিটের জন্য বৈধ।' },
        { value: 'যাচাইকরণ কোড: {{OTP}}' },
        { value: '{{OTP}} হল আপনার এককালীন পাসওয়ার্ড' },
        { value: 'OTP: {{OTP}}। কারও সাথে শেয়ার করবেন না।' },
        { value: 'আপনার নিরাপত্তা কোড {{OTP}}। না চাইলে উপেক্ষা করুন।' },
      ]);

      // 10. 🇧🇷 Brazilian Portuguese OTP Templates (MCC 724 - Brazil)
      const p10 = await seedProfile('Brazilian OTP Templates - MCC 724', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '724', null);
      await assignProfile(p10, 'both', null, 1);
      await addPool(p10, [
        // Global templates (apply to all operators in MCC 724 / Brazil)
        { value: 'Seu código de verificação é {{OTP}}. Válido por 5 minutos.' },
        { value: 'Código OTP: {{OTP}}. Não compartilhe este código.' },
        { value: '{{OTP}} é sua senha de uso único.' },
        { value: 'OTP: {{OTP}}. Não compartilhe com ninguém.' },
        { value: 'Seu código de segurança é {{OTP}}. Se não solicitou, ignore.' },
        { value: '{{OTP}} é seu PIN de login. Válido por 3 minutos.' },
        // Operator-specific templates
        { value: 'Vivo: Seu código de verificação {{OTP}} é válido por 5 minutos.', mccmnc: '724001' },
        { value: 'TIM: Use {{OTP}} para confirmar seu login.', mccmnc: '724002' },
        { value: 'Claro: Código OTP {{OTP}} — Não compartilhe.', mccmnc: '724003' },
        { value: 'Oi: Seu código de acesso é {{OTP}}. Válido por 5 minutos.', mccmnc: '724010' },
        { value: 'Vivo: {{OTP}} é seu código de segurança.', mccmnc: '724011' },
        { value: 'TIM: Código de verificação {{OTP}} — Válido por 3 minutos.', mccmnc: '724032' },
        { value: 'Claro: {{OTP}} é sua senha de uso único.', mccmnc: '724033' },
        { value: 'Algar: Use {{OTP}} para verificar sua conta.', mccmnc: '724034' },
      ]);

      // 11. OTP Extract Rule — auto-detect for global
      await client.query(
        `INSERT INTO "${schemaName}".otp_extract_rules
         (name, regex_pattern, otp_group_index, forward_template, auto_detect, sort_order, is_active)
         VALUES ('Sample OTP Auto-Extract', '(\\\d{4,8})', 1, '{otp}', true, 0, true)
         ON CONFLICT DO NOTHING`
      );

      console.log(`[TENANT] Seeded 11 sample translation profiles (6 core + 5 multilingual) for ${schemaName}`);
    }

    await client.query(`SET search_path TO public`);

  } finally {
    client.release();
  }
}

export async function tenantQuery(schemaName: string, query: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    const result = await client.query(query, params);
    await client.query(`SET search_path TO public`);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Global SMPP Username Index — O(1) cross-tenant uniqueness lookups.
 * All writes to the per-tenant clients table MUST sync through these helpers
 * to keep the global index consistent.
 */

/**
 * Check if an SMPP username is already used by another client.
 * O(1) lookup on the global smpp_usernames table instead of scanning all schemas.
 */
export async function isSmppUsernameTaken(smppUsername: string, excludeClientId?: number): Promise<boolean> {
  if (!smppUsername) return false;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT 1 FROM smpp_usernames WHERE smpp_username = $1` +
      (excludeClientId ? ` AND client_id != $2` : ""),
      excludeClientId ? [smppUsername, excludeClientId] : [smppUsername]
    );
    return rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Register an SMPP username in the global index after creating a client.
 * INSERT with ON CONFLICT as safety net (though uniqueness is checked beforehand).
 */
export async function registerSmppUsername(
  smppUsername: string,
  tenantId: number,
  clientId: number,
  schemaName: string
): Promise<void> {
  if (!smppUsername) return;
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO smpp_usernames (smpp_username, tenant_id, client_id, schema_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (smpp_username) DO UPDATE SET tenant_id = $2, client_id = $3, schema_name = $4`,
      [smppUsername, tenantId, clientId, schemaName]
    );
  } finally {
    client.release();
  }
}

/**
 * Unregister an SMPP username from the global index (on delete or username change).
 */
export async function unregisterSmppUsername(smppUsername: string): Promise<void> {
  if (!smppUsername) return;
  const client = await pool.connect();
  try {
    await client.query(
      `DELETE FROM smpp_usernames WHERE smpp_username = $1`,
      [smppUsername]
    );
  } finally {
    client.release();
  }
}

/**
 * Handle SMPP username change during client update.
 * Caller is responsible for checking that the username actually changed.
 */
export async function syncSmppUsernameChange(
  oldUsername: string | null,
  newUsername: string | null,
  tenantId: number,
  clientId: number,
  schemaName: string
): Promise<void> {
  // Remove old username from index (if it existed)
  if (oldUsername) {
    await unregisterSmppUsername(oldUsername);
  }
  // Register new username in index (if provided)
  if (newUsername) {
    await registerSmppUsername(newUsername, tenantId, clientId, schemaName);
  }
}

/**
 * Seed MCC/MNC rate entries from the global mcc_mnc_database into a
 * new tenant's client_rates and supplier_rates tables. Uses client_id=-1
 * and supplier_id=-1 as placeholder entries (shared default rates).
 * Called automatically on tenant registration.
 */
export async function seedMccMncRates(schemaName: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Fetch all MCC/MNC entries from global database
    await client.query("SET search_path TO public");
    const { rows: mccEntries } = await client.query(
      "SELECT mcc, mnc, country_code, country_name, network_name FROM mcc_mnc_database ORDER BY country_name, network_name"
    );
    if (mccEntries.length === 0) return;

    // Switch to tenant schema to insert
    await client.query(`SET search_path TO "${schemaName}"`);

    let inserted = 0;
    let skipped = 0;

    // Insert into client_rates (placeholder client_id = -1 for shared defaults).
    // MNC is stored zero-padded and deduplicated on the padded key so "3" and
    // "003" are treated as the same network.
    for (const entry of mccEntries) {
      try {
        const { rowCount } = await client.query(
          `INSERT INTO client_rates (client_id, country_code, mcc, mnc, operator_name, rate, mccmnc)
           SELECT -1, $1::text, $2::text, $3::text, $4::text, 0.00025, $2::text || LPAD(COALESCE($3::text,''), 3, '0')
           WHERE NOT EXISTS (
             SELECT 1 FROM client_rates
             WHERE country_code = $1 AND mcc = $2
               AND LPAD(COALESCE(mnc,''), 3, '0') = LPAD(COALESCE($3,''), 3, '0')
           )`,
          [entry.country_code, entry.mcc, padMnc(entry.mnc) || null, entry.network_name || null]
        );
        if (rowCount && rowCount > 0) inserted++; else skipped++;
      } catch { skipped++; }
    }

    // Insert into supplier_rates (placeholder supplier_id = -1 for shared defaults)
    for (const entry of mccEntries) {
      try {
        const { rowCount } = await client.query(
          `INSERT INTO supplier_rates (supplier_id, country_code, mcc, mnc, operator_name, cost, mccmnc)
           SELECT -1, $1::text, $2::text, $3::text, $4::text, 0.00020, $2::text || LPAD(COALESCE($3::text,''), 3, '0')
           WHERE NOT EXISTS (
             SELECT 1 FROM supplier_rates
             WHERE country_code = $1 AND mcc = $2
               AND LPAD(COALESCE(mnc,''), 3, '0') = LPAD(COALESCE($3,''), 3, '0')
           )`,
          [entry.country_code, entry.mcc, padMnc(entry.mnc) || null, entry.network_name || null]
        );
        if (rowCount && rowCount > 0) inserted++; else skipped++;
      } catch { skipped++; }
    }

    await client.query("SET search_path TO public");
    console.log(`[TENANT] Seeded MCC/MNC rates for ${schemaName}: ${inserted} inserted, ${skipped} skipped`);
  } catch (e) {
    console.error(`[TENANT] MCC/MNC rate seeding failed for ${schemaName}:`, (e as Error).message);
  } finally {
    client.release();
  }
}
