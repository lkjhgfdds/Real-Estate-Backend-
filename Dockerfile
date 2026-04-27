# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code
COPY --from=builder /app/src ./src

# Ensure non-root user owns the app directory
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Healthcheck to integrate with Docker / k8s orchestrators
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["npm", "start"]
