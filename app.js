const SESSION_KEY = 'smart-electricity-session';
const TOKEN_KEY = 'token';
const USER_KEY = 'auth-user';
const SAVE_DELAY = 700;
const LIVE_INTERVAL = 4000;
const API_BASE = (() => {
  if (window.location.protocol === 'file:') {
    return 'http://localhost:5000';
  }

  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalHost && window.location.port && window.location.port !== '5000') {
    return 'http://localhost:5000';
  }

  return '';
})();

const rooms = [
  { name: 'Living Room', threshold: 2200 },
  { name: 'Bedroom', threshold: 1800 },
  { name: 'Kitchen', threshold: 1700 },
  { name: 'Bathroom', threshold: 1000 },
];

const applianceBlueprints = [
  { room: 'Living Room', name: 'Fan', type: 'fan', watts: 75, dailyHours: 8.2, on: true },
  { room: 'Living Room', name: 'AC', type: 'ac', watts: 1450, dailyHours: 4.5, on: true },
  { room: 'Living Room', name: 'Light', type: 'light', watts: 90, dailyHours: 6.5, on: true },
  { room: 'Living Room', name: 'TV', type: 'tv', watts: 180, dailyHours: 5.2, on: true },
  { room: 'Living Room', name: 'Refrigerator', type: 'fridge', watts: 220, dailyHours: 18.5, on: true },
  { room: 'Bedroom', name: 'Fan', type: 'fan', watts: 60, dailyHours: 9.0, on: true },
  { room: 'Bedroom', name: 'AC', type: 'ac', watts: 1300, dailyHours: 3.6, on: false },
  { room: 'Bedroom', name: 'Light', type: 'light', watts: 60, dailyHours: 5.0, on: true },
  { room: 'Bedroom', name: 'TV', type: 'tv', watts: 120, dailyHours: 2.4, on: false },
  { room: 'Bedroom', name: 'Refrigerator', type: 'fridge', watts: 160, dailyHours: 10.0, on: false },
  { room: 'Kitchen', name: 'Fan', type: 'fan', watts: 55, dailyHours: 6.2, on: true },
  { room: 'Kitchen', name: 'AC', type: 'ac', watts: 900, dailyHours: 1.5, on: false },
  { room: 'Kitchen', name: 'Light', type: 'light', watts: 80, dailyHours: 7.0, on: true },
  { room: 'Kitchen', name: 'TV', type: 'tv', watts: 95, dailyHours: 1.0, on: false },
  { room: 'Kitchen', name: 'Refrigerator', type: 'fridge', watts: 260, dailyHours: 22.0, on: true },
  { room: 'Bathroom', name: 'Fan', type: 'fan', watts: 35, dailyHours: 3.5, on: false },
  { room: 'Bathroom', name: 'AC', type: 'ac', watts: 650, dailyHours: 1.2, on: false },
  { room: 'Bathroom', name: 'Light', type: 'light', watts: 50, dailyHours: 3.3, on: true },
  { room: 'Bathroom', name: 'TV', type: 'tv', watts: 70, dailyHours: 0.7, on: false },
  { room: 'Bathroom', name: 'Refrigerator', type: 'fridge', watts: 120, dailyHours: 5.5, on: false },
];

const iotObjects = [
  'Electricity meter',
  'Current sensor',
  'Voltage sensor',
  'Breadboard',
  'Jumper wires',
  'Microcontroller',
  'IoT gateway',
];

const accessMembers = [
  { name: 'Primary Admin', role: 'Admin', access: 'All rooms and billing' },
  { name: 'Family Member', role: 'Member', access: 'Living Room and Bedroom' },
  { name: 'Guest User', role: 'Restricted', access: 'Lights and TV only' },
];

const notificationLabels = {
  usageLimit: 'Usage limit alerts',
  lowVoltage: 'Low voltage warnings',
  peakHour: 'Peak hour notifications',
  overload: 'Overload and short circuit alerts',
};

const state = {
  token: null,
  user: null,
  activeAuthTab: 'login',
  activeTab: 'home',
  appliances: [],
  metrics: null,
  dailyHistory: [],
  dailyLimit: 28,
  darkMode: true,
  selectedRoom: rooms[0].name,
  saveStatus: 'Live',
  notificationPrefs: {
    usageLimit: true,
    lowVoltage: true,
    peakHour: true,
    overload: true,
  },
};

let liveIntervalId = null;
let saveTimerId = null;

function $(id) {
  return document.getElementById(id);
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function round1(value) {
  return Number(value.toFixed(1));
}

function round2(value) {
  return Number(value.toFixed(2));
}

function formatNumber(value, digits) {
  return Number(value || 0).toFixed(digits == null ? 1 : digits);
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function storageLoad() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      return JSON.parse(raw);
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (!token) {
      return null;
    }

    return {
      token,
      user: userRaw ? JSON.parse(userRaw) : null,
    };
  } catch (_error) {
    return null;
  }
}

function storageSave(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session && session.token) {
    localStorage.setItem(TOKEN_KEY, session.token);
  }
  if (session && session.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  }
}

function storageClear() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function friendlyFetchError(error) {
  const message = error && error.message ? error.message : '';
  if (message === 'Authentication required.' || message === 'Invalid token.' || message === 'Token expired.') {
    return 'Your session has expired. Please log in again.';
  }
  if (message === 'No token provided.') {
    return 'Please log in to continue.';
  }
  if (error && error.name === 'TypeError') {
    return `Cannot reach the backend server at ${API_BASE || window.location.origin}. Start the backend on port 5000 and try again.`;
  }
  return message || 'Request failed';
}
function createDefaultAppliances() {
  return applianceBlueprints.map((item) => ({
    ...item,
    deviceId: `${slugify(item.room)}-${slugify(item.name)}`,
    highUsage: item.watts >= 1000,
  }));
}

function mergeAppliances(savedAppliances) {
  const defaults = createDefaultAppliances();
  if (!Array.isArray(savedAppliances) || !savedAppliances.length) {
    return defaults;
  }

  return defaults.map((item) => {
    const saved = savedAppliances.find((entry) => entry.deviceId === item.deviceId);
    return saved ? { ...item, ...saved } : item;
  });
}

function calculateRoomStats(appliances) {
  return rooms.map((room) => {
    const devices = appliances.filter((item) => item.room === room.name);
    const activeWatts = devices.filter((item) => item.on).reduce((sum, item) => sum + item.watts, 0);
    return {
      ...room,
      devices,
      activeWatts,
      activeLoadKw: round2(activeWatts / 1000),
      activeCount: devices.filter((item) => item.on).length,
      overloaded: activeWatts > room.threshold,
    };
  });
}

function computeMetrics(appliances, previousMetrics, dailyLimit) {
  const now = new Date();
  const activeWatts = appliances.filter((item) => item.on).reduce((sum, item) => sum + item.watts, 0) + 42;
  const liveLoadKw = round2(activeWatts / 1000);
  const peakHour = now.getHours() >= 18 && now.getHours() < 22;
  const baseline = 6.4 + appliances.reduce((sum, item) => sum + (item.watts * item.dailyHours) / 1000, 0) * 0.44;
  const previousToday = previousMetrics && previousMetrics.todayUsage ? Number(previousMetrics.todayUsage) : baseline;
  const drift = liveLoadKw * 0.001 + (peakHour ? 0.00035 : 0.00016);
  const todayUsage = round2(Math.max(baseline, previousToday + drift));
  const weeklyUsage = round1(todayUsage * 6.7);
  const monthlyUsage = round1(todayUsage * 27.3);
  const rawVoltage = 229 - liveLoadKw * 5 - (peakHour ? 8 : 0) + Math.sin((now.getMinutes() / 60) * Math.PI * 2) * 1.6;
  const voltage = Math.max(193, Math.min(238, Math.round(rawVoltage)));
  const current = round1(activeWatts / Math.max(voltage, 1));
  const billEstimate = Math.round(monthlyUsage * 8.35);

  return {
    liveLoadKw,
    todayUsage,
    weeklyUsage,
    monthlyUsage,
    voltage,
    current,
    billEstimate,
    lowVoltage: voltage < 210,
    overLimit: todayUsage > dailyLimit,
    peakHour,
    lastSyncedAt: now.toISOString(),
    activeDevices: appliances.filter((item) => item.on).length,
  };
}

function createHistory(todayUsage) {
  const items = [];
  const today = new Date();
  for (let index = 13; index >= 0; index -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - index);
    const variance = ((13 - index) % 4) * 0.6;
    const totalKwh = index === 0 ? todayUsage : Math.max(8.4, todayUsage - (index * 0.55 + variance));
    items.push({
      date: day.toISOString().slice(0, 10),
      totalKwh: round1(totalKwh),
    });
  }
  return items;
}

function syncTodayHistory(history, todayUsage) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const next = Array.isArray(history) && history.length ? history.slice(-14) : createHistory(todayUsage);
  const index = next.findIndex((item) => item.date === todayKey);
  if (index >= 0) {
    next[index] = { ...next[index], totalKwh: round1(todayUsage) };
  } else {
    next.push({ date: todayKey, totalKwh: round1(todayUsage) });
  }
  return next.slice(-14);
}

function buildTrend(range) {
  if (range === 'daily') {
    const labels = ['6a', '9a', '12p', '3p', '6p', '9p', '12a'];
    const values = labels.map((_, index) => round1(Math.max(0.5, state.metrics.liveLoadKw * (0.56 + index * 0.16) + (index % 2 ? 0.3 : 0.2))));
    return { labels, values };
  }

  if (range === 'weekly') {
    const recent = state.dailyHistory.slice(-7);
    return {
      labels: recent.map((item) => new Date(item.date).toLocaleDateString(undefined, { weekday: 'short' })),
      values: recent.map((item) => round1(item.totalKwh)),
    };
  }

  const labels = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const values = labels.map((_, index) => round1(Math.max(280, state.metrics.monthlyUsage - (5 - index) * 18 + index * 4)));
  return { labels, values };
}

function buildComparison() {
  return state.appliances
    .slice()
    .sort((left, right) => right.watts - left.watts)
    .slice(0, 6)
    .map((item) => ({
      label: `${item.room} ${item.name}`,
      watts: item.watts,
      on: item.on,
    }));
}

function buildAlerts() {
  const roomStats = calculateRoomStats(state.appliances);
  const alerts = [];

  if (state.notificationPrefs.usageLimit) {
    if (state.metrics.overLimit) {
      alerts.push({ tone: 'danger', title: 'Daily limit exceeded', detail: `${formatNumber(state.metrics.todayUsage - state.dailyLimit, 1)} kWh above the daily usage limit.` });
    } else if (state.dailyLimit - state.metrics.todayUsage < 2) {
      alerts.push({ tone: 'warn', title: 'Approaching daily limit', detail: `${formatNumber(state.dailyLimit - state.metrics.todayUsage, 1)} kWh left before the cap is crossed.` });
    }
  }

  if (state.notificationPrefs.lowVoltage && state.metrics.lowVoltage) {
    alerts.push({ tone: 'warn', title: 'Low voltage warning', detail: `Voltage has dropped to ${state.metrics.voltage} V and sensitive loads are being monitored.` });
  }

  if (state.notificationPrefs.peakHour && state.metrics.peakHour) {
    alerts.push({ tone: 'safe', title: 'Peak-hour notification', detail: `${formatNumber(state.metrics.liveLoadKw, 2)} kW is active during the high-tariff window.` });
  }

  const overloadedRooms = roomStats.filter((room) => room.overloaded);
  if (state.notificationPrefs.overload && overloadedRooms.length) {
    alerts.push({ tone: 'danger', title: 'Overload risk', detail: `${overloadedRooms.map((room) => room.name).join(', ')} has unusually high appliance demand.` });
  }

  if (!alerts.length) {
    alerts.push({ tone: 'safe', title: 'All systems normal', detail: 'No active power warnings at the moment.' });
  }

  return alerts;
}
function iconSvg(type) {
  const map = {
    fan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.1"></circle><path d="M12 3.6c2.4 0 3.8 2.9 2.4 5l-1 1.4"></path><path d="M19.1 10.5c1.1 2.1-.7 4.7-3 4.6l-1.8-.1"></path><path d="M8.1 18.6c-2.2 1-4.7-1-4.4-3.3l.2-1.7"></path></svg>',
    ac: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="6" rx="2"></rect><path d="M7 15v1"></path><path d="M12 15v3"></path><path d="M17 15v1"></path><path d="M9 18c0 1-.8 1.6-1.5 2"></path><path d="M15 18c0 1 .8 1.6 1.5 2"></path></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.2 10.4a3.8 3.8 0 1 1 7.6 0c0 1.6-.8 2.4-1.7 3.3-.6.6-.9 1.3-1 2H11c-.1-.7-.4-1.4-1-2-.9-.9-1.8-1.7-1.8-3.3Z"></path><path d="M10 18h4"></path><path d="M10.6 20.2h2.8"></path></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="10" rx="2"></rect><path d="M10 20h4"></path><path d="M12 16v4"></path></svg>',
    fridge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="4" width="10" height="16" rx="2"></rect><path d="M9.5 8h5"></path><path d="M12 17h.01"></path></svg>',
  };
  return map[type] || map.fridge;
}

function chartMarkup(title, description, trend, tone) {
  const maxValue = Math.max(...trend.values, 1);
  return `
    <article class="chart-card panel">
      <div class="chart-head">
        <span class="eyebrow">${escapeHtml(title)}</span>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="chart-body">
        ${trend.values.map((value, index) => {
          const height = Math.max(12, (value / maxValue) * 100);
          return `
            <div class="chart-bar">
              <span class="chart-value">${escapeHtml(String(value))}</span>
              <div class="chart-track">
                <div class="chart-fill ${escapeHtml(tone || '')}" style="height:${height}%"></div>
              </div>
              <span class="chart-label">${escapeHtml(String(trend.labels[index]))}</span>
            </div>
          `;
        }).join('')}
      </div>
    </article>
  `;
}

function metricCard(label, value, note, tone) {
  return `
    <article class="metric-card ${tone ? escapeHtml(tone) : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function applianceMarkup(device) {
  return `
    <button type="button" class="appliance-card ${device.on ? 'on' : 'off'} ${device.highUsage ? 'high' : ''}" data-device-id="${escapeHtml(device.deviceId)}">
      <span class="icon-chip">${iconSvg(device.type)}</span>
      <span class="appliance-copy">
        <strong>${escapeHtml(device.name)}</strong>
        <small>${escapeHtml(String(device.watts))}W</small>
      </span>
      <span class="toggle-chip ${device.on ? 'on' : 'off'}">${device.on ? 'ON' : 'OFF'}</span>
    </button>
  `;
}

function roomMarkup(room) {
  return `
    <article class="room-card ${state.selectedRoom === room.name ? 'selected' : ''}" data-room="${escapeHtml(room.name)}">
      ${room.overloaded ? '<span class="room-warning">!</span>' : ''}
      <div class="room-head">
        <div>
          <h4>${escapeHtml(room.name)}</h4>
          <p>${escapeHtml(String(room.activeWatts))}W active load</p>
        </div>
        <span class="room-status ${room.overloaded ? 'danger' : 'safe'}">${room.overloaded ? 'Overload' : 'Stable'}</span>
      </div>
      <div class="room-appliances">
        ${room.devices.map((device) => applianceMarkup(device)).join('')}
      </div>
    </article>
  `;
}

function renderHomeScreen() {
  const roomStats = calculateRoomStats(state.appliances);
  const selectedRoom = roomStats.find((room) => room.name === state.selectedRoom) || roomStats[0];
  const alerts = buildAlerts();
  const todayLeft = Math.max(0, state.dailyLimit - state.metrics.todayUsage);
  const progress = Math.min(100, (state.metrics.todayUsage / state.dailyLimit) * 100);
  const highWarning = roomStats.some((room) => room.overloaded);

  $('screen-home').innerHTML = `
    <div class="hero-layout">
      <article class="hero-card panel">
        <div class="hero-value">
          <span class="eyebrow">Realtime monitoring</span>
          <h3>${formatNumber(state.metrics.liveLoadKw, 2)} kW live load</h3>
          <p>${formatNumber(state.metrics.todayUsage, 1)} kWh used today from smart meter and IoT sensor telemetry.</p>
        </div>
        <div class="hero-side">
          <strong>${state.metrics.activeDevices}</strong>
          <span>devices active</span>
        </div>
      </article>

      <article class="limit-card panel">
        <span class="eyebrow">Smart daily usage</span>
        <h3>${formatNumber(todayLeft, 1)} kWh left</h3>
        <p>${state.metrics.overLimit ? `${formatNumber(state.metrics.todayUsage - state.dailyLimit, 1)} kWh above the smart limit.` : `${formatNumber(progress, 0)}% of the daily budget already used.`}</p>
        <div class="limit-progress"><span style="width:${progress}%"></span></div>
        <div class="limit-stats">
          ${metricCard('Today', `${formatNumber(state.metrics.todayUsage, 1)} kWh`, 'Live tracked usage')}
          ${metricCard('Monthly bill', formatCurrency(state.metrics.billEstimate), 'Projected estimate')}
        </div>
      </article>
    </div>

    <div class="metrics-grid">
      ${metricCard('Voltage', `${state.metrics.voltage} V`, 'Live line reading')}
      ${metricCard('Current', `${formatNumber(state.metrics.current, 1)} A`, 'Main supply')}
      ${metricCard('Today', `${formatNumber(state.metrics.todayUsage, 1)} kWh`, 'Tracked today')}
      ${metricCard('This week', `${formatNumber(state.metrics.weeklyUsage, 1)} kWh`, 'Rolling 7-day total')}
      ${metricCard('This month', `${formatNumber(state.metrics.monthlyUsage, 1)} kWh`, 'Projected monthly use')}
      ${metricCard('Sync status', state.saveStatus, 'Backend save state', state.saveStatus === 'Offline' ? 'danger' : '')}
    </div>

    <article class="map-card panel">
      <div class="map-head">
        <div>
          <span class="eyebrow">2D House Map</span>
          <h3>Top-view appliance layout</h3>
          <p>Tap a room to inspect total usage. Tap any appliance to switch it ON or OFF.</p>
        </div>
        <span class="pill ${highWarning ? 'danger' : 'safe'}">${highWarning ? 'Warning active' : 'Normal load'}</span>
      </div>

      <div class="summary-grid">
        ${metricCard('Selected room', selectedRoom.name, `${selectedRoom.activeWatts}W active`)}
        ${metricCard('Room devices ON', selectedRoom.activeCount, selectedRoom.overloaded ? 'Above room threshold' : 'Within safe threshold')}
      </div>

      <div class="house-map">
        ${roomStats.map((room) => roomMarkup(room)).join('')}
      </div>
    </article>

    <div class="two-column">
      <article class="alerts-card panel">
        <div class="card-head">
          <div>
            <span class="eyebrow">Alerts</span>
            <h3>Power notifications</h3>
            <p>Warnings for overuse, low voltage, peak hours, and overload conditions.</p>
          </div>
        </div>
        <div class="notifications-grid">
          ${alerts.map((alert) => `
            <article class="notification-card ${escapeHtml(alert.tone)}">
              <div class="modal-copy">
                <strong>${escapeHtml(alert.title)}</strong>
                <span>${escapeHtml(alert.detail)}</span>
              </div>
              <span class="pill ${escapeHtml(alert.tone)}">${escapeHtml(alert.tone === 'danger' ? 'Critical' : alert.tone === 'warn' ? 'Warning' : 'Info')}</span>
            </article>
          `).join('')}
        </div>
      </article>

      ${chartMarkup('Hourly graph', 'Realtime load behavior across the day.', buildTrend('daily'), '')}
    </div>
  `;
}

function renderDevicesScreen() {
  const roomStats = calculateRoomStats(state.appliances);
  const selectedRoom = roomStats.find((room) => room.name === state.selectedRoom) || roomStats[0];

  $('screen-devices').innerHTML = `
    <div class="device-layout">
      <article class="devices-card panel">
        <div class="card-head">
          <div>
            <span class="eyebrow">Selected room</span>
            <h3>${escapeHtml(selectedRoom.name)}</h3>
            <p>Remote control and current electricity demand for the active room.</p>
          </div>
        </div>
        <div class="summary-grid">
          ${metricCard('Live room load', `${formatNumber(selectedRoom.activeLoadKw, 2)} kW`, `${selectedRoom.activeWatts}W in use`)}
          ${metricCard('Devices ON', selectedRoom.activeCount, selectedRoom.overloaded ? 'Needs attention' : 'Normal operation')}
        </div>
        <div class="list-stack">
          ${selectedRoom.devices.map((device) => `
            <article class="room-device-row">
              <div class="modal-copy">
                <strong>${escapeHtml(device.name)}</strong>
                <span>${escapeHtml(String(device.watts))}W appliance rating</span>
              </div>
              <button type="button" class="toggle-button" data-device-id="${escapeHtml(device.deviceId)}">${device.on ? 'Turn OFF' : 'Turn ON'}</button>
            </article>
          `).join('')}
        </div>
      </article>

      <article class="map-card panel">
        <div class="map-head">
          <div>
            <span class="eyebrow">Remote control</span>
            <h3>Room-wise appliance map</h3>
            <p>High energy devices are highlighted so users can identify power-heavy loads quickly.</p>
          </div>
          <span class="pill safe">Green = ON</span>
        </div>
        <div class="house-map">
          ${roomStats.map((room) => roomMarkup(room)).join('')}
        </div>
      </article>
    </div>
  `;
}
function renderAnalyticsScreen() {
  const comparison = buildComparison();

  $('screen-analytics').innerHTML = `
    <div class="analytics-layout">
      <div class="chart-grid">
        ${chartMarkup('Daily graph', 'Short-interval electricity demand.', buildTrend('daily'), '')}
        ${chartMarkup('Weekly graph', 'Last 7 days of tracked usage.', buildTrend('weekly'), 'lime')}
        ${chartMarkup('Monthly graph', 'Projected monthly demand profile.', buildTrend('monthly'), 'amber')}
      </div>

      <div class="analytics-top">
        <article class="bill-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Bill estimation</span>
              <h3>${formatCurrency(state.metrics.billEstimate)}</h3>
              <p>Estimated bill based on current usage simulation and monthly projection.</p>
            </div>
          </div>
          <div class="summary-grid">
            ${metricCard('Monthly usage', `${formatNumber(state.metrics.monthlyUsage, 1)} kWh`, 'Projected this month')}
            ${metricCard('Peak hour', state.metrics.peakHour ? 'Active' : 'Idle', '6 PM to 10 PM window')}
          </div>
        </article>

        <article class="analytics-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Appliance comparison</span>
              <h3>Highest watt devices</h3>
              <p>Use this ranking to identify the appliances contributing the most load.</p>
            </div>
          </div>
          <div class="list-stack">
            ${comparison.map((item) => `
              <article class="rank-row">
                <div class="rank-copy">
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>${item.on ? 'Currently ON' : 'Currently OFF'}</span>
                </div>
                <span class="pill ${item.on ? 'safe' : 'warn'}">${escapeHtml(String(item.watts))}W</span>
              </article>
            `).join('')}
          </div>
        </article>
      </div>

      <article class="analytics-card panel">
        <div class="card-head">
          <div>
            <span class="eyebrow">Daily tracking</span>
            <h3>Recent usage history</h3>
            <p>Saved electricity history is updated every time the live profile changes.</p>
          </div>
        </div>
        <div class="history-grid">
          ${state.dailyHistory.slice().reverse().map((entry) => `
            <article class="history-row">
              <strong>${escapeHtml(entry.date)}</strong>
              <span>${escapeHtml(String(entry.totalKwh))} kWh</span>
            </article>
          `).join('')}
        </div>
      </article>
    </div>
  `;
}

function renderSettingsScreen() {
  $('screen-settings').innerHTML = `
    <div class="settings-layout">
      <div class="settings-grid">
        <article class="settings-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Preferences</span>
              <h3>Smart limits and theme</h3>
              <p>Set a daily usage limit and switch between dark and light mode.</p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-copy">
              <strong>Daily usage limit</strong>
              <span>${escapeHtml(String(state.dailyLimit))} kWh</span>
            </div>
            <input id="daily-limit-range" type="range" min="10" max="60" value="${escapeHtml(String(state.dailyLimit))}" />
          </div>

          <button type="button" id="theme-toggle-setting" class="setting-row">
            <div class="setting-copy">
              <strong>${state.darkMode ? 'Dark mode enabled' : 'Light mode enabled'}</strong>
              <span>Switch the app appearance across mobile and desktop layouts.</span>
            </div>
            <span class="setting-switch ${state.darkMode ? 'on' : 'off'}">${state.darkMode ? 'On' : 'Off'}</span>
          </button>
        </article>

        <article class="settings-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Notification settings</span>
              <h3>Alert preferences</h3>
              <p>Choose which alerts remain active in the interface.</p>
            </div>
          </div>
          <div class="list-stack">
            ${Object.keys(notificationLabels).map((key) => `
              <button type="button" class="setting-row" data-pref-key="${escapeHtml(key)}">
                <div class="setting-copy">
                  <strong>${escapeHtml(notificationLabels[key])}</strong>
                  <span>${state.notificationPrefs[key] ? 'Enabled' : 'Disabled'}</span>
                </div>
                <span class="setting-switch ${state.notificationPrefs[key] ? 'on' : 'off'}">${state.notificationPrefs[key] ? 'On' : 'Off'}</span>
              </button>
            `).join('')}
          </div>
        </article>
      </div>

      <div class="two-column">
        <article class="data-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">IoT integration</span>
              <h3>Connected objects</h3>
              <p>Hardware components and linked devices used for measurement and sync.</p>
            </div>
          </div>
          <div class="chip-grid">
            ${iotObjects.map((item) => `<span class="data-chip">${escapeHtml(item)}</span>`).join('')}
          </div>
        </article>

        <article class="access-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">User access</span>
              <h3>${escapeHtml(state.user.name)}</h3>
              <p>${escapeHtml(state.user.email)}</p>
            </div>
          </div>
          <div class="access-grid">
            ${accessMembers.map((member) => `
              <article class="feature-card">
                <strong>${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(member.role)} - ${escapeHtml(member.access)}</span>
              </article>
            `).join('')}
          </div>
        </article>
      </div>
    </div>
  `;
}

function updateProfileChrome() {
  $('profile-name').textContent = state.user ? state.user.name : 'Primary User';
  $('profile-email').textContent = state.user ? state.user.email : 'user@example.com';
  $('deployment-label').textContent = 'Home users';
  $('sync-status').textContent = state.saveStatus;
  $('theme-toggle').textContent = state.darkMode ? 'Light mode' : 'Dark mode';
}

function applyTheme() {
  document.body.classList.toggle('theme-dark', state.darkMode);
  document.body.classList.toggle('theme-light', !state.darkMode);
}

function showGlobalMessage(message, type) {
  const el = $('global-message');
  if (!message) {
    el.className = 'form-message hidden';
    el.textContent = '';
    return;
  }
  el.className = `form-message ${type || 'success'}`;
  el.textContent = message;
}

function openRoomModal(roomName) {
  const roomStats = calculateRoomStats(state.appliances);
  const room = roomStats.find((item) => item.name === roomName);
  if (!room) {
    return;
  }

  $('modal-room-title').textContent = room.name;
  $('modal-room-copy').textContent = `${room.activeWatts}W active load across ${room.activeCount} running appliances.`;
  $('modal-room-metrics').innerHTML = `
    ${metricCard('Live load', `${formatNumber(room.activeLoadKw, 2)} kW`, 'Current room usage')}
    ${metricCard('Devices ON', room.activeCount, room.overloaded ? 'Over threshold' : 'Within threshold')}
  `;
  $('modal-room-devices').innerHTML = room.devices.map((device) => `
    <article class="room-device-row">
      <div class="modal-copy">
        <strong>${escapeHtml(device.name)}</strong>
        <span>${escapeHtml(String(device.watts))}W</span>
      </div>
      <span class="pill ${device.on ? 'safe' : 'danger'}">${device.on ? 'ON' : 'OFF'}</span>
    </article>
  `).join('');
  $('room-modal').classList.remove('hidden');
}

function closeRoomModal() {
  $('room-modal').classList.add('hidden');
}

function setActiveTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.nav-button, .mobile-nav-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('hidden', screen.id !== `screen-${tab}`);
  });
}

function render() {
  applyTheme();
  updateProfileChrome();
  renderHomeScreen();
  renderDevicesScreen();
  renderAnalyticsScreen();
  renderSettingsScreen();
  setActiveTab(state.activeTab);
  attachDynamicHandlers();
}
function attachDynamicHandlers() {
  document.querySelectorAll('[data-room]').forEach((element) => {
    element.addEventListener('click', () => {
      state.selectedRoom = element.dataset.room;
      render();
      openRoomModal(state.selectedRoom);
    });
  });

  document.querySelectorAll('[data-device-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleDevice(button.dataset.deviceId);
    });
  });

  const dailyLimitRange = $('daily-limit-range');
  if (dailyLimitRange) {
    dailyLimitRange.addEventListener('input', (event) => {
      state.dailyLimit = Number(event.target.value);
      state.metrics = computeMetrics(state.appliances, state.metrics, state.dailyLimit);
      state.dailyHistory = syncTodayHistory(state.dailyHistory, state.metrics.todayUsage);
      render();
      scheduleSave();
    });
  }

  const themeToggleSetting = $('theme-toggle-setting');
  if (themeToggleSetting) {
    themeToggleSetting.addEventListener('click', () => {
      state.darkMode = !state.darkMode;
      render();
      scheduleSave();
    });
  }

  document.querySelectorAll('[data-pref-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.prefKey;
      state.notificationPrefs[key] = !state.notificationPrefs[key];
      render();
    });
  });
}

function showAuth() {
  $('auth-view').classList.remove('hidden');
  $('app-view').classList.add('hidden');
  stopLiveUpdates();
}

function showApp() {
  $('auth-view').classList.add('hidden');
  $('app-view').classList.remove('hidden');
  render();
  startLiveUpdates();
}

async function apiRequest(path, options) {
  const requestOptions = options || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, requestOptions.headers || {});
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method: requestOptions.method || 'GET',
      headers,
      body: requestOptions.body,
    });
  } catch (error) {
    throw new Error(friendlyFetchError(error));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}


function startLiveUpdates() {
  stopLiveUpdates();
  liveIntervalId = setInterval(() => {
    state.metrics = computeMetrics(state.appliances, state.metrics, state.dailyLimit);
    state.dailyHistory = syncTodayHistory(state.dailyHistory, state.metrics.todayUsage);
    render();
    scheduleSave();
  }, LIVE_INTERVAL);
}

function stopLiveUpdates() {
  if (liveIntervalId) {
    clearInterval(liveIntervalId);
    liveIntervalId = null;
  }
}

function scheduleSave() {
  if (!state.token) {
    return;
  }

  clearTimeout(saveTimerId);
  state.saveStatus = 'Syncing';
  updateProfileChrome();

  saveTimerId = setTimeout(async () => {
    try {
      await apiRequest('/save-usage', {
        method: 'POST',
        body: JSON.stringify({
          metrics: state.metrics,
          appliances: state.appliances.map((item) => ({
            deviceId: item.deviceId,
            room: item.room,
            name: item.name,
            type: item.type,
            watts: item.watts,
            on: item.on,
            highUsage: item.highUsage,
          })),
          dailyHistory: state.dailyHistory,
          settings: {
            dailyLimit: state.dailyLimit,
            darkMode: state.darkMode,
          },
        }),
      });
      state.saveStatus = 'Live';
      updateProfileChrome();
    } catch (_error) {
      state.saveStatus = 'Offline';
      updateProfileChrome();
    }
  }, SAVE_DELAY);
}

function toggleDevice(deviceId) {
  state.appliances = state.appliances.map((item) => (item.deviceId === deviceId ? { ...item, on: !item.on } : item));
  state.metrics = computeMetrics(state.appliances, state.metrics, state.dailyLimit);
  state.dailyHistory = syncTodayHistory(state.dailyHistory, state.metrics.todayUsage);
  render();
  scheduleSave();
}

async function hydrateUsage() {
  const usage = await apiRequest('/usage-data');
  const merged = mergeAppliances(usage.appliances);
  state.appliances = merged;
  state.dailyLimit = usage.settings && usage.settings.dailyLimit ? Number(usage.settings.dailyLimit) : 28;
  state.darkMode = usage.settings ? usage.settings.darkMode !== false : true;
  state.metrics = usage.latestMetrics && usage.latestMetrics.todayUsage
    ? { ...usage.latestMetrics, activeDevices: merged.filter((item) => item.on).length }
    : computeMetrics(merged, null, state.dailyLimit);
  state.dailyHistory = Array.isArray(usage.dailyHistory) && usage.dailyHistory.length
    ? syncTodayHistory(usage.dailyHistory, state.metrics.todayUsage)
    : createHistory(state.metrics.todayUsage);
}

async function completeAuth(result) {
  state.token = result.token;
  state.user = result.user;
  state.dailyLimit = result.settings && result.settings.dailyLimit ? Number(result.settings.dailyLimit) : 28;
  state.darkMode = result.settings ? result.settings.darkMode !== false : true;
  storageSave({ token: state.token, user: state.user });
  await hydrateUsage();
  state.saveStatus = 'Live';
  showGlobalMessage('Authentication successful. Your dashboard is now active.', 'success');
  showApp();
}

async function restoreSession() {
  const stored = storageLoad();
  if (!stored || !stored.token) {
    state.appliances = createDefaultAppliances();
    state.metrics = computeMetrics(state.appliances, null, state.dailyLimit);
    state.dailyHistory = createHistory(state.metrics.todayUsage);
    showAuth();
    return;
  }

  try {
    state.token = stored.token;
    const data = await apiRequest('/user-data');
    state.user = data.user;
    state.dailyLimit = data.settings && data.settings.dailyLimit ? Number(data.settings.dailyLimit) : 28;
    state.darkMode = data.settings ? data.settings.darkMode !== false : true;
    await hydrateUsage();
    state.saveStatus = 'Live';
    showApp();
  } catch (error) {
    storageClear();
    state.token = null;
    state.user = null;
    state.appliances = createDefaultAppliances();
    state.metrics = computeMetrics(state.appliances, null, state.dailyLimit);
    state.dailyHistory = createHistory(state.metrics.todayUsage);
    showAuth();
    $('login-error').className = 'form-message error';
    $('login-error').textContent = friendlyFetchError(error);
  }
}

function setAuthTab(tab) {
  state.activeAuthTab = tab;
  document.querySelectorAll('.auth-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.authTab === tab);
  });
  $('login-form').classList.toggle('hidden', tab !== 'login');
  $('signup-form').classList.toggle('hidden', tab !== 'signup');
}

function clearAuthMessages() {
  ['login-error', 'signup-error'].forEach((id) => {
    $(id).className = 'form-message hidden';
    $(id).textContent = '';
  });
}

function setFormLoading(form, isLoading, busyLabel) {
  const submitButton = form.querySelector('button[type="submit"]');
  if (!submitButton) {
    return;
  }

  if (!submitButton.dataset.defaultLabel) {
    submitButton.dataset.defaultLabel = submitButton.textContent;
  }

  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? busyLabel : submitButton.dataset.defaultLabel;
}

async function handleLogin(event) {
  event.preventDefault();
  clearAuthMessages();
  const form = event.currentTarget;
  const formData = new FormData(form);
  setFormLoading(form, true, 'Logging in...');
  try {
    const result = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });
    await completeAuth(result);
  } catch (error) {
    $('login-error').className = 'form-message error';
    $('login-error').textContent = friendlyFetchError(error);
  } finally {
    setFormLoading(form, false, 'Logging in...');
  }
}

async function handleSignup(event) {
  event.preventDefault();
  clearAuthMessages();
  const form = event.currentTarget;
  const formData = new FormData(form);
  setFormLoading(form, true, 'Creating account...');
  try {
    const result = await apiRequest('/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });
    await completeAuth(result);
  } catch (error) {
    $('signup-error').className = 'form-message error';
    $('signup-error').textContent = friendlyFetchError(error);
  } finally {
    setFormLoading(form, false, 'Creating account...');
  }
}

function handleLogout() {
  storageClear();
  clearTimeout(saveTimerId);
  stopLiveUpdates();
  state.token = null;
  state.user = null;
  state.appliances = createDefaultAppliances();
  state.metrics = computeMetrics(state.appliances, null, state.dailyLimit);
  state.dailyHistory = createHistory(state.metrics.todayUsage);
  showGlobalMessage('', '');
  showAuth();
}

function registerStaticHandlers() {
  document.querySelectorAll('.auth-tab').forEach((button) => {
    button.addEventListener('click', () => setAuthTab(button.dataset.authTab));
  });

  $('login-form').addEventListener('submit', handleLogin);
  $('signup-form').addEventListener('submit', handleSignup);
  $('logout-button').addEventListener('click', handleLogout);
  $('theme-toggle').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    render();
    scheduleSave();
  });

  document.querySelectorAll('.nav-button, .mobile-nav-button').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  document.querySelectorAll('[data-close-modal="true"]').forEach((button) => {
    button.addEventListener('click', closeRoomModal);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  registerStaticHandlers();
  setAuthTab('login');
  restoreSession().catch((error) => {
    showAuth();
    $('login-error').className = 'form-message error';
    $('login-error').textContent = friendlyFetchError(error);
  });
});




const MAP_GRID_COLS = 12;
const MAP_GRID_ROWS = 10;
const ROOM_LIBRARY = [
  { key: 'living', label: 'Living Room', threshold: 2200 },
  { key: 'bedroom', label: 'Bedroom', threshold: 1800 },
  { key: 'kitchen', label: 'Kitchen', threshold: 1700 },
  { key: 'bathroom', label: 'Bathroom', threshold: 1000 },
  { key: 'custom', label: 'Custom Room', threshold: 1600 },
];
const DEVICE_LIBRARY = [
  { type: 'fan', name: 'Fan', watts: 75, dailyHours: 8.2 },
  { type: 'ac', name: 'AC', watts: 1450, dailyHours: 4.5 },
  { type: 'light', name: 'Light', watts: 90, dailyHours: 6.5 },
  { type: 'tv', name: 'TV', watts: 180, dailyHours: 5.2 },
  { type: 'fridge', name: 'Refrigerator', watts: 220, dailyHours: 18.5 },
];
const DEFAULT_ROOM_LAYOUT = [
  { type: 'living', name: 'Living Room', x: 0, y: 0, w: 7, h: 4 },
  { type: 'bedroom', name: 'Bedroom', x: 7, y: 0, w: 5, h: 4 },
  { type: 'kitchen', name: 'Kitchen', x: 0, y: 4, w: 6, h: 6 },
  { type: 'bathroom', name: 'Bathroom', x: 6, y: 4, w: 6, h: 6 },
];
const FALLBACK_LAYOUT_SLOTS = [
  { x: 0, y: 0, w: 6, h: 4 },
  { x: 6, y: 0, w: 6, h: 4 },
  { x: 0, y: 4, w: 6, h: 3 },
  { x: 6, y: 4, w: 6, h: 3 },
  { x: 0, y: 7, w: 6, h: 3 },
  { x: 6, y: 7, w: 6, h: 3 },
];
const DEFAULT_NOTIFICATIONS = {
  usageLimit: true,
  lowVoltage: true,
  peakHour: true,
  overload: true,
};
const SETUP_STEPS = [
  { id: 1, title: 'Draw rooms', note: 'Create a floor-plan layout.' },
  { id: 2, title: 'Place devices', note: 'Add appliances into rooms.' },
  { id: 3, title: 'Review', note: 'Save and open the dashboard.' },
];

Object.assign(state, {
  currentView: 'auth',
  rooms: [],
  setupCompleted: false,
  setupStep: 1,
  setupRoomType: 'living',
  setupCustomRoomName: 'Study',
  setupSelectedRoomId: null,
  setupInteraction: null,
  setupDraft: null,
  setupMessage: '',
  deferredInstallPrompt: null,
  installAvailable: false,
  offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
});
state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS, state.notificationPrefs || {});

function uid(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getRoomTemplate(type) {
  return ROOM_LIBRARY.find((item) => item.key === type) || ROOM_LIBRARY[ROOM_LIBRARY.length - 1];
}

function getDeviceTemplate(type) {
  return DEVICE_LIBRARY.find((item) => item.type === type) || DEVICE_LIBRARY[0];
}

function roomThreshold(type) {
  return getRoomTemplate(type).threshold;
}

function uniqueRoomName(baseName, roomList, ignoreId) {
  const taken = (roomList || []).filter((room) => room.id !== ignoreId).map((room) => room.name.toLowerCase());
  if (!taken.includes(String(baseName).toLowerCase())) {
    return baseName;
  }
  let index = 2;
  while (taken.includes(`${String(baseName).toLowerCase()} ${index}`)) {
    index += 1;
  }
  return `${baseName} ${index}`;
}

function defaultDevicePlacement(type, count) {
  const placements = {
    fan: [0.24, 0.34],
    ac: [0.74, 0.28],
    light: [0.5, 0.18],
    tv: [0.33, 0.72],
    fridge: [0.72, 0.72],
  };
  const fallback = placements[type] || [0.5, 0.5];
  const nudge = Math.min(count * 0.05, 0.14);
  return {
    xPct: clamp(fallback[0] + (count % 2 ? nudge : -nudge * 0.35), 0.16, 0.84),
    yPct: clamp(fallback[1] + (count > 1 ? nudge * 0.5 : 0), 0.18, 0.84),
  };
}

function createRoom(payload) {
  const type = payload.type || 'custom';
  return {
    id: payload.id || uid('room'),
    type,
    name: payload.name || getRoomTemplate(type).label,
    x: clamp(Math.round(Number(payload.x) || 0), 0, MAP_GRID_COLS - 1),
    y: clamp(Math.round(Number(payload.y) || 0), 0, MAP_GRID_ROWS - 1),
    w: clamp(Math.round(Number(payload.w) || 3), 2, MAP_GRID_COLS),
    h: clamp(Math.round(Number(payload.h) || 2), 2, MAP_GRID_ROWS),
    threshold: Number(payload.threshold) || roomThreshold(type),
  };
}

function createDefaultRooms() {
  return DEFAULT_ROOM_LAYOUT.map((item) => createRoom(item));
}

function createRoomsFromLegacyAppliances(savedAppliances) {
  const names = Array.from(new Set((savedAppliances || []).map((item) => String(item.room || '').trim()).filter(Boolean)));
  return names.map((name, index) => {
    const known = DEFAULT_ROOM_LAYOUT.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const slot = known || FALLBACK_LAYOUT_SLOTS[index % FALLBACK_LAYOUT_SLOTS.length];
    const type = known ? known.type : 'custom';
    return createRoom({
      id: `legacy-${slugify(name)}`,
      type,
      name,
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: slot.h,
      threshold: roomThreshold(type),
    });
  });
}

function normalizeRooms(savedRooms, savedAppliances) {
  if (Array.isArray(savedRooms) && savedRooms.length) {
    return savedRooms.map((room) => createRoom(room));
  }
  if (Array.isArray(savedAppliances) && savedAppliances.length) {
    return createRoomsFromLegacyAppliances(savedAppliances);
  }
  return [];
}

function syncRoomSelections() {
  if (!state.rooms.length) {
    state.selectedRoom = null;
    state.setupSelectedRoomId = null;
    return;
  }
  if (!state.selectedRoom || !state.rooms.some((room) => room.id === state.selectedRoom)) {
    state.selectedRoom = state.rooms[0].id;
  }
  if (!state.setupSelectedRoomId || !state.rooms.some((room) => room.id === state.setupSelectedRoomId)) {
    state.setupSelectedRoomId = state.rooms[0].id;
  }
}

function createDevice(payload, indexInRoom) {
  const template = getDeviceTemplate(payload.type);
  const placement = payload.xPct != null && payload.yPct != null
    ? { xPct: Number(payload.xPct), yPct: Number(payload.yPct) }
    : defaultDevicePlacement(payload.type, indexInRoom || 0);
  return {
    deviceId: payload.deviceId || uid('device'),
    roomId: payload.roomId || '',
    room: payload.room || '',
    name: payload.name || template.name,
    type: payload.type || template.type,
    watts: Number(payload.watts) || template.watts,
    dailyHours: Number(payload.dailyHours) || template.dailyHours,
    on: payload.on !== false,
    highUsage: Number(payload.watts) >= 1000 || Boolean(payload.highUsage),
    xPct: clamp(Number(placement.xPct), 0.16, 0.84),
    yPct: clamp(Number(placement.yPct), 0.18, 0.84),
  };
}

function createDefaultAppliances(roomList) {
  const activeRooms = Array.isArray(roomList) && roomList.length ? roomList : createDefaultRooms();
  const roomMap = Object.fromEntries(activeRooms.map((room) => [room.name, room]));
  const roomCounts = {};
  return applianceBlueprints
    .map((item) => {
      const room = roomMap[item.room];
      if (!room) {
        return null;
      }
      roomCounts[room.id] = roomCounts[room.id] || 0;
      const device = createDevice({
        deviceId: `${slugify(item.room)}-${slugify(item.name)}`,
        roomId: room.id,
        room: room.name,
        name: item.name,
        type: item.type,
        watts: item.watts,
        dailyHours: item.dailyHours,
        on: item.on,
        highUsage: item.watts >= 1000,
      }, roomCounts[room.id]);
      roomCounts[room.id] += 1;
      return device;
    })
    .filter(Boolean);
}

function mergeAppliances(savedAppliances) {
  const roomList = Array.isArray(state.rooms) ? state.rooms : [];
  if (!Array.isArray(savedAppliances) || !savedAppliances.length) {
    if (!state.setupCompleted) {
      return [];
    }
    if (!roomList.length) {
      return [];
    }
    return createDefaultAppliances(roomList);
  }

  const roomById = Object.fromEntries(roomList.map((room) => [room.id, room]));
  const roomByName = Object.fromEntries(roomList.map((room) => [room.name.toLowerCase(), room]));
  const roomCounts = {};

  return savedAppliances.map((item) => {
    const matchedRoom = roomById[item.roomId] || roomByName[String(item.room || '').toLowerCase()] || roomList[0] || null;
    if (matchedRoom) {
      roomCounts[matchedRoom.id] = roomCounts[matchedRoom.id] || 0;
    }
    const device = createDevice({
      deviceId: item.deviceId,
      roomId: matchedRoom ? matchedRoom.id : String(item.roomId || ''),
      room: matchedRoom ? matchedRoom.name : String(item.room || ''),
      name: item.name,
      type: item.type,
      watts: item.watts,
      dailyHours: item.dailyHours,
      on: item.on,
      highUsage: item.highUsage,
      xPct: item.xPct,
      yPct: item.yPct,
    }, matchedRoom ? roomCounts[matchedRoom.id] : 0);
    if (matchedRoom) {
      roomCounts[matchedRoom.id] += 1;
    }
    return device;
  });
}

function getRoomById(roomId) {
  return state.rooms.find((room) => room.id === roomId) || null;
}

function roomDisplayName(roomId) {
  const room = getRoomById(roomId);
  return room ? room.name : 'Room';
}

function calculateRoomStats(appliances) {
  return (state.rooms || []).map((room) => {
    const devices = (appliances || []).filter((item) => item.roomId === room.id);
    const activeWatts = devices.filter((item) => item.on).reduce((sum, item) => sum + item.watts, 0);
    return {
      ...room,
      devices,
      activeWatts,
      activeLoadKw: round2(activeWatts / 1000),
      activeCount: devices.filter((item) => item.on).length,
      overloaded: activeWatts > Number(room.threshold || roomThreshold(room.type)),
    };
  });
}

function getSelectedRoomStats(roomStats) {
  if (!roomStats.length) {
    return null;
  }
  return roomStats.find((room) => room.id === state.selectedRoom) || roomStats[0];
}

function buildComparison() {
  return state.appliances
    .slice()
    .sort((left, right) => right.watts - left.watts)
    .slice(0, 6)
    .map((item) => ({
      label: `${roomDisplayName(item.roomId)} ${item.name}`,
      watts: item.watts,
      on: item.on,
    }));
}

function rectanglesOverlap(left, right) {
  return !(
    left.x + left.w <= right.x ||
    right.x + right.w <= left.x ||
    left.y + left.h <= right.y ||
    right.y + right.h <= left.y
  );
}

function canPlaceRoom(candidate, ignoreId) {
  if (candidate.x < 0 || candidate.y < 0 || candidate.x + candidate.w > MAP_GRID_COLS || candidate.y + candidate.h > MAP_GRID_ROWS) {
    return false;
  }
  return !state.rooms.some((room) => room.id !== ignoreId && rectanglesOverlap(room, candidate));
}

function roomInlineStyle(room) {
  return [
    `left:${(room.x / MAP_GRID_COLS) * 100}%`,
    `top:${(room.y / MAP_GRID_ROWS) * 100}%`,
    `width:${(room.w / MAP_GRID_COLS) * 100}%`,
    `height:${(room.h / MAP_GRID_ROWS) * 100}%`,
  ].join(';');
}

function deviceInlineStyle(device) {
  return `left:${device.xPct * 100}%;top:${device.yPct * 100}%;`;
}

function getSetupStepNote() {
  if (state.setupStep === 1) {
    return 'Select a room type, then drag across the grid to draw a clean top-view layout.';
  }
  if (state.setupStep === 2) {
    return 'Drag devices from the palette into rooms, then move them around inside each room.';
  }
  return 'Review the saved floor plan, verify device power ratings, and commit the setup.';
}

function mapDeviceMarkup(device, context) {
  const interactiveAttr = context === 'setup' ? `data-setup-device-id="${escapeHtml(device.deviceId)}"` : `data-device-id="${escapeHtml(device.deviceId)}"`;
  const contextClass = context === 'setup' ? 'setup-draggable' : 'dashboard-toggle';
  return `
    <button
      type="button"
      class="map-device ${device.on ? 'on' : 'off'} ${device.highUsage ? 'high' : ''} ${contextClass}"
      ${interactiveAttr}
      data-device-room-id="${escapeHtml(device.roomId)}"
      style="${deviceInlineStyle(device)}"
    >
      <span class="map-device-icon">${iconSvg(device.type)}</span>
      <strong>${escapeHtml(device.name)}</strong>
      <span class="device-watts">${escapeHtml(String(device.watts))}W</span>
      <span class="device-state ${device.on ? 'on' : 'off'}">${device.on ? 'ON' : 'OFF'}</span>
    </button>
  `;
}

function floorRoomMarkup(room, context) {
  const selected = context === 'setup' ? state.setupSelectedRoomId === room.id : state.selectedRoom === room.id;
  const roomDevices = room.devices || [];
  return `
    <article
      class="floor-room ${selected ? 'selected' : ''} ${room.overloaded ? 'overloaded' : ''}"
      data-room-id="${escapeHtml(room.id)}"
      data-room-drop="${context === 'setup' ? 'true' : 'false'}"
      style="${roomInlineStyle(room)}"
    >
      <div class="floor-room-title" ${context === 'setup' ? 'data-room-handle="move"' : ''}>
        <strong>${escapeHtml(room.name)}</strong>
        <span>${context === 'setup' ? `${room.w}x${room.h} grid` : `${room.activeWatts}W active`}</span>
      </div>
      ${room.overloaded ? '<span class="floor-room-warning">!</span>' : ''}
      ${context === 'setup' ? `<button type="button" class="room-resize-handle" data-room-handle="resize" data-room-id="${escapeHtml(room.id)}"></button>` : ''}
      <div class="floor-room-devices" data-room-id="${escapeHtml(room.id)}">
        ${roomDevices.map((device) => mapDeviceMarkup(device, context)).join('')}
      </div>
    </article>
  `;
}

function floorPreviewMarkup() {
  if (!state.setupDraft) {
    return '';
  }
  return `
    <article class="floor-room-preview" style="${roomInlineStyle(state.setupDraft)}">
      <div class="floor-room-title">
        <strong>${escapeHtml(state.setupDraft.name)}</strong>
        <span>${state.setupDraft.valid === false ? 'Placement invalid' : 'Preview'}</span>
      </div>
    </article>
  `;
}

function renderFloorPlan(context) {
  const roomStats = calculateRoomStats(state.appliances);
  const emptyCopy = context === 'setup'
    ? 'Choose a room type and drag across the blueprint grid to create your first room.'
    : 'No saved floor plan yet. Open Settings and run the floor-plan builder.';
  return `
    <div class="blueprint-shell">
      <div id="${context === 'setup' ? 'setup-board' : ''}" class="blueprint-board ${context === 'setup' ? 'builder' : 'readonly'}">
        ${roomStats.length ? roomStats.map((room) => floorRoomMarkup(room, context)).join('') : `
          <div class="blueprint-empty">
            <article class="setup-inline-card">
              <strong>${context === 'setup' ? 'Start with your first room' : 'No custom house map yet'}</strong>
              <span>${emptyCopy}</span>
            </article>
          </div>
        `}
        ${context === 'setup' ? floorPreviewMarkup() : ''}
      </div>
    </div>
  `;
}

function roomSummaryMetric(label, value, note) {
  return metricCard(label, value, note, '');
}

function renderHomeScreen() {
  const roomStats = calculateRoomStats(state.appliances);
  const selectedRoom = getSelectedRoomStats(roomStats);
  const alerts = buildAlerts();
  const todayLeft = Math.max(0, state.dailyLimit - state.metrics.todayUsage);
  const progress = state.dailyLimit ? Math.min(100, (state.metrics.todayUsage / state.dailyLimit) * 100) : 0;
  const highWarning = roomStats.some((room) => room.overloaded);

  $('screen-home').innerHTML = `
    <div class="hero-layout">
      <article class="hero-card panel">
        <div class="hero-value">
          <span class="eyebrow">Realtime monitoring</span>
          <h3>${formatNumber(state.metrics.liveLoadKw, 2)} kW live load</h3>
          <p>${formatNumber(state.metrics.todayUsage, 1)} kWh used today from smart meter and IoT sensor telemetry.</p>
        </div>
        <div class="hero-side">
          <strong>${state.metrics.activeDevices}</strong>
          <span>devices active</span>
        </div>
      </article>

      <article class="limit-card panel">
        <span class="eyebrow">Smart daily usage</span>
        <h3>${formatNumber(todayLeft, 1)} kWh left</h3>
        <p>${state.metrics.overLimit ? `${formatNumber(state.metrics.todayUsage - state.dailyLimit, 1)} kWh above the smart limit.` : `${formatNumber(progress, 0)}% of the daily budget already used.`}</p>
        <div class="limit-progress"><span style="width:${progress}%"></span></div>
        <div class="limit-stats">
          ${metricCard('Today', `${formatNumber(state.metrics.todayUsage, 1)} kWh`, 'Live tracked usage')}
          ${metricCard('Monthly bill', formatCurrency(state.metrics.billEstimate), 'Projected estimate')}
        </div>
      </article>
    </div>

    <div class="metrics-grid">
      ${metricCard('Voltage', `${state.metrics.voltage} V`, 'Live line reading')}
      ${metricCard('Current', `${formatNumber(state.metrics.current, 1)} A`, 'Main supply')}
      ${metricCard('Today', `${formatNumber(state.metrics.todayUsage, 1)} kWh`, 'Tracked today')}
      ${metricCard('This week', `${formatNumber(state.metrics.weeklyUsage, 1)} kWh`, 'Rolling 7-day total')}
      ${metricCard('This month', `${formatNumber(state.metrics.monthlyUsage, 1)} kWh`, 'Projected monthly use')}
      ${metricCard('Sync status', state.offline ? 'Offline shell' : state.saveStatus, state.offline ? 'Offline support active' : 'Backend save state', state.saveStatus === 'Offline' ? 'danger' : '')}
    </div>

    <article class="map-card panel map-shell-card">
      <div class="map-head">
        <div>
          <span class="eyebrow">2D House Map</span>
          <h3>Custom architectural floor plan</h3>
          <p>Tap a room to inspect total usage. Tap any appliance to switch it ON or OFF.</p>
        </div>
        <span class="pill ${highWarning ? 'danger' : 'safe'}">${highWarning ? 'Warning active' : 'Normal load'}</span>
      </div>

      <div class="summary-grid">
        ${selectedRoom ? roomSummaryMetric('Selected room', selectedRoom.name, `${selectedRoom.activeWatts}W active`) : roomSummaryMetric('Selected room', 'No rooms', 'Open Settings to build a map')}
        ${selectedRoom ? roomSummaryMetric('Room devices ON', selectedRoom.activeCount, selectedRoom.overloaded ? 'Above room threshold' : 'Within safe threshold') : roomSummaryMetric('Room devices ON', '0', 'No room selected')}
      </div>

      ${renderFloorPlan('dashboard')}
    </article>

    <div class="two-column">
      <article class="alerts-card panel">
        <div class="card-head">
          <div>
            <span class="eyebrow">Alerts</span>
            <h3>Power notifications</h3>
            <p>Warnings for overuse, low voltage, peak hours, and overload conditions.</p>
          </div>
        </div>
        <div class="notifications-grid">
          ${alerts.map((alert) => `
            <article class="notification-card ${escapeHtml(alert.tone)}">
              <div class="modal-copy">
                <strong>${escapeHtml(alert.title)}</strong>
                <span>${escapeHtml(alert.detail)}</span>
              </div>
              <span class="pill ${escapeHtml(alert.tone)}">${escapeHtml(alert.tone === 'danger' ? 'Critical' : alert.tone === 'warn' ? 'Warning' : 'Info')}</span>
            </article>
          `).join('')}
        </div>
      </article>

      ${chartMarkup('Hourly graph', 'Realtime load behavior across the day.', buildTrend('daily'), '')}
    </div>
  `;
}

function renderDevicesScreen() {
  const roomStats = calculateRoomStats(state.appliances);
  const selectedRoom = getSelectedRoomStats(roomStats);
  const selectedDevices = selectedRoom ? selectedRoom.devices : [];

  $('screen-devices').innerHTML = `
    <div class="device-layout">
      <article class="devices-card panel">
        <div class="card-head">
          <div>
            <span class="eyebrow">Selected room</span>
            <h3>${escapeHtml(selectedRoom ? selectedRoom.name : 'No room selected')}</h3>
            <p>Remote control and current electricity demand for the active room.</p>
          </div>
        </div>
        <div class="summary-grid">
          ${selectedRoom ? metricCard('Live room load', `${formatNumber(selectedRoom.activeLoadKw, 2)} kW`, `${selectedRoom.activeWatts}W in use`) : metricCard('Live room load', '0.00 kW', 'Build a floor plan first')}
          ${selectedRoom ? metricCard('Devices ON', selectedRoom.activeCount, selectedRoom.overloaded ? 'Needs attention' : 'Normal operation') : metricCard('Devices ON', '0', 'No selected room')}
        </div>
        <div class="list-stack">
          ${selectedDevices.length ? selectedDevices.map((device) => `
            <article class="room-device-row">
              <div class="modal-copy">
                <strong>${escapeHtml(device.name)}</strong>
                <span>${escapeHtml(String(device.watts))}W appliance rating</span>
              </div>
              <button type="button" class="toggle-button" data-device-id="${escapeHtml(device.deviceId)}">${device.on ? 'Turn OFF' : 'Turn ON'}</button>
            </article>
          `).join('') : '<article class="room-device-row"><div class="modal-copy"><strong>No appliances in this room</strong><span>Add devices in the setup builder from Settings.</span></div></article>'}
        </div>
      </article>

      <article class="map-card panel map-shell-card">
        <div class="map-head">
          <div>
            <span class="eyebrow">Remote control</span>
            <h3>Room-wise appliance map</h3>
            <p>High energy devices are highlighted so users can identify power-heavy loads quickly.</p>
          </div>
          <span class="pill safe">Green = ON</span>
        </div>
        ${renderFloorPlan('dashboard')}
      </article>
    </div>
  `;
}

function renderSettingsScreen() {
  $('screen-settings').innerHTML = `
    <div class="settings-layout">
      <div class="settings-grid">
        <article class="settings-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Preferences</span>
              <h3>Smart limits and theme</h3>
              <p>Set a daily usage limit and switch between dark and light mode.</p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-copy">
              <strong>Daily usage limit</strong>
              <span>${escapeHtml(String(state.dailyLimit))} kWh</span>
            </div>
            <input id="daily-limit-range" type="range" min="10" max="60" value="${escapeHtml(String(state.dailyLimit))}" />
          </div>

          <button type="button" id="theme-toggle-setting" class="setting-row">
            <div class="setting-copy">
              <strong>${state.darkMode ? 'Dark mode enabled' : 'Light mode enabled'}</strong>
              <span>Switch the app appearance across mobile and desktop layouts.</span>
            </div>
            <span class="setting-switch ${state.darkMode ? 'on' : 'off'}">${state.darkMode ? 'On' : 'Off'}</span>
          </button>
        </article>

        <article class="settings-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Floor plan builder</span>
              <h3>House map and install</h3>
              <p>Edit your architectural layout, add more rooms, and install the tracker like an app.</p>
            </div>
          </div>
          <div class="settings-action-grid">
            <button type="button" class="setting-row" data-open-setup>
              <div class="setting-copy">
                <strong>Edit floor plan</strong>
                <span>${state.rooms.length} rooms and ${state.appliances.length} devices in the saved layout.</span>
              </div>
              <span class="setting-switch on">Open</span>
            </button>
            <button type="button" class="setting-row" data-install-app>
              <div class="setting-copy">
                <strong>Install app</strong>
                <span>Standalone icon, splash-ready shell, and offline support for the app frame.</span>
              </div>
              <span class="setting-switch ${state.installAvailable ? 'on' : 'off'}">${state.installAvailable ? 'Ready' : 'Menu'}</span>
            </button>
            <article class="install-note">
              <strong>Install guidance</strong>
              <span>Install prompts work on localhost or HTTPS. On phones over plain local Wi-Fi URLs, use the browser menu for Add to Home Screen.</span>
              <span class="pill safe">PWA upgrade included</span>
            </article>
          </div>
        </article>

        <article class="settings-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Notification settings</span>
              <h3>Alert preferences</h3>
              <p>Choose which alerts remain active in the interface.</p>
            </div>
          </div>
          <div class="list-stack">
            ${Object.keys(notificationLabels).map((key) => `
              <button type="button" class="setting-row" data-pref-key="${escapeHtml(key)}">
                <div class="setting-copy">
                  <strong>${escapeHtml(notificationLabels[key])}</strong>
                  <span>${state.notificationPrefs[key] ? 'Enabled' : 'Disabled'}</span>
                </div>
                <span class="setting-switch ${state.notificationPrefs[key] ? 'on' : 'off'}">${state.notificationPrefs[key] ? 'On' : 'Off'}</span>
              </button>
            `).join('')}
          </div>
        </article>
      </div>

      <div class="two-column">
        <article class="data-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">IoT integration</span>
              <h3>Connected objects</h3>
              <p>Hardware components and linked devices used for measurement and sync.</p>
            </div>
          </div>
          <div class="chip-grid">
            ${iotObjects.map((item) => `<span class="data-chip">${escapeHtml(item)}</span>`).join('')}
          </div>
        </article>

        <article class="access-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">User access</span>
              <h3>${escapeHtml(state.user.name)}</h3>
              <p>${escapeHtml(state.user.email)}</p>
            </div>
          </div>
          <div class="access-grid">
            ${accessMembers.map((member) => `
              <article class="feature-card">
                <strong>${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(member.role)} - ${escapeHtml(member.access)}</span>
              </article>
            `).join('')}
          </div>
        </article>
      </div>
    </div>
  `;
}

function showSetupMessage(message, type) {
  state.setupMessage = message ? { text: message, type: type || 'success' } : null;
}

function renderSetupSidebar() {
  const selectedRoom = getRoomById(state.setupSelectedRoomId);
  if (state.setupStep === 1) {
    return `
      <div class="builder-stack">
        <div class="card-head">
          <div>
            <span class="eyebrow">Rooms</span>
            <h3>Create the floor plan</h3>
            <p>Select a room type, then drag across the blueprint to draw each room.</p>
          </div>
        </div>
        <div class="palette-grid">
          ${ROOM_LIBRARY.map((room) => `
            <button type="button" class="room-type-button ${state.setupRoomType === room.key ? 'active' : ''}" data-room-type="${escapeHtml(room.key)}">${escapeHtml(room.label)}</button>
          `).join('')}
        </div>
        ${state.setupRoomType === 'custom' ? `
          <label class="setup-field">
            <span>Custom room name</span>
            <input id="custom-room-name" type="text" maxlength="24" value="${escapeHtml(state.setupCustomRoomName)}" placeholder="Study, Office, Store Room" />
          </label>
        ` : ''}
        <div class="builder-note">${escapeHtml(getSetupStepNote())}</div>
        <div class="room-line-list">
          ${state.rooms.length ? state.rooms.map((room) => `
            <button type="button" class="room-line-item ${state.setupSelectedRoomId === room.id ? 'selected' : ''}" data-select-setup-room="${escapeHtml(room.id)}">
              <strong>${escapeHtml(room.name)}</strong>
              <span>${room.w} x ${room.h} grid cells</span>
            </button>
          `).join('') : '<article class="setup-inline-card"><strong>No rooms yet</strong><span>Your custom floor plan will appear here after you draw on the grid.</span></article>'}
        </div>
        ${selectedRoom ? `
          <label class="setup-field">
            <span>Rename selected room</span>
            <input id="selected-room-name" type="text" maxlength="24" value="${escapeHtml(selectedRoom.name)}" />
          </label>
        ` : ''}
        <div class="room-line-actions">
          ${selectedRoom ? `<button type="button" class="ghost-button" data-remove-room="${escapeHtml(selectedRoom.id)}">Delete room</button>` : ''}
          <button type="button" class="ghost-button" data-clear-layout>Clear layout</button>
        </div>
      </div>
    `;
  }

  if (state.setupStep === 2) {
    const roomDevices = selectedRoom ? state.appliances.filter((device) => device.roomId === selectedRoom.id) : [];
    return `
      <div class="builder-stack">
        <div class="card-head">
          <div>
            <span class="eyebrow">Devices</span>
            <h3>Place appliances inside rooms</h3>
            <p>Drag a device into a room, then drag the device icon to fine-tune its position.</p>
          </div>
        </div>
        <div class="room-pill-grid">
          ${state.rooms.map((room) => `
            <button type="button" class="room-pill ${state.setupSelectedRoomId === room.id ? 'active' : ''}" data-select-setup-room="${escapeHtml(room.id)}">${escapeHtml(room.name)}</button>
          `).join('')}
        </div>
        <div class="device-palette">
          ${DEVICE_LIBRARY.map((device) => `
            <button type="button" data-device-template="${escapeHtml(device.type)}">
              <span class="map-device-icon">${iconSvg(device.type)}</span>
              <strong>${escapeHtml(device.name)}</strong>
              <span>${escapeHtml(String(device.watts))}W default</span>
            </button>
          `).join('')}
        </div>
        <div class="builder-note">${selectedRoom ? `Selected room: ${selectedRoom.name}.` : 'Select a room to place devices.'}</div>
        <div class="setup-device-list">
          ${roomDevices.length ? roomDevices.map((device) => `
            <article class="setup-device-row">
              <strong>${escapeHtml(device.name)}</strong>
              <span>${escapeHtml(String(device.watts))}W, ${device.on ? 'currently ON' : 'currently OFF'}</span>
              <div class="setup-inline-grid">
                <label class="inline-field">
                  <span>Watts</span>
                  <input type="number" min="10" max="5000" data-device-watts="${escapeHtml(device.deviceId)}" value="${escapeHtml(String(device.watts))}" />
                </label>
                <button type="button" class="ghost-button" data-device-toggle-setup="${escapeHtml(device.deviceId)}">${device.on ? 'Turn OFF' : 'Turn ON'}</button>
              </div>
              <button type="button" class="ghost-button" data-device-remove="${escapeHtml(device.deviceId)}">Remove device</button>
            </article>
          `).join('') : '<article class="setup-inline-card"><strong>No devices in this room</strong><span>Drag from the palette into the room or tap a palette item to add it to the room center.</span></article>'}
        </div>
      </div>
    `;
  }

  const activeRooms = calculateRoomStats(state.appliances);
  const activeOn = state.appliances.filter((device) => device.on).length;
  return `
    <div class="builder-stack">
      <div class="card-head">
        <div>
          <span class="eyebrow">Review</span>
          <h3>Save your smart home layout</h3>
          <p>Check the room blueprint, device counts, and usage assumptions before saving.</p>
        </div>
      </div>
      <div class="setup-summary-grid">
        ${metricCard('Rooms', state.rooms.length, 'Saved on the house map')}
        ${metricCard('Devices', state.appliances.length, 'Placed across rooms')}
        ${metricCard('Devices ON', activeOn, 'Realtime starting state')}
        ${metricCard('Est. bill', formatCurrency(state.metrics.billEstimate), 'Based on current device mix')}
      </div>
      <div class="room-line-list">
        ${activeRooms.map((room) => `
          <article class="room-line-item">
            <strong>${escapeHtml(room.name)}</strong>
            <span>${room.devices.length} devices, ${room.activeWatts}W active load</span>
          </article>
        `).join('')}
      </div>
      <article class="install-note">
        <strong>App-like install</strong>
        <span>You can install this tracker with a home-screen icon, standalone window, and offline shell caching.</span>
        <button type="button" class="ghost-button" data-install-app>${state.installAvailable ? 'Install app now' : 'Use browser menu on mobile'}</button>
      </article>
    </div>
  `;
}

function attachSetupHandlers() {
  const board = $('setup-board');
  if (board) {
    board.addEventListener('pointerdown', handleSetupPointerDown);
  }

  document.querySelectorAll('[data-room-type]').forEach((button) => {
    button.addEventListener('click', () => {
      state.setupRoomType = button.dataset.roomType;
      render();
    });
  });

  const customRoomName = $('custom-room-name');
  if (customRoomName) {
    customRoomName.addEventListener('input', (event) => {
      state.setupCustomRoomName = event.target.value || 'Custom Room';
    });
  }

  const selectedRoomName = $('selected-room-name');
  if (selectedRoomName) {
    selectedRoomName.addEventListener('change', (event) => {
      renameRoom(state.setupSelectedRoomId, event.target.value);
    });
  }

  document.querySelectorAll('[data-select-setup-room]').forEach((button) => {
    button.addEventListener('click', () => {
      state.setupSelectedRoomId = button.dataset.selectSetupRoom;
      if (state.setupStep > 1) {
        state.selectedRoom = button.dataset.selectSetupRoom;
      }
      render();
    });
  });

  document.querySelectorAll('[data-remove-room]').forEach((button) => {
    button.addEventListener('click', () => removeRoom(button.dataset.removeRoom));
  });

  document.querySelectorAll('[data-clear-layout]').forEach((button) => {
    button.addEventListener('click', clearLayoutBuilder);
  });

  document.querySelectorAll('[data-device-template]').forEach((button) => {
    button.addEventListener('click', () => addDeviceToSelectedRoom(button.dataset.deviceTemplate));
  });

  document.querySelectorAll('[data-device-watts]').forEach((input) => {
    input.addEventListener('change', () => updateDeviceWatts(input.dataset.deviceWatts, input.value));
  });

  document.querySelectorAll('[data-device-toggle-setup]').forEach((button) => {
    button.addEventListener('click', () => toggleDevice(button.dataset.deviceToggleSetup));
  });

  document.querySelectorAll('[data-device-remove]').forEach((button) => {
    button.addEventListener('click', () => removeDevice(button.dataset.deviceRemove));
  });

  $('setup-prev').onclick = handleSetupPrev;
  $('setup-next').onclick = handleSetupNext;
  $('setup-save').onclick = saveSetupConfiguration;
  $('setup-secondary-button').onclick = handleSetupSecondaryAction;
}

function renderSetupView() {
  syncRoomSelections();
  $('setup-title').textContent = state.setupCompleted ? 'Edit your house map' : 'Build your smart house map';
  $('setup-subtitle').textContent = state.setupCompleted
    ? 'Update the floor plan, move devices, and save the refreshed layout back into the dashboard.'
    : 'Create rooms, place appliances, and save a blueprint-style layout before opening the dashboard.';
  $('setup-canvas-title').textContent = state.setupStep === 1 ? 'Architectural room builder' : state.setupStep === 2 ? 'Device placement canvas' : 'Final blueprint review';
  $('setup-canvas-copy').textContent = getSetupStepNote();
  $('setup-hint-title').textContent = state.setupStep === 1 ? 'Draw rooms' : state.setupStep === 2 ? 'Place devices' : 'Save setup';
  $('setup-hint-copy').textContent = getSetupStepNote();
  $('setup-secondary-button').textContent = state.setupCompleted ? 'Back to dashboard' : 'Logout';

  $('setup-steps').innerHTML = SETUP_STEPS.map((step) => `
    <article class="step-chip ${state.setupStep === step.id ? 'active' : step.id < state.setupStep ? 'done' : ''}">
      <strong>${step.id}. ${escapeHtml(step.title)}</strong>
      <span>${escapeHtml(step.note)}</span>
    </article>
  `).join('');

  $('setup-canvas-shell').innerHTML = renderFloorPlan('setup');
  $('setup-sidebar').innerHTML = renderSetupSidebar();

  $('setup-prev').disabled = state.setupStep === 1;
  $('setup-next').classList.toggle('hidden', state.setupStep === 3);
  $('setup-save').classList.toggle('hidden', state.setupStep !== 3);
  $('setup-next').disabled = (state.setupStep === 1 && !state.rooms.length) || (state.setupStep === 2 && !state.appliances.length);
  $('setup-save').disabled = !state.rooms.length;

  const message = state.setupMessage;
  const setupMessage = $('setup-message');
  if (message && message.text) {
    setupMessage.className = `form-message ${message.type || 'success'}`;
    setupMessage.textContent = message.text;
  } else {
    setupMessage.className = 'form-message hidden';
    setupMessage.textContent = '';
  }

  attachSetupHandlers();
}

function updateFloorMetrics() {
  state.metrics = computeMetrics(state.appliances, state.metrics, state.dailyLimit);
  state.dailyHistory = syncTodayHistory(Array.isArray(state.dailyHistory) ? state.dailyHistory : [], state.metrics.todayUsage);
}

function renameRoom(roomId, nextName) {
  const room = getRoomById(roomId);
  if (!room) {
    return;
  }
  const trimmed = String(nextName || '').trim();
  const name = uniqueRoomName(trimmed || room.name, state.rooms, roomId);
  state.rooms = state.rooms.map((item) => (item.id === roomId ? { ...item, name } : item));
  state.appliances = state.appliances.map((device) => (device.roomId === roomId ? { ...device, room: name } : device));
  render();
}

function removeRoom(roomId) {
  state.rooms = state.rooms.filter((room) => room.id !== roomId);
  state.appliances = state.appliances.filter((device) => device.roomId !== roomId);
  syncRoomSelections();
  updateFloorMetrics();
  render();
}

function clearLayoutBuilder() {
  state.rooms = [];
  state.appliances = [];
  state.setupSelectedRoomId = null;
  state.selectedRoom = null;
  state.setupDraft = null;
  state.setupInteraction = null;
  updateFloorMetrics();
  showSetupMessage('', '');
  render();
}

function addDeviceToRoom(roomId, type, xPct, yPct) {
  const room = getRoomById(roomId);
  if (!room) {
    showSetupMessage('Select a room before adding devices.', 'error');
    render();
    return;
  }
  const template = getDeviceTemplate(type);
  const existingCount = state.appliances.filter((device) => device.roomId === roomId && device.type === type).length;
  const label = existingCount ? `${template.name} ${existingCount + 1}` : template.name;
  const placement = xPct != null && yPct != null ? { xPct, yPct } : defaultDevicePlacement(type, state.appliances.filter((device) => device.roomId === roomId).length);
  state.appliances = state.appliances.concat(createDevice({
    roomId: room.id,
    room: room.name,
    name: label,
    type,
    watts: template.watts,
    dailyHours: template.dailyHours,
    on: true,
    xPct: placement.xPct,
    yPct: placement.yPct,
  }, 0));
  state.setupSelectedRoomId = roomId;
  state.selectedRoom = roomId;
  updateFloorMetrics();
  showSetupMessage(`${label} added to ${room.name}.`, 'success');
  render();
}

function addDeviceToSelectedRoom(type) {
  if (!state.setupSelectedRoomId) {
    showSetupMessage('Select a room first, then add a device.', 'error');
    render();
    return;
  }
  addDeviceToRoom(state.setupSelectedRoomId, type, 0.5, 0.54);
}

function updateDeviceWatts(deviceId, watts) {
  const nextWatts = clamp(Number(watts) || 0, 10, 5000);
  state.appliances = state.appliances.map((device) => (
    device.deviceId === deviceId
      ? { ...device, watts: nextWatts, highUsage: nextWatts >= 1000 }
      : device
  ));
  updateFloorMetrics();
  render();
}

function removeDevice(deviceId) {
  state.appliances = state.appliances.filter((device) => device.deviceId !== deviceId);
  updateFloorMetrics();
  render();
}

function getBoardMetrics() {
  const board = $('setup-board');
  if (!board) {
    return null;
  }
  const rect = board.getBoundingClientRect();
  return {
    board,
    rect,
    cellWidth: rect.width / MAP_GRID_COLS,
    cellHeight: rect.height / MAP_GRID_ROWS,
  };
}

function getGridPointFromEvent(event) {
  const metrics = getBoardMetrics();
  if (!metrics) {
    return null;
  }
  return {
    metrics,
    x: clamp(Math.floor((event.clientX - metrics.rect.left) / metrics.cellWidth), 0, MAP_GRID_COLS - 1),
    y: clamp(Math.floor((event.clientY - metrics.rect.top) / metrics.cellHeight), 0, MAP_GRID_ROWS - 1),
  };
}

function buildDraftRoom(start, current) {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const w = Math.abs(current.x - start.x) + 1;
  const h = Math.abs(current.y - start.y) + 1;
  const roomType = state.setupRoomType;
  const baseName = roomType === 'custom' ? String(state.setupCustomRoomName || 'Custom Room').trim() || 'Custom Room' : getRoomTemplate(roomType).label;
  return {
    type: roomType,
    name: baseName,
    x,
    y,
    w,
    h,
    threshold: roomThreshold(roomType),
    valid: canPlaceRoom({ x, y, w, h }, null),
  };
}

function handleSetupPointerDown(event) {
  if (state.currentView !== 'setup') {
    return;
  }
  const roomHandle = event.target.closest('[data-room-handle="move"]');
  const resizeHandle = event.target.closest('[data-room-handle="resize"]');
  const deviceChip = event.target.closest('[data-setup-device-id]');
  const roomEl = event.target.closest('[data-room-id]');
  const boardPoint = getGridPointFromEvent(event);
  if (!boardPoint) {
    return;
  }

  if (state.setupStep === 2 && deviceChip) {
    event.preventDefault();
    state.setupSelectedRoomId = deviceChip.dataset.deviceRoomId || state.setupSelectedRoomId;
    state.setupInteraction = {
      kind: 'move-device',
      deviceId: deviceChip.dataset.setupDeviceId,
      roomId: deviceChip.dataset.deviceRoomId,
    };
    return;
  }

  if (resizeHandle) {
    event.preventDefault();
    const room = getRoomById(resizeHandle.dataset.roomId);
    if (!room) {
      return;
    }
    state.setupSelectedRoomId = room.id;
    state.setupInteraction = {
      kind: 'resize-room',
      roomId: room.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      original: { ...room },
      metrics: boardPoint.metrics,
    };
    return;
  }

  if (roomHandle && roomEl) {
    event.preventDefault();
    const room = getRoomById(roomEl.dataset.roomId);
    if (!room) {
      return;
    }
    state.setupSelectedRoomId = room.id;
    state.setupInteraction = {
      kind: 'move-room',
      roomId: room.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      original: { ...room },
      metrics: boardPoint.metrics,
    };
    render();
    return;
  }

  if (roomEl) {
    state.setupSelectedRoomId = roomEl.dataset.roomId;
    render();
    return;
  }

  if (state.setupStep === 1) {
    event.preventDefault();
    state.setupInteraction = {
      kind: 'draw-room',
      start: { x: boardPoint.x, y: boardPoint.y },
    };
    state.setupDraft = buildDraftRoom(state.setupInteraction.start, state.setupInteraction.start);
    render();
  }
}

function handleSetupPointerMove(event) {
  if (state.currentView !== 'setup' || !state.setupInteraction) {
    return;
  }
  const interaction = state.setupInteraction;

  if (interaction.kind === 'draw-room') {
    const point = getGridPointFromEvent(event);
    if (!point) {
      return;
    }
    state.setupDraft = buildDraftRoom(interaction.start, point);
    render();
    return;
  }

  if (interaction.kind === 'move-room') {
    const dx = Math.round((event.clientX - interaction.startClientX) / interaction.metrics.cellWidth);
    const dy = Math.round((event.clientY - interaction.startClientY) / interaction.metrics.cellHeight);
    const candidate = {
      ...interaction.original,
      x: clamp(interaction.original.x + dx, 0, MAP_GRID_COLS - interaction.original.w),
      y: clamp(interaction.original.y + dy, 0, MAP_GRID_ROWS - interaction.original.h),
    };
    if (canPlaceRoom(candidate, interaction.roomId)) {
      state.rooms = state.rooms.map((room) => (room.id === interaction.roomId ? { ...room, x: candidate.x, y: candidate.y } : room));
      render();
    }
    return;
  }

  if (interaction.kind === 'resize-room') {
    const dw = Math.round((event.clientX - interaction.startClientX) / interaction.metrics.cellWidth);
    const dh = Math.round((event.clientY - interaction.startClientY) / interaction.metrics.cellHeight);
    const candidate = {
      ...interaction.original,
      w: clamp(interaction.original.w + dw, 2, MAP_GRID_COLS - interaction.original.x),
      h: clamp(interaction.original.h + dh, 2, MAP_GRID_ROWS - interaction.original.y),
    };
    if (canPlaceRoom(candidate, interaction.roomId)) {
      state.rooms = state.rooms.map((room) => (room.id === interaction.roomId ? { ...room, w: candidate.w, h: candidate.h } : room));
      render();
    }
    return;
  }

  if (interaction.kind === 'move-device') {
    const roomEl = document.querySelector(`#setup-view [data-room-id="${interaction.roomId}"]`);
    if (!roomEl) {
      return;
    }
    const rect = roomEl.getBoundingClientRect();
    const xPct = clamp((event.clientX - rect.left) / rect.width, 0.16, 0.84);
    const yPct = clamp((event.clientY - rect.top) / rect.height, 0.22, 0.84);
    state.appliances = state.appliances.map((device) => (
      device.deviceId === interaction.deviceId ? { ...device, xPct, yPct } : device
    ));
    render();
  }
}

function handleSetupPointerUp() {
  if (state.currentView !== 'setup' || !state.setupInteraction) {
    return;
  }
  if (state.setupInteraction.kind === 'draw-room') {
    if (state.setupDraft && state.setupDraft.valid !== false) {
      const newRoom = createRoom({
        ...state.setupDraft,
        name: uniqueRoomName(state.setupDraft.name, state.rooms),
      });
      state.rooms = state.rooms.concat(newRoom);
      state.setupSelectedRoomId = newRoom.id;
      state.selectedRoom = newRoom.id;
      showSetupMessage(`${newRoom.name} added to the blueprint.`, 'success');
    } else {
      showSetupMessage('That room overlaps another room or goes outside the blueprint. Try again.', 'error');
    }
    state.setupDraft = null;
  }
  state.setupInteraction = null;
  updateFloorMetrics();
  render();
}

function handleRoomDrop(event) {
  event.preventDefault();
  const roomId = event.currentTarget.dataset.roomId;
  const type = state.setupDraggedDeviceType || event.dataTransfer.getData('text/plain');
  if (!roomId || !type) {
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  const xPct = clamp((event.clientX - rect.left) / rect.width, 0.18, 0.82);
  const yPct = clamp((event.clientY - rect.top) / rect.height, 0.24, 0.84);
  addDeviceToRoom(roomId, type, xPct, yPct);
  state.setupDraggedDeviceType = '';
}

function handleSetupPrev() {
  if (state.setupStep > 1) {
    state.setupStep -= 1;
    showSetupMessage('', '');
    render();
  }
}

function handleSetupNext() {
  if (state.setupStep === 1 && !state.rooms.length) {
    showSetupMessage('Create at least one room before continuing.', 'error');
    render();
    return;
  }
  if (state.setupStep === 2 && !state.appliances.length) {
    showSetupMessage('Add at least one device before saving the setup.', 'error');
    render();
    return;
  }
  if (state.setupStep < 3) {
    state.setupStep += 1;
    showSetupMessage('', '');
    render();
  }
}

function handleSetupSecondaryAction() {
  if (state.setupCompleted) {
    showSetupMessage('', '');
    showApp();
    return;
  }
  handleLogout();
}

async function saveSetupConfiguration() {
  if (!state.rooms.length) {
    showSetupMessage('Create at least one room before saving.', 'error');
    render();
    return;
  }
  const previousSetupState = state.setupCompleted;
  try {
    state.setupCompleted = true;
    updateFloorMetrics();
    await apiRequest('/save-layout', {
      method: 'POST',
      body: JSON.stringify({
        rooms: state.rooms,
        appliances: state.appliances,
        metrics: state.metrics,
        dailyHistory: state.dailyHistory,
        settings: {
          dailyLimit: state.dailyLimit,
          darkMode: state.darkMode,
          notifications: state.notificationPrefs,
        },
        setupCompleted: true,
      }),
    });
    state.saveStatus = 'Live';
    storageSave({ token: state.token, user: state.user });
    showSetupMessage('', '');
    showGlobalMessage('Custom floor plan saved. Your dashboard is now using the new house map.', 'success');
    showApp();
  } catch (error) {
    state.setupCompleted = previousSetupState;
    showSetupMessage(friendlyFetchError(error), 'error');
    render();
  }
}

function updateProfileChrome() {
  $('profile-name').textContent = state.user ? state.user.name : 'Primary User';
  $('profile-email').textContent = state.user ? state.user.email : 'user@example.com';
  $('deployment-label').textContent = 'Home users';
  $('sync-status').textContent = state.offline ? 'Offline shell' : state.saveStatus;
  $('theme-toggle').textContent = state.darkMode ? 'Light mode' : 'Dark mode';
  const installLabel = state.installAvailable ? 'Install app' : 'Add to Home';
  ['install-app-topbar', 'setup-install-button'].forEach((id) => {
    const button = $(id);
    if (button) {
      button.textContent = installLabel;
    }
  });
}

function openRoomModal(roomId) {
  const roomStats = calculateRoomStats(state.appliances);
  const room = roomStats.find((item) => item.id === roomId);
  if (!room) {
    return;
  }

  $('modal-room-title').textContent = room.name;
  $('modal-room-copy').textContent = `${room.activeWatts}W active load across ${room.activeCount} running appliances.`;
  $('modal-room-metrics').innerHTML = `
    ${metricCard('Live load', `${formatNumber(room.activeLoadKw, 2)} kW`, 'Current room usage')}
    ${metricCard('Devices ON', room.activeCount, room.overloaded ? 'Over threshold' : 'Within threshold')}
  `;
  $('modal-room-devices').innerHTML = room.devices.map((device) => `
    <article class="room-device-row">
      <div class="modal-copy">
        <strong>${escapeHtml(device.name)}</strong>
        <span>${escapeHtml(String(device.watts))}W</span>
      </div>
      <span class="pill ${device.on ? 'safe' : 'danger'}">${device.on ? 'ON' : 'OFF'}</span>
    </article>
  `).join('');
  $('room-modal').classList.remove('hidden');
}

function render() {
  applyTheme();
  updateProfileChrome();
  if (state.currentView === 'setup') {
    renderSetupView();
    return;
  }
  if (state.currentView !== 'app') {
    return;
  }
  renderHomeScreen();
  renderDevicesScreen();
  renderAnalyticsScreen();
  renderSettingsScreen();
  setActiveTab(state.activeTab);
  attachDynamicHandlers();
}

function attachDynamicHandlers() {
  document.querySelectorAll('#app-view .floor-room[data-room-id]').forEach((element) => {
    element.addEventListener('click', () => {
      state.selectedRoom = element.dataset.roomId;
      render();
      openRoomModal(state.selectedRoom);
    });
  });

  document.querySelectorAll('#app-view [data-device-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleDevice(button.dataset.deviceId);
    });
  });

  const dailyLimitRange = $('daily-limit-range');
  if (dailyLimitRange) {
    dailyLimitRange.addEventListener('input', (event) => {
      state.dailyLimit = Number(event.target.value);
      updateFloorMetrics();
      render();
      scheduleSave();
    });
  }

  const themeToggleSetting = $('theme-toggle-setting');
  if (themeToggleSetting) {
    themeToggleSetting.addEventListener('click', () => {
      state.darkMode = !state.darkMode;
      render();
      scheduleSave();
    });
  }

  document.querySelectorAll('[data-pref-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.prefKey;
      state.notificationPrefs[key] = !state.notificationPrefs[key];
      render();
      scheduleSave();
    });
  });

  document.querySelectorAll('[data-open-setup]').forEach((button) => {
    button.addEventListener('click', () => {
      state.setupStep = 1;
      showSetupMessage('', '');
      showSetup();
    });
  });
}

function showAuth() {
  state.currentView = 'auth';
  $('auth-view').classList.remove('hidden');
  $('setup-view').classList.add('hidden');
  $('app-view').classList.add('hidden');
  stopLiveUpdates();
}

function showSetup() {
  state.currentView = 'setup';
  $('auth-view').classList.add('hidden');
  $('setup-view').classList.remove('hidden');
  $('app-view').classList.add('hidden');
  stopLiveUpdates();
  render();
}

function showApp() {
  state.currentView = 'app';
  $('auth-view').classList.add('hidden');
  $('setup-view').classList.add('hidden');
  $('app-view').classList.remove('hidden');
  render();
  startLiveUpdates();
}

function scheduleSave() {
  if (!state.token || !state.setupCompleted) {
    return;
  }

  clearTimeout(saveTimerId);
  state.saveStatus = 'Syncing';
  updateProfileChrome();

  saveTimerId = setTimeout(async () => {
    try {
      await apiRequest('/save-usage', {
        method: 'POST',
        body: JSON.stringify({
          metrics: state.metrics,
          rooms: state.rooms,
          appliances: state.appliances.map((item) => ({
            deviceId: item.deviceId,
            roomId: item.roomId,
            room: item.room,
            name: item.name,
            type: item.type,
            watts: item.watts,
            dailyHours: item.dailyHours,
            on: item.on,
            highUsage: item.highUsage,
            xPct: item.xPct,
            yPct: item.yPct,
          })),
          dailyHistory: state.dailyHistory,
          settings: {
            dailyLimit: state.dailyLimit,
            darkMode: state.darkMode,
            notifications: state.notificationPrefs,
          },
          setupCompleted: state.setupCompleted,
        }),
      });
      state.saveStatus = 'Live';
      updateProfileChrome();
    } catch (_error) {
      state.saveStatus = 'Offline';
      updateProfileChrome();
    }
  }, SAVE_DELAY);
}

function toggleDevice(deviceId) {
  state.appliances = state.appliances.map((item) => (item.deviceId === deviceId ? { ...item, on: !item.on } : item));
  updateFloorMetrics();
  render();
  scheduleSave();
}

async function hydrateUsage() {
  const usage = await apiRequest('/usage-data');
  state.rooms = normalizeRooms(usage.rooms, usage.appliances);
  state.setupCompleted = typeof usage.setupCompleted === 'boolean'
    ? usage.setupCompleted || (state.rooms.length > 0 && Array.isArray(usage.appliances) && usage.appliances.length > 0 && !usage.rooms)
    : Boolean(state.rooms.length && Array.isArray(usage.appliances) && usage.appliances.length);
  state.dailyLimit = usage.settings && usage.settings.dailyLimit ? Number(usage.settings.dailyLimit) : 28;
  state.darkMode = usage.settings ? usage.settings.darkMode !== false : true;
  state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS, usage.settings && usage.settings.notifications ? usage.settings.notifications : {});
  state.appliances = mergeAppliances(usage.appliances);
  state.metrics = usage.latestMetrics && usage.latestMetrics.todayUsage
    ? { ...usage.latestMetrics, activeDevices: state.appliances.filter((item) => item.on).length }
    : computeMetrics(state.appliances, null, state.dailyLimit);
  state.dailyHistory = Array.isArray(usage.dailyHistory) && usage.dailyHistory.length
    ? syncTodayHistory(usage.dailyHistory, state.metrics.todayUsage)
    : createHistory(state.metrics.todayUsage);
  syncRoomSelections();
}

async function completeAuth(result) {
  state.token = result.token;
  state.user = result.user;
  state.dailyLimit = result.settings && result.settings.dailyLimit ? Number(result.settings.dailyLimit) : 28;
  state.darkMode = result.settings ? result.settings.darkMode !== false : true;
  state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS, result.settings && result.settings.notifications ? result.settings.notifications : {});
  storageSave({ token: state.token, user: state.user });
  await hydrateUsage();
  state.saveStatus = 'Live';
  if (state.setupCompleted) {
    showGlobalMessage('Authentication successful. Your dashboard is now active.', 'success');
    showApp();
  } else {
    state.setupStep = 1;
    showSetupMessage('Create your floor plan to finish onboarding.', 'success');
    showSetup();
  }
}

async function restoreSession() {
  const stored = storageLoad();
  if (!stored || !stored.token) {
    state.rooms = [];
    state.appliances = [];
    updateFloorMetrics();
    showAuth();
    return;
  }

  try {
    state.token = stored.token;
    const data = await apiRequest('/user-data');
    state.user = data.user;
    state.dailyLimit = data.settings && data.settings.dailyLimit ? Number(data.settings.dailyLimit) : 28;
    state.darkMode = data.settings ? data.settings.darkMode !== false : true;
    state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS, data.settings && data.settings.notifications ? data.settings.notifications : {});
    await hydrateUsage();
    state.saveStatus = 'Live';
    if (state.setupCompleted) {
      showApp();
    } else {
      state.setupStep = 1;
      showSetupMessage('Finish the first-time setup to unlock the dashboard.', 'warn');
      showSetup();
    }
  } catch (error) {
    storageClear();
    state.token = null;
    state.user = null;
    state.rooms = [];
    state.appliances = [];
    updateFloorMetrics();
    showAuth();
    $('login-error').className = 'form-message error';
    $('login-error').textContent = friendlyFetchError(error);
  }
}

function handleLogout() {
  storageClear();
  clearTimeout(saveTimerId);
  stopLiveUpdates();
  state.token = null;
  state.user = null;
  state.rooms = [];
  state.appliances = [];
  state.setupCompleted = false;
  state.setupStep = 1;
  state.setupSelectedRoomId = null;
  state.selectedRoom = null;
  state.setupDraft = null;
  state.setupInteraction = null;
  state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS);
  updateFloorMetrics();
  showGlobalMessage('', '');
  showSetupMessage('', '');
  showAuth();
}

async function promptInstall() {
  if (!state.deferredInstallPrompt) {
    const message = 'Install prompt unavailable here. On phones over local Wi-Fi, use the browser menu and choose Add to Home Screen.';
    if (state.currentView === 'setup') {
      showSetupMessage(message, 'warn');
      render();
    } else {
      showGlobalMessage(message, 'warn');
    }
    return;
  }
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice.catch(() => null);
  state.deferredInstallPrompt = null;
  state.installAvailable = false;
  render();
}

function registerPwaSupport() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    state.installAvailable = true;
    render();
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    state.installAvailable = false;
    showGlobalMessage('The tracker is installed. You can launch it from your home screen.', 'success');
    render();
  });

  window.addEventListener('online', () => {
    state.offline = false;
    updateProfileChrome();
    if (state.currentView === 'app') {
      render();
    }
  });

  window.addEventListener('offline', () => {
    state.offline = true;
    updateProfileChrome();
    if (state.currentView === 'app') {
      showGlobalMessage('Offline mode is active. The app shell stays available and sync resumes when the connection returns.', 'warn');
      render();
    }
  });
}

function registerStaticHandlers() {
  if (registerStaticHandlers.didBind) {
    return;
  }
  registerStaticHandlers.didBind = true;

  document.querySelectorAll('.auth-tab').forEach((button) => {
    button.addEventListener('click', () => setAuthTab(button.dataset.authTab));
  });

  $('login-form').addEventListener('submit', handleLogin);
  $('signup-form').addEventListener('submit', handleSignup);
  document.querySelectorAll('[data-app-action="logout"]').forEach((button) => {
    button.addEventListener('click', handleLogout);
  });
  $('theme-toggle').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    render();
    scheduleSave();
  });

  document.querySelectorAll('.nav-button, .mobile-nav-button').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  document.querySelectorAll('[data-close-modal="true"]').forEach((button) => {
    button.addEventListener('click', closeRoomModal);
  });

  document.addEventListener('click', (event) => {
    const installButton = event.target.closest('[data-install-app]');
    if (installButton) {
      event.preventDefault();
      promptInstall();
    }
  });

  window.addEventListener('pointermove', handleSetupPointerMove);
  window.addEventListener('pointerup', handleSetupPointerUp);
  registerPwaSupport();
}

function setInlineMessage(id, message, type) {
  const el = $(id);
  if (!el) {
    return;
  }
  if (!message) {
    el.className = 'form-message hidden';
    el.textContent = '';
    return;
  }
  el.className = `form-message ${type || 'success'}`;
  el.textContent = message;
}

function clearPasswordResetMessages() {
  setInlineMessage('forgot-password-message', '', '');
  setInlineMessage('reset-password-message', '', '');
}

function openPasswordResetModal(prefillEmail) {
  clearPasswordResetMessages();
  const loginEmail = $('login-form')?.querySelector('input[name="email"]')?.value || '';
  const nextEmail = String(prefillEmail || loginEmail || '').trim();
  if ($('forgot-password-email')) {
    $('forgot-password-email').value = nextEmail;
  }
  if ($('reset-password-email')) {
    $('reset-password-email').value = nextEmail;
  }
  if ($('reset-password-otp')) {
    $('reset-password-otp').value = '';
  }
  if ($('reset-password-new')) {
    $('reset-password-new').value = '';
  }
  if ($('reset-password-confirm')) {
    $('reset-password-confirm').value = '';
  }
  $('password-reset-modal')?.classList.remove('hidden');
}

function closePasswordResetModal() {
  $('password-reset-modal')?.classList.add('hidden');
  clearPasswordResetMessages();
}

async function handleForgotPasswordRequest(event) {
  event.preventDefault();
  clearPasswordResetMessages();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!email) {
    setInlineMessage('forgot-password-message', 'Enter your email address first.', 'error');
    return;
  }

  setFormLoading(form, true, 'Sending OTP...');
  try {
    const result = await apiRequest('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    if ($('reset-password-email')) {
      $('reset-password-email').value = email;
    }
    const extra = result && result.debugOtp ? ` Local preview OTP: ${result.debugOtp}` : '';
    setInlineMessage('forgot-password-message', `${result.message || 'OTP sent.'}${extra}`, result && result.debugOtp ? 'warn' : 'success');
  } catch (error) {
    setInlineMessage('forgot-password-message', friendlyFetchError(error), 'error');
  } finally {
    setFormLoading(form, false, 'Sending OTP...');
  }
}

async function handleResetPassword(event) {
  event.preventDefault();
  clearPasswordResetMessages();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const otp = String(formData.get('otp') || '').trim();
  const newPassword = String(formData.get('newPassword') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (!email || !otp || !newPassword || !confirmPassword) {
    setInlineMessage('reset-password-message', 'Complete all fields to reset your password.', 'error');
    return;
  }
  if (newPassword.length < 6) {
    setInlineMessage('reset-password-message', 'New password must be at least 6 characters long.', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    setInlineMessage('reset-password-message', 'New password and confirm password must match.', 'error');
    return;
  }

  setFormLoading(form, true, 'Updating password...');
  try {
    const result = await apiRequest('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
    const loginEmailInput = $('login-form')?.querySelector('input[name="email"]');
    const loginPasswordInput = $('login-form')?.querySelector('input[name="password"]');
    if (loginEmailInput) {
      loginEmailInput.value = email;
    }
    if (loginPasswordInput) {
      loginPasswordInput.value = '';
    }
    setAuthTab('login');
    closePasswordResetModal();
    $('login-error').className = 'form-message success';
    $('login-error').textContent = result.message || 'Password updated successfully. Please log in.';
  } catch (error) {
    setInlineMessage('reset-password-message', friendlyFetchError(error), 'error');
  } finally {
    setFormLoading(form, false, 'Updating password...');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  $('forgot-password-button')?.addEventListener('click', () => openPasswordResetModal());
  $('forgot-password-form')?.addEventListener('submit', handleForgotPasswordRequest);
  $('reset-password-form')?.addEventListener('submit', handleResetPassword);
  document.querySelectorAll('[data-close-reset="true"]').forEach((button) => {
    button.addEventListener('click', closePasswordResetModal);
  });
});

const SMTP_FORM_DEFAULT_PORT = '587';

function smtpPresetForEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const domain = normalizedEmail.includes('@') ? normalizedEmail.split('@')[1] : '';
  if (['gmail.com', 'googlemail.com'].includes(domain)) {
    return {
      label: 'Gmail',
      hint: 'Use a Google App Password here, not your normal Gmail password.',
      host: 'smtp.gmail.com',
      port: '587',
      useSsl: true,
      defaultEmail: normalizedEmail,
    };
  }
  if (['outlook.com', 'hotmail.com', 'live.com', 'office365.com'].includes(domain)) {
    return {
      label: 'Outlook',
      hint: 'Use the Outlook or Microsoft 365 mailbox password, or an app password if MFA is enabled.',
      host: 'smtp.office365.com',
      port: '587',
      useSsl: true,
      defaultEmail: normalizedEmail,
    };
  }
  if (['yahoo.com', 'ymail.com'].includes(domain)) {
    return {
      label: 'Yahoo',
      hint: 'Yahoo usually needs an app password for SMTP access.',
      host: 'smtp.mail.yahoo.com',
      port: '465',
      useSsl: true,
      defaultEmail: normalizedEmail,
    };
  }
  return {
    label: 'Custom SMTP',
    hint: 'Enter the SMTP details from the mailbox or email service you want GridSense to use.',
    host: '',
    port: SMTP_FORM_DEFAULT_PORT,
    useSsl: true,
    defaultEmail: normalizedEmail,
  };
}

function buildSmtpState(sourceConfig) {
  const preset = smtpPresetForEmail(state.user && state.user.email);
  const source = sourceConfig && typeof sourceConfig === 'object' ? sourceConfig : {};
  return {
    host: String(source.host || state.smtpConfig?.host || preset.host || '').trim(),
    port: String(source.port || state.smtpConfig?.port || preset.port || SMTP_FORM_DEFAULT_PORT).trim() || SMTP_FORM_DEFAULT_PORT,
    user: String(source.user || state.smtpConfig?.user || preset.defaultEmail || '').trim(),
    pass: '',
    from: String(source.from || state.smtpConfig?.from || preset.defaultEmail || '').trim(),
    useSsl: source.useSsl !== undefined ? source.useSsl !== false : (state.smtpConfig ? state.smtpConfig.useSsl !== false : preset.useSsl),
    configured: Boolean(source.configured),
    hasSavedPassword: Boolean(source.hasSavedPassword),
    source: String(source.source || (source.configured ? 'saved' : 'preview')),
    providerLabel: preset.label,
    providerHint: preset.hint,
  };
}

function setSmtpMessage(message, type) {
  state.smtpStatusMessage = message ? { text: message, type: type || 'success' } : null;
}

Object.assign(state, {
  smtpConfig: buildSmtpState({}),
  smtpStatusMessage: null,
  smtpBusy: false,
  smtpBusyAction: '',
  smtpTestEmail: '',
});

function readSmtpForm() {
  return {
    host: String($('smtp-host')?.value || '').trim(),
    port: String($('smtp-port')?.value || '').trim() || SMTP_FORM_DEFAULT_PORT,
    user: String($('smtp-user')?.value || '').trim(),
    pass: String($('smtp-pass')?.value || ''),
    from: String($('smtp-from')?.value || '').trim(),
    useSsl: Boolean($('smtp-use-ssl')?.checked),
    testEmail: String($('smtp-test-email')?.value || state.smtpTestEmail || (state.user ? state.user.email : '') || '').trim().toLowerCase(),
  };
}

function rememberSmtpDraft(draft) {
  state.smtpConfig = Object.assign({}, state.smtpConfig, {
    host: draft.host,
    port: draft.port,
    user: draft.user,
    from: draft.from,
    useSsl: draft.useSsl,
  });
  state.smtpTestEmail = draft.testEmail;
}

async function hydrateSmtpConfig() {
  if (!state.user) {
    state.smtpConfig = buildSmtpState({});
    state.smtpTestEmail = '';
    return;
  }

  state.smtpConfig = buildSmtpState(state.smtpConfig);
  if (!state.smtpTestEmail) {
    state.smtpTestEmail = state.user.email;
  }

  if (!state.token) {
    return;
  }

  try {
    const result = await apiRequest('/smtp-config');
    state.smtpConfig = buildSmtpState(result.config || result);
    if (!state.smtpTestEmail) {
      state.smtpTestEmail = state.user.email;
    }
  } catch (_error) {
    state.smtpConfig = buildSmtpState(state.smtpConfig);
  }
}

async function handleSmtpSaveRequest(sendTestEmailAfterSave) {
  const draft = readSmtpForm();
  rememberSmtpDraft(draft);

  const needsPassword = !draft.pass && !state.smtpConfig.hasSavedPassword;
  if (!draft.host || !draft.user || !draft.from || needsPassword) {
    setSmtpMessage('Enter the SMTP host, username, from email, and app password to enable real OTP emails.', 'error');
    render();
    return;
  }

  state.smtpBusy = true;
  state.smtpBusyAction = sendTestEmailAfterSave ? 'test' : 'save';
  setSmtpMessage('', '');
  render();

  try {
    const saveResult = await apiRequest('/smtp-config', {
      method: 'POST',
      body: JSON.stringify({
        host: draft.host,
        port: draft.port,
        user: draft.user,
        pass: draft.pass,
        from: draft.from,
        useSsl: draft.useSsl,
      }),
    });

    state.smtpConfig = buildSmtpState(saveResult.config || {});
    state.smtpTestEmail = draft.testEmail || (state.user ? state.user.email : '');

    if (sendTestEmailAfterSave) {
      const testResult = await apiRequest('/smtp-test-email', {
        method: 'POST',
        body: JSON.stringify({
          email: state.smtpTestEmail || (state.user ? state.user.email : ''),
        }),
      });
      setSmtpMessage(testResult.message || 'Test email sent successfully.', 'success');
    } else {
      setSmtpMessage(saveResult.message || 'Email delivery settings saved successfully.', 'success');
    }
  } catch (error) {
    setSmtpMessage(friendlyFetchError(error), 'error');
  } finally {
    state.smtpBusy = false;
    state.smtpBusyAction = '';
    render();
  }
}

async function handleSmtpClearRequest() {
  state.smtpBusy = true;
  state.smtpBusyAction = 'clear';
  setSmtpMessage('', '');
  render();

  try {
    const result = await apiRequest('/smtp-config', {
      method: 'POST',
      body: JSON.stringify({ clear: true }),
    });
    state.smtpConfig = buildSmtpState({});
    state.smtpTestEmail = state.user ? state.user.email : '';
    setSmtpMessage(result.message || 'Saved SMTP settings removed. OTP will stay in preview mode until email delivery is configured again.', 'success');
  } catch (error) {
    setSmtpMessage(friendlyFetchError(error), 'error');
  } finally {
    state.smtpBusy = false;
    state.smtpBusyAction = '';
    render();
  }
}

function renderSettingsScreen() {
  const smtpMessageClass = state.smtpStatusMessage ? `form-message ${escapeHtml(state.smtpStatusMessage.type || 'success')}` : 'form-message hidden';
  const smtpMessageText = state.smtpStatusMessage ? escapeHtml(state.smtpStatusMessage.text) : '';
  const smtpStatusLabel = state.smtpConfig.configured ? 'Configured' : 'Preview mode';
  const smtpStatusTone = state.smtpConfig.configured ? 'safe' : 'warn';
  const smtpPasswordHint = state.smtpConfig.hasSavedPassword
    ? 'Leave this blank to keep the saved password.'
    : 'Enter the mailbox app password or SMTP password.';

  $('screen-settings').innerHTML = `
    <div class="settings-layout">
      <div class="settings-grid">
        <article class="settings-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Preferences</span>
              <h3>Smart limits and theme</h3>
              <p>Set a daily usage limit and switch between dark and light mode.</p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-copy">
              <strong>Daily usage limit</strong>
              <span>${escapeHtml(String(state.dailyLimit))} kWh</span>
            </div>
            <input id="daily-limit-range" type="range" min="10" max="60" value="${escapeHtml(String(state.dailyLimit))}" />
          </div>

          <button type="button" id="theme-toggle-setting" class="setting-row">
            <div class="setting-copy">
              <strong>${state.darkMode ? 'Dark mode enabled' : 'Light mode enabled'}</strong>
              <span>Switch the app appearance across mobile and desktop layouts.</span>
            </div>
            <span class="setting-switch ${state.darkMode ? 'on' : 'off'}">${state.darkMode ? 'On' : 'Off'}</span>
          </button>
        </article>

        <article class="settings-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Floor plan builder</span>
              <h3>House map and install</h3>
              <p>Edit your architectural layout, add more rooms, and install the tracker like an app.</p>
            </div>
          </div>
          <div class="settings-action-grid">
            <button type="button" class="setting-row" data-open-setup>
              <div class="setting-copy">
                <strong>Edit floor plan</strong>
                <span>${state.rooms.length} rooms and ${state.appliances.length} devices in the saved layout.</span>
              </div>
              <span class="setting-switch on">Open</span>
            </button>
            <button type="button" class="setting-row" data-install-app>
              <div class="setting-copy">
                <strong>Install app</strong>
                <span>Standalone icon, splash-ready shell, and offline support for the app frame.</span>
              </div>
              <span class="setting-switch ${state.installAvailable ? 'on' : 'off'}">${state.installAvailable ? 'Ready' : 'Menu'}</span>
            </button>
            <article class="install-note">
              <strong>Install guidance</strong>
              <span>Install prompts work on localhost or HTTPS. On phones over plain local Wi-Fi URLs, use the browser menu for Add to Home Screen.</span>
              <span class="pill safe">PWA upgrade included</span>
            </article>
          </div>
        </article>

        <article class="settings-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Email delivery</span>
              <h3>Password reset OTP mail</h3>
              <p>Connect a sender mailbox so forgot-password codes arrive in the real inbox instead of local preview mode.</p>
            </div>
            <span class="pill ${smtpStatusTone}">${smtpStatusLabel}</span>
          </div>
          <div class="${smtpMessageClass}">${smtpMessageText}</div>
          <div class="smtp-form-grid">
            <label class="inline-field">
              <span>SMTP host</span>
              <input id="smtp-host" type="text" value="${escapeHtml(state.smtpConfig.host)}" placeholder="smtp.gmail.com" />
            </label>
            <label class="inline-field">
              <span>Port</span>
              <input id="smtp-port" type="number" min="1" max="65535" value="${escapeHtml(state.smtpConfig.port)}" placeholder="${SMTP_FORM_DEFAULT_PORT}" />
            </label>
            <label class="inline-field">
              <span>Username</span>
              <input id="smtp-user" type="email" value="${escapeHtml(state.smtpConfig.user)}" placeholder="${escapeHtml(state.user ? state.user.email : 'you@example.com')}" />
            </label>
            <label class="inline-field">
              <span>From email</span>
              <input id="smtp-from" type="email" value="${escapeHtml(state.smtpConfig.from)}" placeholder="${escapeHtml(state.user ? state.user.email : 'you@example.com')}" />
            </label>
            <label class="inline-field smtp-span-2">
              <span>${state.smtpConfig.hasSavedPassword ? 'App password saved' : 'App password'}</span>
              <input id="smtp-pass" type="password" value="" placeholder="${escapeHtml(smtpPasswordHint)}" />
            </label>
            <label class="inline-field smtp-span-2">
              <span>Test email address</span>
              <input id="smtp-test-email" type="email" value="${escapeHtml(state.smtpTestEmail || (state.user ? state.user.email : ''))}" placeholder="where the test email should arrive" />
            </label>
            <label class="smtp-checkbox-row smtp-span-2">
              <input id="smtp-use-ssl" type="checkbox" ${state.smtpConfig.useSsl ? 'checked' : ''} />
              <span>Use SSL/TLS for the SMTP connection</span>
            </label>
          </div>
          <div class="smtp-action-row">
            <button type="button" id="smtp-save-button" class="primary-button" ${state.smtpBusy ? 'disabled' : ''}>${state.smtpBusyAction === 'save' ? 'Saving...' : 'Save email settings'}</button>
            <button type="button" id="smtp-test-button" class="ghost-button" ${state.smtpBusy ? 'disabled' : ''}>${state.smtpBusyAction === 'test' ? 'Sending...' : 'Save and send test email'}</button>
            <button type="button" id="smtp-clear-button" class="text-button" ${state.smtpBusy ? 'disabled' : ''}>${state.smtpBusyAction === 'clear' ? 'Removing...' : 'Remove saved SMTP'}</button>
          </div>
          <article class="install-note smtp-note">
            <strong>${escapeHtml(state.smtpConfig.providerLabel || 'Custom SMTP')}</strong>
            <span>${escapeHtml(state.smtpConfig.providerHint || 'Enter the mail server settings for the sender account you want GridSense to use.')}</span>
            <span class="pill ${state.smtpConfig.configured ? 'safe' : 'warn'}">${escapeHtml(state.smtpConfig.source === 'env' ? 'Server env' : state.smtpConfig.configured ? 'Saved in app' : 'Needs setup')}</span>
          </article>
        </article>

        <article class="settings-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">Notification settings</span>
              <h3>Alert preferences</h3>
              <p>Choose which alerts remain active in the interface.</p>
            </div>
          </div>
          <div class="list-stack">
            ${Object.keys(notificationLabels).map((key) => `
              <button type="button" class="setting-row" data-pref-key="${escapeHtml(key)}">
                <div class="setting-copy">
                  <strong>${escapeHtml(notificationLabels[key])}</strong>
                  <span>${state.notificationPrefs[key] ? 'Enabled' : 'Disabled'}</span>
                </div>
                <span class="setting-switch ${state.notificationPrefs[key] ? 'on' : 'off'}">${state.notificationPrefs[key] ? 'On' : 'Off'}</span>
              </button>
            `).join('')}
          </div>
        </article>
      </div>

      <div class="two-column">
        <article class="data-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">IoT integration</span>
              <h3>Connected objects</h3>
              <p>Hardware components and linked devices used for measurement and sync.</p>
            </div>
          </div>
          <div class="chip-grid">
            ${iotObjects.map((item) => `<span class="data-chip">${escapeHtml(item)}</span>`).join('')}
          </div>
        </article>

        <article class="access-card panel">
          <div class="card-head">
            <div>
              <span class="eyebrow">User access</span>
              <h3>${escapeHtml(state.user ? state.user.name : 'Primary User')}</h3>
              <p>${escapeHtml(state.user ? state.user.email : 'user@example.com')}</p>
            </div>
          </div>
          <div class="access-grid">
            ${accessMembers.map((member) => `
              <article class="feature-card">
                <strong>${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(member.role)} - ${escapeHtml(member.access)}</span>
              </article>
            `).join('')}
          </div>
        </article>
      </div>
    </div>
  `;
}

function attachDynamicHandlers() {
  document.querySelectorAll('#app-view .floor-room[data-room-id]').forEach((element) => {
    element.addEventListener('click', () => {
      state.selectedRoom = element.dataset.roomId;
      render();
      openRoomModal(state.selectedRoom);
    });
  });

  document.querySelectorAll('#app-view [data-device-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleDevice(button.dataset.deviceId);
    });
  });

  const dailyLimitRange = $('daily-limit-range');
  if (dailyLimitRange) {
    dailyLimitRange.addEventListener('input', (event) => {
      state.dailyLimit = Number(event.target.value);
      updateFloorMetrics();
      render();
      scheduleSave();
    });
  }

  const themeToggleSetting = $('theme-toggle-setting');
  if (themeToggleSetting) {
    themeToggleSetting.addEventListener('click', () => {
      state.darkMode = !state.darkMode;
      render();
      scheduleSave();
    });
  }

  document.querySelectorAll('[data-pref-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.prefKey;
      state.notificationPrefs[key] = !state.notificationPrefs[key];
      render();
      scheduleSave();
    });
  });

  document.querySelectorAll('[data-open-setup]').forEach((button) => {
    button.addEventListener('click', () => {
      state.setupStep = 1;
      showSetupMessage('', '');
      showSetup();
    });
  });

  document.querySelectorAll('[data-install-app]').forEach((button) => {
    button.addEventListener('click', () => {
      promptInstall().catch(() => null);
    });
  });

  $('smtp-save-button')?.addEventListener('click', () => {
    handleSmtpSaveRequest(false).catch((error) => {
      setSmtpMessage(friendlyFetchError(error), 'error');
      state.smtpBusy = false;
      state.smtpBusyAction = '';
      render();
    });
  });

  $('smtp-test-button')?.addEventListener('click', () => {
    handleSmtpSaveRequest(true).catch((error) => {
      setSmtpMessage(friendlyFetchError(error), 'error');
      state.smtpBusy = false;
      state.smtpBusyAction = '';
      render();
    });
  });

  $('smtp-clear-button')?.addEventListener('click', () => {
    handleSmtpClearRequest().catch((error) => {
      setSmtpMessage(friendlyFetchError(error), 'error');
      state.smtpBusy = false;
      state.smtpBusyAction = '';
      render();
    });
  });
}

async function completeAuth(result) {
  state.token = result.token;
  state.user = result.user;
  state.dailyLimit = result.settings && result.settings.dailyLimit ? Number(result.settings.dailyLimit) : 28;
  state.darkMode = result.settings ? result.settings.darkMode !== false : true;
  state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS, result.settings && result.settings.notifications ? result.settings.notifications : {});
  state.smtpBusy = false;
  state.smtpBusyAction = '';
  setSmtpMessage('', '');
  state.smtpTestEmail = state.user ? state.user.email : '';
  state.smtpConfig = buildSmtpState({});
  storageSave({ token: state.token, user: state.user });
  await hydrateUsage();
  await hydrateSmtpConfig();
  state.saveStatus = 'Live';
  if (state.setupCompleted) {
    showGlobalMessage('Authentication successful. Your dashboard is now active.', 'success');
    showApp();
  } else {
    state.setupStep = 1;
    showSetupMessage('Create your floor plan to finish onboarding.', 'success');
    showSetup();
  }
}

async function restoreSession() {
  const stored = storageLoad();
  if (!stored || !stored.token) {
    state.rooms = [];
    state.appliances = [];
    state.smtpConfig = buildSmtpState({});
    state.smtpTestEmail = '';
    updateFloorMetrics();
    showAuth();
    return;
  }

  try {
    state.token = stored.token;
    const data = await apiRequest('/user-data');
    state.user = data.user;
    state.dailyLimit = data.settings && data.settings.dailyLimit ? Number(data.settings.dailyLimit) : 28;
    state.darkMode = data.settings ? data.settings.darkMode !== false : true;
    state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS, data.settings && data.settings.notifications ? data.settings.notifications : {});
    state.smtpBusy = false;
    state.smtpBusyAction = '';
    setSmtpMessage('', '');
    state.smtpTestEmail = state.user ? state.user.email : '';
    state.smtpConfig = buildSmtpState({});
    await hydrateUsage();
    await hydrateSmtpConfig();
    state.saveStatus = 'Live';
    if (state.setupCompleted) {
      showApp();
    } else {
      state.setupStep = 1;
      showSetupMessage('Finish the first-time setup to unlock the dashboard.', 'warn');
      showSetup();
    }
  } catch (error) {
    storageClear();
    state.token = null;
    state.user = null;
    state.rooms = [];
    state.appliances = [];
    state.smtpConfig = buildSmtpState({});
    state.smtpTestEmail = '';
    updateFloorMetrics();
    showAuth();
    showGlobalMessage(friendlyFetchError(error), 'error');
  }
}

function handleLogout() {
  storageClear();
  clearTimeout(saveTimerId);
  stopLiveUpdates();
  state.token = null;
  state.user = null;
  state.rooms = [];
  state.appliances = [];
  state.setupCompleted = false;
  state.setupStep = 1;
  state.setupSelectedRoomId = null;
  state.selectedRoom = null;
  state.setupDraft = null;
  state.setupInteraction = null;
  state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS);
  state.smtpConfig = buildSmtpState({});
  state.smtpStatusMessage = null;
  state.smtpBusy = false;
  state.smtpBusyAction = '';
  state.smtpTestEmail = '';
  updateFloorMetrics();
  showGlobalMessage('', '');
  showSetupMessage('', '');
  showAuth();
}

const ADVANCED_SETUP_GRID_PRESETS = [
  { id: 'small', label: 'Small', unit: 10 },
  { id: 'medium', label: 'Medium', unit: 20 },
  { id: 'large', label: 'Large', unit: 40 },
];

Object.assign(state, {
  setupGridUnit: Number(state.setupGridUnit) || 20,
  setupPointerOverlay: null,
});

function activeSetupGridUnit() {
  const selected = Number(state.setupGridUnit) || 20;
  return ADVANCED_SETUP_GRID_PRESETS.some((preset) => preset.unit === selected) ? selected : 20;
}

function setupPixels(room) {
  return {
    width: Math.max(1, Math.round((Number(room?.w) || 0) * activeSetupGridUnit())),
    height: Math.max(1, Math.round((Number(room?.h) || 0) * activeSetupGridUnit())),
  };
}

function setupDimensionPrimary(room) {
  const px = setupPixels(room);
  return `${px.width}px x ${px.height}px`;
}

function setupDimensionSecondary(room) {
  return `${Math.max(1, Number(room?.w) || 0)} x ${Math.max(1, Number(room?.h) || 0)} grid units`;
}

function setupRoomSummary(room) {
  return `${setupDimensionPrimary(room)} - ${setupDimensionSecondary(room)}`;
}

function setupAdvanceLabel() {
  if (state.setupStep === 1) {
    return 'Place devices';
  }
  if (state.setupStep === 2) {
    return 'Review dashboard';
  }
  return 'Next';
}

function canVisitSetupStep(stepId) {
  if (stepId <= 1) {
    return true;
  }
  if (stepId === 2) {
    return state.rooms.length > 0;
  }
  if (stepId === 3) {
    return state.appliances.length > 0;
  }
  return false;
}

function setupBlockedMessage(stepId) {
  if (stepId === 2) {
    return 'Please add at least one room first';
  }
  if (stepId === 3) {
    return 'Please add devices before continuing';
  }
  return '';
}

function goToSetupStep(stepId) {
  const nextStep = Math.max(1, Math.min(3, Number(stepId) || 1));
  if (nextStep > state.setupStep && !canVisitSetupStep(nextStep)) {
    showSetupMessage(setupBlockedMessage(nextStep), 'error');
    render();
    return;
  }
  state.setupStep = nextStep;
  state.setupPointerOverlay = null;
  showSetupMessage('', '');
  render();
}

function setSetupPointerOverlay(roomLike, event, modeLabel) {
  const board = $('setup-board');
  const metrics = board ? getBoardMetrics(board) : null;
  if (!metrics || !roomLike) {
    state.setupPointerOverlay = null;
    return;
  }
  const xPct = clamp((event.clientX - metrics.rect.left) / metrics.rect.width, 0.08, 0.92);
  const yPct = clamp((event.clientY - metrics.rect.top) / metrics.rect.height, 0.08, 0.9);
  state.setupPointerOverlay = {
    xPct,
    yPct,
    primary: setupDimensionPrimary(roomLike),
    secondary: `${setupDimensionSecondary(roomLike)}${modeLabel ? ` - ${modeLabel}` : ''}`,
  };
}

function clearSetupPointerOverlay() {
  state.setupPointerOverlay = null;
}

function setupGridBadgeMarkup() {
  return `
    <div class="blueprint-grid-meta">
      <strong>${activeSetupGridUnit()}px grid</strong>
      <span>Snap-to-grid enabled</span>
    </div>
  `;
}

function setupDimensionOverlayMarkup() {
  if (!state.setupPointerOverlay) {
    return '';
  }
  return `
    <div class="setup-dimension-badge" style="left:${(state.setupPointerOverlay.xPct * 100).toFixed(2)}%;top:${(state.setupPointerOverlay.yPct * 100).toFixed(2)}%;">
      <strong>${escapeHtml(state.setupPointerOverlay.primary)}</strong>
      <span>${escapeHtml(state.setupPointerOverlay.secondary)}</span>
    </div>
  `;
}

function advancedResizeHandlesMarkup(roomId) {
  return ['nw', 'ne', 'sw', 'se'].map((corner) => `
    <button
      type="button"
      class="room-resize-handle ${corner}"
      data-room-handle="resize-${corner}"
      data-room-id="${escapeHtml(roomId)}"
      aria-label="Resize room from ${corner.toUpperCase()} corner"
    ></button>
  `).join('');
}

function getSetupStepNote() {
  if (state.setupStep === 1) {
    return `Click and drag across the grid to draw rooms. Live dimensions use ${activeSetupGridUnit()}px per grid unit.`;
  }
  if (state.setupStep === 2) {
    return 'Select a room, add appliances, and drag devices into position inside the floor plan.';
  }
  return 'Review rooms, device positions, and estimated usage before saving the dashboard layout.';
}

function floorRoomMarkup(room, context) {
  const selected = context === 'setup' ? state.setupSelectedRoomId === room.id : state.selectedRoom === room.id;
  const roomDevices = room.devices || [];
  const setupCaption = `${setupDimensionPrimary(room)} - ${room.w}x${room.h} units`;
  return `
    <article
      class="floor-room ${selected ? 'selected' : ''} ${room.overloaded ? 'overloaded' : ''}"
      data-room-id="${escapeHtml(room.id)}"
      data-room-drop="${context === 'setup' ? 'true' : 'false'}"
      style="${roomInlineStyle(room)}"
    >
      <div class="floor-room-title" ${context === 'setup' ? 'data-room-handle="move"' : ''}>
        <strong>${escapeHtml(room.name)}</strong>
        <span>${context === 'setup' ? escapeHtml(setupCaption) : `${room.activeWatts}W active`}</span>
      </div>
      ${room.overloaded ? '<span class="floor-room-warning">!</span>' : ''}
      ${context === 'setup' ? advancedResizeHandlesMarkup(room.id) : ''}
      <div class="floor-room-devices" data-room-id="${escapeHtml(room.id)}">
        ${roomDevices.map((device) => mapDeviceMarkup(device, context)).join('')}
      </div>
    </article>
  `;
}

function floorPreviewMarkup() {
  if (!state.setupDraft) {
    return '';
  }
  return `
    <article class="floor-room-preview" style="${roomInlineStyle(state.setupDraft)}">
      <div class="floor-room-title">
        <strong>${escapeHtml(state.setupDraft.name)}</strong>
        <span>${escapeHtml(state.setupDraft.valid === false ? 'Placement invalid' : setupDimensionPrimary(state.setupDraft))}</span>
      </div>
    </article>
  `;
}

function renderFloorPlan(context) {
  const roomStats = calculateRoomStats(state.appliances);
  const emptyCopy = context === 'setup'
    ? 'Choose a room type and drag across the blueprint grid to create your first room.'
    : 'No saved floor plan yet. Open Settings and run the floor-plan builder.';
  return `
    <div class="blueprint-shell ${context === 'setup' ? 'setup-active' : ''}">
      <div id="${context === 'setup' ? 'setup-board' : ''}" class="blueprint-board ${context === 'setup' ? 'builder' : 'readonly'}">
        ${context === 'setup' ? setupGridBadgeMarkup() : ''}
        ${roomStats.length ? roomStats.map((room) => floorRoomMarkup(room, context)).join('') : `
          <div class="blueprint-empty">
            <article class="setup-inline-card">
              <strong>${context === 'setup' ? 'Start with your first room' : 'No custom house map yet'}</strong>
              <span>${emptyCopy}</span>
            </article>
          </div>
        `}
        ${context === 'setup' ? `${floorPreviewMarkup()}${setupDimensionOverlayMarkup()}` : ''}
      </div>
    </div>
  `;
}

function renderSetupSidebar() {
  const selectedRoom = getRoomById(state.setupSelectedRoomId);
  if (state.setupStep === 1) {
    return `
      <div class="builder-stack setup-stage-panel">
        <div class="card-head">
          <div>
            <span class="eyebrow">Rooms</span>
            <h3>Create the floor plan</h3>
            <p>Drag on the grid to draw a room, then move or resize it from any corner handle.</p>
          </div>
        </div>
        <div class="grid-size-panel">
          <strong>Grid scale</strong>
          <div class="grid-preset-row">
            ${ADVANCED_SETUP_GRID_PRESETS.map((preset) => `
              <button
                type="button"
                class="grid-preset-button ${activeSetupGridUnit() === preset.unit ? 'active' : ''}"
                data-setup-grid-unit="${preset.unit}"
              >
                <strong>${escapeHtml(preset.label)}</strong>
                <span>${preset.unit}px</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="palette-grid">
          ${ROOM_LIBRARY.map((room) => `
            <button type="button" class="room-type-button ${state.setupRoomType === room.key ? 'active' : ''}" data-room-type="${escapeHtml(room.key)}">${escapeHtml(room.label)}</button>
          `).join('')}
        </div>
        ${state.setupRoomType === 'custom' ? `
          <label class="setup-field">
            <span>Custom room name</span>
            <input id="custom-room-name" type="text" maxlength="24" value="${escapeHtml(state.setupCustomRoomName)}" placeholder="Study, Office, Store Room" />
          </label>
        ` : ''}
        <div class="builder-note">${escapeHtml(getSetupStepNote())}</div>
        <div class="room-line-list">
          ${state.rooms.length ? state.rooms.map((room) => `
            <button type="button" class="room-line-item ${state.setupSelectedRoomId === room.id ? 'selected' : ''}" data-select-setup-room="${escapeHtml(room.id)}">
              <strong>${escapeHtml(room.name)}</strong>
              <span>${escapeHtml(setupRoomSummary(room))}</span>
            </button>
          `).join('') : '<article class="setup-inline-card"><strong>No rooms yet</strong><span>Your custom floor plan will appear here after you drag on the blueprint.</span></article>'}
        </div>
        ${selectedRoom ? `
          <label class="setup-field">
            <span>Rename selected room</span>
            <input id="selected-room-name" type="text" maxlength="24" value="${escapeHtml(selectedRoom.name)}" />
          </label>
        ` : ''}
        <div class="room-line-actions">
          ${selectedRoom ? `<button type="button" class="ghost-button" data-remove-room="${escapeHtml(selectedRoom.id)}">Delete room</button>` : ''}
          <button type="button" class="ghost-button" data-clear-layout>Clear layout</button>
        </div>
      </div>
    `;
  }

  if (state.setupStep === 2) {
    const roomDevices = selectedRoom ? state.appliances.filter((device) => device.roomId === selectedRoom.id) : [];
    return `
      <div class="builder-stack setup-stage-panel">
        <div class="card-head">
          <div>
            <span class="eyebrow">Devices</span>
            <h3>Place appliances inside rooms</h3>
            <p>Select a room, add devices, then drag them around in the blueprint.</p>
          </div>
        </div>
        <div class="room-pill-grid">
          ${state.rooms.map((room) => `
            <button type="button" class="room-pill ${state.setupSelectedRoomId === room.id ? 'active' : ''}" data-select-setup-room="${escapeHtml(room.id)}">${escapeHtml(room.name)}</button>
          `).join('')}
        </div>
        <div class="device-palette">
          ${DEVICE_LIBRARY.map((device) => `
            <button type="button" data-device-template="${escapeHtml(device.type)}">
              <span class="map-device-icon">${iconSvg(device.type)}</span>
              <strong>${escapeHtml(device.name)}</strong>
              <span>${escapeHtml(String(device.watts))}W default</span>
            </button>
          `).join('')}
        </div>
        <div class="builder-note">${escapeHtml(selectedRoom ? `Selected room: ${selectedRoom.name} - ${setupRoomSummary(selectedRoom)}` : 'Select a room to place devices.')}</div>
        <div class="setup-device-list">
          ${roomDevices.length ? roomDevices.map((device) => `
            <article class="setup-device-row">
              <strong>${escapeHtml(device.name)}</strong>
              <span>${escapeHtml(String(device.watts))}W, ${device.on ? 'currently ON' : 'currently OFF'}</span>
              <div class="setup-inline-grid">
                <label class="inline-field">
                  <span>Watts</span>
                  <input type="number" min="10" max="5000" data-device-watts="${escapeHtml(device.deviceId)}" value="${escapeHtml(String(device.watts))}" />
                </label>
                <button type="button" class="ghost-button" data-device-toggle-setup="${escapeHtml(device.deviceId)}">${device.on ? 'Turn OFF' : 'Turn ON'}</button>
              </div>
              <button type="button" class="ghost-button" data-device-remove="${escapeHtml(device.deviceId)}">Remove device</button>
            </article>
          `).join('') : '<article class="setup-inline-card"><strong>No devices in this room</strong><span>Drag from the palette into the room or tap a palette item to add it to the room center.</span></article>'}
        </div>
      </div>
    `;
  }

  const activeRooms = calculateRoomStats(state.appliances);
  const activeOn = state.appliances.filter((device) => device.on).length;
  return `
    <div class="builder-stack setup-stage-panel">
      <div class="card-head">
        <div>
          <span class="eyebrow">Review</span>
          <h3>Save your smart home layout</h3>
          <p>Check the room blueprint, device counts, and usage assumptions before saving.</p>
        </div>
      </div>
      <div class="setup-summary-grid">
        ${metricCard('Rooms', state.rooms.length, 'Saved on the house map')}
        ${metricCard('Devices', state.appliances.length, 'Placed across rooms')}
        ${metricCard('Devices ON', activeOn, 'Realtime starting state')}
        ${metricCard('Grid scale', `${activeSetupGridUnit()}px`, 'Displayed dimension unit')}
      </div>
      <div class="room-line-list">
        ${activeRooms.map((room) => `
          <article class="room-line-item">
            <strong>${escapeHtml(room.name)}</strong>
            <span>${escapeHtml(setupRoomSummary(room))} - ${room.devices.length} devices</span>
          </article>
        `).join('')}
      </div>
      <article class="install-note">
        <strong>Dashboard review</strong>
        <span>Everything is ready to save back into the main dashboard once this review looks correct.</span>
        <button type="button" class="ghost-button" data-install-app>${state.installAvailable ? 'Install app now' : 'Use browser menu on mobile'}</button>
      </article>
    </div>
  `;
}

function attachSetupHandlers() {
  const board = $('setup-board');
  if (board) {
    board.onpointerdown = handleSetupPointerDown;
  }

  document.querySelectorAll('[data-room-type]').forEach((button) => {
    button.addEventListener('click', () => {
      state.setupRoomType = button.dataset.roomType;
      render();
    });
  });

  document.querySelectorAll('[data-setup-grid-unit]').forEach((button) => {
    button.addEventListener('click', () => {
      state.setupGridUnit = Number(button.dataset.setupGridUnit) || 20;
      clearSetupPointerOverlay();
      render();
    });
  });

  document.querySelectorAll('[data-setup-step-button]').forEach((button) => {
    button.addEventListener('click', () => goToSetupStep(button.dataset.setupStepButton));
  });

  const customRoomName = $('custom-room-name');
  if (customRoomName) {
    customRoomName.addEventListener('input', (event) => {
      state.setupCustomRoomName = event.target.value || 'Custom Room';
    });
  }

  const selectedRoomName = $('selected-room-name');
  if (selectedRoomName) {
    selectedRoomName.addEventListener('change', (event) => {
      renameRoom(state.setupSelectedRoomId, event.target.value);
    });
  }

  document.querySelectorAll('[data-select-setup-room]').forEach((button) => {
    button.addEventListener('click', () => {
      state.setupSelectedRoomId = button.dataset.selectSetupRoom;
      if (state.setupStep > 1) {
        state.selectedRoom = button.dataset.selectSetupRoom;
      }
      render();
    });
  });

  document.querySelectorAll('[data-remove-room]').forEach((button) => {
    button.addEventListener('click', () => removeRoom(button.dataset.removeRoom));
  });

  document.querySelectorAll('[data-clear-layout]').forEach((button) => {
    button.addEventListener('click', clearLayoutBuilder);
  });

  document.querySelectorAll('[data-device-template]').forEach((button) => {
    button.addEventListener('click', () => addDeviceToSelectedRoom(button.dataset.deviceTemplate));
  });

  document.querySelectorAll('[data-device-watts]').forEach((input) => {
    input.addEventListener('change', () => updateDeviceWatts(input.dataset.deviceWatts, input.value));
  });

  document.querySelectorAll('[data-device-toggle-setup]').forEach((button) => {
    button.addEventListener('click', () => toggleDevice(button.dataset.deviceToggleSetup));
  });

  document.querySelectorAll('[data-device-remove]').forEach((button) => {
    button.addEventListener('click', () => removeDevice(button.dataset.deviceRemove));
  });

  $('setup-prev').onclick = handleSetupPrev;
  $('setup-next').onclick = handleSetupNext;
  $('setup-save').onclick = saveSetupConfiguration;
  $('setup-secondary-button').onclick = handleSetupSecondaryAction;
}

function renderSetupView() {
  syncRoomSelections();
  $('setup-title').textContent = state.setupCompleted ? 'Edit your house map' : 'Build your smart house map';
  $('setup-subtitle').textContent = state.setupCompleted
    ? 'Update the floor plan, move devices, and save the refreshed layout back into the dashboard.'
    : 'Create rooms, place appliances, and save a blueprint-style layout before opening the dashboard.';
  $('setup-canvas-title').textContent = state.setupStep === 1 ? 'Architectural room builder' : state.setupStep === 2 ? 'Device placement canvas' : 'Final blueprint review';
  $('setup-canvas-copy').textContent = getSetupStepNote();
  $('setup-hint-title').textContent = state.setupStep === 1 ? 'Draw rooms' : state.setupStep === 2 ? 'Place devices' : 'Review and save';
  $('setup-hint-copy').textContent = getSetupStepNote();
  $('setup-secondary-button').textContent = state.setupCompleted ? 'Back to dashboard' : 'Logout';

  $('setup-steps').innerHTML = SETUP_STEPS.map((step) => {
    const available = canVisitSetupStep(step.id) || step.id <= state.setupStep;
    const stateClass = state.setupStep === step.id ? 'active' : step.id < state.setupStep ? 'done' : '';
    return `
      <button type="button" class="step-chip ${stateClass} ${available ? 'clickable' : 'locked'}" data-setup-step-button="${step.id}" ${available ? '' : 'disabled'}>
        <strong>${step.id}. ${escapeHtml(step.title)}</strong>
        <span>${escapeHtml(step.note)}</span>
      </button>
    `;
  }).join('');

  $('setup-canvas-shell').innerHTML = renderFloorPlan('setup');
  $('setup-sidebar').innerHTML = renderSetupSidebar();

  $('setup-prev').textContent = 'Back';
  $('setup-prev').disabled = state.setupStep === 1;
  $('setup-next').textContent = setupAdvanceLabel();
  $('setup-next').classList.toggle('hidden', state.setupStep === 3);
  $('setup-save').classList.toggle('hidden', state.setupStep !== 3);
  $('setup-next').disabled = !canVisitSetupStep(state.setupStep + 1);
  $('setup-save').disabled = !state.rooms.length || !state.appliances.length;
  $('setup-save').textContent = state.setupCompleted ? 'Update dashboard' : 'Save and open dashboard';

  const message = state.setupMessage;
  const setupMessage = $('setup-message');
  if (message && message.text) {
    setupMessage.className = `form-message ${message.type || 'success'}`;
    setupMessage.textContent = message.text;
  } else {
    setupMessage.className = 'form-message hidden';
    setupMessage.textContent = '';
  }

  attachSetupHandlers();
}

function calculateResizeCandidate(original, direction, dx, dy) {
  const right = original.x + original.w;
  const bottom = original.y + original.h;
  let x = original.x;
  let y = original.y;
  let w = original.w;
  let h = original.h;

  if (direction.includes('w')) {
    x = clamp(original.x + dx, 0, right - 2);
    w = right - x;
  }
  if (direction.includes('e')) {
    w = clamp(original.w + dx, 2, MAP_GRID_COLS - original.x);
  }
  if (direction.includes('n')) {
    y = clamp(original.y + dy, 0, bottom - 2);
    h = bottom - y;
  }
  if (direction.includes('s')) {
    h = clamp(original.h + dy, 2, MAP_GRID_ROWS - original.y);
  }

  return {
    ...original,
    x,
    y,
    w,
    h,
  };
}

function handleSetupPointerDown(event) {
  if (state.currentView !== 'setup') {
    return;
  }

  const boardPoint = getGridPointFromEvent(event);
  if (!boardPoint) {
    return;
  }

  const resizeHandle = event.target.closest('[data-room-handle^="resize-"]');
  const roomHandle = event.target.closest('[data-room-handle="move"]');
  const roomEl = event.target.closest('.floor-room[data-room-id]');
  const deviceChip = event.target.closest('[data-setup-device-id]');

  if (state.setupStep === 2 && deviceChip) {
    event.preventDefault();
    state.setupSelectedRoomId = deviceChip.dataset.deviceRoomId || state.setupSelectedRoomId;
    state.setupInteraction = {
      kind: 'move-device',
      deviceId: deviceChip.dataset.setupDeviceId,
      roomId: deviceChip.dataset.deviceRoomId,
    };
    clearSetupPointerOverlay();
    return;
  }

  if (resizeHandle) {
    event.preventDefault();
    const room = getRoomById(resizeHandle.dataset.roomId);
    if (!room) {
      return;
    }
    state.setupSelectedRoomId = room.id;
    state.setupInteraction = {
      kind: 'resize-room',
      direction: String(resizeHandle.dataset.roomHandle || 'resize-se').replace('resize-', ''),
      roomId: room.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      original: { ...room },
      metrics: boardPoint.metrics,
    };
    setSetupPointerOverlay(room, event, 'resize');
    render();
    return;
  }

  if (roomHandle && roomEl) {
    event.preventDefault();
    const room = getRoomById(roomEl.dataset.roomId);
    if (!room) {
      return;
    }
    state.setupSelectedRoomId = room.id;
    state.setupInteraction = {
      kind: 'move-room',
      roomId: room.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      original: { ...room },
      metrics: boardPoint.metrics,
    };
    setSetupPointerOverlay(room, event, 'move');
    render();
    return;
  }

  if (roomEl) {
    state.setupSelectedRoomId = roomEl.dataset.roomId;
    render();
    return;
  }

  if (state.setupStep === 1) {
    event.preventDefault();
    state.setupInteraction = {
      kind: 'draw-room',
      start: { x: boardPoint.x, y: boardPoint.y },
    };
    state.setupDraft = buildDraftRoom(state.setupInteraction.start, state.setupInteraction.start);
    setSetupPointerOverlay(state.setupDraft, event, 'draw');
    render();
  }
}

function handleSetupPointerMove(event) {
  if (state.currentView !== 'setup' || !state.setupInteraction) {
    return;
  }
  const interaction = state.setupInteraction;

  if (interaction.kind === 'draw-room') {
    const point = getGridPointFromEvent(event);
    if (!point) {
      return;
    }
    state.setupDraft = buildDraftRoom(interaction.start, point);
    setSetupPointerOverlay(state.setupDraft, event, state.setupDraft.valid === false ? 'invalid' : 'draw');
    render();
    return;
  }

  if (interaction.kind === 'move-room') {
    const dx = Math.round((event.clientX - interaction.startClientX) / interaction.metrics.cellWidth);
    const dy = Math.round((event.clientY - interaction.startClientY) / interaction.metrics.cellHeight);
    const candidate = {
      ...interaction.original,
      x: clamp(interaction.original.x + dx, 0, MAP_GRID_COLS - interaction.original.w),
      y: clamp(interaction.original.y + dy, 0, MAP_GRID_ROWS - interaction.original.h),
    };
    if (canPlaceRoom(candidate, interaction.roomId)) {
      state.rooms = state.rooms.map((room) => (room.id === interaction.roomId ? { ...room, x: candidate.x, y: candidate.y } : room));
      setSetupPointerOverlay(candidate, event, 'move');
      render();
    }
    return;
  }

  if (interaction.kind === 'resize-room') {
    const dx = Math.round((event.clientX - interaction.startClientX) / interaction.metrics.cellWidth);
    const dy = Math.round((event.clientY - interaction.startClientY) / interaction.metrics.cellHeight);
    const candidate = calculateResizeCandidate(interaction.original, interaction.direction || 'se', dx, dy);
    if (canPlaceRoom(candidate, interaction.roomId)) {
      state.rooms = state.rooms.map((room) => (room.id === interaction.roomId ? { ...room, x: candidate.x, y: candidate.y, w: candidate.w, h: candidate.h } : room));
      setSetupPointerOverlay(candidate, event, 'resize');
      render();
    }
    return;
  }

  if (interaction.kind === 'move-device') {
    const roomEl = document.querySelector(`#setup-view [data-room-id="${interaction.roomId}"]`);
    if (!roomEl) {
      return;
    }
    const rect = roomEl.getBoundingClientRect();
    const xPct = clamp((event.clientX - rect.left) / rect.width, 0.16, 0.84);
    const yPct = clamp((event.clientY - rect.top) / rect.height, 0.22, 0.84);
    state.appliances = state.appliances.map((device) => (
      device.deviceId === interaction.deviceId ? { ...device, xPct, yPct } : device
    ));
    clearSetupPointerOverlay();
    render();
  }
}

function handleSetupPointerUp() {
  if (state.currentView !== 'setup' || !state.setupInteraction) {
    return;
  }
  if (state.setupInteraction.kind === 'draw-room') {
    if (state.setupDraft && state.setupDraft.valid !== false) {
      const newRoom = createRoom({
        ...state.setupDraft,
        name: uniqueRoomName(state.setupDraft.name, state.rooms),
      });
      state.rooms = state.rooms.concat(newRoom);
      state.setupSelectedRoomId = newRoom.id;
      state.selectedRoom = newRoom.id;
      showSetupMessage(`${newRoom.name} added to the blueprint.`, 'success');
    } else {
      showSetupMessage('That room overlaps another room or goes outside the blueprint. Try again.', 'error');
    }
    state.setupDraft = null;
  }
  state.setupInteraction = null;
  clearSetupPointerOverlay();
  updateFloorMetrics();
  render();
}

function handleSetupPrev() {
  if (state.setupStep > 1) {
    state.setupStep -= 1;
    clearSetupPointerOverlay();
    showSetupMessage('', '');
    render();
  }
}

function handleSetupNext() {
  goToSetupStep(state.setupStep + 1);
}

function handleLogout() {
  storageClear();
  clearTimeout(saveTimerId);
  stopLiveUpdates();
  state.token = null;
  state.user = null;
  state.rooms = [];
  state.appliances = [];
  state.setupCompleted = false;
  state.setupStep = 1;
  state.setupSelectedRoomId = null;
  state.selectedRoom = null;
  state.setupDraft = null;
  state.setupInteraction = null;
  state.setupPointerOverlay = null;
  state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS);
  state.smtpConfig = buildSmtpState({});
  state.smtpStatusMessage = null;
  state.smtpBusy = false;
  state.smtpBusyAction = '';
  state.smtpTestEmail = '';
  updateFloorMetrics();
  showGlobalMessage('', '');
  showSetupMessage('', '');
  showAuth();
}


const setupPerfRuntime = {
  rafId: 0,
  pointer: null,
  board: null,
  previewEl: null,
  overlayEl: null,
  roomEl: null,
  deviceEl: null,
};

function resetSetupPerfRuntime() {
  if (setupPerfRuntime.rafId) {
    window.cancelAnimationFrame(setupPerfRuntime.rafId);
  }
  setupPerfRuntime.rafId = 0;
  setupPerfRuntime.pointer = null;
  setupPerfRuntime.board = null;
  setupPerfRuntime.previewEl = null;
  setupPerfRuntime.overlayEl = null;
  setupPerfRuntime.roomEl = null;
  setupPerfRuntime.deviceEl = null;
}

function primeSetupPerfRuntime() {
  setupPerfRuntime.board = $('setup-board');
  if (!setupPerfRuntime.board) {
    return;
  }
  setupPerfRuntime.previewEl = setupPerfRuntime.board.querySelector('.floor-room-preview');
  setupPerfRuntime.overlayEl = setupPerfRuntime.board.querySelector('.setup-dimension-badge');
  setupPerfRuntime.roomEl = state.setupInteraction && state.setupInteraction.roomId
    ? document.querySelector(`#setup-view .floor-room[data-room-id="${state.setupInteraction.roomId}"]`)
    : null;
  setupPerfRuntime.deviceEl = state.setupInteraction && state.setupInteraction.deviceId
    ? document.querySelector(`#setup-view [data-setup-device-id="${state.setupInteraction.deviceId}"]`)
    : null;
}

function ensureSetupPreviewEl() {
  if (!setupPerfRuntime.board) {
    return null;
  }
  if (setupPerfRuntime.previewEl && document.body.contains(setupPerfRuntime.previewEl)) {
    return setupPerfRuntime.previewEl;
  }
  const preview = document.createElement('article');
  preview.className = 'floor-room-preview';
  preview.innerHTML = '<div class="floor-room-title"><strong></strong><span></span></div>';
  setupPerfRuntime.board.appendChild(preview);
  setupPerfRuntime.previewEl = preview;
  return preview;
}

function ensureSetupOverlayEl() {
  if (!setupPerfRuntime.board) {
    return null;
  }
  if (setupPerfRuntime.overlayEl && document.body.contains(setupPerfRuntime.overlayEl)) {
    return setupPerfRuntime.overlayEl;
  }
  const overlay = document.createElement('div');
  overlay.className = 'setup-dimension-badge';
  overlay.innerHTML = '<strong></strong><span></span>';
  setupPerfRuntime.board.appendChild(overlay);
  setupPerfRuntime.overlayEl = overlay;
  return overlay;
}

function getGridPointFromMetrics(pointer, metrics) {
  if (!pointer || !metrics) {
    return null;
  }
  return {
    metrics,
    x: clamp(Math.floor((pointer.clientX - metrics.rect.left) / metrics.cellWidth), 0, MAP_GRID_COLS - 1),
    y: clamp(Math.floor((pointer.clientY - metrics.rect.top) / metrics.cellHeight), 0, MAP_GRID_ROWS - 1),
  };
}

function buildSetupOverlayState(roomLike, pointer, modeLabel, metrics) {
  if (!roomLike || !pointer || !metrics) {
    return null;
  }
  return {
    xPct: clamp((pointer.clientX - metrics.rect.left) / metrics.rect.width, 0.08, 0.92),
    yPct: clamp((pointer.clientY - metrics.rect.top) / metrics.rect.height, 0.08, 0.9),
    primary: setupDimensionPrimary(roomLike),
    secondary: `${setupDimensionSecondary(roomLike)}${modeLabel ? ` - ${modeLabel}` : ''}`,
  };
}

function patchSetupOverlayNode(overlayState) {
  const overlayEl = ensureSetupOverlayEl();
  if (!overlayEl || !overlayState) {
    return;
  }
  overlayEl.style.left = `${(overlayState.xPct * 100).toFixed(2)}%`;
  overlayEl.style.top = `${(overlayState.yPct * 100).toFixed(2)}%`;
  const strong = overlayEl.querySelector('strong');
  const span = overlayEl.querySelector('span');
  if (strong) {
    strong.textContent = overlayState.primary;
  }
  if (span) {
    span.textContent = overlayState.secondary;
  }
}

function patchSetupPreviewNode(draft) {
  const previewEl = ensureSetupPreviewEl();
  if (!previewEl || !draft) {
    return;
  }
  previewEl.style.cssText = roomInlineStyle(draft);
  const strong = previewEl.querySelector('strong');
  const span = previewEl.querySelector('span');
  if (strong) {
    strong.textContent = draft.name;
  }
  if (span) {
    span.textContent = draft.valid === false ? 'Placement invalid' : setupDimensionPrimary(draft);
  }
}

function patchSetupRoomNode(roomLike) {
  const roomId = roomLike && roomLike.id ? roomLike.id : state.setupInteraction && state.setupInteraction.roomId;
  if (!roomId) {
    return;
  }
  if (!setupPerfRuntime.roomEl || !document.body.contains(setupPerfRuntime.roomEl)) {
    setupPerfRuntime.roomEl = document.querySelector(`#setup-view .floor-room[data-room-id="${roomId}"]`);
  }
  const roomEl = setupPerfRuntime.roomEl;
  if (!roomEl || !roomLike) {
    return;
  }
  roomEl.style.cssText = roomInlineStyle(roomLike);
  const caption = roomEl.querySelector('.floor-room-title span');
  if (caption) {
    caption.textContent = `${setupDimensionPrimary(roomLike)} - ${roomLike.w}x${roomLike.h} units`;
  }
}

function patchSetupDeviceNode(deviceLike) {
  const deviceId = deviceLike && deviceLike.deviceId ? deviceLike.deviceId : state.setupInteraction && state.setupInteraction.deviceId;
  if (!deviceId) {
    return;
  }
  if (!setupPerfRuntime.deviceEl || !document.body.contains(setupPerfRuntime.deviceEl)) {
    setupPerfRuntime.deviceEl = document.querySelector(`#setup-view [data-setup-device-id="${deviceId}"]`);
  }
  const deviceEl = setupPerfRuntime.deviceEl;
  if (!deviceEl || !deviceLike) {
    return;
  }
  deviceEl.style.left = `${(deviceLike.xPct * 100).toFixed(2)}%`;
  deviceEl.style.top = `${(deviceLike.yPct * 100).toFixed(2)}%`;
}

function applySetupInteractionFrame(pointer) {
  const interaction = state.setupInteraction;
  if (!interaction || !pointer || state.currentView !== 'setup') {
    return;
  }
  if (!setupPerfRuntime.board || !document.body.contains(setupPerfRuntime.board)) {
    primeSetupPerfRuntime();
  }
  const metrics = interaction.metrics || (setupPerfRuntime.board ? getBoardMetrics(setupPerfRuntime.board) : null);
  if (!metrics) {
    return;
  }

  if (interaction.kind === 'draw-room') {
    const point = getGridPointFromMetrics(pointer, metrics);
    if (!point) {
      return;
    }
    const draft = buildDraftRoom(interaction.start, point);
    state.setupDraft = draft;
    state.setupPointerOverlay = buildSetupOverlayState(draft, pointer, draft.valid === false ? 'invalid' : 'drawing', metrics);
    patchSetupPreviewNode(draft);
    patchSetupOverlayNode(state.setupPointerOverlay);
    return;
  }

  if (interaction.kind === 'move-room') {
    const dx = Math.round((pointer.clientX - interaction.startClientX) / metrics.cellWidth);
    const dy = Math.round((pointer.clientY - interaction.startClientY) / metrics.cellHeight);
    const candidate = {
      ...interaction.original,
      x: clamp(interaction.original.x + dx, 0, MAP_GRID_COLS - interaction.original.w),
      y: clamp(interaction.original.y + dy, 0, MAP_GRID_ROWS - interaction.original.h),
    };
    if (!canPlaceRoom(candidate, interaction.roomId)) {
      return;
    }
    const room = getRoomById(interaction.roomId);
    if (!room) {
      return;
    }
    room.x = candidate.x;
    room.y = candidate.y;
    state.setupPointerOverlay = buildSetupOverlayState(room, pointer, 'moving', metrics);
    patchSetupRoomNode(room);
    patchSetupOverlayNode(state.setupPointerOverlay);
    return;
  }

  if (interaction.kind === 'resize-room') {
    const dx = Math.round((pointer.clientX - interaction.startClientX) / metrics.cellWidth);
    const dy = Math.round((pointer.clientY - interaction.startClientY) / metrics.cellHeight);
    const candidate = calculateResizeCandidate(interaction.original, interaction.direction || 'se', dx, dy);
    if (!canPlaceRoom(candidate, interaction.roomId)) {
      return;
    }
    const room = getRoomById(interaction.roomId);
    if (!room) {
      return;
    }
    room.x = candidate.x;
    room.y = candidate.y;
    room.w = candidate.w;
    room.h = candidate.h;
    state.setupPointerOverlay = buildSetupOverlayState(room, pointer, 'resizing', metrics);
    patchSetupRoomNode(room);
    patchSetupOverlayNode(state.setupPointerOverlay);
    return;
  }

  if (interaction.kind === 'move-device') {
    const roomEl = document.querySelector(`#setup-view [data-room-id="${interaction.roomId}"]`);
    if (!roomEl) {
      return;
    }
    const rect = roomEl.getBoundingClientRect();
    const xPct = clamp((pointer.clientX - rect.left) / rect.width, 0.16, 0.84);
    const yPct = clamp((pointer.clientY - rect.top) / rect.height, 0.22, 0.84);
    const device = state.appliances.find((item) => item.deviceId === interaction.deviceId);
    if (!device) {
      return;
    }
    device.xPct = xPct;
    device.yPct = yPct;
    patchSetupDeviceNode(device);
  }
}

function scheduleSetupInteractionFrame(pointer) {
  setupPerfRuntime.pointer = pointer;
  if (setupPerfRuntime.rafId) {
    return;
  }
  setupPerfRuntime.rafId = window.requestAnimationFrame(() => {
    setupPerfRuntime.rafId = 0;
    const nextPointer = setupPerfRuntime.pointer;
    if (!nextPointer) {
      return;
    }
    applySetupInteractionFrame(nextPointer);
  });
}

function commitSetupInteractionFrame() {
  if (!state.setupInteraction || !setupPerfRuntime.pointer) {
    return;
  }
  if (setupPerfRuntime.rafId) {
    window.cancelAnimationFrame(setupPerfRuntime.rafId);
    setupPerfRuntime.rafId = 0;
  }
  applySetupInteractionFrame(setupPerfRuntime.pointer);
}

function handleSetupPointerDown(event) {
  if (state.currentView !== 'setup') {
    return;
  }

  const boardPoint = getGridPointFromEvent(event);
  if (!boardPoint) {
    return;
  }

  const resizeHandle = event.target.closest('[data-room-handle^="resize-"]');
  const roomHandle = event.target.closest('[data-room-handle="move"]');
  const roomEl = event.target.closest('.floor-room[data-room-id]');
  const deviceChip = event.target.closest('[data-setup-device-id]');

  if (state.setupStep === 2 && deviceChip) {
    event.preventDefault();
    state.setupSelectedRoomId = deviceChip.dataset.deviceRoomId || state.setupSelectedRoomId;
    state.setupInteraction = {
      kind: 'move-device',
      deviceId: deviceChip.dataset.setupDeviceId,
      roomId: deviceChip.dataset.deviceRoomId,
    };
    state.setupPointerOverlay = null;
    render();
    primeSetupPerfRuntime();
    return;
  }

  if (resizeHandle) {
    event.preventDefault();
    const room = getRoomById(resizeHandle.dataset.roomId);
    if (!room) {
      return;
    }
    state.setupSelectedRoomId = room.id;
    state.setupInteraction = {
      kind: 'resize-room',
      direction: String(resizeHandle.dataset.roomHandle || 'resize-se').replace('resize-', ''),
      roomId: room.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      original: { ...room },
      metrics: boardPoint.metrics,
    };
    state.setupPointerOverlay = buildSetupOverlayState(room, { clientX: event.clientX, clientY: event.clientY }, 'resizing', boardPoint.metrics);
    render();
    primeSetupPerfRuntime();
    patchSetupOverlayNode(state.setupPointerOverlay);
    return;
  }

  if (roomHandle && roomEl) {
    event.preventDefault();
    const room = getRoomById(roomEl.dataset.roomId);
    if (!room) {
      return;
    }
    state.setupSelectedRoomId = room.id;
    state.setupInteraction = {
      kind: 'move-room',
      roomId: room.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      original: { ...room },
      metrics: boardPoint.metrics,
    };
    state.setupPointerOverlay = buildSetupOverlayState(room, { clientX: event.clientX, clientY: event.clientY }, 'moving', boardPoint.metrics);
    render();
    primeSetupPerfRuntime();
    patchSetupOverlayNode(state.setupPointerOverlay);
    return;
  }

  if (roomEl) {
    state.setupSelectedRoomId = roomEl.dataset.roomId;
    render();
    return;
  }

  if (state.setupStep === 1) {
    event.preventDefault();
    state.setupInteraction = {
      kind: 'draw-room',
      start: { x: boardPoint.x, y: boardPoint.y },
      metrics: boardPoint.metrics,
    };
    state.setupDraft = buildDraftRoom(state.setupInteraction.start, state.setupInteraction.start);
    state.setupPointerOverlay = buildSetupOverlayState(state.setupDraft, { clientX: event.clientX, clientY: event.clientY }, 'drawing', boardPoint.metrics);
    render();
    primeSetupPerfRuntime();
    patchSetupPreviewNode(state.setupDraft);
    patchSetupOverlayNode(state.setupPointerOverlay);
  }
}

function handleSetupPointerMove(event) {
  if (state.currentView !== 'setup' || !state.setupInteraction) {
    return;
  }
  scheduleSetupInteractionFrame({ clientX: event.clientX, clientY: event.clientY });
}

function handleSetupPointerUp() {
  if (state.currentView !== 'setup' || !state.setupInteraction) {
    return;
  }
  commitSetupInteractionFrame();
  if (state.setupInteraction.kind === 'draw-room') {
    if (state.setupDraft && state.setupDraft.valid !== false) {
      const newRoom = createRoom({
        ...state.setupDraft,
        name: uniqueRoomName(state.setupDraft.name, state.rooms),
      });
      state.rooms = state.rooms.concat(newRoom);
      state.setupSelectedRoomId = newRoom.id;
      state.selectedRoom = newRoom.id;
      showSetupMessage(`${newRoom.name} added to the blueprint.`, 'success');
    } else {
      showSetupMessage('That room overlaps another room or goes outside the blueprint. Try again.', 'error');
    }
    state.setupDraft = null;
  }
  state.setupInteraction = null;
  clearSetupPointerOverlay();
  resetSetupPerfRuntime();
  updateFloorMetrics();
  render();
}

function buildLayoutRoomsPayload() {
  return state.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    type: room.type,
    x: room.x,
    y: room.y,
    width: room.w,
    height: room.h,
    w: room.w,
    h: room.h,
    threshold: room.threshold,
  }));
}

function buildLayoutDevicesPayload() {
  return state.appliances.map((device) => ({
    id: device.deviceId,
    deviceId: device.deviceId,
    roomId: device.roomId,
    room: device.room,
    type: device.type,
    name: device.name,
    power: device.watts,
    watts: device.watts,
    isOn: device.on,
    on: device.on,
    x: device.xPct,
    y: device.yPct,
    xPct: device.xPct,
    yPct: device.yPct,
    highUsage: device.highUsage,
    dailyHours: device.dailyHours,
  }));
}

function normalizeLoadedLayoutDevices(devices) {
  return Array.isArray(devices)
    ? devices.map((device) => ({
        deviceId: device.deviceId || device.id,
        roomId: device.roomId,
        room: device.room,
        name: device.name,
        type: device.type,
        watts: device.watts != null ? device.watts : device.power,
        dailyHours: device.dailyHours,
        on: device.on != null ? device.on : device.isOn,
        highUsage: device.highUsage,
        xPct: device.xPct != null ? device.xPct : device.x,
        yPct: device.yPct != null ? device.yPct : device.y,
      }))
    : [];
}

function buildLayoutSavePayload() {
  const devices = buildLayoutDevicesPayload();
  return {
    rooms: buildLayoutRoomsPayload(),
    devices,
    appliances: devices,
    metrics: state.metrics,
    dailyHistory: state.dailyHistory,
    settings: {
      dailyLimit: state.dailyLimit,
      darkMode: state.darkMode,
      notifications: state.notificationPrefs,
    },
    setupCompleted: true,
  };
}

async function hydrateUsage() {
  const [usage, layoutResponse] = await Promise.all([
    apiRequest('/usage-data'),
    apiRequest('/get-layout').catch(() => null),
  ]);

  const layoutRooms = layoutResponse && Array.isArray(layoutResponse.rooms) && layoutResponse.rooms.length
    ? layoutResponse.rooms.map((room) => ({
        ...room,
        w: room.w != null ? room.w : room.width,
        h: room.h != null ? room.h : room.height,
      }))
    : usage.rooms;

  const layoutDevices = layoutResponse && Array.isArray(layoutResponse.devices)
    ? normalizeLoadedLayoutDevices(layoutResponse.devices)
    : Array.isArray(usage.appliances)
      ? usage.appliances
      : [];

  state.rooms = normalizeRooms(layoutRooms, layoutDevices);
  state.appliances = mergeAppliances(layoutDevices.length ? layoutDevices : usage.appliances);
  state.setupCompleted = layoutResponse && typeof layoutResponse.setupCompleted === 'boolean'
    ? layoutResponse.setupCompleted
    : typeof usage.setupCompleted === 'boolean'
      ? usage.setupCompleted
      : Boolean(state.rooms.length && state.appliances.length);
  state.dailyLimit = usage.settings && usage.settings.dailyLimit ? Number(usage.settings.dailyLimit) : 28;
  state.darkMode = usage.settings ? usage.settings.darkMode !== false : true;
  state.notificationPrefs = Object.assign({}, DEFAULT_NOTIFICATIONS, usage.settings && usage.settings.notifications ? usage.settings.notifications : {});
  state.metrics = usage.latestMetrics && usage.latestMetrics.todayUsage
    ? { ...usage.latestMetrics, activeDevices: state.appliances.filter((item) => item.on).length }
    : computeMetrics(state.appliances, null, state.dailyLimit);
  state.dailyHistory = Array.isArray(usage.dailyHistory) && usage.dailyHistory.length
    ? syncTodayHistory(usage.dailyHistory, state.metrics.todayUsage)
    : createHistory(state.metrics.todayUsage);
  syncRoomSelections();
}

async function saveSetupConfiguration() {
  if (!state.rooms.length) {
    showSetupMessage('Please add at least one room first.', 'error');
    render();
    return;
  }

  if (!state.appliances.length) {
    showSetupMessage('Please add devices before continuing.', 'error');
    render();
    return;
  }

  const previousSetupState = state.setupCompleted;
  try {
    state.setupCompleted = true;
    state.saveStatus = 'Saving...';
    updateFloorMetrics();
    showSetupMessage('Saving your custom house map...', 'warn');
    render();

    const saveButton = $('setup-save');
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
    }
    updateProfileChrome();

    const response = await apiRequest('/save-layout', {
      method: 'POST',
      body: JSON.stringify(buildLayoutSavePayload()),
    });

    if (response && response.layout) {
      const layoutRooms = Array.isArray(response.layout.rooms)
        ? response.layout.rooms.map((room) => ({
            ...room,
            w: room.w != null ? room.w : room.width,
            h: room.h != null ? room.h : room.height,
          }))
        : state.rooms;
      const layoutDevices = normalizeLoadedLayoutDevices(response.layout.devices || []);
      state.rooms = normalizeRooms(layoutRooms, layoutDevices);
      state.appliances = mergeAppliances(layoutDevices);
      state.setupCompleted = response.layout.setupCompleted !== false;
      syncRoomSelections();
      updateFloorMetrics();
    }

    state.saveStatus = 'Saved';
    storageSave({ token: state.token, user: state.user });
    showSetupMessage('Saved successfully.', 'success');
    showGlobalMessage('Saved successfully. Your custom grid layout will load automatically next time.', 'success');
    showApp();
  } catch (error) {
    state.setupCompleted = previousSetupState;
    state.saveStatus = 'Offline';
    updateProfileChrome();
    showSetupMessage(friendlyFetchError(error), 'error');
    render();
  }
}

state.layoutSaveBusy = false;

async function handleUpdate(event) {
  if (event) {
    event.preventDefault();
  }

  if (state.layoutSaveBusy) {
    return;
  }

  if (!state.rooms.length) {
    showSetupMessage('Please add at least one room first.', 'error');
    render();
    return;
  }

  if (!state.appliances.length) {
    showSetupMessage('Please add devices before continuing.', 'error');
    render();
    return;
  }

  const saveButton = $('setup-save');
  const previousSetupState = state.setupCompleted;

  try {
    state.layoutSaveBusy = true;
    state.setupCompleted = true;
    state.saveStatus = 'Saving...';
    updateFloorMetrics();
    showSetupMessage('Saving your updated house map...', 'warn');

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Updating...';
    }

    updateProfileChrome();

    const response = await apiRequest('/save-layout', {
      method: 'POST',
      body: JSON.stringify(buildLayoutSavePayload()),
    });

    if (response && response.layout) {
      const layoutRooms = Array.isArray(response.layout.rooms)
        ? response.layout.rooms.map((room) => ({
            ...room,
            w: room.w != null ? room.w : room.width,
            h: room.h != null ? room.h : room.height,
          }))
        : state.rooms;
      const layoutDevices = normalizeLoadedLayoutDevices(response.layout.devices || []);
      state.rooms = normalizeRooms(layoutRooms, layoutDevices);
      state.appliances = mergeAppliances(layoutDevices);
      state.setupCompleted = response.layout.setupCompleted !== false;
      syncRoomSelections();
      updateFloorMetrics();
    }

    state.saveStatus = 'Saved';
    storageSave({ token: state.token, user: state.user });
    showSetupMessage('Saved successfully.', 'success');
    showGlobalMessage('Saved successfully. Your updated layout is now stored in the backend.', 'success');
    showApp();
  } catch (error) {
    state.setupCompleted = previousSetupState;
    state.saveStatus = 'Offline';
    const message = friendlyFetchError(error);
    showSetupMessage(message, 'error');
    showGlobalMessage(`Layout update failed: ${message}`, 'error');
    render();
  } finally {
    state.layoutSaveBusy = false;
    updateProfileChrome();
  }
}

saveSetupConfiguration = handleUpdate;

const previousAttachSetupHandlersWithUpdate = attachSetupHandlers;
attachSetupHandlers = function attachSetupHandlers() {
  previousAttachSetupHandlersWithUpdate();
  const saveButton = $('setup-save');
  if (saveButton) {
    saveButton.onclick = handleUpdate;
  }
};

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function resolveConfiguredApiBase() {
  const runtimeConfig = window.__APP_CONFIG__ || {};
  const explicit = trimTrailingSlash(runtimeConfig.apiBaseUrl || runtimeConfig.apiUrl || window.API_URL || '');
  if (explicit) {
    return explicit;
  }

  if (window.location.protocol === 'file:') {
    return 'http://localhost:5000';
  }

  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalHost && window.location.port && window.location.port !== '5000') {
    return 'http://localhost:5000';
  }

  return trimTrailingSlash(window.location.origin || '');
}

function apiUrl(path) {
  const base = resolveConfiguredApiBase();
  return `${base}${path}`;
}

function friendlyFetchError(error) {
  const message = error && error.message ? error.message : '';
  if (message === 'Authentication required.' || message === 'Invalid token.' || message === 'Token expired.') {
    return 'Your session has expired. Please log in again.';
  }
  if (message === 'No token provided.') {
    return 'Please log in to continue.';
  }
  if (error && error.name === 'TypeError') {
    const base = resolveConfiguredApiBase();
    return `Cannot reach backend server at ${base}. Check that the backend is running or that the hosted API URL is configured correctly.`;
  }
  return message || 'Request failed';
}
