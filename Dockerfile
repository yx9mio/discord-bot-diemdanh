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

USER botuser

CMD ["node", "index.js"]
