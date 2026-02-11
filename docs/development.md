# Development Setup Guide

This guide covers setting up WiFi Sentry for local development and contribution.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Git**: For version control
- **MongoDB**: Local installation or Atlas connection string

## Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/dvntone/wifisentry.git
   cd wifisentry
   ```

2. **Run the setup script**
   ```bash
   npm run setup
   ```
   This installs dependencies for both the backend and the frontend (web-app).

3. **Configure Environment**
   The setup script creates a `.env` file. Open it and configure:
   - `MONGO_URI`: Defaults to localhost. Change if using Atlas.
   - `GOOGLE_GEMINI_API_KEY`: Required for AI features.

## Running the App

### Run Everything (Recommended)
Starts backend and frontend concurrently.
```bash
npm run dev:all
```

### Run Backend Only
```bash
npm run dev
```

### Run Frontend Only
```bash
npm run web:dev
```

Access the dashboard at `http://localhost:3000`.