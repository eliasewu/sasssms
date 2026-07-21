-- Add server_location column to tenants table
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "server_location" varchar(50);

-- Seed default server locations into platform_settings if not exists
INSERT INTO "platform_settings" ("key", "value")
VALUES ('server_locations', '[{"id":"canada","country":"Canada","city":"Toronto","countryCodes":"US,CA,MX","ipAddress":"","port":2775,"isActive":true},{"id":"poland","country":"Poland","city":"Warsaw","countryCodes":"PL,CZ,SK,HU,UA,RO,BG,LT,LV,EE,HR,SI,RS,BY,MD","ipAddress":"","port":2775,"isActive":true},{"id":"france","country":"France","city":"Paris","countryCodes":"FR,DE,GB,ES,IT,NL,BE,CH,AT,LU,IE,PT,DK,NO,SE,FI","ipAddress":"","port":2775,"isActive":true},{"id":"usa","country":"USA","city":"New York","countryCodes":"","ipAddress":"","port":2775,"isActive":true},{"id":"germany","country":"Germany","city":"Frankfurt","countryCodes":"DE,AT,CH,CZ,SK,HU","ipAddress":"","port":2775,"isActive":false},{"id":"uk","country":"United Kingdom","city":"London","countryCodes":"GB,IE,PT,ES,FR,NL,BE","ipAddress":"","port":2775,"isActive":false},{"id":"singapore","country":"Singapore","city":"Singapore","countryCodes":"SG,MY,ID,TH,VN,PH,IN,BD,PK","ipAddress":"","port":2775,"isActive":false}]')
ON CONFLICT ("key") DO NOTHING;
