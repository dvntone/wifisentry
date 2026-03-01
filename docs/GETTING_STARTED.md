# Getting Started with WiFi Sentry

Welcome! WiFi Sentry detects WiFi threats in real-time with AI-powered analysis.

## ⏱️ Quick Start (5 minutes)

### 1. One-Command Setup

```bash
npm run setup
```

This will:
- Install all dependencies
- Create configuration files
- Check prerequisites

### 2. Configure (2 minutes)

Edit `.env` file:
```bash
nano .env
# or use your favorite editor
```

**Minimum required:**
- `ADMIN_PASSWORD` - Change from default

**Recommended:**
- `GOOGLE_GEMINI_API_KEY` - For AI threat analysis

### 3. Start

```bash
npm run dev:all
```

Opens automatically at: **http://localhost:3000**

### 4. Login

- Username: `admin`
- Password: (whatever you set in .env)

Done! You're running WiFi Sentry.

---

## 📚 Choose Your Setup Path

- **Developer**: See [Development Setup](./SETUP/development.md)
- **Production**: See [Production Setup](./SETUP/production.md)
- **Docker**: See [Docker Setup](./SETUP/docker.md)
- **Windows**: See [Windows WSL2 Setup](./SETUP/windows-wsl2.md)
- **Android**: See [Android Setup](./SETUP/android.md)

---

## 🐛 Something Not Working?

See [Troubleshooting](./TROUBLESHOOTING/common-issues.md)

## 📖 Full Documentation

- [API Reference](./API/rest-api.md)
- [Component Guide](./COMPONENTS/)
- [Deployment Guide](./DEPLOYMENT/)
