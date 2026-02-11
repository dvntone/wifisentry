# WiFi Sentry

An advanced WiFi monitoring and security application designed to detect and log potential threats, including WiFi Pineapples, evil twin cloning, and Karma attacks. The application features a user-friendly interface that allows users to select and customize detection techniques in real time.

## ✨ Features

### Real-Time Detection
- **Karma Attack Detection** - Identifies suspicious networks broadcast as bait SSIDs
- **Evil Twin Detection** - Detects same SSID with different BSSIDs (potential rogue access points)
- **WiFi Pineapple Detection** - Recognizes known WiFi Pineapple patterns and configurations
- **Live Network Scanning** - Continuously monitors for WiFi threats with customizable intervals

### AI-Powered Threat Research
- **Google Gemini Integration** - Leverages advanced AI for threat analysis
- **Automatic Severity Classification** - AI determines threat criticality (Critical, High, Medium, Low)
- **Detection Method Generation** - AI suggests optimal detection strategies
- **User Threat Submissions** - Community can submit emerging or zero-day threats for research
- **Collective Threat Catalog** - AI-researched threats immediately available to all users

### Location Mapping & Tracking
- **GPS Mapping** - Track physical locations of detected WiFi networks
- **Proximity Detection** - Find networks within specified radius (1km, 5km, etc.)
- **Geofencing Alerts** - Set up automatic alerts for networks in specific areas
- **User-Consent Based** - Requires explicit opt-in for location tracking
- **Privacy Controls** - Users can disable tracking anytime

### Data Export & Integration
- **WiGLE.net Compatibility** - Export scans to wardriving database
, - **CSV/JSON Export** - Export cataloged threats and scan data in multiple formats
- **Historical Tracking** - Query networks scanned during specific date ranges
- **Batch Operations** - Process thousands of networks efficiently

### Web-Based Dashboard
- **Real-time UI** - Modern Next.js interface with Tailwind CSS
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Live Threat Indicators** - Visual severity ratings and threat details
- **Technique Selection** - Toggle detection methods on-the-fly

## 🏗️ Architecture

The application uses a modern, modular technology stack:

### Backend
- **Node.js + Express** - RESTful API server
- **Firebase Admin SDK** - Cloud database for persistent storage
- **Google Generative AI (Gemini)** - AI-powered threat analysis
- **node-wifi** - Hardware WiFi network scanning
- **Geolocation APIs** - Maps SDK integration

### Frontend
- **Next.js 16** - React framework with TypeScript
- **Tailwind CSS** - Modern styling
- **Real-time Updates** - SSE for live data streaming
- **Responsive UI** - Mobile-first design

### Database
- **Firestore/Firebase** - Cloud database collections:
  - `threats` - Cataloged WiFi security threats
  - `user_submissions` - Pending threat research queue
  - `wifi_networks` - Historical scan results
  - `locations` - GPS coordinates (with consent)

### AI Integration
- **Gemini API** - Analyzes threat patterns
- **Detection Rules** - Generates custom detection signatures
- **Threat Classification** - Assigns severity levels
- **Emerging Threat Research** - Processes user submissions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- WiFi adapter (for actual scanning)
- Administrator/sudo privileges (for WiFi scanning)
- Google Gemini API key (optional, for AI features)

### Installation (60 seconds)

```bash
# 1. Install backend dependencies
npm install

# 2. Configure environment (optional)
cp .env.example .env
# Edit .env with your API keys

# 3. Start backend
npm start

# 4. Start frontend (in new terminal)
cd web-app && npm run dev
```

Access the app at **http://localhost:3000**

### First Run

1. Select detection techniques (Karma, Evil Twin, Pineapple)
2. Click "Start Monitoring"
3. View detected threats in real-time
4. (Optional) Enable location tracking
5. (Optional) Submit new threats for AI research

## 📋 API Endpoints

### Monitoring Control
```
POST /api/start-monitoring      - Start WiFi scan
POST /api/stop-monitoring       - Stop monitoring
GET  /api/health                - Health check
```

### Threat Intelligence
```
GET  /api/cataloged-threats     - List all known threats
GET  /api/cataloged-threats/:id - Get threat details
GET  /api/cataloged-threats?severity=High - Filter threats
```

### User Submissions
```
POST /api/submit-technique      - Submit new threat for research
GET  /api/submissions           - View all submissions
GET  /api/submissions/:id       - Get submission status
```

### Scan History
```
GET  /api/scan-history          - Recent scan results
POST /api/export-wigle          - Export for WiGLE.net
```

### Location Tracking
```
POST /api/location-consent      - Enable/disable tracking
GET  /api/location-consent      - Check tracking status
POST /api/log-location          - Log network location
GET  /api/locations             - Retrieve all locations
GET  /api/nearby-networks       - Find networks near coordinates
```

## 🛠️ Configuration

### Environment Variables

Create `.env` file (see `.env.example`):

**Required:**
```env
NODE_ENV=development
PORT=3000
```

**For AI Features:**
```env
GOOGLE_GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-pro
```

**For Cloud Database:**
```env
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY=your-key
FIREBASE_CLIENT_EMAIL=your-email
```

**For Location Mapping:**
```env
GOOGLE_MAPS_API_KEY=your-maps-key
```

**For WiGLE.net Export:**
```env
WIGLE_API_NAME=your-username
WIGLE_API_TOKEN=your-token
```

## 📊 Threat Detection

### Karma Attacks
Identifies networks designed to intercept device connections:
- Broadcasts common ISP SSIDs
- Passive WiFi discovery exploitation
- Devices connect without user interaction

### Evil Twins
Detects rogue access point patterns:
- Same SSID, different BSSID
- Typically followed by SSL stripping
- Man-in-the-middle attack vector

### WiFi Pineapple
Recognizes pentest device signatures:
- Default SSID patterns
- Beacon broadcasting behavior
- Common attack configurations

## 🗺️ Location Tracking

### How It Works
1. User enables location tracking consent
2. Browser provides GPS coordinates
3. WiFi network location saved to database
4. Map visualization of network locations
5. Optional export to WiGLE.net

### Privacy
- Requires explicit user opt-in
- Users can disable anytime
- Data stored securely in Firebase
- No tracking without permission

## 🤖 AI Integration

### Threat Research Flow
```
User Submission
    ↓
Gemini API Analysis
    ↓
Severity Classification
    ↓
Detection Methods Generated
    ↓
Added to Threat Catalog
    ↓
Available to All Users
```

### AI Capabilities
- Analyzes new threat descriptions
- Generates detection signatures
- Classifies threat severity
- Suggests mitigation strategies
- Identifies indicators of compromise

## 📁 Project Structure

```
wifisentry-1/
├── server.js                  # Main Express server
├── config.js                  # Configuration & environment
├── database.js                # Firebase operations
├── aiService.js               # Gemini API integration
├── wifi-scanner.js            # WiFi scanning & detection
├── location-tracker.js        # Geolocation & mapping
├── karma-attack.js            # Karma attack detection
├── evil-twin-detector.js      # Evil twin detection
│
├── web-app/                   # Next.js Frontend
│   ├── src/app/
│   │   ├── page.tsx           # Main dashboard
│   │   ├── layout.tsx         # App layout
│   │   └── globals.css        # Styles
│   ├── package.json
│   └── tsconfig.json
│
├── public/                    # Static assets
├── package.json               # Dependencies
├── .env.example               # Environment template
├── README.md                  # This file
├── QUICK_START.md             # 30-second setup
├── INSTALLATION.md            # Full installation guide
└── LICENSE                    # MIT License
```

## 🔧 Development

### Running in Development

**Backend with hot-reload:**
```bash
npm start
```

**Frontend with hot-reload:**
```bash
cd web-app
npm run dev
```

### Building for Production

```bash
# Backend
npm run build

# Frontend
cd web-app
npm run build
npm start
```

### Running Tests
```bash
npm test
```

### Code Linting
```bash
npm run lint
```

## ⚠️ Security

### Best Practices
- ✅ Never commit `.env` file (already in `.gitignore`)
- ✅ Rotate API keys monthly
- ✅ Use environment-specific keys
- ✅ Enable location only with explicit consent
- ✅ CORS restricted to trusted origins
- ✅ Input validation on all endpoints

### Threat Models
- **Credential Exposure** - Mitigated by environment variables
- **Unauthorized Access** - Controlled by authentication layer
- **Location Privacy** - User consent required
- **API Rate Limiting** - Recommended for production

## 🐛 Troubleshooting

### WiFi Scanning Issues
- Requires administrator privileges (Linux/Mac) or Run as Administrator (Windows)
- Check WiFi adapter is enabled
- Verify wireless drivers are installed

### API Errors
- Check `.env` configuration
- Verify API keys and quotas in Google Cloud Console
- Review server logs for detailed errors

### Database Connection
- Confirm Firebase credentials
- Check Firestore rules allow access
- Verify Firebase project is active

### Port Already in Use
```bash
PORT=3001 npm start
```

See [INSTALLATION.md](./INSTALLATION.md) for comprehensive troubleshooting.

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - 30-second setup guide
- **[INSTALLATION.md](./INSTALLATION.md)** - Complete installation & configuration
- **[.env.example](./.env.example)** - Configuration template

## 🚦 Roadmap

- [ ] Mobile app (React Native)
- [ ] Bluetooth threat detection
- [ ] Real-time WebSocket alerts
- [ ] Advanced analytics dashboard
- [ ] Multi-device coordination
- [ ] Machine learning threat classification
- [ ] Integration with security platforms
- [ ] 5G network analysis

## 📄 License

MIT License - See [LICENSE](./LICENSE) file

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

- **Issues & Bugs**: Open GitHub Issue
- **Questions**: Check INSTALLATION.md FAQ
- **Feature Requests**: GitHub Discussions
- **Security Issues**: Email maintainer directly

## 👨‍💻 Author

Created with focus on WiFi security awareness and emerging threat detection.

---

**Last Updated**: February 2024  
**Version**: 1.0.0  
**Status**: Active Development 🟢
