/**
 * Shared API Client for WiFi Sentry
 * Used by Web, Desktop (Electron), and Mobile (Capacitor) apps
 * Provides unified interface to backend API
 */

interface APIOptions {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

interface ThreatData {
  id?: string;
  threatType: 'evil-twin' | 'karma-attack' | 'wifi-pineapple' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ssid: string;
  bssid?: string;
  description: string;
  detectedAt?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

class WiFiSentryAPI {
  private baseURL: string;
  private timeout: number;
  private sessionToken: string | null = null;
  private headers: Record<string, string>;

  constructor(options: APIOptions = {}) {
    this.baseURL = options.baseURL || 'http://localhost:3000';
    this.timeout = options.timeout || 30000;
    this.headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
  }

  /**
   * Set authentication token for subsequent requests
   */
  setToken(token: string) {
    this.sessionToken = token;
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    this.sessionToken = null;
  }

  /**
   * Login user
   */
  async login(username: string, password: string): Promise<{ token: string; user: any }> {
    const response = await this.request('/api/auth/login', 'POST', {
      username,
      password,
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await this.request('/api/auth/logout', 'POST');
    this.clearToken();
  }

  /**
   * Start WiFi monitoring
   */
  async startMonitoring(): Promise<{ status: string }> {
    return this.request('/api/start-monitoring', 'POST');
  }

  /**
   * Stop WiFi monitoring
   */
  async stopMonitoring(): Promise<{ status: string }> {
    return this.request('/api/stop-monitoring', 'POST');
  }

  /**
   * Get monitoring status
   */
  async getMonitoringStatus(): Promise<{
    isMonitoring: boolean;
    threatsDetected: number;
    sessionsActive: number;
  }> {
    return this.request('/api/monitoring-status', 'GET');
  }

  /**
   * Get cataloged threats
   */
  async getCatalogedThreats(filters?: {
    severity?: string;
    threatType?: string;
  }): Promise<ThreatData[]> {
    const params = new URLSearchParams(filters || {});
    return this.request(
      `/api/cataloged-threats?${params.toString()}`,
      'GET'
    );
  }

  /**
   * Get threats by severity level
   */
  async getThreatsBySeverity(severity: string): Promise<ThreatData[]> {
    return this.request(`/api/threats-by-severity/${severity}`, 'GET');
  }

  /**
   * Submit user-identified threat
   */
  async submitThreat(threat: Partial<ThreatData>): Promise<{ id: string; status: string }> {
    return this.request('/api/submit-threat', 'POST', threat);
  }

  /**
   * Get user submissions
   */
  async getUserSubmissions(): Promise<ThreatData[]> {
    return this.request('/api/user-submissions', 'GET');
  }

  /**
   * Get submission status
   */
  async getSubmissionStatus(submissionId: string): Promise<{
    id: string;
    status: 'pending' | 'reviewing' | 'approved' | 'rejected';
    feedback?: string;
  }> {
    return this.request(`/api/submission-status/${submissionId}`, 'GET');
  }

  /**
   * Log location
   */
  async logLocation(
    location: LocationData,
    consentGiven: boolean
  ): Promise<{ id: string; saved: boolean }> {
    if (!consentGiven) {
      throw new Error('Location consent required');
    }

    return this.request('/api/log-location', 'POST', {
      ...location,
      consentGiven,
    });
  }

  /**
   * Get nearby detected networks
   */
  async getNearbyNetworks(
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<Array<{
    ssid: string;
    bssid: string;
    latitude: number;
    longitude: number;
    threatType?: string;
  }>> {
    return this.request('/api/nearby-networks', 'POST', {
      latitude,
      longitude,
      radiusKm,
    });
  }

  /**
   * Export data in WiGLE format
   */
  async exportToWiGLE(): Promise<{
    status: string;
    recordsExported: number;
  }> {
    return this.request('/api/export-wigle', 'POST');
  }

  /**
   * Get system health/status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'error';
    uptime: number;
    dbConnection: boolean;
    apiHealth: boolean;
  }> {
    return this.request('/api/health', 'GET');
  }

  /**
   * Get server statistics
   */
  async getStats(): Promise<{
    totalThreatsDetected: number;
    totalNetworksScanned: number;
    activeSessions: number;
    lastScanTime: string;
  }> {
    return this.request('/api/stats', 'GET');
  }

  /**
   * Subscribe to real-time threat updates via EventSource
   */
  onRealtimeThreats(callback: (threat: ThreatData) => void): () => void {
    const eventSource = new EventSource(`${this.baseURL}/api/monitoring-stream`);

    const handleMessage = (event: Event) => {
      const messageEvent = event as MessageEvent;
      try {
        const threat = JSON.parse(messageEvent.data);
        callback(threat);
      } catch (error) {
        console.error('Failed to parse threat data:', error);
      }
    };

    eventSource.addEventListener('threat', handleMessage);

    // Return cleanup function
    return () => {
      eventSource.removeEventListener('threat', handleMessage);
      eventSource.close();
    };
  }

  /**
   * Generic request method
   */
  private async request(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const options: RequestInit = {
        method,
        headers: { ...this.headers },
        signal: controller.signal,
      };

      if (this.sessionToken) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${this.sessionToken}`,
        };
      }

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, options);

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          throw new Error('Unauthorized: Please login again');
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout (${this.timeout}ms)`);
        }
        throw error;
      }
      throw new Error('Unknown error occurred');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default WiFiSentryAPI;
export type { ThreatData, LocationData, APIOptions };
