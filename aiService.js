/**
 * AI Service module using Google Gemini API for threat research and analysis.
 * Integrates with Firestore for persistent storage of cataloged threats.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');
const database = require('./database');

let genAI;
let model;

try {
  genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  model = genAI.getGenerativeModel({ model: config.gemini.model });
} catch (error) {
  console.warn('Gemini API initialization skipped - using mock responses for development');
}

/**
 * Analyzes a WiFi threat using AI
 * @param {object} threatData - The threat to analyze
 * @returns {Promise<object>} Analysis results
 */
async function analyzeThreat(threatData) {
  try {
    const prompt = `
      As a cybersecurity WiFi expert, analyze the following potential WiFi threat:
      
      Name: ${threatData.name}
      Description: ${threatData.description}
      SSID Pattern: ${threatData.ssidPattern || 'Not provided'}
      Detection Method: ${threatData.detectionMethod || 'Not provided'}
      
      Provide a detailed analysis including:
      1. Severity level (Critical, High, Medium, Low)
      2. Technical explanation of how this threat works
      3. Recommended detection methods
      4. Mitigation strategies
      5. Indicators of compromise (IOCs)
      
      Format your response as JSON with keys: severity, explanation, detectionMethods, mitigation, iocs
    `;

    let response;
    if (model) {
      const result = await model.generateContent(prompt);
      response = result.response.text();
    } else {
      // Mock response for development
      response = JSON.stringify({
        severity: 'High',
        explanation: `This threat involves ${threatData.name} attempting to deceive users into connecting to rogue access points.`,
        detectionMethods: [
          'Monitor for unusual beacon frames',
          'Analyze SSID cloning patterns',
          'Track rapid authentication failures',
        ],
        mitigation: 'Users should verify network authenticity and use certificate pinning',
        iocs: ['Rapid SSID duplication', 'Unusual beacon patterns'],
      });
    }

    // Parse JSON response
    let analysisResult;
    try {
      analysisResult = JSON.parse(response);
    } catch (e) {
      // If response isn't JSON, wrap it
      analysisResult = {
        severity: 'Medium',
        explanation: response,
        detectionMethods: [],
        mitigation: '',
        iocs: [],
      };
    }

    return {
      id: `analysis-${Date.now()}`,
      ...threatData,
      ...analysisResult,
      analyzedAt: new Date().toISOString(),
      source: threatData.source || 'AI Analysis',
    };
  } catch (error) {
    console.error('Error analyzing threat with AI:', error);
    throw error;
  }
}

/**
 * Research a new WiFi threat technique using AI
 * @param {object} techniqueData - Data about the technique
 * @returns {Promise<object>} Researched threat object
 */
async function researchTechnique(techniqueData) {
  try {
    console.log(`AI Service: Researching new technique: ${techniqueData.name}`);

    // Analyze the technique
    const analysis = await analyzeThreat(techniqueData);

    // Save to database
    const threat = {
      name: analysis.name,
      description: analysis.description,
      severity: analysis.severity,
      explanation: analysis.explanation,
      detectionMethods: analysis.detectionMethods,
      mitigation: analysis.mitigation,
      indicators: analysis.iocs,
      source: techniqueData.source || 'User Submission',
      discoveredDate: new Date().toISOString(),
    };

    const savedThreat = await database.threats.add(threat);
    console.log(`AI Service: Finished researching ${techniqueData.name}. Cataloged with ID: ${savedThreat.id}`);
    
    return savedThreat;
  } catch (error) {
    console.error('Error researching technique:', error);
    throw error;
  }
}

/**
 * Get all cataloged threats
 * @returns {Promise<Array>} Array of threat objects
 */
async function getCatalogedThreats() {
  try {
    return await database.threats.getAll();
  } catch (error) {
    console.error('Error retrieving cataloged threats:', error);
    throw error;
  }
}

/**
 * Get threats by severity level
 * @param {string} severity - Severity level filter
 * @returns {Promise<Array>} Filtered threats
 */
async function getThreatsBySeverity(severity) {
  try {
    return await database.threats.getAll({ severity });
  } catch (error) {
    console.error('Error retrieving threats by severity:', error);
    throw error;
  }
}

/**
 * Analyze detection for suspicious patterns
 * @param {Array} detectedNetworks - Networks detected in scan
 * @returns {Promise<object>} Analysis of potential threats
 */
async function analyzeDetectionResults(detectedNetworks) {
  try {
    const prompt = `
      Analyze the following WiFi networks for potential spoofing or evil twin attacks:
      
      ${JSON.stringify(detectedNetworks, null, 2)}
      
      Identify:
      1. Duplicate SSIDs with different BSSIDs
      2. Suspicious open networks
      3. Known security vulnerabilities
      
      Return JSON with: suspicious_networks, threat_types, recommended_actions
    `;

    let response;
    if (model) {
      const result = await model.generateContent(prompt);
      response = result.response.text();
    } else {
      response = JSON.stringify({
        suspicious_networks: detectedNetworks.filter(n => !n.security || n.security === 'OPEN'),
        threat_types: ['potential_evil_twin', 'open_network_risks'],
        recommended_actions: ['Avoid connecting to open networks', 'Verify network owner'],
      });
    }

    try {
      return JSON.parse(response);
    } catch (e) {
      return { analysis: response };
    }
  } catch (error) {
    console.error('Error analyzing detection results:', error);
    throw error;
  }
}

module.exports = {
  researchTechnique,
  getCatalogedThreats,
  getThreatsBySeverity,
  analyzeThreat,
  analyzeDetectionResults,
};
