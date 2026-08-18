#!/bin/bash
# Net2APP PM2 Watchdog — checks localhost:5556 every 2 min, restarts if unresponsive
# Installed by deploy.sh and deploy-to-server.sh as a cron job
ENDPOINT="http://localhost:5556/"
TIMEOUT=10
LOGFILE="/var/log/net2app-watchdog.log"

if curl -s -o /dev/null --max-time $TIMEOUT $ENDPOINT 2>/dev/null; then
  exit 0
fi

echo "[$(date)] Server unresponsive — restarting PM2" >> $LOGFILE

# Try restart first, fall back to start if process doesn't exist
if pm2 pid net2app &>/dev/null; then
  pm2 restart net2app >> $LOGFILE 2>&1
else
  cd /home/ubuntu/saas-sms-platform-architecture && pm2 start npm --name net2app -- run start >> $LOGFILE 2>&1
fi

sleep 12
if curl -s -o /dev/null --max-time 5 $ENDPOINT 2>/dev/null; then
  echo "[$(date)] Server back online" >> $LOGFILE
else
  echo "[$(date)] WARNING: Server still unresponsive after restart" >> $LOGFILE
fi
