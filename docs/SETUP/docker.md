# Docker Setup Guide

This guide explains how to run WiFi Sentry using Docker and Docker Compose. This is the recommended method for production as it handles all dependencies, including MongoDB, automatically.

## 📋 Prerequisites

- **Docker**: Version 20.0.0 or higher.
- **Docker Compose**: Version 1.29.0 or higher.

## 🚀 Quick Start (Recommended)

The easiest way to get WiFi Sentry up and running is with `docker-compose`.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-repo/wifi-sentry.git
    cd wifi-sentry
    ```

2.  **Configure environment variables**:
    Edit the `docker-compose.yml` file and update the `ADMIN_PASSWORD` and `SESSION_SECRET` values under the `app` service environment.

3.  **Start the application**:
    ```bash
    docker-compose up -d
    ```
    This command will:
    - Build the WiFi Sentry image.
    - Start a MongoDB container.
    - Connect the application to MongoDB.
    - Expose the application on [http://localhost:3000](http://localhost:3000).

## 🛠️ Building the Image Manually

If you only want to build the application image without using Docker Compose:

```bash
docker build -t wifi-sentry .
```

To run the image manually, you will need to provide a connection string to an external MongoDB instance:

```bash
docker run -p 3000:3000 \
  -e MONGO_URI=mongodb://your-db-host:27017/wifi-sentry \
  -e ADMIN_PASSWORD=your-secure-password \
  -e SESSION_SECRET=your-session-secret \
  wifi-sentry
```

## 📋 Configuration Details

### Environment Variables

The following environment variables can be configured in `docker-compose.yml`:

- `PORT`: The port the app runs on inside the container (default: 3000).
- `NODE_ENV`: Set to `production`.
- `MONGO_URI`: The connection string to MongoDB.
- `ADMIN_PASSWORD`: Secure password for the admin account.
- `SESSION_SECRET`: Random string for session encryption.
- `GOOGLE_GEMINI_API_KEY`: (Optional) For AI threat analysis.

### Persistence

The `docker-compose.yml` file is configured with a named volume `mongo-data` to ensure your database data persists across container restarts and updates.

## 📈 Monitoring and Logs

To view the application logs:
```bash
docker-compose logs -f app
```

To see the status of your containers:
```bash
docker-compose ps
```

## 🛑 Stopping the Application

To stop and remove the containers:
```bash
docker-compose down
```
*(Note: Your data will remain safe in the `mongo-data` volume.)*
