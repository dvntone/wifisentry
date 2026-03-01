# WiFi Sentry - Complete Setup & Installation Guide

## Project Overview

WiFi Sentry is an advanced WiFi monitoring and security application designed to:
- Detect WiFi Pineapples, Evil Twin networks, and Karma attacks
- Research emerging WiFi threats using Google Gemini AI
- Map and track WiFi network locations (with user consent)
- Export data to WiGLE.net wardriving database
- Allow user submissions of new zero-day threats for AI research

## Prerequisites

### System Requirements
- Node.js 18+ and npm
- Modern web browser with geolocation support (for location features)
- WiFi adapter on device (for actual scanning)
- Administrator/sudo privileges (for WiFi scanning on some systems)

### API Keys Required
1. **Google Gemini API Key** - For AI threat analysis
2. **Google Maps API Key** - For location mapping (optional)
3. **Firebase Admin SDK** - For cloud database (optional)
4. **WiGLE.net API Credentials** - For wardriving export (optional)

## Installation

### 1. Clone Repository
```bash
git clone <repo-url>
cd wifisentry-1
```

### 2. Install Backend Dependencies
```bash
npm install
```

Dependencies installed:
- `express` - Web server
- `firebase-admin` - Cloud database
- `@google/generative-ai` - Gemini API
- `node-wifi` - WiFi scanning
- `dotenv` - Environment variables
- `cors` - Cross-origin support
- `uuid` - ID generation
- `axios` - HTTP client

### 3. Install Frontend Dependencies
```bash
cd web-app
npm install
cd ..
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:

**Essential (for basic functionality):**
```env
NODE_ENV=development
PORT=3000
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
```

**Optional (for advanced features):**
```env
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_PRIVATE_KEY=your-firebase-key
FIREBASE_CLIENT_EMAIL=your-firebase-email
GOOGLE_MAPS_API_KEY=your-maps-key
WIGLE_API_NAME=your-wigle-username
WIGLE_API_TOKEN=your-wigle-token
```

## Running the Application

### Development Mode

**Terminal 1 - Backend Server:**
```bash
npm start
```
Server runs on `http://localhost:3000`

**Terminal 2 - Frontend (Next.js):**
```bash
cd web-app
npm run dev
```
Frontend runs on `http://localhost:3000/` (displays after backend starts)

### Production Build
```bash
npm run build
npm start
```

## API Endpoints

### Monitoring
- `POST /api/start-monitoring` - Start WiFi scan with selected techniques
- `POST /api/stop-monitoring` - Stop monitoring

### Threat Catalog
- `GET /api/cataloged-threats` - Get all known threats
- `GET /api/cataloged-threats/:id` - Get threat details
- `GET /api/cataloged-threats?severity=High` - Filter by severity

### User Submissions
- `POST /api/submit-technique` - Submit new threat for research
- `GET /api/submissions` - View all submissions
- `GET /api/submissions/:id` - Get submission details

### Location Tracking
- `POST /api/location-consent` - Enable/disable location tracking
- `GET /api/location-consent` - Check tracking status
- `POST /api/log-location` - Log WiFi location
- `GET /api/locations` - Get all logged locations
- `GET /api/nearby-networks` - Find networks near coordinates

### Scan History & Export
- `GET /api/scan-history` - View recent scans
- `POST /api/export-wigle` - Export to WiGLE.net format

### System
- `GET /api/health` - Health check

## Setting Up Google Gemini API

### 1. Get Gemini API Key
- Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
- Create a new API key
- Copy to `.env` as `GOOGLE_GEMINI_API_KEY`

### 2. Enable Gemini in Your Code
The AI service uses Gemini to:
- Analyze WiFi threat patterns
- Research user-submitted techniques
- Classify threat severity
- Suggest detection methods

## Setting Up Firebase (Optional)

### 1. Create Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com)
- Create new project
- Enable Firestore Database
- Create service account credentials

### 2. Add Credentials to .env
- Download service account JSON key
- Extract values and add to `.env`

### 3. Database Collections
The app creates these collections:
- `threats` - Cataloged WiFi threats
- `user_submissions` - Submitted threats awaiting research
- `wifi_networks` - Scanned network details
- `locations` - Network GPS coordinates (with consent)

## WiFi Scanning

### macOS/Linux
Requires sudo/admin privileges:
```bash
sudo npm start
```

### Windows
Run terminal as Administrator:
1. Right-click PowerShell/CMD
2. Select "Run as administrator"
3. Run `npm start`

### Known Issues
- **Permission Denied**: Ensure admin privileges
- **No Networks Found**: Check WiFi adapter status
- **"iwconfig" not found**: Install `wireless-tools` package

## User Submission Workflow

### 1. User Submits Threat
```bash
POST /api/submit-technique
{
  "name": "Protocol Downgrade Attack",
  "description": "Forces WiFi clients to use WEP encryption",
  "ssidPattern": "Optional pattern",
  "detectionMethod": "Optional method"
}
```

### 2. AI Research (Async)
- Gemini API analyzes the threat
- Generates severity rating
- Creates detection methods
- Catalogs for other users

### 3. Threat Added to Database
- Available immediately in threat catalog
- Other users see new threat signatures
- Integrated into monitoring queries

## Location Tracking & Mapping

### Enable Location Tracking
1. Click "Location Tracking" toggle in UI
2. Grant browser geolocation permission
3. Submit location when logging networks

### Features
- Real-time map of WiFi networks
- Network proximity detection (within 1km radius)
- Heatmap generation
- Geofencing alerts

### Privacy
- Requires explicit user consent
- Data stored securely in Firebase
- Can be disabled anytime
- Optional WiGLE.net sharing

## WiGLE.net Export

### Prerequisites
- WiGLE.net account
- API credentials from WiGLE.net settings

### Export Process
1. Ensure locations are saved (`/api/log-location`)
2. Call export endpoint:
```bash
POST /api/export-wigle
{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

3. Receives CSV format compatible with WiGLE.net
4. Upload CSV to WiGLE.net wardriving database

## Threat Detection Techniques

### Karma Attack Detection
Identifies networks broadcast as bait SSIDs:
- Common ISP SSIDs (xfinitywifi, att wifi)
- Generic names (Free WiFi, Open Network)
- Flags devices that connect without manual selection

### Evil Twin Detection
Detects same SSID with different BSSIDs:
- Same network name, different MAC addresses
- Typically indicates rogue access point
- Often paired with SSL stripping attacks

### WiFi Pineapple Detection
Identifies WiFi Pineapple devices:
- Matches known default SSIDs
- Detects beacon broadcasting patterns
- Flags suspicious SSID combinations

## Development

### Project Structure
```
wifisentry-1/
├── server.js              # Main Express server
├── config.js              # Configuration
├── database.js            # Firebase/Database operations
├── aiService.js           # Gemini API integration
├── wifi-scanner.js        # WiFi scanning & threat detection
├── location-tracker.js    # Geolocation & mapping
├── karma-attack.js        # Karma attack detection
├── evil-twin-detector.js  # Evil twin detection
├── web-app/               # Next.js frontend
│   ├── src/app/
│   │   ├── page.tsx       # Main dashboard
│   │   ├── layout.tsx     # App layout
│   │   └── globals.css    # Global styles
│   └── package.json
├── public/                # Static files
├── package.json           # Backend dependencies
└── .env.example           # Environment template
```

### Making Changes

**Backend:**
1. Edit files in root directory
2. Restart server with `npm start`

**Frontend:**
1. Edit files in `web-app/src`
2. Changes hot-reload automatically

## Troubleshooting

### "Module not found" errors
```bash
rm -rf node_modules
npm install
```

### WiFi scan not working
- Check admin privileges
- Verify wireless adapter is enabled
- Check system logs: `dmesg | tail -20`

### Gemini API errors
- Verify API key in `.env`
- Check API quota on Google Cloud Console
- Ensure API is enabled in project

### Firebase connection issues
- Verify credentials in `.env`
- Check Firebase rules allow access
- Ensure Firestore is initialized

### Port 3000 already in use
```bash
# Find process using port
lsof -i :3000
# Kill process or use different port
PORT=3001 npm start
```

## Security Considerations

- **Never commit `.env`** - Already in `.gitignore`
- **Rotate API keys** - Regenerate keys monthly
- **Location data** - Only stored with explicit consent
- **CORS** - Configured to localhost only in development
- **Admin detection** - Only admin can access scan results

## Advanced Configuration

### Custom Detection Rules
Edit `wifi-scanner.js` to add new detection patterns:
```javascript
function detectCustomThreat(networks) {
  // Your detection logic
  return { /* threat details */ };
}
```

### Batch Processing
For large WiFi scans, implement pagination:
```javascript
const networks = await database.networks.getRecent(1000);
const batches = chunk(networks, 100); // Process 100 at a time
```

### Rate Limiting
Add rate limiting for API endpoints:
```bash
npm install express-rate-limit
```

## Performance Tips

- Enable result caching for threat catalog
- Use database indexes on BSSID, SSID
- Implement scan result pagination
- Cache Gemini API responses
- Use async workers for long-running tasks

## Contributing

1. Create feature branch: `git checkout -b feature/new-threat-detection`
2. Make changes with clear commits
3. Add tests: `npm test`
4. Submit PR with description

## License

MIT - See LICENSE file

## Support

For issues or questions:
1. Check troubleshooting section
2. Review API documentation
3. Check GitHub issues
4. Contact project maintainer

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Bluetooth threat detection
- [ ] 5G network analysis
- [ ] Real-time threat alerts via WebSocket
- [ ] Dashboard analytics & reporting
- [ ] Multi-device coordination
- [ ] Machine learning threat classification
- [ ] Integration with security platforms (ZeroTrust, etc.)

---

**Last Updated**: February 2024
**Version**: 1.0.0
