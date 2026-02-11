const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const config = require('./config');

const aiService = require('./aiService');
const wifiScanner = require('./wifi-scanner');
const locationTracker = require('./location-tracker');
const database = require('./database');
const { detectKarmaAttack } = require('./karma-attack');
const { detectEvilTwin } = require('./evil-twin-detector');

const app = express();
const port = config.port || 3000;

let monitoringInterval = null;
let clients = [];
let locationTrackingConsent = false;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware Setup
app.use(session({
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: config.environment === 'production', httpOnly: true, maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    // For API requests, send a 401 Unauthorized status.
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized: Please log in.' });
    }
    // For page requests, redirect to the login page.
    res.redirect('/login.html');
};

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve login page publicly
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Protect the dashboard page
app.get('/dashboard.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// SSE Endpoint for real-time updates
app.get('/api/monitoring-stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    clients.push(newClient);

    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
    });
});

function broadcast(data) {
    clients.forEach(client => client.res.write(`data: ${JSON.stringify(data)}\n\n`));
}

async function runScan(techniques) {
    try {
        console.log('Performing background WiFi scan...');
        const scannedNetworks = await wifiScanner.scan();
        
        let findings = [];
        if (techniques.includes('karma')) {
            findings = findings.concat(detectKarmaAttack(scannedNetworks));
        }
        if (techniques.includes('evil-twin')) {
            const evilTwinFindings = detectEvilTwin(scannedNetworks);
            evilTwinFindings.forEach(f => f.reason = `Evil Twin/Pineapple detected. ${f.reason}`);
            findings = findings.concat(evilTwinFindings);
        }

        // Save findings to MongoDB
        if (findings.length > 0) {
            await database.threatLogs.logBatch(findings);
        }

        broadcast({ 
            type: 'scan-result', 
            timestamp: new Date().toLocaleTimeString(),
            networkCount: scannedNetworks.length, 
            findings 
        });
    } catch (error) {
        console.error('Scan error:', error);
        broadcast({ type: 'error', message: error.message });
    }
}

// API endpoint to start the monitoring process
app.post('/api/start-monitoring', (req, res) => {
    const { techniques } = req.body;
    if (!techniques || techniques.length === 0) {
        return res.status(400).json({ error: 'No monitoring techniques selected.' });
    }

    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }

    console.log('Starting continuous monitoring for:', techniques);
    runScan(techniques); // Run immediately
    monitoringInterval = setInterval(() => runScan(techniques), 10000); // Then every 10s

    res.json({ message: 'Continuous monitoring started.' });
});

app.post('/api/stop-monitoring', (req, res) => {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    res.json({ message: 'Monitoring stopped.' });
});

// API endpoint to submit a new technique for AI research
app.post('/api/submit-technique', async (req, res) => {
    const { name, description } = req.body;
    if (!name || !description) {
        return res.status(400).json({ error: 'Technique name and description are required.' });
    }
    try {
        const newThreat = await aiService.researchTechnique({ name, description, source: 'User Submission' });
        res.status(201).json(newThreat);
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit technique for research.', details: error.message });
    }
});

// API endpoint to get all cataloged threats
app.get('/api/cataloged-threats', async (req, res) => {
    try {
        const severity = req.query.severity;
        let threats;

        if (severity) {
            threats = await aiService.getThreatsBySeverity(severity);
        } else {
            threats = await aiService.getCatalogedThreats();
        }

        res.json(threats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve cataloged threats.', details: error.message });
    }
});

// API endpoint to get threat logs for dashboard
app.get('/api/threat-logs', isAuthenticated, async (req, res) => {
    try {
        const logs = await database.threatLogs.getAll();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve threat logs', details: error.message });
    }
});

// Get threat by ID
app.get('/api/cataloged-threats/:id', async (req, res) => {
    try {
        const threat = await database.threats.getById(req.params.id);
        if (!threat) {
            return res.status(404).json({ error: 'Threat not found' });
        }
        res.json(threat);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve threat', details: error.message });
    }
});

// ============ SCAN HISTORY & EXPORT API ============

/**
 * Converts an array of threat objects to a CSV string.
 * @param {Array<object>} threats - An array of Mongoose documents for threats.
 * @returns {string} A CSV formatted string.
 */
function threatsToCsv(threats) {
    if (!threats || threats.length === 0) {
        return '';
    }

    const headers = ['id', 'name', 'severity', 'description', 'explanation', 'detectionMethods', 'mitigation', 'indicators', 'source', 'discoveredDate', 'createdAt', 'updatedAt'];

    const escapeCell = (cell) => {
        if (cell === null || cell === undefined) return '';
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = threats.map(threatDoc => {
        const threat = threatDoc.toObject({ virtuals: true });
        return headers.map(header => {
            let value = threat[header];
            if (Array.isArray(value)) {
                value = value.join('; '); // Join array items with a semicolon
            }
            return escapeCell(value);
        }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}

app.get('/api/scan-history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const networks = await wifiScanner.getScanHistory(limit);
        res.json(networks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve scan history', details: error.message });
    }
});

app.get('/api/export/threats-csv', async (req, res, next) => {
    try {
        const allThreats = await database.threats.getAll();
        const csvData = threatsToCsv(allThreats);

        res.header('Content-Type', 'text/csv');
        res.attachment('threats.csv');
        res.send(csvData);
    } catch (error) {
        next(error);
    }
});

app.post('/api/export-wigle', async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const networks = await database.networks.getRecent(1000);
        const filtered = networks.filter(n => {
            if (startDate && new Date(n.detectedAt) < new Date(startDate)) return false;
            if (endDate && new Date(n.detectedAt) > new Date(endDate)) return false;
            return true;
        });

        const formatted = locationTracker.formatForWigle(filtered);
        res.json({
            message: 'Export data formatted for WiGLE.net',
            count: filtered.length,
            csv: formatted.csv,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to export data', details: error.message });
    }
});

// ============ LOCATION TRACKING API ============

app.post('/api/location-consent', (req, res) => {
    const { consent } = req.body;
    try {
        locationTrackingConsent = consent === true;
        res.json({ message: `Location tracking ${consent ? 'enabled' : 'disabled'}`, consent: locationTrackingConsent });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set location consent', details: error.message });
    }
});

app.get('/api/location-consent', (req, res) => {
    res.json({ consent: locationTrackingConsent });
});

app.post('/api/log-location', async (req, res) => {
    const { bssid, ssid, latitude, longitude, accuracy } = req.body;
    try {
        if (!locationTrackingConsent) {
            return res.status(403).json({ error: 'Location tracking not consented' });
        }

        const location = await locationTracker.logNetworkLocation(
            { bssid, ssid },
            { latitude, longitude, accuracy },
            true
        );

        res.json({ message: 'Location logged', location });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log location', details: error.message });
    }
});

app.get('/api/locations', async (req, res) => {
    try {
        if (!locationTrackingConsent) {
            return res.json([]);
        }
        const locations = await locationTracker.getAllLocations(true);
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve locations', details: error.message });
    }
});

app.get('/api/nearby-networks', async (req, res) => {
    try {
        const { latitude, longitude, radius } = req.query;
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude required' });
        }

        const radiusKm = (radius ? parseFloat(radius) / 1000 : 1);
        const nearby = await locationTracker.getNearbyNetworks(
            parseFloat(latitude),
            parseFloat(longitude),
            radiusKm
        );
        res.json(nearby);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve nearby networks', details: error.message });
    }
});

// ============ AUTHENTICATION API ============

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === config.auth.adminUsername && password === config.auth.adminPassword) {
        req.session.user = { username: username, loggedInAt: Date.now() };
        res.json({ success: true, message: 'Login successful.' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out.' });
        }
        res.clearCookie('connect.sid'); // Default session cookie name
        res.json({ success: true, message: 'Successfully logged out.' });
    });
});

// ============ USER SUBMISSIONS API ============

app.get('/api/submissions', async (req, res) => {
    try {
        const status = req.query.status;
        const submissions = await database.submissions.getAll(status ? { status } : {});
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve submissions', details: error.message });
    }
});

app.get('/api/submissions/:id', async (req, res) => {
    try {
        const submissions = await database.submissions.getAll();
        const submission = submissions.find(s => s.id === req.params.id);
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        res.json(submission);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve submission', details: error.message });
    }
});

// ============ HEALTH CHECK ============

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// ============ ERROR HANDLER ============

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: config.environment === 'development' ? err.message : undefined,
    });
});

app.listen(port, async () => {
    await database.connect();
    console.log(`WiFi Sentry is running on http://localhost:${port}`);
    console.log(`Environment: ${config.environment}`);
    console.log(`Location tracking enabled: ${locationTrackingConsent}`);
});