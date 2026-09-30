# ============================================
# Payload CMS + Next.js 应用镜像
#
# 用途: 生产部署和容器化测试
# 说明: 采用多阶段构建
#       - 构建阶段保留完整依赖
#       - 运行阶段仅保留 production dependencies
#       - 丢弃 Next.js 构建缓存并裁掉仅用于开发的依赖
#
# 使用方式: 配合 docker-compose.test.yml 使用
# ============================================

# -------------------------------------------------
# 阶段 1: 依赖安装
# -------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# GitHub Runner 默认使用官方源；阿里云构建显式传入国内镜像，避免跨境超时。
ARG ALPINE_MIRROR=https://dl-cdn.alpinelinux.org/alpine
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN if [ "$ALPINE_MIRROR" != "https://dl-cdn.alpinelinux.org/alpine" ]; then \
      sed -i "s#https://dl-cdn.alpinelinux.org/alpine#$ALPINE_MIRROR#g" /etc/apk/repositories; \
    fi && \
    apk add --no-cache libc6-compat
# 仓库使用 npm 锁文件，构建必须与 CI 安装同一依赖图。
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci \
      --registry="$NPM_REGISTRY" \
      --replace-registry-host=always \
      --prefer-offline \
      --no-audit \
      --no-fund

# npm prune 会移除项目仅用于 CI/本地开发的依赖；Payload 所需的 peer 依赖仍由 npm 保留。
FROM deps AS production-deps
RUN npm prune \
      --omit=dev \
      --registry="$NPM_REGISTRY" \
      --replace-registry-host=always \
      --prefer-offline \
      --no-audit \
      --no-fund && \
    npm cache clean --force

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

# 构建阶段只需通过配置校验；占位值仅存在于此命令，不写入镜像环境。
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    PAYLOAD_SECRET=build-only-placeholder-not-used-at-runtime \
    NODE_ENV=production \
    npm run build && \
    rm -rf .next/cache

# -------------------------------------------------
# 阶段 3: 运行环境
# -------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

ARG APP_REVISION=unknown
LABEL org.opencontainers.image.revision=$APP_REVISION

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 仅复制生产依赖；migration 与 Agent canary 所需工具均属于 dependencies。
COPY --from=production-deps /app/node_modules ./node_modules

# 复制构建输出
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# 只读 canary 与切换前的 Payload migration 都从 candidate runtime image 执行。
# 源码只存在于服务端文件系统，不复制到 public 或客户端静态资源。
COPY --from=builder /app/scripts/blog-agent-canary.ts ./scripts/blog-agent-canary.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/payload.config.ts ./payload.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 创建上传目录
RUN mkdir -p /app/media && chown -R nextjs:nodejs /app/media

USER nextjs

EXPOSE 3001

CMD ["npm", "start"]
