# ─── Stage 1: deps ──────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy cả package-lock.json để npm ci có thể dùng lockfile
# Layer này chỉ rebuild khi package*.json thay đổi
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# ─── Stage 2: runtime ───────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Chạy với user non-root — best practice bảo mật container
RUN addgroup -S botgroup && adduser -S botuser -G botgroup

# Copy chỉ node_modules đã build từ stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source (bỏ qua những gì trong .dockerignore)
COPY . .

# Railway chạy UTC — dùng TZ env để logs hiển giờ VN
ENV TZ=Asia/Ho_Chi_Minh \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256"

# Expose port cho Railway health check (giá trị mặc định, Railway sẽ override bằng $PORT)
EXPOSE 8080

USER botuser

# Health check: gọi /health endpoint, cho 30s grace period khởi động bot
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/health || exit 1

CMD ["node", "index.js"]
