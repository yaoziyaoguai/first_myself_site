#!/bin/bash

# Health check and monitoring script for Aliyun ECS
# This script checks the health of the application and system resources

APP_URL="${1:-https://yourdomain.com}"
APP_DIR="/opt/mysites-app"
DOMAIN="${APP_URL#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%%/*}"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=80
ALERT_THRESHOLD_DISK=85

print_header() {
  echo ""
  echo "================================"
  echo "$1"
  echo "================================"
}

# Check application health
print_header "Application Health Check"
if curl -s -f -m 5 "$APP_URL" > /dev/null; then
  echo "✓ Application is responding"
else
  echo "✗ Application is NOT responding"
  echo "  Status code: $(curl -s -o /dev/null -w '%{http_code}' -m 5 "$APP_URL")"
fi

# Check Docker containers
print_header "Docker Container Status"
cd "$APP_DIR" 2>/dev/null
if docker-compose ps 2>/dev/null | grep -q "Up"; then
  echo "✓ Docker containers are running"
  docker-compose ps
else
  echo "✗ Some Docker containers are NOT running"
  docker-compose ps
fi

# Check system resources
print_header "System Resources"

# CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
echo "CPU Usage: ${CPU_USAGE}%"
if (( $(echo "$CPU_USAGE > $ALERT_THRESHOLD_CPU" | bc -l) )); then
  echo "⚠ WARNING: CPU usage is high"
fi

# Memory usage
MEMORY_INFO=$(free | grep Mem)
TOTAL_MEM=$(echo $MEMORY_INFO | awk '{print $2}')
USED_MEM=$(echo $MEMORY_INFO | awk '{print $3}')
MEMORY_USAGE=$(echo "scale=1; ($USED_MEM / $TOTAL_MEM) * 100" | bc)
echo "Memory Usage: ${MEMORY_USAGE}% ($USED_MEM MB / $TOTAL_MEM MB)"
if (( $(echo "$MEMORY_USAGE > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
  echo "⚠ WARNING: Memory usage is high"
fi

# Disk usage
DISK_INFO=$(df /opt/mysites-app | tail -1)
DISK_USAGE=$(echo $DISK_INFO | awk '{print $5}' | sed 's/%//')
DISK_FREE=$(echo $DISK_INFO | awk '{print $4}')
echo "Disk Usage: ${DISK_USAGE}% (${DISK_FREE} available)"
if (( $(echo "$DISK_USAGE > $ALERT_THRESHOLD_DISK" | bc -l) )); then
  echo "⚠ WARNING: Disk usage is high"
fi

# Check network connectivity
print_header "Network Connectivity"
if ping -c 1 -W 2 8.8.8.8 > /dev/null 2>&1; then
  echo "✓ Internet connectivity is OK"
else
  echo "✗ Internet connectivity is DOWN"
fi

# Check SSL certificate
print_header "SSL Certificate Status"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ -f "$CERT_PATH" ]; then
  CERT_EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
  DAYS_LEFT=$(( ( $(date -d "$CERT_EXPIRY" +%s) - $(date +%s) ) / 86400 ))
  echo "✓ SSL Certificate found"
  echo "  Expiry: $CERT_EXPIRY"
  echo "  Days left: $DAYS_LEFT days"
  if [ $DAYS_LEFT -lt 7 ]; then
    echo "⚠ WARNING: Certificate expires in less than 7 days"
  fi
else
  echo "✗ SSL Certificate not found at $CERT_PATH"
fi

# Check application logs for errors
print_header "Recent Application Errors"
cd "$APP_DIR" 2>/dev/null
ERROR_COUNT=$(docker-compose logs --tail=100 app 2>/dev/null | grep -i "error" | wc -l)
if [ $ERROR_COUNT -gt 0 ]; then
  echo "⚠ Found $ERROR_COUNT errors in last 100 logs"
  docker-compose logs --tail=20 app 2>/dev/null | grep -i "error"
else
  echo "✓ No recent errors found"
fi

print_header "Health Check Complete"
echo "Last check: $(date)"
