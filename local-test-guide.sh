#!/bin/bash

# 🚀 本地完整测试指南
# 用法: bash local-test-guide.sh

set -e

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                      Next.js 个人网站 - 本地测试                        ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤计数
STEP=1

print_step() {
    echo -e "${BLUE}[步骤 $STEP]${NC} $1"
    ((STEP++))
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# ============================================================================
# 第一步：检查环境
# ============================================================================

print_step "检查本地环境"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js 未安装"
    echo "请访问 https://nodejs.org 安装 LTS 版本"
    exit 1
fi
print_success "Node.js: $(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    print_error "npm 未安装"
    exit 1
fi
print_success "npm: $(npm -v)"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    print_warning ".env 文件不存在，复制 .env.example..."
    cp .env.example .env
    print_success ".env 已创建"
fi

# 检查环境变量
echo ""
echo "当前环境变量:"
grep -E "^[A-Z_]+=" .env | head -5
echo ""

# ============================================================================
# 第二步：安装依赖
# ============================================================================

print_step "安装项目依赖"
echo ""

if [ ! -d "node_modules" ]; then
    echo "运行: npm install"
    npm install
    print_success "依赖安装完成"
else
    print_success "依赖已存在"
fi

echo ""

# ============================================================================
# 第三步：构建项目
# ============================================================================

print_step "构建 Next.js 项目"
echo ""

echo "运行: npm run build"
PAYLOAD_SECRET="test-secret-key-for-local-testing-only" npm run build

if [ $? -eq 0 ]; then
    print_success "项目构建成功"
else
    print_error "项目构建失败，请检查错误日志"
    exit 1
fi

echo ""

# ============================================================================
# 第四步：启动开发服务
# ============================================================================

print_step "启动本地开发服务"
echo ""

echo "启动命令: npm run dev"
echo ""
echo -e "${YELLOW}开发服务将启动在: http://localhost:3000${NC}"
echo -e "${YELLOW}或自动切换到: http://localhost:3001${NC}"
echo ""
echo "让服务运行 5 秒钟后进行测试..."
echo ""

# 后台启动服务
npm run dev > /tmp/next-dev.log 2>&1 &
DEV_PID=$!

# 等待服务启动
sleep 6

# 检查服务是否运行
if ! ps -p $DEV_PID > /dev/null; then
    print_error "开发服务启动失败"
    cat /tmp/next-dev.log
    exit 1
fi

print_success "开发服务已启动 (PID: $DEV_PID)"

# 确定实际端口
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    PORT=3000
    print_success "服务运行在 http://localhost:3000"
elif curl -s http://localhost:3001 > /dev/null 2>&1; then
    PORT=3001
    print_success "服务运行在 http://localhost:3001"
else
    print_error "无法连接到开发服务"
    kill $DEV_PID
    exit 1
fi

echo ""

# ============================================================================
# 第五步：测试首页访问
# ============================================================================

print_step "测试首页访问"
echo ""

if curl -s http://localhost:$PORT | grep -q "DWEngineer"; then
    print_success "首页可正常访问"
else
    print_warning "首页访问异常，但服务在运行"
fi

echo ""

# ============================================================================
# 第六步：初始化数据
# ============================================================================

print_step "初始化数据 (/api/seed)"
echo ""

ADMIN_SECRET=$(grep "ADMIN_SECRET_TOKEN" .env | cut -d'=' -f2)

if [ -z "$ADMIN_SECRET" ]; then
    print_warning "ADMIN_SECRET_TOKEN 未设置，跳过数据初始化"
    echo "请在 .env 中设置 ADMIN_SECRET_TOKEN"
else
    echo "运行: curl -H \"Authorization: Bearer \$ADMIN_SECRET\" http://localhost:$PORT/api/seed"
    echo ""

    RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_SECRET" http://localhost:$PORT/api/seed)

    if echo "$RESPONSE" | grep -q "success"; then
        print_success "数据初始化成功"
        echo ""
        echo "初始化结果:"
        echo "$RESPONSE" | grep -o '"results":\[\([^]]*\)\]' | head -1
    else
        print_warning "数据初始化可能失败"
        echo "响应: $RESPONSE"
    fi
fi

echo ""

# ============================================================================
# 第七步：创建/重置管理员账户
# ============================================================================

print_step "创建管理员账户"
echo ""

ADMIN_EMAIL=$(grep "PAYLOAD_INITIAL_ADMIN_EMAIL" .env | cut -d'=' -f2)
ADMIN_PASSWORD=$(grep "PAYLOAD_INITIAL_ADMIN_PASSWORD" .env | cut -d'=' -f2)

echo "管理员邮箱: $ADMIN_EMAIL"
echo "管理员密码: $ADMIN_PASSWORD"
echo ""

if [ -z "$ADMIN_SECRET" ]; then
    print_warning "跳过创建，因为 ADMIN_SECRET_TOKEN 未设置"
else
    echo "运行: curl -H \"Authorization: Bearer \$ADMIN_SECRET\" http://localhost:$PORT/api/create-admin"
    echo ""

    RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_SECRET" http://localhost:$PORT/api/create-admin)

    if echo "$RESPONSE" | grep -q "message"; then
        print_success "管理员账户已创建/重置"
    else
        print_warning "管理员账户创建可能失败"
    fi
fi

echo ""

# ============================================================================
# 第八步：打开管理后台
# ============================================================================

print_step "访问管理后台"
echo ""

echo -e "${YELLOW}在浏览器中访问以下 URL:${NC}"
echo ""
echo "   http://localhost:$PORT/admin"
echo ""
echo "登录凭证:"
echo "   邮箱: $ADMIN_EMAIL"
echo "   密码: $ADMIN_PASSWORD"
echo ""

# ============================================================================
# 第九步：测试检查清单
# ============================================================================

print_step "本地测试检查清单"
echo ""

echo -e "${YELLOW}请在浏览器中逐一完成以下测试:${NC}"
echo ""
echo "首页测试:"
echo "  □ 访问 http://localhost:$PORT"
echo "  □ 页面正常加载"
echo "  □ 导航栏可以点击"
echo ""
echo "关于页面:"
echo "  □ 访问 http://localhost:$PORT/about"
echo "  □ 内容正常显示"
echo ""
echo "项目页面:"
echo "  □ 访问 http://localhost:$PORT/projects"
echo "  □ 项目列表显示"
echo ""
echo "博客页面:"
echo "  □ 访问 http://localhost:$PORT/blog"
echo "  □ 博客列表显示"
echo ""
echo "管理后台:"
echo "  □ 访问 http://localhost:$PORT/admin"
echo "  □ 用上面的凭证登录"
echo "  □ 可以查看 Posts、Projects、Media 等集合"
echo "  □ 尝试修改一条内容（例如修改项目的 sortOrder）"
echo "  □ 修改后能看到前端更新"
echo ""
echo "API 测试 (可选，使用 curl 或 Postman):"
echo "  □ GET  http://localhost:$PORT/api/posts"
echo "  □ GET  http://localhost:$PORT/api/projects"
echo "  □ GET  http://localhost:$PORT/api/media"
echo ""
echo "媒体上传测试:"
echo "  □ 登录后台"
echo "  □ 进入 Media 集合"
echo "  □ 上传一个图片"
echo "  □ 验证文件被保存"
echo ""

# ============================================================================
# 第十步：总结
# ============================================================================

echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                        测试总结                                        ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ 开发服务已启动"
echo "   PID: $DEV_PID"
echo "   端口: $PORT"
echo "   访问: http://localhost:$PORT"
echo ""
echo "✅ 管理后台可用"
echo "   URL: http://localhost:$PORT/admin"
echo "   邮箱: $ADMIN_EMAIL"
echo ""
echo "下一步:"
echo "1️⃣  在浏览器中完成上面的检查清单"
echo "2️⃣  确认所有功能正常"
echo "3️⃣  修改初始管理员密码（登录后）"
echo "4️⃣  完成测试后，执行: kill $DEV_PID"
echo "5️⃣  回到主流程，准备部署到阿里云"
echo ""
echo "📝 日志文件:"
echo "   /tmp/next-dev.log"
echo ""
echo "⚠️  注意:"
echo "   • 开发服务会持续运行，直到你手动停止"
echo "   • 按 Ctrl+C 可停止服务"
echo "   • 或运行: kill $DEV_PID"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# 等待用户输入
read -p "按 Enter 键打开管理后台链接（或手动在浏览器访问）..."

# 尝试用默认浏览器打开
if command -v open &> /dev/null; then
    open "http://localhost:$PORT/admin"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:$PORT/admin"
elif command -v start &> /dev/null; then
    start "http://localhost:$PORT/admin"
fi

echo ""
echo "服务继续运行中..."
echo "按 Ctrl+C 停止服务"
echo ""

# 持续显示日志
tail -f /tmp/next-dev.log

# 清理
trap "kill $DEV_PID; echo ''; print_success '开发服务已停止'; exit 0" EXIT
