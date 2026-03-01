# Production Deployment Guide

This guide provides instructions for deploying WiFi Sentry to a production environment.

## ⚠️ Critical Security Warning

In production, you **MUST** set the following environment variables. The application will fail to start if they are missing or if the default development values are used.

- `SESSION_SECRET`: A long, random string used to encrypt session cookies.
- `MONGO_URI`: A secure connection string to your production MongoDB instance.
- `ADMIN_PASSWORD`: A strong password for the admin account.
- `NODE_ENV`: Set this to `production`.

## 📦 Deployment Steps

### 1. Prepare the Server

Ensure your server meets the [Prerequisites](./development.md#prerequisites) and has Node.js 18+ installed.

### 2. Clone and Setup

```bash
git clone https://github.com/your-repo/wifi-sentry.git
cd wifi-sentry
npm run setup:prod
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory and add the following:

```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-long-random-secret-here
MONGO_URI=mongodb://your-db-user:your-db-password@your-db-host:27017/wifi-sentry
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-admin-password
CORS_ORIGINS=https://your-domain.com
```

### 4. Build the Application

Build both the frontend and backend for production:

```bash
npm run build
```

This will:
- Build the Next.js frontend (`web-app/`).
- Prepare the static assets.

### 5. Start the Server

We recommend using a process manager like [PM2](https://pm2.keymetrics.io/) to keep the application running.

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server.js --name wifi-sentry
```

## 🔒 Security Best Practices

### Reverse Proxy (Nginx)

It is highly recommended to use Nginx or another reverse proxy in front of your Fastify server. This allows you to:
- Terminate SSL/TLS.
- Handle static file serving more efficiently.
- Implement rate limiting at the network level.

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL/TLS

Always use HTTPS in production. You can obtain free SSL certificates from [Let's Encrypt](https://letsencrypt.org/).

### Database Security

- Ensure your MongoDB instance is not publicly accessible.
- Use strong, unique passwords for database users.
- Enable authentication and authorization.

## 📈 Monitoring

- Use PM2's built-in monitoring: `pm2 monit`.
- Check application logs: `pm2 logs wifi-sentry`.
- Implement external monitoring (e.g., UptimeRobot, Datadog) to alert you if the application goes down.
