FROM node:20-slim

WORKDIR /app

# Root dependencies (tsx is needed at runtime to execute TypeScript)
COPY package*.json ./
RUN npm ci

# App dependencies
COPY app/package*.json ./app/
RUN cd app && npm ci --omit=dev

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/
COPY skills/ ./skills/
COPY config/ ./config/
COPY orchestration/ ./orchestration/
COPY app/ ./app/

ENV PORT=8080
EXPOSE 8080

CMD ["npx", "tsx", "app/server/server.ts"]
