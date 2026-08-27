# Step 1: Base Image
FROM node:20-alpine AS base

# Set working directory
WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source code
COPY src/ ./src

# Set environment variable
ENV NODE_ENV=production

# Expose API Port
EXPOSE 5000

# Default command (runs API server; worker overrides CMD in docker-compose.yml)
CMD ["npm", "start"]
