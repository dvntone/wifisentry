document.addEventListener('DOMContentLoaded', () => {
    const refreshButton = document.getElementById('refresh-data');
    const logoutButton = document.getElementById('logout-button');
    const recentLogsContainer = document.getElementById('recent-logs');
    const twoFactorStatusContainer = document.getElementById('2fa-status');
    const twoFactorSetupModal = document.getElementById('2fa-setup-modal');
    const twoFactorQrCode = document.getElementById('2fa-qr-code');
    const twoFactorVerifyTokenInput = document.getElementById('2fa-verify-token');
    const twoFactorVerifyButton = document.getElementById('2fa-verify-button');
    const twoFactorSetupMessage = document.getElementById('2fa-setup-message');
    
    let typeChart = null;
    let severityChart = null;

    async function fetchData() {
        try {
            const response = await fetch('/api/threat-logs');
            if (response.status === 401) {
                // Not authenticated, redirect to login
                window.location.href = '/login.html';
                return;
            }
            const logs = await response.json();
            updateCharts(logs);
            updateRecentLogs(logs);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            recentLogsContainer.innerHTML = '<p style="color:red">Failed to load data.</p>';
        }
    }

    async function check2FAStatus() {
        // This is a mock check. In a real app, you'd have an endpoint to get user settings.
        // For now, we just show the enable button.
        twoFactorStatusContainer.innerHTML = `
            <p>Two-Factor Authentication (2FA) adds an extra layer of security to your account.</p>
            <button id="2fa-enable-start-button">Enable 2FA</button>
        `;
        document.getElementById('2fa-enable-start-button').addEventListener('click', start2FASetup);
    }

    async function start2FASetup() {
        try {
            const response = await fetch('/api/auth/2fa/generate');
            const data = await response.json();
            if (response.ok) {
                twoFactorQrCode.src = data.qrCodeUrl;
                twoFactorSetupModal.style.display = 'block';
                twoFactorSetupMessage.textContent = `Your secret key: ${data.secret}`;
                twoFactorSetupMessage.style.color = 'black';
            } else {
                twoFactorStatusContainer.innerHTML = `<p style="color:red">Error: ${data.message}</p>`;
            }
        } catch (error) {
            console.error('Error starting 2FA setup:', error);
        }
    }

    function updateCharts(logs) {
        // Process data for charts
        const typeCounts = {};
        const severityCounts = {};

        logs.forEach(log => {
            typeCounts[log.threatType] = (typeCounts[log.threatType] || 0) + 1;
            severityCounts[log.severity] = (severityCounts[log.severity] || 0) + 1;
        });

        // Render Type Chart
        const typeCtx = document.getElementById('threatTypeChart').getContext('2d');
        if (typeChart) typeChart.destroy();
        typeChart = new Chart(typeCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(typeCounts),
                datasets: [{
                    label: 'Detections',
                    data: Object.values(typeCounts),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // Render Severity Chart
        const severityCtx = document.getElementById('severityChart').getContext('2d');
        if (severityChart) severityChart.destroy();
        severityChart = new Chart(severityCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(severityCounts),
                datasets: [{
                    data: Object.values(severityCounts),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)', // Red
                        'rgba(255, 206, 86, 0.6)', // Yellow
                        'rgba(75, 192, 192, 0.6)', // Green
                        'rgba(153, 102, 255, 0.6)' // Purple
                    ],
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function updateRecentLogs(logs) {
        recentLogsContainer.innerHTML = '';
        const recent = logs.slice(0, 10); // Show last 10
        
        if (recent.length === 0) {
            recentLogsContainer.innerHTML = '<p>No threats detected yet.</p>';
            return;
        }

        recent.forEach(log => {
            const div = document.createElement('div');
            div.style.borderBottom = '1px solid #eee';
            div.style.padding = '10px 0';
            div.innerHTML = `
                <strong>${new Date(log.detectedAt).toLocaleString()}</strong> - 
                <span style="color: ${log.severity === 'High' ? 'red' : 'orange'}">${log.threatType}</span>
                <br>
                <small>${log.description} (SSID: ${log.ssid})</small>
            `;
            recentLogsContainer.appendChild(div);
        });
    }

    twoFactorVerifyButton.addEventListener('click', async () => {
        const token = twoFactorVerifyTokenInput.value;
        if (!token || token.length !== 6) {
            twoFactorSetupMessage.textContent = 'Please enter a valid 6-digit token.';
            twoFactorSetupMessage.style.color = 'red';
            return;
        }

        try {
            const response = await fetch('/api/auth/2fa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await response.json();
            twoFactorSetupMessage.textContent = data.message;
            if (response.ok) {
                twoFactorSetupMessage.style.color = 'green';
                twoFactorVerifyButton.disabled = true;
                twoFactorVerifyTokenInput.disabled = true;
            } else {
                twoFactorSetupMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Error verifying 2FA token:', error);
            twoFactorSetupMessage.textContent = 'An error occurred during verification.';
        }
    });

    logoutButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            if (response.ok) {
                window.location.href = '/login.html';
            } else {
                alert('Logout failed.');
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    refreshButton.addEventListener('click', fetchData);
    check2FAStatus();
    fetchData(); // Initial load
});