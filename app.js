document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-monitoring');
    const stopButton = document.getElementById('stop-monitoring');
    const logsContainer = document.getElementById('logs');
    const exportButton = document.getElementById('export-threats');
    let monitoring = false;
    let eventSource = null;

    function addLog(message, color = 'black') {
        logsContainer.innerHTML = `<p style="color:${color}">${message}</p>` + logsContainer.innerHTML;
    }

    startButton.addEventListener('click', async () => {
        const selectedTechniques = Array.from(document.querySelectorAll('input[name="technique"]:checked')).map(cb => cb.value);
        
        if (selectedTechniques.length === 0) {
            alert('Please select at least one technique.');
            return;
        }

        monitoring = true;
        startButton.disabled = true;
        stopButton.disabled = false;
        addLog('Starting continuous WiFi monitoring...');

        await fetch('/api/start-monitoring', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ techniques: selectedTechniques })
        });

        // Open SSE connection
        eventSource = new EventSource('/api/monitoring-stream');
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'scan-result') {
                addLog(`[${data.timestamp}] Scan complete. Networks: ${data.networkCount}. Threats: ${data.findings.length}`);
                data.findings.forEach(f => {
                    addLog(`⚠️ THREAT: ${f.reason || f.threat || f.description} (${f.ssid})`, 'red');
                    // Push threat to Electron for native OS notification (desktop only)
                    if (typeof window !== 'undefined' && window.electron?.notifyThreat) {
                        window.electron.notifyThreat(f);
                    }
                });
            } else if (data.type === 'error') {
                addLog(`Error: ${data.message}`, 'red');
            }
        };
    });

    stopButton.addEventListener('click', async () => {
        monitoring = false;
        startButton.disabled = false;
        stopButton.disabled = true;
        await fetch('/api/stop-monitoring', { method: 'POST' });
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        addLog('WiFi monitoring stopped.');
    });

    exportButton.addEventListener('click', () => {
        addLog('Exporting cataloged threats to CSV...');
        window.location.href = '/api/export/threats-csv';
    });

    // Desktop: auto-start monitoring when Electron sends the signal on startup
    if (typeof window !== 'undefined' && window.electron?.onAutoStartMonitoring) {
        window.electron.onAutoStartMonitoring((techniques) => {
            if (monitoring) return;
            addLog(`Auto-starting monitoring (${techniques.join(', ')})…`);
            techniques.forEach(t => {
                const cb = document.querySelector(`input[name="technique"][value="${t}"]`);
                if (cb) cb.checked = true;
            });
            startButton.click();
        });
    }
});