# syntax=docker/dockerfile:1

# ============================================
# Payload CMS + Next.js 测试环境 Dockerfile（简化版）
#
# 用途: 本地开发测试、CI 测试、快速验证
# 说明: 这是测试环境简化方案，非生产优化方案
#       - 未使用 Next.js standalone 输出
#       - 未做最小化 node_modules 优化
#       - 优先考虑构建简单性和兼容性
#
# 使用方式: 配合 docker-compose.test.yml 使用
# ============================================

# -------------------------------------------------
# 阶段 1: 依赖安装
# -------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# 安装构建依赖（native 模块编译需要）
RUN apk add --no-cache libc6-compat python3 make g++

# 复制依赖文件
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# 安装依赖（包含 devDependencies，用于构建）
RUN \
  if [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  else npm install; \
  fi

# -------------------------------------------------
# 阶段 2: 构建应用
# -------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# 从 deps 阶段复制完整 node_modules（测试环境简化方案）
COPY --from=deps /app/node_modules ./node_modules

# 复制所有源代码
COPY . .

# Build-time 环境变量
ARG NEXT_PUBLIC_SERVER_URL
ARG DATABASE_URL
ARG PAYLOAD_SECRET
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL

ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
ENV DATABASE_URL=${DATABASE_URL}
ENV PAYLOAD_SECRET=${PAYLOAD_SECRET}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NODE_ENV=production

# 构建应用
RUN npm run build

# -------------------------------------------------
# 阶段 3: 运行环境（测试环境简化版）
# -------------------------------------------------
FROM node:20-alpine AS runner

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

# 创建上传目录
RUN mkdir -p /app/media && chown -R nextjs:nodejs /app/media

USER nextjs

EXPOSE 3001

CMD ["npm", "start"]
