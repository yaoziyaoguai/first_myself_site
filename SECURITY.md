# 安全加固 - 第一阶段完成清单

## ✅ 已完成的修改

### 1. 强制 PAYLOAD_SECRET 环境变量
**文件**: `payload.config.ts`
- ✅ 移除默认密钥 `"default-secret-key-change-in-production"`
- ✅ 改为运行时验证，如果未设置会抛出错误
- ✅ 提供生成密钥的命令建议

### 2. 移除硬编码管理员凭证
**文件**: `app/(main)/api/create-admin/route.ts`
- ✅ 移除 `admin@example.com / admin123`
- ✅ 改为从环境变量读取: `PAYLOAD_INITIAL_ADMIN_EMAIL`, `PAYLOAD_INITIAL_ADMIN_PASSWORD`
- ✅ 添加管理员密钥验证 (`ADMIN_SECRET_TOKEN`)
- ✅ 添加 `Authorization` 头验证

**文件**: `app/(main)/api/seed/route.ts`
- ✅ 移除硬编码的管理员账户创建
- ✅ 添加管理员密钥验证 (`ADMIN_SECRET_TOKEN`)
- ✅ 改为提示用户使用 `/api/create-admin` 创建账户

### 3. 创建环境变量模块
**文件**: `lib/env.ts`
- ✅ 创建环境变量验证工具函数
- ✅ 提供必需变量和可选变量的获取方法
- ✅ 便于后续扩展

### 4. 创建环境变量示例
**文件**: `.env.example`
- ✅ 详细注释说明每个环境变量的作用
- ✅ 生产环境配置指南
- ✅ 密钥生成命令

### 5. 验证 .gitignore
**文件**: `.gitignore`
- ✅ 确认已包含 `.env*` 规则
- ✅ SQLite 数据库文件 `.payload/` 也已排除

---

## 🚀 部署到 Vercel 前的关键步骤

### 第一步：生成密钥
在本地终端运行:
```bash
# 生成 PAYLOAD_SECRET（用于 JWT 签名）
openssl rand -base64 32

# 生成 ADMIN_SECRET_TOKEN（用于验证开发端点）
openssl rand -hex 32
```

### 第二步：在 Vercel 配置环境变量

访问: https://vercel.com → 项目 → Settings → Environment Variables

添加以下变量（生产环境）:

| 环境变量 | 值 | 说明 |
|---------|-----|------|
| `PAYLOAD_SECRET` | `openssl rand -base64 32` 的结果 | 必需，用于 JWT 签名 |
| `PAYLOAD_INITIAL_ADMIN_EMAIL` | 你的真实邮箱 | 初始管理员邮箱 |
| `PAYLOAD_INITIAL_ADMIN_PASSWORD` | 强密码 | 初始管理员密码（之后要修改） |
| `NODE_ENV` | `production` | 必需，禁用开发端点 |
| `PAYLOAD_LOG_LEVEL` | `warn` | 不要用 `debug`，避免泄露敏感信息 |
| `NEXT_PUBLIC_SERVER_URL` | 你的部署 URL | 例: `https://yoursite.vercel.app` |

**注意**: 不需要在生产环境设置 `ADMIN_SECRET_TOKEN`（开发端点在生产环境被禁用）

### 第三步：本地测试

确保 `.env.local` 文件已设置所有必需变量:
```bash
PAYLOAD_SECRET=你生成的密钥
ADMIN_SECRET_TOKEN=你生成的 token
PAYLOAD_INITIAL_ADMIN_EMAIL=your-email@example.com
PAYLOAD_INITIAL_ADMIN_PASSWORD=a-strong-password
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
NODE_ENV=development
```

运行本地开发:
```bash
npm run dev

# 初始化数据（需要传递 ADMIN_SECRET_TOKEN）
curl -H "Authorization: Bearer your-admin-secret-token" http://localhost:3000/api/seed

# 创建管理员账户
curl -H "Authorization: Bearer your-admin-secret-token" http://localhost:3000/api/create-admin
```

### 第四步：Vercel 部署后

1. 部署成功后，访问 `https://yoursite.vercel.app`
2. 尝试访问管理后台: `https://yoursite.vercel.app/admin`
3. 使用 `PAYLOAD_INITIAL_ADMIN_EMAIL` 和 `PAYLOAD_INITIAL_ADMIN_PASSWORD` 登录
4. ✅ 登录成功后，立即修改管理员密码

### 第五步：后续维护

1. ✅ 登录后修改初始管理员密码
2. 不要将 `.env` 或 `.env.local` 提交到 Git
3. 定期检查 Vercel 的 Environment Variables 配置
4. 不要在公开场合泄露密钥

---

## 🔒 安全检查清单

部署前验证:

```
□ PAYLOAD_SECRET 已在 Vercel 配置（强随机密钥）
□ PAYLOAD_INITIAL_ADMIN_EMAIL 已设置（使用真实邮箱）
□ PAYLOAD_INITIAL_ADMIN_PASSWORD 已设置（强密码）
□ NODE_ENV=production 已在 Vercel 配置
□ PAYLOAD_LOG_LEVEL=warn 已在 Vercel 配置（不是 debug）
□ ADMIN_SECRET_TOKEN 只在本地设置（生产环境不需要）
□ .env 和 .env.local 已在 .gitignore 中
□ 没有 hardcode 的凭证在代码中
□ 本地测试 /api/seed 和 /api/create-admin 成功
□ 部署后能用新凭证登录 /admin
```

---

## ⚠️ 常见问题

### Q: 忘记了初始管理员密码怎么办？
**A**: 重新部署时修改 Vercel 的 `PAYLOAD_INITIAL_ADMIN_PASSWORD` 环境变量，然后调用 `/api/create-admin` 重置（本地开发环境）。生产环境无法直接调用。

### Q: 本地测试时 /api/seed 返回 401？
**A**: 检查 `ADMIN_SECRET_TOKEN` 是否在 `.env.local` 中设置，并在请求中传递:
```bash
curl -H "Authorization: Bearer your-token-here" http://localhost:3000/api/seed
```

### Q: 生产环境能调用 /api/seed 吗？
**A**: 不能。生产环境设置了 `NODE_ENV=production`，所有开发端点会被禁用并返回 403。

### Q: 怎样查看当前的 PAYLOAD_SECRET？
**A**: 不需要查看。它应该只在应用启动时使用一次。如果需要重新设置，在 Vercel 更新环境变量并重新部署即可。

---

## 📋 下一步工作

第二阶段计划（HIGH 优先级）:
- [ ] 实现访问控制（Users 集合的角色系统）
- [ ] 为公开集合设置读权限
- [ ] 配置 CORS 和 API 安全

第三阶段计划（MEDIUM 优先级）:
- [ ] 配置安全 HTTP 头（CSP、X-Frame-Options）
- [ ] 实现 API 速率限制
- [ ] 改进错误处理（不泄露敏感信息）
