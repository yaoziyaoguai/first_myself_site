#!/bin/bash

# Aliyun ECS Deployment Script
# This script automates the deployment of the Next.js application to Aliyun ECS

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${DOMAIN:-"example.com"}
EMAIL=${EMAIL:-"admin@example.com"}
SSH_KEY=${SSH_KEY:-"$HOME/.ssh/id_rsa"}
REMOTE_USER=${REMOTE_USER:-"root"}
REMOTE_HOST=${REMOTE_HOST:-"your-server-ip"}
APP_DIR="/opt/mysites-app"
BACKUP_DIR="/opt/backups"

# Functions
print_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  print_info "Checking prerequisites..."

  if ! command -v ssh &> /dev/null; then
    print_error "ssh is not installed"
    exit 1
  fi

  if ! command -v scp &> /dev/null; then
    print_error "scp is not installed"
    exit 1
  fi

  if [ ! -f "$SSH_KEY" ]; then
    print_error "SSH key not found at $SSH_KEY"
    exit 1
  fi

  # Check SSH key permissions
  SSH_KEY_PERMS=$(stat -c "%a" "$SSH_KEY" 2>/dev/null || stat -f "%A" "$SSH_KEY" 2>/dev/null)
  if [ "$SSH_KEY_PERMS" != "600" ] && [ "$SSH_KEY_PERMS" != "rw-------" ]; then
    print_warning "SSH key permissions are not secure (current: $SSH_KEY_PERMS). Fixing..."
    chmod 600 "$SSH_KEY"
    print_success "SSH key permissions fixed to 600"
  fi

  print_success "Prerequisites check passed"
}

# Connect to remote server and setup
setup_remote_server() {
  print_info "Setting up remote server at $REMOTE_HOST..."

  ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" bash -s << 'EOF'
    set -e

    echo "Installing Docker and Docker Compose..."
    apt-get update
    apt-get install -y docker.io docker-compose git curl wget

    echo "Adding current user to docker group..."
    usermod -aG docker $(whoami)

    echo "Creating application directory..."
    mkdir -p /opt/mysites-app
    mkdir -p /opt/backups

    echo "Setting up backup cron job..."
    # This will be configured after app deployment

    echo "Remote server setup completed"
EOF

  print_success "Remote server setup completed"
}

# Build Docker image locally
build_docker_image() {
  print_info "Building Docker image..."

  docker build -t mysites-app:latest .
  docker tag mysites-app:latest mysites-app:$(date +%Y%m%d-%H%M%S)

  print_success "Docker image built successfully"
}

# Deploy application
deploy_app() {
  print_info "Deploying application to $REMOTE_HOST..."

  # Create deployment package
  print_info "Creating deployment package..."
  mkdir -p deploy-pkg
  cp docker-compose.yml deploy-pkg/
  cp nginx.conf deploy-pkg/
  cp .env.example deploy-pkg/.env
  cp -r public/media deploy-pkg/ || true

  # Create environment file for remote
  cat > deploy-pkg/.env << EOF
NODE_ENV=production
PAYLOAD_SECRET=${PAYLOAD_SECRET}
ADMIN_SECRET_TOKEN=${ADMIN_SECRET_TOKEN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=https://${DOMAIN}
EOF

  # Transfer files to remote
  print_info "Transferring deployment files..."
  scp -i "$SSH_KEY" -r deploy-pkg/* "$REMOTE_USER@$REMOTE_HOST:$APP_DIR/"

  # Cleanup local deployment package
  rm -rf deploy-pkg

  print_success "Files transferred successfully"
}

# Start application on remote server
start_app() {
  print_info "Starting application on remote server..."

  ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" bash -s << EOF
    set -e
    cd $APP_DIR

    print_info "Pulling latest code..."
    # If using git repository on server
    # git pull origin main

    print_info "Starting Docker containers..."
    docker-compose down || true
    docker-compose up -d

    print_info "Waiting for app to be healthy..."
    sleep 10

    docker-compose ps

    print_success "Application started successfully"
EOF

  print_success "Application is running on remote server"
}

# Setup SSL certificate with Let's Encrypt
setup_ssl() {
  print_info "Setting up SSL certificate for $DOMAIN..."

  ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" bash -s << EOF
    set -e
    cd $APP_DIR

    print_info "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx

    print_info "Creating certificate..."
    certbot certonly --standalone \
      --non-interactive \
      --agree-tos \
      -m $EMAIL \
      -d $DOMAIN \
      -d www.$DOMAIN

    print_info "Setting up certificate renewal..."
    systemctl restart docker

    print_success "SSL certificate setup completed"
EOF

  print_success "SSL certificate installed"
}

# Create backup
create_backup() {
  print_info "Creating backup on remote server..."

  ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" bash -s << EOF
    set -e
    TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_\$TIMESTAMP.tar.gz"

    mkdir -p $BACKUP_DIR

    cd $APP_DIR
    tar -czf \$BACKUP_FILE \
      .payload/ \
      public/media/ \
      .env \
      --exclude=node_modules \
      --exclude=.next \
      2>/dev/null || true

    print_success "Backup created: \$BACKUP_FILE"
    ls -lh $BACKUP_DIR
EOF

  print_success "Backup completed"
}

# Show deployment status
show_status() {
  print_info "Deployment Status"
  print_info "================="

  ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" bash -s << EOF
    set -e
    cd $APP_DIR

    print_info "Docker containers:"
    docker-compose ps

    print_info "Application logs (last 20 lines):"
    docker-compose logs --tail=20 app

    print_info "Nginx logs (last 10 lines):"
    docker-compose logs --tail=10 nginx || true

    print_info "Disk usage:"
    du -sh $APP_DIR
    du -sh $BACKUP_DIR

    print_info "System uptime:"
    uptime
EOF
}

# Rollback to previous version
rollback() {
  print_warning "Rolling back to previous version..."

  ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" bash -s << EOF
    set -e
    cd $APP_DIR

    if [ ! -d ".backup" ]; then
      print_error "No backup found for rollback"
      exit 1
    fi

    print_info "Stopping current containers..."
    docker-compose down

    print_info "Restoring from backup..."
    tar -xzf .backup/latest.tar.gz

    print_info "Starting containers..."
    docker-compose up -d

    print_success "Rollback completed"
EOF

  print_success "Rollback completed successfully"
}

# Main deployment flow
main() {
  print_info "Starting Aliyun ECS Deployment"
  print_info "=============================="
  print_info "Domain: $DOMAIN"
  print_info "Remote Host: $REMOTE_HOST"
  print_info "Remote User: $REMOTE_USER"
  print_info ""

  # Validate environment variables
  if [ -z "$PAYLOAD_SECRET" ] || [ -z "$ADMIN_SECRET_TOKEN" ] || [ -z "$NEXTAUTH_SECRET" ]; then
    print_error "Missing required environment variables:"
    print_error "  - PAYLOAD_SECRET"
    print_error "  - ADMIN_SECRET_TOKEN"
    print_error "  - NEXTAUTH_SECRET"
    exit 1
  fi

  case "${1:-deploy}" in
    check)
      check_prerequisites
      ;;
    setup)
      check_prerequisites
      setup_remote_server
      ;;
    build)
      build_docker_image
      ;;
    deploy)
      check_prerequisites
      build_docker_image
      deploy_app
      start_app
      ;;
    ssl)
      setup_ssl
      ;;
    backup)
      create_backup
      ;;
    status)
      show_status
      ;;
    rollback)
      rollback
      ;;
    full-deploy)
      check_prerequisites
      setup_remote_server
      build_docker_image
      deploy_app
      start_app
      setup_ssl
      create_backup
      show_status
      ;;
    *)
      print_error "Unknown command: $1"
      echo ""
      echo "Usage: $0 {check|setup|build|deploy|ssl|backup|status|rollback|full-deploy}"
      echo ""
      echo "Commands:"
      echo "  check       - Check prerequisites"
      echo "  setup       - Setup remote server (one-time)"
      echo "  build       - Build Docker image locally"
      echo "  deploy      - Deploy application to remote server"
      echo "  ssl         - Setup SSL certificate"
      echo "  backup      - Create backup on remote server"
      echo "  status      - Show deployment status"
      echo "  rollback    - Rollback to previous version"
      echo "  full-deploy - Complete deployment workflow (setup + build + deploy + ssl + backup)"
      echo ""
      echo "Environment variables required:"
      echo "  PAYLOAD_SECRET      - Payload CMS secret key"
      echo "  ADMIN_SECRET_TOKEN  - Admin creation token"
      echo "  NEXTAUTH_SECRET     - NextAuth.js secret"
      echo "  DOMAIN              - Your domain (default: example.com)"
      echo "  EMAIL               - Certificate email (default: admin@example.com)"
      echo "  REMOTE_HOST         - Server IP or domain"
      echo "  REMOTE_USER         - SSH user (default: root)"
      echo "  SSH_KEY             - SSH key path (default: ~/.ssh/id_rsa)"
      exit 1
      ;;
  esac

  print_success "Deployment completed successfully!"
}

# Run main function with arguments
main "$@"
