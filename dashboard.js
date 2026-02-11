document.addEventListener('DOMContentLoaded', () => {
    const refreshButton = document.getElementById('refresh-data');
    const recentLogsContainer = document.getElementById('recent-logs');
    
    let typeChart = null;
    let severityChart = null;

    async function fetchData() {
        try {
            const response = await fetch('/api/threat-logs');
            const logs = await response.json();
            updateCharts(logs);
            updateRecentLogs(logs);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            recentLogsContainer.innerHTML = '<p style="color:red">Failed to load data.</p>';
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

    refreshButton.addEventListener('click', fetchData);
    fetchData(); // Initial load
});