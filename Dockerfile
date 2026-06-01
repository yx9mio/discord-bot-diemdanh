# ─── Stage 1: deps ──────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Chỉ copy manifest trước — tận dụng Docker layer cache
# Layer này chỉ rebuild khi package.json thay đổi
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

# ─── Stage 2: runtime ────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Chạy với user non-root — best practice bảo mật container
RUN addgroup -S botgroup && adduser -S botuser -G botgroup

# Copy chỉ node_modules đã build từ stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source (bỏ qua những gì trong .dockerignore)
COPY . .

# Đặt timezone để logs hiển giờ VN (Railway chạy UTC nên dùng env thay)
ENV TZ=Asia/Ho_Chi_Minh \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256"

USER botuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('./index.js')" 2>/dev/null || exit 1

CMD ["node", "index.js"]
