# ─── Stage 1: deps (chỉ production packages) ────────────────────
# bookworm-slim = glibc, khớp với Ubuntu ARM64 VPS.
# @napi-rs/canvas tự tải binary linux-arm64-gnu qua optionalDependencies.
FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# ─── Stage 2: runtime ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# Non-root user — bảo mật container
RUN groupadd -r botgroup && useradd -r -g botgroup -d /app botuser

# Chỉ copy node_modules đã build + source cần thiết
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production \
    TZ=Asia/Ho_Chi_Minh \
    NODE_OPTIONS="--max-old-space-size=256"

EXPOSE 8080

USER botuser

# Health check dùng Node global fetch (không cần cài wget/curl)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
