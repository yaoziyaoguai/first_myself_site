# 本地测试 - 快速指南

## 🎯 5分钟快速开始

### 1️⃣ 启动服务（第一个终端）

```bash
npm run dev
```

等待看到：
```
✓ Ready in 4.3s
Local: http://localhost:3000
```

**如果端口被占用，会自动用 3001**

---

### 2️⃣ 初始化数据（第二个终端）

```bash
# 设置管理员密钥
export ADMIN_SECRET_TOKEN="your-admin-secret-token-here"

# 初始化数据
curl -H "Authorization: Bearer $ADMIN_SECRET_TOKEN" \
     http://localhost:3000/api/seed
```

**或使用 .env 中的值：**

```bash
ADMIN_SECRET_TOKEN=$(grep ADMIN_SECRET_TOKEN .env | cut -d'=' -f2)
curl -H "Authorization: Bearer $ADMIN_SECRET_TOKEN" \
     http://localhost:3000/api/seed
```

---

### 3️⃣ 创建管理员账户

```bash
export ADMIN_SECRET_TOKEN="your-admin-secret-token-here"

curl -H "Authorization: Bearer $ADMIN_SECRET_TOKEN" \
     http://localhost:3000/api/create-admin
```

---

### 4️⃣ 登录后台

在浏览器访问：

```
http://localhost:3000/admin
```

登录凭证（来自 .env）：
- **邮箱**: admin@example.com （PAYLOAD_INITIAL_ADMIN_EMAIL）
- **密码**: admin123 （PAYLOAD_INITIAL_ADMIN_PASSWORD）

---

## ✅ 测试检查清单

### 页面访问

- [ ] 首页：http://localhost:3000 ✓
- [ ] 关于页：http://localhost:3000/about ✓
- [ ] 项目页：http://localhost:3000/projects ✓
- [ ] 博客页：http://localhost:3000/blog ✓
- [ ] 联系页：http://localhost:3000/contact ✓

### 管理后台

- [ ] 登录：http://localhost:3000/admin ✓
- [ ] 查看 Posts 集合 ✓
- [ ] 查看 Projects 集合 ✓
- [ ] 查看 Media 集合 ✓
- [ ] 查看 Users 集合 ✓

### 功能测试

- [ ] 修改一条项目数据，保存后前端是否更新 ✓
- [ ] 上传一个媒体文件到 Media ✓
- [ ] 检查上传的文件是否可访问 ✓
- [ ] 创建一篇博客文章（如果需要） ✓

### API 测试

```bash
# 获取所有项目
curl http://localhost:3000/api/projects | jq

# 获取所有文章
curl http://localhost:3000/api/posts | jq

# 获取所有媒体
curl http://localhost:3000/api/media | jq
```

---

## 🔒 安全功能测试

### 1. 环境变量强制验证

```bash
# 尝试启动但不设置 PAYLOAD_SECRET
PAYLOAD_SECRET="" npm run dev

# 应该看到错误：
# PAYLOAD_SECRET environment variable is required
```

### 2. API 端点保护

```bash
# 不传 token 调用 /api/seed
curl http://localhost:3000/api/seed

# 应该返回 401 Unauthorized
# {"error":"Unauthorized: missing or invalid token"}
```

### 3. 访问控制

```bash
# 未认证用户
curl http://localhost:3000/api/users

# 应该无法获取用户列表（不是公开的）
```

---

## 🐛 常见问题

### Q: 端口 3000 被占用怎么办？

**A:** Next.js 会自动用 3001，或手动指定：

```bash
PORT=3002 npm run dev
```

---

### Q: 如何重置数据库？

**A:** 删除数据库文件，重新初始化：

```bash
# 删除数据库
rm ./.payload/payload.db

# 重新启动服务并初始化
npm run dev
# 然后在另一个终端运行 /api/seed
```

---

### Q: 管理员密码错误怎么办？

**A:** 重新设置：

1. 删除 `.payload/payload.db`
2. 在 `.env` 中修改 `PAYLOAD_INITIAL_ADMIN_PASSWORD`
3. 重启服务并调用 `/api/create-admin`

---

### Q: 如何停止开发服务？

**A:** 按 `Ctrl+C`

---

### Q: 上传的媒体在哪里？

**A:**
```bash
public/media/  # 本地存储路径
.payload/      # 数据库文件
```

---

## 📊 测试完成后

当所有测试都通过后：

1. ✅ **确认功能正常**
   - 所有页面可访问
   - 管理后台可操作
   - API 端点可用
   - 媒体上传正常

2. ✅ **修改初始管理员密码**
   - 登录后台
   - 进入 Users 集合
   - 修改 admin 用户的密码

3. ✅ **准备部署**
   - 生成生产环境密钥
   - 创建 Dockerfile
   - 配置 Nginx
   - 上传到阿里云

---

## 📝 日志查看

**开发服务日志：**
```bash
tail -f /tmp/next-dev.log
```

**Docker 构建时的日志：**
```bash
docker build -t mysites . --no-cache
```

---

## 💡 下一步

当本地测试完成且所有功能正常后，告诉我 ✅

然后我们进行：

1. 🐳 创建 Dockerfile（容器化）
2. 🔧 创建 Nginx 配置（反向代理）
3. 📤 创建部署脚本（自动化）
4. 🚀 一步步部署到阿里云

---
