#!/bin/bash

# 🚀 快速启动脚本
# 用法: ./start-dev.sh

set -e

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                    个人网站 - 本地开发服务启动                          ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
  echo "⚠️  .env 文件不存在，复制 .env.example..."
  cp .env.example .env
  echo "✓ 已创建 .env 文件，请检查配置后重新运行"
  exit 1
fi

# 检查必需的环境变量
if [ -z "$PAYLOAD_SECRET" ]; then
  echo "⚠️  警告: PAYLOAD_SECRET 未设置"
  echo "   请在 .env 文件中设置此变量或运行:"
  echo "   export PAYLOAD_SECRET=\$(openssl rand -base64 32)"
  exit 1
fi

echo "✓ 环境变量检查通过"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install
fi

echo "✓ 依赖检查完毕"
echo ""

# 启动开发服务
echo "🚀 启动开发服务..."
echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "服务将启动在: http://localhost:3000 或 http://localhost:3001"
echo ""
echo "首次使用，请在另一个终端运行:"
echo ""
echo "  export ADMIN_SECRET_TOKEN=\"your-admin-secret-token-here\""
echo "  curl -H \"Authorization: Bearer \$ADMIN_SECRET_TOKEN\" \\"
echo "       http://localhost:3001/api/seed"
echo ""
echo "然后访问: http://localhost:3001/admin"
echo "用户名: admin@example.com"
echo "密码: admin123"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

npm run dev
