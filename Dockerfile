FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/webhook/server.ts"]
