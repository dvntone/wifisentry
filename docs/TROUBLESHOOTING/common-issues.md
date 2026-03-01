# Troubleshooting: Common Issues

This guide provides solutions for common issues encountered when setting up or running WiFi Sentry.

## 🗄️ Database Issues

### Issue: "Failed to connect to MongoDB"
- **Symptom**: The application fails to start and logs a database connection error.
- **Possible Causes**:
  - MongoDB is not running.
  - The `MONGO_URI` in your `.env` file is incorrect.
  - Network connectivity issues (for cloud databases).
- **Solutions**:
  - Ensure MongoDB is running locally: `sudo systemctl status mongod`.
  - Check your `.env` file and verify the `MONGO_URI`.
  - If using MongoDB Atlas, ensure your IP address is whitelisted in the Atlas console.

## 📦 Dependency Issues

### Issue: "Node.js 18+ required"
- **Symptom**: The `npm run setup` command fails with a version mismatch error.
- **Possible Causes**:
  - You are running an older version of Node.js.
- **Solutions**:
  - Update Node.js to the latest LTS version (18 or higher) from [nodejs.org](https://nodejs.org/).
  - Use `nvm` (Node Version Manager) to switch versions: `nvm install 18 && nvm use 18`.

### Issue: "airmon-ng: command not found"
- **Symptom**: Advanced monitoring features fail to start on Linux or WSL2.
- **Possible Causes**:
  - The `aircrack-ng` suite is not installed.
- **Solutions**:
  - Install the necessary tools: `sudo apt-get update && sudo apt-get install aircrack-ng tcpdump`.

## 🌐 Network and Port Issues

### Issue: "Address already in use (EADDRINUSE: 3000)"
- **Symptom**: The server fails to start because port 3000 is occupied.
- **Possible Causes**:
  - Another instance of WiFi Sentry is already running.
  - Another application is using port 3000.
- **Solutions**:
  - Stop any existing WiFi Sentry processes.
  - Change the `PORT` in your `.env` file (e.g., `PORT=4000`).

### Issue: "SSE stream connection closed"
- **Symptom**: Real-time scan results are not appearing in the dashboard.
- **Possible Causes**:
  - Browser extensions blocking the SSE stream.
  - A reverse proxy (like Nginx) timeout.
- **Solutions**:
  - Disable browser extensions like ad-blockers for the WiFi Sentry URL.
  - Configure your reverse proxy to handle long-lived connections (see [Nginx config in Deployment Guide](../DEPLOYMENT/docker-compose.md)).

## 🔐 Permission Issues

### Issue: "Permission denied (EACCES)"
- **Symptom**: The application fails to write to files or access system resources.
- **Possible Causes**:
  - Insufficient user permissions.
- **Solutions**:
  - Run the application with appropriate permissions (e.g., `sudo` for monitor mode on Linux).
  - Check file permissions in the project directory: `chmod -R 755 .`.

## 📱 Android Specific Issues

### Issue: "WiFi scanning not returning results"
- **Symptom**: The Android app shows zero networks even when WiFi is on.
- **Possible Causes**:
  - Location services are disabled.
  - Location permission was not granted.
- **Solutions**:
  - Ensure **Location** is turned ON in the Android system settings.
  - Go to **App Info -> Permissions** and ensure **Location** permission is granted to WiFi Sentry.
