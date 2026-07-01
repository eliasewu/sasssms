#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Net2APP Mail Server Setup
# Postfix (SMTP) + Dovecot (IMAP/POP3) + PostgreSQL backend
# Domain: net2app.com
# ═══════════════════════════════════════════════════════════
set -e

MAIL_DOMAIN="net2app.com"
MAIL_HOSTNAME="mail.${MAIL_DOMAIN}"
DB_NAME="app_db"
DB_USER="postgres"
DB_PASS="postgres"

echo "═════════════════════════════════════════"
echo "  Net2APP Mail Server Setup"
echo "  Domain: ${MAIL_DOMAIN}"
echo "═════════════════════════════════════════"
echo ""

# ── 1. Install packages ──
echo ">>> Installing Postfix + Dovecot + dependencies..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  postfix postfix-pgsql \
  dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd dovecot-pgsql \
  opendkim opendkim-tools \
  certbot

# ── 2. Configure Postfix ──
echo ">>> Configuring Postfix..."
echo "${MAIL_DOMAIN}" > /etc/mailname
postconf -e "myhostname = ${MAIL_HOSTNAME}"
postconf -e "mydomain = ${MAIL_DOMAIN}"
postconf -e "myorigin = /etc/mailname"
postconf -e "mydestination = localhost"
postconf -e "mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128"
postconf -e "inet_interfaces = all"
postconf -e "inet_protocols = all"

# Virtual mailbox config
postconf -e "virtual_mailbox_domains = pgsql:/etc/postfix/pgsql-virtual-domains.cf"
postconf -e "virtual_mailbox_maps = pgsql:/etc/postfix/pgsql-virtual-mailboxes.cf"
postconf -e "virtual_alias_maps = pgsql:/etc/postfix/pgsql-virtual-aliases.cf"
postconf -e "virtual_transport = lmtp:unix:private/dovecot-lmtp"
postconf -e "virtual_mailbox_base = /var/mail/vhosts"
postconf -e "virtual_minimum_uid = 5000"
postconf -e "virtual_uid_maps = static:5000"
postconf -e "virtual_gid_maps = static:5000"

# Create virtual mail user
id -u vmail &>/dev/null || useradd -u 5000 -d /var/mail/vhosts -m -s /bin/false vmail
mkdir -p /var/mail/vhosts/${MAIL_DOMAIN}
chown -R vmail:vmail /var/mail/vhosts

# ── 3. Create Postfix PostgreSQL lookup files ──
cat > /etc/postfix/pgsql-virtual-domains.cf <<EOF
user = ${DB_USER}
password = ${DB_PASS}
hosts = 127.0.0.1
dbname = ${DB_NAME}
query = SELECT 1 FROM email_accounts WHERE email LIKE '%@' || '$1' AND is_active = true LIMIT 1
EOF

cat > /etc/postfix/pgsql-virtual-mailboxes.cf <<EOF
user = ${DB_USER}
password = ${DB_PASS}
hosts = 127.0.0.1
dbname = ${DB_NAME}
query = SELECT '/var/mail/vhosts/' || split_part(email, '@', 2) || '/' || split_part(email, '@', 1) || '/' FROM email_accounts WHERE email = '%s' AND is_active = true
EOF

cat > /etc/postfix/pgsql-virtual-aliases.cf <<EOF
user = ${DB_USER}
password = ${DB_PASS}
hosts = 127.0.0.1
dbname = ${DB_NAME}
query = SELECT email FROM email_accounts WHERE email = '%s' AND is_active = true
EOF

chmod 640 /etc/postfix/pgsql-*.cf
chown postfix:postfix /etc/postfix/pgsql-*.cf

# ── 4. Configure Dovecot ──
echo ">>> Configuring Dovecot..."
cat > /etc/dovecot/dovecot-sql.conf.ext <<EOF
driver = pgsql
connect = host=127.0.0.1 dbname=${DB_NAME} user=${DB_USER} password=${DB_PASS}
default_pass_scheme = BLF-CRYPT
password_query = SELECT email AS user, password_hash AS password FROM email_accounts WHERE email = '%u' AND is_active = true
user_query = SELECT '/var/mail/vhosts/' || split_part(email, '@', 2) || '/' || split_part(email, '@', 1) AS home, 5000 AS uid, 5000 AS gid, 'maildir:~/Maildir' AS mail, disk_quota_mb * 1024 AS quota_rule FROM email_accounts WHERE email = '%u' AND is_active = true
EOF
chmod 600 /etc/dovecot/dovecot-sql.conf.ext
chown root:root /etc/dovecot/dovecot-sql.conf.ext

# Dovecot main config
cat > /etc/dovecot/dovecot.conf <<EOF
protocols = imap pop3 lmtp
listen = *
mail_location = maildir:~/Maildir
mail_uid = 5000
mail_gid = 5000

passdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}
userdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0666
    user = postfix
    group = postfix
  }
  unix_listener auth-userdb {
    mode = 0600
    user = vmail
  }
}

service imap-login {
  inet_listener imap {
    port = 143
  }
  inet_listener imaps {
    port = 993
    ssl = yes
  }
}
service pop3-login {
  inet_listener pop3 {
    port = 110
  }
  inet_listener pop3s {
    port = 995
    ssl = yes
  }
}

ssl = no

plugin {
  quota = maildir:User quota
  quota_rule = *:storage=1G
}
EOF

# Create Maildir for vmail user
mkdir -p /var/mail/vhosts/${MAIL_DOMAIN}
chown -R vmail:vmail /var/mail/vhosts

# ── 5. Configure SASL auth ──
postconf -e "smtpd_sasl_type = dovecot"
postconf -e "smtpd_sasl_path = private/auth"
postconf -e "smtpd_sasl_auth_enable = yes"
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtp_tls_security_level = may"

# ── 6. Set up SSL with Let's Encrypt (optional, uncomment when DNS is ready) ──
# certbot certonly --standalone -d ${MAIL_HOSTNAME} --non-interactive --agree-tos -m admin@${MAIL_DOMAIN}
# postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/${MAIL_HOSTNAME}/fullchain.pem"
# postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/${MAIL_HOSTNAME}/privkey.pem"

# ── 7. OpenDKIM for email deliverability ──
mkdir -p /etc/opendkim/keys/${MAIL_DOMAIN}
opendkim-genkey -D /etc/opendkim/keys/${MAIL_DOMAIN} -d ${MAIL_DOMAIN} -s default
chown -R opendkim:opendkim /etc/opendkim

cat > /etc/opendkim.conf <<'EOF'
Syslog yes
UMask 002
PidFile /run/opendkim/opendkim.pid
KeyTable /etc/opendkim/KeyTable
SigningTable refile:/etc/opendkim/SigningTable
InternalHosts refile:/etc/opendkim/TrustedHosts
Mode sv
Socket inet:8891@localhost
EOF

echo "default._domainkey.${MAIL_DOMAIN} ${MAIL_DOMAIN}:default:/etc/opendkim/keys/${MAIL_DOMAIN}/default.private" > /etc/opendkim/KeyTable
echo "*@${MAIL_DOMAIN} default._domainkey.${MAIL_DOMAIN}" > /etc/opendkim/SigningTable
echo "127.0.0.1\n::1\nlocalhost" > /etc/opendkim/TrustedHosts

postconf -e "milter_default_action = accept"
postconf -e "milter_protocol = 2"
postconf -e "smtpd_milters = inet:127.0.0.1:8891"
postconf -e "non_smtpd_milters = inet:127.0.0.1:8891"

# ── 8. Enable submission port 587 ──
postconf -M "submission/inet=submission inet n - n - - smtpd" 2>/dev/null || true
postconf -P "submission/inet/syslog_name=postfix/submission" 2>/dev/null || true
postconf -P "submission/inet/smtpd_tls_security_level=may" 2>/dev/null || true
postconf -P "submission/inet/smtpd_sasl_auth_enable=yes" 2>/dev/null || true

# ── 9. Restart services ──
echo ">>> Restarting services..."
systemctl restart postfix dovecot opendkim
systemctl enable postfix dovecot opendkim

echo ""
echo "═════════════════════════════════════════"
echo "  Setup Complete!"
echo "═════════════════════════════════════════"
echo ""
echo "  SMTP: mail.${MAIL_DOMAIN}:587 (STARTTLS)"
echo "  IMAP: mail.${MAIL_DOMAIN}:993 (SSL)"
echo "  POP3: mail.${MAIL_DOMAIN}:995 (SSL)"
echo ""
echo "  Default noreply account:"
echo "  Email: noreply@${MAIL_DOMAIN}"
echo "  Create via: POST /api/super/email-accounts"
echo ""
echo "  ⚠️  Add these DNS records:"
echo "  ---------------------------------------------------"
echo "  MX    @    → mail.${MAIL_DOMAIN}  (priority 10)"
echo "  A     mail → $(curl -s ifconfig.me)"
echo "  TXT   @    → v=spf1 mx a ~all"
echo ""
echo "  DKIM Record (add as TXT):"
echo "  default._domainkey →"
cat /etc/opendkim/keys/${MAIL_DOMAIN}/default.txt 2>/dev/null || echo "  (run script again to generate)"
echo ""
echo "  DMARC (add as TXT):"
echo "  _dmarc → v=DMARC1; p=none; rua=mailto:admin@${MAIL_DOMAIN}"
echo ""
echo "  ⚠️  Env vars to set in .env:"
echo "  SMTP_HOST=mail.${MAIL_DOMAIN}"
echo "  SMTP_PORT=587"
echo "  SMTP_USER=noreply@${MAIL_DOMAIN}"
echo "  SMTP_PASS=<password from email-accounts API>"
echo "  SUPER_ADMIN_EMAIL=elias.ewu@gmail.com"
echo ""
