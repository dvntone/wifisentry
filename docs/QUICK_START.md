# WiFi Sentry - Quick Start Guide

## 30-Second Setup

### 1. Prerequisites
- Node.js 18+
- Terminal/PowerShell
- WiFi adapter (for real scanning)

### 2. Install & Run

**Backend:**
```bash
npm install
npm start
```
Backend runs on http://localhost:3000

**Frontend (new terminal):**
```bash
cd web-app
npm run dev
```

### 3. Access Application
Open http://localhost:3000 in your browser

---

## Basic Usage

### First Time Setup

1. **Optionally set Google Gemini API key** (for AI threat analysis):
   - Create `.env` file
   - Add: `GOOGLE_GEMINI_API_KEY=your-key-here`
   - Restart server

2. **Choose detection techniques**:
   - ☑️ Karma Attacks
   - ☑️ Evil Twins
   - ☑️ WiFi Pineapple

3. **Click "Start Monitoring"**
   - App scans for WiFi networks
   - Detects threats based on selected techniques
   - Displays findings in real-time

### Enable Location Tracking (Optional)

1. Toggle "Location Tracking" ✓
2. Grant browser geolocation permission
3. Networks are now mapped by location
4. Can export to WiGLE.net

### Submit New Threat Discovery

1. Describe a potential WiFi threat
2. Click "Submit for Research"
3. Gemini AI analyzes (2-5 seconds)
4. Results visible to all users

---

## API Quick Reference

### Start Scan
```bash
curl -X POST http://localhost:3000/api/start-monitoring \
  -H "Content-Type: application/json" \
  -d '{"techniques": ["karma", "evil-twin", "pineapple"]}'
```

### Get Threats
```bash
curl http://localhost:3000/api/cataloged-threats
```

### Submit Threat
```bash
curl -X POST http://localhost:3000/api/submit-technique \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Attack Type",
    "description": "Description of the attack..."
  }'
```

### Check Health
```bash
curl http://localhost:3000/api/health
```

---

## Common Issues

**Port 3000 in use?**
```bash
PORT=3001 npm start
```

**No WiFi networks detected?**
- Run as administrator (Windows) or sudo (Mac/Linux)
- Check WiFi adapter is enabled
- Try mock data for testing

**Gemini API errors?**
- Verify API key in `.env`
- Check Google Cloud Console for quota

**Module not found?**
```bash
rm -rf node_modules
npm install
```

---

## Feature Overview

✅ **Real-time WiFi Scanning**
- Detect 50+ networks simultaneously
- Signal strength monitoring
- Security type classification

✅ **Threat Detection**
- Karma attack identification
- Evil twin recognition
- WiFi Pineapple detection
- Custom threat patterns

✅ **AI-Powered Research**
- Google Gemini integration
- Automatic threat analysis
- Severity classification
- Detection method generation

✅ **Location Mapping**
- GPS-based network tracking
- Proximity detection
- Geofencing alerts
- User-consent based

✅ **Data Export**
- WiGLE.net compatibility
- CSV/JSON formats
- Historical tracking
- Custom date ranges

✅ **Threat Catalog**
- Community-maintained threat database
- Crowdsourced detections
- Emerging threat research
- Instant updates

---

## Next Steps

After basic setup:

1. **Configure Firebase** (optional for persistence):
   - Edit `.env` with Firebase credentials
   - Threats/submissions saved to cloud

2. **Set up location tracking**:
   - Add `GOOGLE_MAPS_API_KEY`
   - Enable map visualization

3. **Configure WiGLE.net export**:
   - Get API credentials from WiGLE.net
   - Add to `.env`
   - Export scans to wardriving database

4. **Deploy to production**:
   - Set `NODE_ENV=production`
   - Configure proper CORS origins
   - Set up SSL/HTTPS

---

## Documentation

- Full setup: [INSTALLATION.md](./INSTALLATION.md)
- API reference: [API.md](./API.md) (coming soon)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md) (coming soon)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md) (coming soon)

---

## Getting Help

1. Check [INSTALLATION.md](./INSTALLATION.md) Troubleshooting section
2. Review [README.md](./README.md) for feature details
3. Check GitHub Issues
4. Review API logs: Check terminal output
5. Enable debug mode: `DEBUG=true npm start`

---

## Key Files Modified/Created

### Backend
- ✅ `server.js` - Enhanced with comprehensive API
- ✅ `config.js` - Enhanced configuration
- ✅ `database.js` - Firebase integration
- ✅ `aiService.js` - Gemini API integration
- ✅ `wifi-scanner.js` - Enhanced threat detection
- ✅ `location-tracker.js` - Geolocation & mapping

### Frontend
- ✅ `web-app/src/app/page.tsx` - Complete dashboard UI

### Documentation
- ✅ `INSTALLATION.md` - Full setup guide
- ✅ `.env.example` - Configuration template
- ✅ `QUICK_START.md` - This file

---

**Ready to monitor? Run `npm start` in your terminal!** 🛡️
