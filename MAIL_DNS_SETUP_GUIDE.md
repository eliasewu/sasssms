# 📧 Net2APP Mail Server — Cloudflare + GoDaddy DNS Setup Guide

This guide fixes the **"Failed to send email"** error in webmail and configures all DNS records for proper email delivery.

---

## 🔍 Root Cause of the Sending Error

Your `mail.net2app.com` A record is **proxied through Cloudflare (orange cloud)**. Cloudflare only proxies HTTP/HTTPS traffic (ports 80/443). **SMTP (25/587/465) and IMAP (143/993) ports are NOT proxied** — so when webmail tries to connect to `mail.net2app.com:587`, the connection fails.

### The Fix
Set `mail.net2app.com` to **DNS-only (grey cloud)** in Cloudflare. This exposes the real server IP for mail protocols while keeping your main website proxied.

---

## 📋 Step 1: Cloudflare — Make `mail.net2app.com` DNS-Only

### Option A: Via Cloudflare Dashboard

1. Log in to **[Cloudflare Dashboard](https://dash.cloudflare.com)**
2. Select the **net2app.com** domain
3. Click **DNS** → **Records**
4. Find the **`mail`** A record (you'll see multiple — one per server IP)
5. For **EACH** `mail` A record:
   - Click the **orange cloud** icon ☁️ next to the record
   - It turns **grey** ☁️ (DNS only)
   - This means traffic goes directly to your server, NOT through Cloudflare's proxy
6. Click **Save**

### Option B: Via Cloudflare API (if you prefer CLI)

```bash
# Get your zone ID
curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=net2app.com" \
  -H "Authorization: Bearer YOUR_CF_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.result[0].id'

# Update each mail A record to proxied=false
# Replace ZONE_ID, RECORD_ID, and YOUR_CF_API_TOKEN
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records/RECORD_ID" \
  -H "Authorization: Bearer YOUR_CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"proxied": false}'
```

### ✅ Verify the change
```bash
dig mail.net2app.com +short
# Should return your real server IPs (NOT Cloudflare IPs like 104.x.x.x)
```

---

## 📋 Step 2: Cloudflare — Verify All DNS Records

Go to **DNS → Records** and ensure these records exist:

| Type | Name | Value | Proxy | Priority |
|------|------|-------|-------|----------|
| **MX** | `@` (net2app.com) | `mail.net2app.com` | — | 10 |
| **A** | `mail` | `146.59.47.22` | ☁️ Grey (DNS only) | — |
| **A** | `mail` | `54.37.252.5` | ☁️ Grey (DNS only) | — |
| **A** | `mail` | `145.239.1.7` | ☁️ Grey (DNS only) | — |
| **A** | `mail` | `149.56.22.232` | ☁️ Grey (DNS only) | — |
| **A** | `mail` | `15.235.35.125` | ☁️ Grey (DNS only) | — |
| **A** | `@` | `146.59.47.22` | 🟧 Orange (Proxied) | — |
| **A** | `@` | `54.37.252.5` | 🟧 Orange (Proxied) | — |
| *(etc)* | | | | |
| **CNAME** | `www` | `net2app.com` | 🟧 Orange (Proxied) | — |
| **TXT** | `@` | `v=spf1 mx a ~all` | — | — |
| **TXT** | `default._domainkey` | *(DKIM key from server)* | — | — |
| **TXT** | `_dmarc` | `v=DMARC1; p=none; rua=mailto:admin@net2app.com` | — | — |

### Key Points:
- **`mail` records = GREY cloud** (DNS only) ← This is the fix!
- **`@` and `www` records = ORANGE cloud** (Proxied) ← Keep these proxied for web traffic
- **MX record** points to `mail.net2app.com` (which now resolves to your real server)

---

## 📋 Step 3: GoDaddy — Domain Nameserver Check

Your domain `net2app.com` is registered at GoDaddy. Verify the nameservers point to Cloudflare:

1. Log in to **[GoDaddy](https://dcc.godaddy.com)**
2. Go to **My Products** → find **net2app.com** → click **DNS**
3. Scroll to **Nameservers** → click **Manage**
4. Ensure nameservers are set to **Custom**:
   - `dayana.ns.cloudflare.com`
   - `mack.ns.cloudflare.com`
5. If they show GoDaddy's default nameservers, change them to Cloudflare's

> ⏱️ Nameserver changes can take up to 24–48 hours to propagate (usually 1–2 hours).

### If You Need to Add Records in GoDaddy Instead
If your nameservers are still at GoDaddy (not Cloudflare), add these in GoDaddy's DNS manager:

1. Go to **DNS Management** for net2app.com
2. **Add Record**:
   - Type: `MX`
   - Name: `@`
   - Value: `mail.net2app.com`
   - Priority: `10`
   - TTL: `1 Hour`
3. **Add Record**:
   - Type: `A`
   - Name: `mail`
   - Value: *(your server IP, e.g., `146.59.47.22`)*
   - TTL: `1 Hour`
4. **Add Record**:
   - Type: `TXT`
   - Name: `@`
   - Value: `v=spf1 mx a ~all`
   - TTL: `1 Hour`

---

## 📋 Step 4: Server — Apply Mail Server Fix

SSH into your server and run the updated setup script:

```bash
# SSH to your server
ssh root@146.59.47.22

# Apply the updated mail server configuration
cd /opt/net2app
bash setup-mail-server.sh

# Restart mail services
systemctl restart postfix dovecot opendkim
systemctl enable postfix dovecot opendkim

# Verify services are running
systemctl status postfix dovecot opendkim
```

### If Dovecot folders are missing (Drafts, Junk, Trash, Archive):

```bash
# The updated Dovecot config auto-creates these folders.
# To force creation for an existing user, connect via IMAP and Dovecot
# will auto-create them on first login.

# Or manually test IMAP login:
telnet 127.0.0.1 143
# Then type:
# a LOGIN welcome@net2app.com YOUR_PASSWORD
# a LIST "" "*"
# a LOGOUT
```

---

## 📋 Step 5: Verify SMTP Sending Works

```bash
# Test SMTP connection on port 587 (submission)
openssl s_client -connect mail.net2app.com:587 -starttls smtp

# Test from the server directly
swaks --to test@gmail.com --from welcome@net2app.com \
  --server 127.0.0.1:587 --auth --auth-user welcome@net2app.com \
  --auth-password YOUR_PASSWORD -tls

# Check Postfix logs for errors
tail -f /var/log/mail.log
```

### Common errors and fixes:

| Error | Cause | Fix |
|-------|-------|-----|
| `Connection refused` | Postfix not running | `systemctl restart postfix` |
| `Connection timed out` | Cloudflare proxy still on | Set `mail` to grey cloud (Step 1) |
| `535 5.7.8 Error: authentication failed` | Wrong password | Reset password via super admin API |
| `554 5.7.1 Relay access denied` | SASL auth not working | Check Dovecot auth socket |
| `450 4.7.1 Greylisted` | Greylisting delay | Wait 5 min and retry |
| `sender login mismatch` | sender_login_maps wrong | Use `pgsql-virtual-aliases.cf` (fixed in script) |

---

## 📋 Step 6: Update .env File

Ensure these environment variables are set in `/opt/net2app/.env`:

```env
# Webmail IMAP connection (local Dovecot)
WEBMAIL_IMAP_HOST=127.0.0.1
WEBMAIL_IMAP_PORT=143

# Webmail SMTP connection (local Postfix)
WEBMAIL_SMTP_HOST=127.0.0.1
WEBMAIL_SMTP_PORT=587

# Encryption key for webmail session tokens (generate a new one)
WEBMAIL_ENCRYPTION_KEY=<run: openssl rand -hex 32>

# System email (for notifications)
SMTP_HOST=127.0.0.1
SMTP_PORT=587
SMTP_USER=noreply@net2app.com
SMTP_PASS=<password>
SUPER_ADMIN_EMAIL=elias.ewu@gmail.com
```

Generate a secure encryption key:
```bash
openssl rand -hex 32
```

---

## 📋 Step 7: Test the Webmail

1. Go to **https://net2app.com/webmail**
2. Log in with your `@net2app.com` email and password
3. You should now see the sidebar with:
   - 📥 **Inbox**
   - 📝 **Drafts**
   - 📤 **Sent**
   - ⚠️ **Junk**
   - 🗑️ **Trash**
   - 📦 **Archive**
4. Click **✏️ Compose**
5. Send a test email to an external address (e.g., your Gmail)
6. The email should send successfully and appear in the **Sent** folder

---

## 📋 Step 8: Email Deliverability (SPF, DKIM, DMARC)

These records are already in your DNS but verify them:

### SPF (Sender Policy Framework)
```
Type: TXT
Name: @
Value: v=spf1 mx a ~all
```
This tells receivers that only your MX server and A records are allowed to send email for net2app.com.

### DKIM (DomainKeys Identified Mail)
Get the key from your server:
```bash
cat /etc/opendkim/keys/net2app.com/default.txt
```
Add as a TXT record:
```
Type: TXT
Name: default._domainkey
Value: v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgk...
```

### DMARC (Domain-based Message Authentication)
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:admin@net2app.com
```
> Start with `p=none` (monitoring mode). Once you verify emails are authenticating correctly, change to `p=quarantine` or `p=reject`.

### Test deliverability:
- Send a test email to **check-auth@verifier.port25.com** — you'll get a report back
- Or use **https://www.mail-tester.com** — send to the address shown and check your score

---

## 📋 Step 9: Optional — SSL/TLS for Mail (Recommended)

Currently Dovecot has `ssl = no` and webmail connects to `127.0.0.1` locally, so this works. But for external email clients (Thunderbird, Outlook, mobile), you need SSL:

```bash
# Get a Let's Encrypt cert for mail.net2app.com
# IMPORTANT: mail.net2app.com must be DNS-only (grey cloud) for this to work
certbot certonly --standalone -d mail.net2app.com --non-interactive --agree-tos -m admin@net2app.com

# Configure Postfix to use the cert
postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/mail.net2app.com/fullchain.pem"
postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/mail.net2app.com/privkey.pem"
postconf -e "smtpd_tls_security_level = may"

# Configure Dovecot to use the cert
# Edit /etc/dovecot/conf.d/10-ssl.conf:
#   ssl = yes
#   ssl_cert = /etc/letsencrypt/live/mail.net2app.com/fullchain.pem
#   ssl_key = /etc/letsencrypt/live/mail.net2app.com/privkey.pem

systemctl restart postfix dovecot
```

> ⚠️ **Cloudflare SSL/TLS setting**: In Cloudflare, go to **SSL/TLS** → set mode to **Full (strict)** for your website. This ensures Cloudflare uses your origin certificate for HTTPS.

---

## ✅ Quick Checklist

- [ ] Cloudflare: `mail.net2app.com` A records set to **grey cloud** (DNS only)
- [ ] Cloudflare: `@` and `www` records stay **orange cloud** (proxied)
- [ ] Cloudflare: MX record → `mail.net2app.com` priority 10
- [ ] Cloudflare: SPF, DKIM, DMARC TXT records present
- [ ] GoDaddy: Nameservers → `dayana.ns.cloudflare.com` / `mack.ns.cloudflare.com`
- [ ] Server: `setup-mail-server.sh` re-run with updated config
- [ ] Server: Postfix + Dovecot + OpenDKIM restarted and running
- [ ] Server: `.env` has `WEBMAIL_ENCRYPTION_KEY` set
- [ ] Webmail: Login works, all 6 folders visible
- [ ] Webmail: Compose → Send → Email arrives at external address
- [ ] Webmail: Sent email appears in Sent folder
- [ ] Webmail: Attachments work (max 10 files, 10MB each)
- [ ] Deliverability: Test at mail-tester.com scores 8+/10

---

## 🆘 Troubleshooting

### "Failed to send email" still appears after all steps:

1. Check Postfix is listening on port 587:
   ```bash
   ss -tlnp | grep 587
   ```

2. Check Dovecot is listening on port 143:
   ```bash
   ss -tlnp | grep 143
   ```

3. Check Postfix logs:
   ```bash
   tail -100 /var/log/mail.log | grep -i error
   ```

4. Test SMTP auth manually:
   ```bash
   # Install swaks if needed
   apt-get install -y swaks
   swaks --to your@gmail.com --from welcome@net2app.com \
     --server 127.0.0.1:587 --auth PLAIN \
     --auth-user welcome@net2app.com --auth-password "YOURPASS" -tls
   ```

5. Check if the email account exists in the database:
   ```bash
   sudo -u postgres psql -d app_db -c \
     "SELECT email, is_active FROM email_accounts WHERE email = 'welcome@net2app.com';"
   ```

6. Verify DNS propagation:
   ```bash
   dig MX net2app.com +short
   dig A mail.net2app.com +short
   # Should NOT return 104.x.x.x (Cloudflare proxy IPs)
   ```
