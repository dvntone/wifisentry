# Stage 1: Build the frontend
FROM node:18-alpine AS build-frontend
WORKDIR /app/web-app
COPY web-app/package*.json ./
RUN npm install
COPY web-app/ ./
RUN npm run build

# Stage 2: Build the backend and combine
FROM node:18-alpine AS final
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
# Copy the frontend build to the public directory served by Fastify
COPY --from=build-frontend /app/web-app/out ./public

EXPOSE 3000
CMD ["npm", "start"]
