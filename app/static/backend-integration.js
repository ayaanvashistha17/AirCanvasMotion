// ===================================
// BACKEND INTEGRATION MODULE
// ===================================

// Configuration
const CONFIG = {
    BACKEND_URL: 'http://localhost:5000', // Change this to your Pi's address
    SSE_ENDPOINT: '/events',
    COMMAND_ENDPOINT: '/command',
    RECONNECT_DELAY: 3000
};

// State Management
const state = {
    // Mode
    isLiveMode: false,
    backendStatus: 'disconnected',
    eventSource: null,
    
    // Monitor state
    isMonitoring: true,
    soundEnabled: true,
    sensitivity: 30,
    
    // Event state
    eventCount: 0,
    currentStatus: 'No Motion',
    motionActive: false,
    events: [],
    
    // Timing
    startTime: Date.now(),
    
    // Canvas
    canvas: null,
    ctx: null
};

// ===================================
// BACKEND COMMUNICATION
// ===================================

function connectToBackend() {
    if (!state.isLiveMode) return;
    
    // Close existing connection
    if (state.eventSource) {
        state.eventSource.close();
    }
    
    console.log('Connecting to backend SSE...');
    updateBackendStatus('connecting');
    
    const url = `${CONFIG.BACKEND_URL}${CONFIG.SSE_ENDPOINT}`;
    state.eventSource = new EventSource(url);
    
    state.eventSource.onopen = () => {
        console.log('Backend connected');
        updateBackendStatus('connected');
    };
    
    state.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        updateBackendStatus('error');
        
        // Attempt reconnection
        if (state.isLiveMode) {
            setTimeout(() => {
                if (state.isLiveMode) {
                    connectToBackend();
                }
            }, CONFIG.RECONNECT_DELAY);
        }
    };
    
    // Listen for motion events
    state.eventSource.addEventListener('motion', (e) => {
        try {
            const data = JSON.parse(e.data);
            handleBackendMotionEvent(data);
        } catch (err) {
            console.error('Failed to parse motion event:', err);
        }
    });
    
    // Listen for status updates
    state.eventSource.addEventListener('status', (e) => {
        try {
            const data = JSON.parse(e.data);
            handleBackendStatusUpdate(data);
        } catch (err) {
            console.error('Failed to parse status event:', err);
        }
    });
}

function disconnectFromBackend() {
    if (state.eventSource) {
        state.eventSource.close();
        state.eventSource = null;
    }
    updateBackendStatus('disconnected');
}

async function sendBackendCommand(command, params = {}) {
    if (!state.isLiveMode) return;
    
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}${CONFIG.COMMAND_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command,
                ...params
            })
        });
        
        if (!response.ok) {
            console.error('Backend command failed:', response.statusText);
        }
        
        const result = await response.json();
        console.log('Command response:', result);
        return result;
        
    } catch (error) {
        console.error('Failed to send command to backend:', error);
        updateBackendStatus('error');
    }
}

// ===================================
// BACKEND EVENT HANDLERS
// ===================================

function handleBackendMotionEvent(data) {
    if (!state.isMonitoring) return;
    
    console.log('Motion event received:', data);
    
    if (data.type === 'started') {
        state.motionActive = true;
        state.currentStatus = 'Motion Detected';
        state.eventCount++;
        
        updateUI();
        addLogEntry('Motion Started', 'started', data.confidence || '');
        
    } else if (data.type === 'ended') {
        state.motionActive = false;
        state.currentStatus = 'No Motion';
        
        updateUI();
        addLogEntry('Motion Ended', 'ended', data.duration || '');
    }
}

function handleBackendStatusUpdate(data) {
    console.log('Status update received:', data);
    
    if (data.monitoring !== undefined) {
        state.isMonitoring = data.monitoring;
    }
    if (data.eventCount !== undefined) {
        state.eventCount = data.eventCount;
    }
    if (data.sensitivity !== undefined) {
        state.sensitivity = data.sensitivity;
    }
    if (data.sound !== undefined) {
        state.soundEnabled = data.sound;
    }
    
    updateUI();
}

// ===================================
// MODE SWITCHING
// ===================================

function switchMode(mode) {
    const isLive = mode === 'live';
    
    // Update state
    state.isLiveMode = isLive;
    
    // Update UI
    const demoBtn = document.getElementById('demoModeBtn');
    const liveBtn = document.getElementById('liveModeBtn');
    const backendStatus = document.getElementById('backendStatus');
    const demoControls = document.getElementById('demoControls');
    
    if (isLive) {
        demoBtn.classList.remove('active');
        liveBtn.classList.add('active');
        backendStatus.style.display = 'flex';
        demoControls.classList.remove('visible');
        
        // Connect to backend
        connectToBackend();
    } else {
        demoBtn.classList.add('active');
        liveBtn.classList.remove('active');
        backendStatus.style.display = 'none';
        demoControls.classList.add('visible');
        
        // Disconnect from backend
        disconnectFromBackend();
    }
}

function updateBackendStatus(status) {
    state.backendStatus = status;
    
    const dot = document.getElementById('backendStatusDot');
    const text = document.getElementById('backendStatusText');
    
    dot.className = 'backend-status-dot';
    
    switch(status) {
        case 'connected':
            dot.classList.add('connected');
            text.textContent = 'Connected';
            break;
        case 'connecting':
            text.textContent = 'Connecting...';
            break;
        case 'error':
            dot.classList.add('error');
            text.textContent = 'Error';
            break;
        default:
            text.textContent = 'Disconnected';
    }
}

// ===================================
// CONTROL FUNCTIONS
// ===================================

async function toggleMonitoring() {
    state.isMonitoring = !state.isMonitoring;
    
    // Send to backend if in live mode
    if (state.isLiveMode) {
        await sendBackendCommand('monitoring', { enabled: state.isMonitoring });
    }
    
    // Update local state
    if (!state.isMonitoring) {
        state.motionActive = false;
        state.currentStatus = 'Monitoring Paused';
    } else {
        state.currentStatus = 'No Motion';
    }
    
    updateUI();
}

async function updateSensitivity(value) {
    state.sensitivity = parseInt(value);
    
    // Send to backend if in live mode
    if (state.isLiveMode) {
        await sendBackendCommand('sensitivity', { value: state.sensitivity });
    }
    
    updateUI();
}

async function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    
    // Send to backend if in live mode
    if (state.isLiveMode) {
        await sendBackendCommand('sound', { enabled: state.soundEnabled });
    }
    
    updateUI();
}

// ===================================
// DEMO MODE FUNCTIONS
// ===================================

function triggerMotion() {
    if (state.isLiveMode) {
        alert('Switch to Demo Mode to use demo controls');
        return;
    }
    
    if (!state.isMonitoring) {
        alert('Monitoring is paused! Start monitoring first.');
        return;
    }

    state.motionActive = true;
    state.currentStatus = 'Motion Detected';
    state.eventCount++;

    updateUI();
    addLogEntry('Motion Started', 'started');

    setTimeout(() => {
        state.motionActive = false;
        state.currentStatus = 'No Motion';
        updateUI();
        addLogEntry('Motion Ended', 'ended', '2.0s');
    }, 2000);
}

function autoMode() {
    if (state.isLiveMode) {
        alert('Switch to Demo Mode to use demo controls');
        return;
    }
    
    if (!state.isMonitoring) {
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

function clearLogs() {
    state.events = [];
    updateUI();
}

function clearAll() {
    if (!confirm('Clear all events and reset counters?')) return;
    
    state.eventCount = 0;
    state.events = [];
    updateUI();
}

// ===================================
// LOG MANAGEMENT
// ===================================

function addLogEntry(text, type, duration = '') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const relativeTime = 'a few seconds ago';

    const entry = {
        text,
        type,
        duration,
        time: timeStr,
        relativeTime
    };

    state.events.unshift(entry);
    
    // Keep only last 20 events
    if (state.events.length > 20) {
        state.events = state.events.slice(0, 20);
    }

    updateLogUI();
}

function updateLogUI() {
    const logContainer = document.getElementById('logContainer');
    
    if (state.events.length === 0) {
        logContainer.innerHTML = '<div class="log-empty">No recent events</div>';
        return;
    }
    
    logContainer.innerHTML = state.events.map(entry => `
        <div class="log-entry">
            <div class="log-entry-header">
                <div class="log-status-dot ${entry.type}"></div>
                <div class="log-event-type">${entry.text}</div>
                ${entry.duration ? `<div class="log-duration">${entry.duration}</div>` : ''}
            </div>
            <div class="log-timestamp">${entry.time} · ${entry.relativeTime}</div>
        </div>
    `).join('');
}

// ===================================
// UI UPDATE
// ===================================

function updateUI() {
    // Update monitoring button
    const monitoringButton = document.getElementById('monitoringButton');
    const buttonText = document.getElementById('monitoringText');
    const buttonIcon = document.getElementById('buttonIcon');
    const systemStatus = document.getElementById('systemStatus');
    const headerStatus = document.getElementById('headerStatus');
    
    if (state.isMonitoring) {
        monitoringButton.classList.add('monitoring-active');
        buttonText.textContent = 'Stop Monitoring';
        buttonIcon.textContent = '■';
        systemStatus.textContent = 'Monitoring Active';
        headerStatus.classList.remove('paused');
    } else {
        monitoringButton.classList.remove('monitoring-active');
        buttonText.textContent = 'Start Monitoring';
        buttonIcon.textContent = '▶';
        systemStatus.textContent = 'Monitoring Paused';
        headerStatus.classList.add('paused');
    }
    
    // Update REC indicator
    const recIndicator = document.getElementById('recIndicator');
    if (state.isMonitoring) {
        recIndicator.classList.add('recording');
    } else {
        recIndicator.classList.remove('recording');
    }
    
    // Update motion badge
    const motionBadge = document.getElementById('motionBadge');
    if (state.motionActive) {
        motionBadge.classList.add('active');
    } else {
        motionBadge.classList.remove('active');
    }
    
    // Update status cards
    document.getElementById('currentStatus').textContent = state.currentStatus;
    document.getElementById('eventCount').textContent = state.eventCount;
    
    // Update sensitivity
    document.getElementById('sensitivityValue').textContent = state.sensitivity + '%';
    document.getElementById('sensitivitySlider').value = state.sensitivity;
    
    // Update sound toggle
    const soundToggle = document.getElementById('soundToggle');
    if (state.soundEnabled) {
        soundToggle.classList.add('active');
    } else {
        soundToggle.classList.remove('active');
    }
}

// ===================================
// VIDEO FEED RENDERING
// ===================================

function drawVideoFeed() {
    const gradient = state.ctx.createLinearGradient(0, 0, state.canvas.width, state.canvas.height);
    gradient.addColorStop(0, '#2a3f5f');
    gradient.addColorStop(1, '#1a2332');
    state.ctx.fillStyle = gradient;
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    // Room elements
    state.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    state.ctx.fillRect(100, 500, 300, 200);
    state.ctx.fillRect(900, 400, 250, 300);

    // Motion detection overlay
    if (state.motionActive) {
        state.ctx.strokeStyle = '#10b981';
        state.ctx.lineWidth = 4;
        const boxX = 400 + Math.random() * 200;
        const boxY = 250 + Math.random() * 100;
        state.ctx.strokeRect(boxX, boxY, 300, 250);
        
        const bracketSize = 20;
        state.ctx.lineWidth = 3;
        
        state.ctx.beginPath();
        state.ctx.moveTo(boxX, boxY + bracketSize);
        state.ctx.lineTo(boxX, boxY);
        state.ctx.lineTo(boxX + bracketSize, boxY);
        state.ctx.stroke();
        
        state.ctx.beginPath();
        state.ctx.moveTo(boxX + 300 - bracketSize, boxY);
        state.ctx.lineTo(boxX + 300, boxY);
        state.ctx.lineTo(boxX + 300, boxY + bracketSize);
        state.ctx.stroke();
    }

    // Ambient noise
    for (let i = 0; i < 50; i++) {
        state.ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.02})`;
        state.ctx.fillRect(Math.random() * state.canvas.width, Math.random() * state.canvas.height, 2, 2);
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
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('uptime').textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ===================================
// INITIALIZATION
// ===================================

function init() {
    // Initialize canvas
    state.canvas = document.getElementById('videoCanvas');
    state.ctx = state.canvas.getContext('2d');
    state.canvas.width = 1280;
    state.canvas.height = 720;
    
    // Set initial mode to demo
    document.getElementById('demoModeBtn').classList.add('active');
    
    // Start timers
    setInterval(updateTimestamp, 1000);
    setInterval(updateUptime, 1000);
    setInterval(drawVideoFeed, 100);
    
    // Initial UI update
    updateUI();
    
    console.log('Motion Monitor initialized in Demo mode');
    console.log('Backend URL:', CONFIG.BACKEND_URL);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}