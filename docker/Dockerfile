# ============================================
# Payload CMS + Next.js 应用镜像
#
# 用途: 生产部署和容器化测试
# 说明: 采用简单的多阶段构建
#       - 未使用 Next.js standalone 输出
#       - 未做最小化 node_modules 优化
#       - 优先考虑构建简单性和兼容性
#
# 使用方式: 配合 docker-compose.test.yml 使用
# ============================================

# -------------------------------------------------
# 阶段 1: 依赖安装
# -------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# 安装构建依赖（native 模块编译需要）
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine|https://mirrors.aliyun.com/alpine|g' /etc/apk/repositories \
    && apk add --no-cache libc6-compat python3 make g++
# 仓库使用 npm 锁文件，构建必须与 CI 安装同一依赖图。
COPY package.json package-lock.json ./
RUN npm ci

# -------------------------------------------------
# 阶段 2: 构建应用
# -------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# 从 deps 阶段复制完整 node_modules（测试环境简化方案）
COPY --from=deps /app/node_modules ./node_modules

# 复制所有源代码
COPY . .

# Build-time 环境变量
ARG NEXT_PUBLIC_SERVER_URL

ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
# 构建阶段只需通过配置校验，不能接收或保留生产密钥。
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV PAYLOAD_SECRET=build-only-placeholder-not-used-at-runtime
ENV NODE_ENV=production

# 构建应用
RUN npm run build

# -------------------------------------------------
# 阶段 3: 运行环境
# -------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制完整 node_modules（测试环境简化，非最小化方案）
COPY --from=deps /app/node_modules ./node_modules

# 复制构建输出
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# 只读 Blog Agent canary 在入口关闭时直接加载公开文章并调用模型。
# 这些文件只存在于服务端文件系统，不复制到 public 或客户端静态资源。
COPY --from=builder /app/scripts/blog-agent-canary.ts ./scripts/blog-agent-canary.ts
COPY --from=builder /app/src/lib/blog-agent ./src/lib/blog-agent
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 创建上传目录
RUN mkdir -p /app/media && chown -R nextjs:nodejs /app/media

USER nextjs

EXPOSE 3001

CMD ["npm", "start"]
