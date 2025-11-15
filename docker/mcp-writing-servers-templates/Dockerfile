# Multi-stage build for optimal performance
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Stage 1: Install dependencies (cached layer)
FROM base AS deps

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production \
    --prefer-offline \
    --no-audit \
    --ignore-scripts && \
    npm cache clean --force

# Stage 2: Build stage (if you have TypeScript or build steps)
FROM base AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# If you have a build step, run it here
# RUN npm run build

# Stage 3: Production runtime
FROM base AS runtime

WORKDIR /app

# Copy built application
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose ports for all MCP servers
EXPOSE 3001 3002 3003 3004 3005 3006 3007 3008 3009

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the HTTP/SSE server
CMD ["node", "src/http-sse-server.js"]
