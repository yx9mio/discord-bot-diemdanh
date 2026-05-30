FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
RUN mkdir -p data
CMD ["node", "dist/index.js"]
