// =============== UTILITAS UMUM ===============
if (!localStorage.getItem('isLoggedIn')) {
    window.location.href = 'index.html';
}

// Inisialisasi data kapal jika belum ada
if (!localStorage.getItem('vesselData')) {
    localStorage.setItem('vesselData', JSON.stringify({
        current: {
            latitude: -6.2088,
            longitude: 106.8456,
            speed: 12.5,
            heading: 45,
            status: "Sailing",
            fuelUsage: 250,
            engineTemp: 85,
            sensorAlert: "Normal"
        },
        history: []
    }));
}

// =============== VARIABEL GLOBAL ===============
let map;
let vesselMarker;
let historyPolyline = null;

let fuelChart, engineChart;
let fuelData = [];
let engineData = [];
let timestamps = [];

let activeAlerts = [];

// =============== FUNGSI UTAMA ===============

function updateCurrentInfoUI(current) {
    document.getElementById('currentPos').textContent = `${current.latitude.toFixed(4)}, ${current.longitude.toFixed(4)}`;
    document.getElementById('currentSpeed').textContent = current.speed.toFixed(1);
    document.getElementById('currentHeading').textContent = current.heading.toFixed(0);
    document.getElementById('currentStatus').textContent = current.status;
    document.getElementById('fuelUsage').textContent = current.fuelUsage.toFixed(0);
    document.getElementById('engineTemp').textContent = current.engineTemp.toFixed(1);
    document.getElementById('sensorAlert').textContent = current.sensorAlert;
}

function saveToHistory(data) {
    const vesselData = JSON.parse(localStorage.getItem('vesselData'));
    const timestamp = new Date().toLocaleString();

    vesselData.history.push({
        timestamp: timestamp,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.heading,
        status: data.status
    });

    if (vesselData.history.length > 50) {
        vesselData.history.shift();
    }

    localStorage.setItem('vesselData', JSON.stringify(vesselData));
    renderHistoryTable();
}

function renderHistoryTable() {
    const vesselData = JSON.parse(localStorage.getItem('vesselData'));
    const historyBody = document.getElementById('historyBody');
    historyBody.innerHTML = '';

    vesselData.history.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.timestamp}</td>
            <td>${record.latitude.toFixed(4)}</td>
            <td>${record.longitude.toFixed(4)}</td>
            <td>${record.speed.toFixed(1)}</td>
            <td>${record.heading.toFixed(0)}</td>
            <td>${record.status}</td>
        `;
        historyBody.appendChild(row);
    });
}

// =============== PETA (LEAFLET) ===============
function initMap() {
    const vesselData = JSON.parse(localStorage.getItem('vesselData'));
    const current = vesselData.current;

    map = L.map('mapContainer').setView([current.latitude, current.longitude], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    vesselMarker = L.marker([current.latitude, current.longitude], {
        title: 'Current Vessel Position'
    }).addTo(map);

    vesselMarker.bindPopup(`<b>Vessel</b><br>Lat: ${current.latitude.toFixed(4)}<br>Lng: ${current.longitude.toFixed(4)}`).openPopup();
}

function updateMapPosition(lat, lng, speed, heading) {
    if (!map || !vesselMarker) return;
    vesselMarker.setLatLng([lat, lng]);
    map.setView([lat, lng], 6);
    vesselMarker.bindPopup(`<b>Vessel</b><br>Lat: ${lat.toFixed(4)}<br>Lng: ${lng.toFixed(4)}<br>Speed: ${speed} knots<br>Heading: ${heading}°`).openPopup();

    // Di dalam initMap() atau updateMapPosition()
const vesselIcon = L.icon({
    iconUrl: 'assets/ship-icon.png', // download ikon kapal dari: https://www.flaticon.com/free-icons/ship
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

vesselMarker = L.marker([lat, lng], { icon: vesselIcon }).addTo(map);
}

function showHistoryOnMap() {
    const vesselData = JSON.parse(localStorage.getItem('vesselData'));
    const history = vesselData.history;

    if (historyPolyline) {
        map.removeLayer(historyPolyline);
    }

    if (history.length < 2) return;

    const latlngs = history.map(point => [point.latitude, point.longitude]);
    historyPolyline = L.polyline(latlngs, { color: '#e74c3c', weight: 3 }).addTo(map);
    map.fitBounds(historyPolyline.getBounds());
}

// =============== GRAFIK (CHART.JS) ===============
function initCharts() {
    const fuelCtx = document.getElementById('fuelChart').getContext('2d');
    const engineCtx = document.getElementById('engineChart').getContext('2d');

    fuelChart = new Chart(fuelCtx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [{
                label: 'Fuel Usage (L/h)',
                data: fuelData,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });

    engineChart = new Chart(engineCtx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [{
                label: 'Engine Temp (°C)',
                data: engineData,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 60, max: 110 } }
        }
    });
}

function updateCharts(fuel, temp) {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (timestamps.length >= 20) {
        timestamps.shift();
        fuelData.shift();
        engineData.shift();
    }
    timestamps.push(now);
    fuelData.push(fuel);
    engineData.push(temp);
    fuelChart.update();
    engineChart.update();
}

// =============== NOTIFIKASI ===============
function checkAndTriggerAlerts(current) {
    const alerts = [];

    if (current.engineTemp > 95) {
        alerts.push({ id: 'high-temp', message: 'High engine temperature detected!', time: new Date().toLocaleString() });
    }
    if (current.fuelUsage > 450) {
        alerts.push({ id: 'high-fuel', message: 'Unusually high fuel consumption!', time: new Date().toLocaleString() });
    }
    if (current.sensorAlert !== "Normal") {
        alerts.push({ id: 'sensor-fail', message: 'Sensor anomaly: ' + current.sensorAlert, time: new Date().toLocaleString() });
    }

    alerts.forEach(alert => {
        if (!activeAlerts.some(a => a.id === alert.id)) {
            activeAlerts.push(alert);
        }
    });
    showAlertInUI();
}

function showAlertInUI() {
    const alertPanel = document.getElementById('alertPanel');
    const alertList = document.getElementById('alertList');
    alertList.innerHTML = '';

    if (activeAlerts.length === 0) {
        alertPanel.classList.add('hidden');
        return;
    }

    alertPanel.classList.remove('hidden');
    activeAlerts.forEach(alert => {
        const div = document.createElement('div');
        div.className = 'alert-item';
        div.innerHTML = `
            <span><strong>${alert.message}</strong> — ${alert.time}</span>
            <button class="dismiss" data-id="${alert.id}">Dismiss</button>
        `;
        alertList.appendChild(div);
    });

    document.querySelectorAll('.dismiss').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            activeAlerts = activeAlerts.filter(a => a.id !== id);
            showAlertInUI();
        });
    });
}

// =============== SIMULASI PERGERAKAN ===============
function simulateMovement() {
    const vesselData = JSON.parse(localStorage.getItem('vesselData'));
    let current = vesselData.current;

    // Simulasi perubahan
    current.latitude += (Math.random() - 0.5) * 0.001;
    current.longitude += (Math.random() - 0.5) * 0.001;
    current.speed = Math.max(0, current.speed + (Math.random() - 0.5) * 2);
    current.heading = (current.heading + (Math.random() - 0.5) * 10 + 360) % 360;
    current.status = Math.random() > 0.9 ? "Anchored" : "Sailing";
    current.fuelUsage = Math.max(100, Math.min(500, current.fuelUsage + (Math.random() - 0.5) * 50));
    current.engineTemp = Math.max(60, Math.min(100, current.engineTemp + (Math.random() - 0.5) * 5));
    current.sensorAlert = current.engineTemp > 95 ? "High Temp!" : "Normal";

    // Simpan kembali
    vesselData.current = current;
    localStorage.setItem('vesselData', JSON.stringify(vesselData));

    // Update semua komponen
    updateCurrentInfoUI(current);
    updateMapPosition(current.latitude, current.longitude, current.speed, current.heading);
    updateCharts(current.fuelUsage, current.engineTemp);
    checkAndTriggerAlerts(current);

    if (Math.random() > 0.95) {
        saveToHistory(current);
    }

    // Setelah saveToHistory(), tambahkan overlay
if (current.speed > 15) {
    const circle = L.circle([current.latitude, current.longitude], {
        color: 'red',
        fillColor: '#f00',
        fillOpacity: 0.2,
        radius: 5000 // 5km radius
    }).addTo(map);
}
}

// =============== EVENT LISTENERS ===============
document.getElementById('logoutBtn')?.addEventListener('click', function () {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
});

document.getElementById('realtimeBtn')?.addEventListener('click', function () {
    document.getElementById('mapSection').style.display = 'block';
    document.getElementById('infoPanel').style.display = 'block';
    document.getElementById('historyTableSection').style.display = 'none';
    document.getElementById('alertPanel')?.classList.remove('hidden');
    
    const vesselData = JSON.parse(localStorage.getItem('vesselData'));
    const cur = vesselData.current;
    map.setView([cur.latitude, cur.longitude], 6);
    if (historyPolyline) map.removeLayer(historyPolyline);
});

document.getElementById('historyBtn')?.addEventListener('click', function () {
    document.getElementById('mapSection').style.display = 'block';
    document.getElementById('infoPanel').style.display = 'block';
    document.getElementById('historyTableSection').style.display = 'block';
    showHistoryOnMap();
    renderHistoryTable();
});

// =============== INISIALISASI SAAT DOM SIAP ===============
document.addEventListener('DOMContentLoaded', function () {
    if (!localStorage.getItem('isLoggedIn')) return;

    initMap();
    initCharts();

    const vesselData = JSON.parse(localStorage.getItem('vesselData'));
    updateCurrentInfoUI(vesselData.current);
    updateCharts(vesselData.current.fuelUsage, vesselData.current.engineTemp);
    renderHistoryTable();
    showAlertInUI();

    setInterval(simulateMovement, 3000);
});

// Inisialisasi multi-vessel
function initMultiVesselData() {
    if (!localStorage.getItem('vessels')) {
        const vessels = {
            'vessel-1': {
                name: 'MV Oceanic Star',
                current: { latitude: -6.2088, longitude: 106.8456, speed: 12.5, heading: 45, status: "Sailing", fuelUsage: 250, engineTemp: 85, sensorAlert: "Normal" },
                history: []
            },
            'vessel-2': {
                name: 'MV Pacific Trader',
                current: { latitude: -5.1477, longitude: 119.4327, speed: 9.2, heading: 120, status: "Anchored", fuelUsage: 180, engineTemp: 78, sensorAlert: "Normal" },
                history: []
            },
            'vessel-3': {
                name: 'MV Nusantara Link',
                current: { latitude: 1.2667, longitude: 103.8333, speed: 15.0, heading: 300, status: "Sailing", fuelUsage: 310, engineTemp: 92, sensorAlert: "High Temp!" },
                history: []
            }
        };
        localStorage.setItem('vessels', JSON.stringify(vessels));
        localStorage.setItem('activeVessel', 'vessel-1');
    }
}

function exportHistoryToCSV() {
    const vesselId = getActiveVesselId();
    const vessel = getVesselData(vesselId);
    const history = vessel.history;

    if (history.length === 0) {
        alert('No historical data to export.');
        return;
    }

    let csv = 'Timestamp,Latitude,Longitude,Speed,Heading,Status\n';
    csv += history.map(r =>
        `"${r.timestamp}",${r.latitude},${r.longitude},${r.speed},${r.heading},"${r.status}"`
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `${vessel.name}_history.csv`);
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('resetBtn')?.addEventListener('click', () => {
    if (confirm('Reset all vessel data? This cannot be undone.')) {
        localStorage.removeItem('vessels');
        localStorage.removeItem('activeVessel');
        location.reload();
    }
});

document.getElementById('vesselSelector')?.addEventListener('change', function() {
    const vesselId = this.value;
    localStorage.setItem('activeVessel', vesselId);
    // Refresh semua tampilan: peta, info, grafik, riwayat
    const vessel = getVesselData(vesselId);
    updateCurrentInfoUI(vessel.current);
    updateCharts(vessel.current.fuelUsage, vessel.current.engineTemp);
    renderHistoryTable();
    // Update peta
    if (map && vesselMarker) {
        vesselMarker.setLatLng([vessel.current.latitude, vessel.current.longitude]);
        map.setView([vessel.current.latitude, vessel.current.longitude], 6);
    }
    activeAlerts = []; // reset alert per kapal
    checkAndTriggerAlerts(vessel.current);
});