// Canvas and state initialization
const canvas = document.getElementById('videoCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1280;
canvas.height = 720;

let eventCount = 0;
let isMonitoring = true;
let soundEnabled = true;
let sensitivity = 30;
let events = [];
let motionActive = false;
let startTime = Date.now();

// Initialize everything
function init() {
    drawVideoFeed();
    updateTimestamp();
    updateUptime();
    updateRecIndicator();
    
    setInterval(updateTimestamp, 1000);
    setInterval(updateUptime, 1000);
    setInterval(drawVideoFeed, 100);
}

// Draw simulated video feed
function drawVideoFeed() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#2a3f5f');
    gradient.addColorStop(1, '#1a2332');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Room elements for realism
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(100, 500, 300, 200);
    ctx.fillRect(900, 400, 250, 300);

    // Motion detection overlay
    if (motionActive) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        const boxX = 400 + Math.random() * 200;
        const boxY = 250 + Math.random() * 100;
        ctx.strokeRect(boxX, boxY, 300, 250);
        
        // Corner brackets
        const bracketSize = 20;
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + bracketSize);
        ctx.lineTo(boxX, boxY);
        ctx.lineTo(boxX + bracketSize, boxY);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(boxX + 300 - bracketSize, boxY);
        ctx.lineTo(boxX + 300, boxY);
        ctx.lineTo(boxX + 300, boxY + bracketSize);
        ctx.stroke();
    }

    // Ambient noise
    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.02})`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }
}

function updateTimestamp() {
    const now = new Date();
    const hours = now.getHours() % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    document.getElementById('videoTimestamp').textContent = `${hours}:${minutes}:${seconds} ${ampm}`;
}

function updateUptime() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('uptime').textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateRecIndicator() {
    const recIndicator = document.getElementById('recIndicator');
    if (isMonitoring) {
        recIndicator.classList.add('recording');
    } else {
        recIndicator.classList.remove('recording');
    }
}

function triggerMotion() {
    if (!isMonitoring) {
        alert('Monitoring is paused! Start monitoring first.');
        return;
    }

    motionActive = true;
    document.getElementById('motionBadge').classList.add('active');
    document.getElementById('currentStatus').textContent = 'Motion Detected';

    eventCount++;
    document.getElementById('eventCount').textContent = eventCount;

    addLogEntry('Motion Started', 'started');

    setTimeout(() => {
        motionActive = false;
        document.getElementById('motionBadge').classList.remove('active');
        document.getElementById('currentStatus').textContent = 'No Motion';
        addLogEntry('Motion Ended', 'ended', '0.2s');
    }, 2000);
}

function addLogEntry(text, type, duration = '') {
    const logContainer = document.getElementById('logContainer');
    
    const empty = logContainer.querySelector('.log-empty');
    if (empty) empty.remove();

    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const relativeTime = 'a few seconds ago';

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
        <div class="log-entry-header">
            <div class="log-status-dot ${type}"></div>
            <div class="log-event-type">${text}</div>
            ${duration ? `<div class="log-duration">${duration}</div>` : ''}
        </div>
        <div class="log-timestamp">${timeStr} · ${relativeTime}</div>
    `;

    logContainer.insertBefore(entry, logContainer.firstChild);

    const entries = logContainer.querySelectorAll('.log-entry');
    if (entries.length > 20) {
        entries[entries.length - 1].remove();
    }
}

function toggleMonitoring() {
    isMonitoring = !isMonitoring;
    
    const button = document.getElementById('monitoringButton');
    const buttonText = document.getElementById('monitoringText');
    const buttonIcon = document.getElementById('buttonIcon');
    const systemStatus = document.getElementById('systemStatus');
    const headerStatus = document.getElementById('headerStatus');
    const statusIndicator = document.getElementById('statusIndicator');

    if (isMonitoring) {
        button.classList.add('monitoring-active');
        buttonText.textContent = 'Stop Monitoring';
        buttonIcon.textContent = '■';
        systemStatus.textContent = 'Monitoring Active';
        headerStatus.classList.remove('paused');
    } else {
        button.classList.remove('monitoring-active');
        buttonText.textContent = 'Start Monitoring';
        buttonIcon.textContent = '▶';
        systemStatus.textContent = 'Monitoring Paused';
        headerStatus.classList.add('paused');
    }
    
    updateRecIndicator();
}

function updateSensitivity(value) {
    sensitivity = value;
    document.getElementById('sensitivityValue').textContent = value + '%';
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const toggle = document.getElementById('soundToggle');
    toggle.classList.toggle('active');
}

function clearLogs() {
    const logContainer = document.getElementById('logContainer');
    logContainer.innerHTML = '<div class="log-empty">No recent events</div>';
}

function clearAll() {
    if (!confirm('Clear all events and reset counters?')) return;
    
    eventCount = 0;
    document.getElementById('eventCount').textContent = '0';
    clearLogs();
}

function autoMode() {
    if (!isMonitoring) {
        alert('Please start monitoring first!');
        return;
    }
    
    let count = 0;
    const interval = setInterval(() => {
        if (count >= 5) {
            clearInterval(interval);
            return;
        }
        triggerMotion();
        count++;
    }, 4000);
}

// Start everything when page loads
init();