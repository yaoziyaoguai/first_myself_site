#!/bin/bash

# Backup script for Aliyun ECS
# Run this script regularly to backup your application data

BACKUP_DIR="/opt/backups"
APP_DIR="/opt/mysites-app"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
MAX_BACKUPS=7  # Keep last 7 backups

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup at $(date)"
echo "Backup file: $BACKUP_FILE"

# Create backup
cd "$APP_DIR"
tar -czf "$BACKUP_FILE" \
  .payload/ \
  public/media/ \
  .env \
  docker-compose.yml \
  nginx.conf \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  2>/dev/null

if [ $? -eq 0 ]; then
  echo "✓ Backup completed successfully"
  ls -lh "$BACKUP_FILE"

  # Remove old backups
  echo "Cleaning up old backups..."
  CLEANUP_FAILED=0
  if ! find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f | sort -r | tail -n +$((MAX_BACKUPS+1)) | xargs -r rm -v; then
    CLEANUP_FAILED=1
    echo "⚠ Warning: Some old backups could not be deleted"
  fi

  echo "✓ Cleanup completed"
  if [ $CLEANUP_FAILED -eq 1 ]; then
    echo "⚠ Note: Check disk space if cleanup had issues"
  fi

  echo "Backup summary:"
  du -sh "$BACKUP_DIR"
  echo "Backups kept:"
  ls -1 "$BACKUP_DIR"/backup_*.tar.gz | wc -l
else
  echo "✗ Backup failed"
  exit 1
fi

echo "Backup completed at $(date)"
