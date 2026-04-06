FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/webhook/server.ts"]
