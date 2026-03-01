# Production Docker Compose Guide

This guide describes an advanced Docker Compose setup suitable for production deployments, including a reverse proxy with Nginx and SSL support.

## 🏗️ Architecture

- **App Service**: The WiFi Sentry Node.js/Fastify application.
- **Mongo Service**: MongoDB database for persistence.
- **Nginx Service**: Reverse proxy for SSL termination and static file serving.

## 📄 Advanced `docker-compose.yml`

```yaml
version: '3.8'

services:
  app:
    build: .
    restart: always
    environment:
      - NODE_ENV=production
      - MONGO_URI=mongodb://mongo:27017/wifi-sentry
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - SESSION_SECRET=${SESSION_SECRET}
    depends_on:
      - mongo

  mongo:
    image: mongo:latest
    restart: always
    volumes:
      - mongo-data:/data/db

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/certs:/etc/nginx/certs
    depends_on:
      - app

volumes:
  mongo-data:
```

## 🛠️ Nginx Configuration

Create a file at `nginx/conf.d/default.conf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔐 Secrets Management

Use an `.env` file to store your secrets:

```env
ADMIN_PASSWORD=your-very-secure-password
SESSION_SECRET=your-very-long-random-session-secret
```

## 🚀 Deployment

1.  **Prepare your SSL certificates** and place them in the `nginx/certs` directory.
2.  **Update `your-domain.com`** in the Nginx configuration.
3.  **Run Docker Compose**:
    ```bash
    docker-compose up -d
    ```

## 🔄 Updates

To update the application to the latest version:

```bash
git pull
docker-compose up -d --build
```

## 📁 Backup

To backup your MongoDB data:

```bash
docker-compose exec mongo mongodump --out /data/db/backup
# Then copy the backup out of the volume
docker cp $(docker-compose ps -q mongo):/data/db/backup ./backup
```
