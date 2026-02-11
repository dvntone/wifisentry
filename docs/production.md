# Production Deployment Guide

This guide covers deploying WiFi Sentry in a production environment.

## Security Requirements

Before deploying, ensure you have configured the following in your `.env` file or environment variables:

1. **NODE_ENV**: Set to `production`.
2. **ADMIN_PASSWORD**: Must be a strong, unique password.
3. **SESSION_SECRET**: Must be a long, random string (e.g., generated via `openssl rand -hex 32`).
4. **HTTPS**: Production deployments should always use HTTPS.

## Build Process

1. **Install Dependencies**
   ```bash
   npm ci
   cd web-app && npm ci && cd ..
   ```

2. **Build All Artifacts**
   ```bash
   npm run build:all
   ```
   This compiles the Next.js frontend and prepares the backend.

## Deployment Options

### Option 1: Node.js Process (PM2)

Use a process manager like PM2 to keep the server running.

```bash
npm install -g pm2
pm2 start server.js --name "wifi-sentry"
pm2 save
```

### Option 2: Docker

*Docker support coming soon.*

## Post-Deployment Verification

1. **Check Health Endpoint**
   ```bash
   curl https://your-domain.com/api/health
   ```

2. **Verify Logs**
   Ensure no errors are appearing in the logs regarding database connections or API keys.

3. **Test 2FA**
   Enable 2FA immediately after logging in as admin.