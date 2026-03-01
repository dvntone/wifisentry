# WiFi Sentry REST API Reference

This document provides a reference for the WiFi Sentry REST API endpoints.

## 🔐 Authentication

Most endpoints require an authenticated session. Use the login endpoint to establish a session.

### `POST /api/auth/login`
Authenticates a user and starts a session.
- **Body**: `{ "username": "admin", "password": "your-password" }`
- **Response**: `{ "success": true, "message": "Login successful." }` (or `twoFactorRequired: true`)

### `POST /api/auth/logout`
Destroys the current session.
- **Response**: `{ "success": true, "message": "Successfully logged out." }`

### `POST /api/auth/2fa/verify`
Verifies a 2FA token after password login.
- **Body**: `{ "token": "123456" }`
- **Response**: `{ "success": true, "message": "Verification successful." }`

---

## 📡 Scanning & Monitoring

### `GET /api/monitoring-stream`
Server-Sent Events (SSE) stream for real-time scan results.
- **Response**: SSE stream with `type: 'scan-result'` events.

### `POST /api/start-monitoring`
Starts continuous WiFi monitoring.
- **Body**: `{ "techniques": ["karma", "evil-twin"] }`
- **Response**: `{ "message": "Continuous monitoring started." }`

### `POST /api/stop-monitoring`
Stops continuous WiFi monitoring.
- **Response**: `{ "message": "Monitoring stopped." }`

### `GET /api/scan-history`
Retrieves the history of scanned networks.
- **Query Params**: `limit` (default: 50)
- **Response**: Array of network objects.

---

## 🛡️ Threats

### `GET /api/cataloged-threats`
Retrieves a list of AI-cataloged threat techniques.
- **Query Params**: `severity` (optional)
- **Response**: Array of threat objects.

### `GET /api/threat-logs`
**Requires Auth**. Retrieves logs of detected threats.
- **Response**: Array of detected threat events.

### `POST /api/submit-technique`
Submits a new threat technique for AI research.
- **Body**: `{ "name": "...", "description": "..." }`
- **Response**: The researched threat object.

---

## 📍 Locations

### `GET /api/locations`
Retrieves the history of recorded locations.
- **Response**: Array of location objects.

---

## 📦 Dependencies

### `GET /api/dependencies/check`
Checks if required system tools (aircrack-ng, tcpdump, etc.) are installed.
- **Response**: Object showing status of each dependency.

---

## 📤 Export

### `GET /api/export/threats-csv`
Exports cataloged threats as a CSV file.
- **Response**: `text/csv` file download.

### `POST /api/export-wigle`
Formats recent scan data for export to WiGLE.net.
- **Body**: `{ "startDate": "...", "endDate": "..." }`
- **Response**: `{ "csv": "...", "count": ... }`
