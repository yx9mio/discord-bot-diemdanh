FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# cache bust: 2026-05-31T14:08
CMD ["node", "index.js"]
