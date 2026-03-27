const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 5000;
const APP_DIR = __dirname;
const DATA_DIR = path.join(APP_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const JWT_SECRET = process.env.JWT_SECRET || 'smart-electricity-local-secret';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      users: [],
      profiles: {},
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function base64url(input) {
  const value = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input).toString('base64');
  return value.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(content).digest('base64');
  const encodedSignature = signature.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${content}.${encodedSignature}`;
}

function verifyJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const content = `${encodedHeader}.${encodedPayload}`;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(content).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  if (expected !== encodedSignature) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  if (payload.exp && Date.now() > payload.exp) {
    throw new Error('Token expired');
  }

  return payload;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function comparePassword(password, stored) {
  const [salt, originalHash] = String(stored || '').split(':');
  if (!salt || !originalHash) {
    return false;
  }
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  applyCors(res);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { message: 'Not found' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  applyCors(res);
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(content);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthResult(req) {
  const header = req.headers.authorization || '';
  if (!header) {
    return { ok: false, status: 401, message: 'No token provided.' };
  }
  if (!header.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Invalid token.' };
  }

  try {
    return { ok: true, user: verifyJwt(header.slice(7)) };
  } catch (error) {
    return {
      ok: false,
      status: 401,
      message: error && error.message === 'Token expired' ? 'Token expired.' : 'Invalid token.',
    };
  }
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function defaultProfile() {
  return {
    latestMetrics: {
      liveLoadKw: 0,
      todayUsage: 0,
      weeklyUsage: 0,
      monthlyUsage: 0,
      voltage: 0,
      current: 0,
      billEstimate: 0,
      lowVoltage: false,
      overLimit: false,
      peakHour: false,
      lastSyncedAt: new Date().toISOString(),
    },
    appliances: [],
    dailyHistory: [],
    settings: {
      dailyLimit: 28,
      darkMode: true,
    },
  };
}

function sanitizeMetrics(metrics) {
  const source = metrics || {};
  return {
    liveLoadKw: Number(source.liveLoadKw) || 0,
    todayUsage: Number(source.todayUsage) || 0,
    weeklyUsage: Number(source.weeklyUsage) || 0,
    monthlyUsage: Number(source.monthlyUsage) || 0,
    voltage: Number(source.voltage) || 0,
    current: Number(source.current) || 0,
    billEstimate: Number(source.billEstimate) || 0,
    lowVoltage: Boolean(source.lowVoltage),
    overLimit: Boolean(source.overLimit),
    peakHour: Boolean(source.peakHour),
    lastSyncedAt: source.lastSyncedAt || new Date().toISOString(),
  };
}

function sanitizeAppliances(appliances) {
  return Array.isArray(appliances)
    ? appliances.map((item) => ({
        deviceId: String(item.deviceId || ''),
        room: String(item.room || ''),
        name: String(item.name || ''),
        type: String(item.type || ''),
        watts: Number(item.watts) || 0,
        on: Boolean(item.on),
        highUsage: Boolean(item.highUsage),
      }))
    : [];
}

function sanitizeHistory(history) {
  return Array.isArray(history)
    ? history
        .map((item) => ({
          date: String(item.date || ''),
          totalKwh: Number(item.totalKwh) || 0,
        }))
        .filter((item) => item.date)
        .slice(-31)
    : [];
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/signup') {
    const body = await parseBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || password.length < 6) {
      sendJson(res, 400, { message: 'Name, valid email, and a 6+ character password are required.' });
      return true;
    }

    const store = readStore();
    if (store.users.some((user) => user.email === email)) {
      sendJson(res, 409, { message: 'An account with this email already exists.' });
      return true;
    }

    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    store.users.push(user);
    store.profiles[user.id] = defaultProfile();
    writeStore(store);

    const token = signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    sendJson(res, 201, { token, user: sanitizeUser(user), settings: store.profiles[user.id].settings });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const store = readStore();
    const user = store.users.find((entry) => entry.email === email);

    if (!user || !comparePassword(password, user.passwordHash)) {
      sendJson(res, 401, { message: 'Invalid email or password.' });
      return true;
    }

    const token = signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    sendJson(res, 200, { token, user: sanitizeUser(user), settings: (store.profiles[user.id] || defaultProfile()).settings });
    return true;
  }

  if (url.pathname === '/user-data' || url.pathname === '/save-usage' || url.pathname === '/usage-data') {
    const authResult = getAuthResult(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status || 401, { message: authResult.message || 'Authentication required.' });
      return true;
    }

    const authUser = authResult.user;
    const store = readStore();
    const user = store.users.find((entry) => entry.id === authUser.id);
    if (!user) {
      sendJson(res, 404, { message: 'User not found.' });
      return true;
    }

    if (!store.profiles[user.id]) {
      store.profiles[user.id] = defaultProfile();
      writeStore(store);
    }

    if (req.method === 'GET' && url.pathname === '/user-data') {
      sendJson(res, 200, { user: sanitizeUser(user), settings: store.profiles[user.id].settings });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/usage-data') {
      sendJson(res, 200, store.profiles[user.id]);
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/save-usage') {
      const body = await parseBody(req);
      store.profiles[user.id] = {
        latestMetrics: sanitizeMetrics(body.metrics),
        appliances: sanitizeAppliances(body.appliances),
        dailyHistory: sanitizeHistory(body.dailyHistory),
        settings: {
          dailyLimit: Number(body.settings?.dailyLimit) || 28,
          darkMode: body.settings?.darkMode !== false,
        },
      };
      writeStore(store);
      sendJson(res, 200, { message: 'Usage saved successfully.', profile: store.profiles[user.id] });
      return true;
    }
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      applyCors(res);
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (await handleApi(req, res, url)) {
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 404, { message: 'Not found' });
      return;
    }

    const safePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.join(APP_DIR, safePath.replace(/^\/+/, ''));

    if (!filePath.startsWith(APP_DIR)) {
      sendJson(res, 403, { message: 'Forbidden' });
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }

    sendFile(res, path.join(APP_DIR, 'index.html'));
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { message: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  ensureStore();
  console.log(`Smart Electricity Tracker running at http://localhost:${PORT}`);
});





MIME_TYPES['.webmanifest'] = 'application/manifest+json; charset=utf-8';
MIME_TYPES['.png'] = 'image/png';

const PROFILE_NOTIFICATION_DEFAULTS = {
  usageLimit: true,
  lowVoltage: true,
  peakHour: true,
  overload: true,
};
const PROFILE_ROOM_THRESHOLDS = {
  living: 2200,
  bedroom: 1800,
  kitchen: 1700,
  bathroom: 1000,
  custom: 1600,
};
const PROFILE_DEFAULT_LAYOUT = [
  { type: 'living', name: 'Living Room', x: 0, y: 0, w: 7, h: 4 },
  { type: 'bedroom', name: 'Bedroom', x: 7, y: 0, w: 5, h: 4 },
  { type: 'kitchen', name: 'Kitchen', x: 0, y: 4, w: 6, h: 6 },
  { type: 'bathroom', name: 'Bathroom', x: 6, y: 4, w: 6, h: 6 },
];
const PROFILE_FALLBACK_LAYOUT = [
  { x: 0, y: 0, w: 6, h: 4 },
  { x: 6, y: 0, w: 6, h: 4 },
  { x: 0, y: 4, w: 6, h: 3 },
  { x: 6, y: 4, w: 6, h: 3 },
  { x: 0, y: 7, w: 6, h: 3 },
  { x: 6, y: 7, w: 6, h: 3 },
];
const PROFILE_DEVICE_DEFAULTS = {
  fan: { watts: 75, dailyHours: 8.2 },
  ac: { watts: 1450, dailyHours: 4.5 },
  light: { watts: 90, dailyHours: 6.5 },
  tv: { watts: 180, dailyHours: 5.2 },
  fridge: { watts: 220, dailyHours: 18.5 },
};

function profileClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function profileRoomThreshold(type) {
  return PROFILE_ROOM_THRESHOLDS[type] || PROFILE_ROOM_THRESHOLDS.custom;
}

function legacyRoomsFromAppliances(appliances) {
  const names = Array.from(new Set((appliances || []).map((item) => String(item.room || '').trim()).filter(Boolean)));
  return names.map((name, index) => {
    const known = PROFILE_DEFAULT_LAYOUT.find((room) => room.name.toLowerCase() === name.toLowerCase());
    const slot = known || PROFILE_FALLBACK_LAYOUT[index % PROFILE_FALLBACK_LAYOUT.length];
    return {
      id: `legacy-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      type: known ? known.type : 'custom',
      name,
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: slot.h,
      threshold: profileRoomThreshold(known ? known.type : 'custom'),
    };
  });
}

function sanitizeRooms(rooms, appliances) {
  const source = Array.isArray(rooms) && rooms.length ? rooms : Array.isArray(appliances) && appliances.length ? legacyRoomsFromAppliances(appliances) : [];
  return source.map((room, index) => ({
    id: String(room.id || `room-${index + 1}`),
    type: String(room.type || 'custom'),
    name: String(room.name || `Room ${index + 1}`),
    x: profileClamp(Math.round(Number(room.x) || 0), 0, 11),
    y: profileClamp(Math.round(Number(room.y) || 0), 0, 9),
    w: profileClamp(Math.round(Number(room.w) || 3), 2, 12),
    h: profileClamp(Math.round(Number(room.h) || 2), 2, 10),
    threshold: Number(room.threshold) || profileRoomThreshold(String(room.type || 'custom')),
  }));
}

function defaultDevicePlacement(type, count) {
  const placements = {
    fan: [0.24, 0.34],
    ac: [0.74, 0.28],
    light: [0.5, 0.18],
    tv: [0.33, 0.72],
    fridge: [0.72, 0.72],
  };
  const base = placements[type] || [0.5, 0.5];
  const nudge = Math.min(count * 0.05, 0.14);
  return {
    xPct: profileClamp(base[0] + (count % 2 ? nudge : -nudge * 0.35), 0.16, 0.84),
    yPct: profileClamp(base[1] + (count > 1 ? nudge * 0.5 : 0), 0.18, 0.84),
  };
}

function sanitizeSettings(settings) {
  return {
    dailyLimit: Number(settings?.dailyLimit) || 28,
    darkMode: settings?.darkMode !== false,
    notifications: Object.assign({}, PROFILE_NOTIFICATION_DEFAULTS, settings?.notifications || {}),
  };
}

function sanitizeAppliances(appliances, rooms) {
  const roomById = Object.fromEntries((rooms || []).map((room) => [room.id, room]));
  const roomByName = Object.fromEntries((rooms || []).map((room) => [room.name.toLowerCase(), room]));
  const roomCounts = {};
  return Array.isArray(appliances)
    ? appliances.map((item, index) => {
        const matchedRoom = roomById[item.roomId] || roomByName[String(item.room || '').toLowerCase()] || rooms[0] || null;
        const type = String(item.type || 'fan');
        const defaults = PROFILE_DEVICE_DEFAULTS[type] || PROFILE_DEVICE_DEFAULTS.fan;
        if (matchedRoom) {
          roomCounts[matchedRoom.id] = roomCounts[matchedRoom.id] || 0;
        }
        const placement = item.xPct != null && item.yPct != null
          ? { xPct: Number(item.xPct), yPct: Number(item.yPct) }
          : defaultDevicePlacement(type, matchedRoom ? roomCounts[matchedRoom.id] : index);
        const normalized = {
          deviceId: String(item.deviceId || `device-${index + 1}`),
          roomId: matchedRoom ? matchedRoom.id : String(item.roomId || ''),
          room: matchedRoom ? matchedRoom.name : String(item.room || ''),
          name: String(item.name || type),
          type,
          watts: Number(item.watts) || defaults.watts,
          dailyHours: Number(item.dailyHours) || defaults.dailyHours,
          on: item.on !== false,
          highUsage: Number(item.watts) >= 1000 || Boolean(item.highUsage),
          xPct: profileClamp(Number(placement.xPct), 0.16, 0.84),
          yPct: profileClamp(Number(placement.yPct), 0.18, 0.84),
        };
        if (matchedRoom) {
          roomCounts[matchedRoom.id] += 1;
        }
        return normalized;
      })
    : [];
}

function defaultProfile() {
  return {
    latestMetrics: {
      liveLoadKw: 0,
      todayUsage: 0,
      weeklyUsage: 0,
      monthlyUsage: 0,
      voltage: 0,
      current: 0,
      billEstimate: 0,
      lowVoltage: false,
      overLimit: false,
      peakHour: false,
      lastSyncedAt: new Date().toISOString(),
    },
    rooms: [],
    appliances: [],
    dailyHistory: [],
    setupCompleted: false,
    settings: sanitizeSettings({}),
  };
}

function normalizeProfile(profile) {
  const source = profile || defaultProfile();
  const rooms = sanitizeRooms(source.rooms, source.appliances);
  const appliances = sanitizeAppliances(source.appliances, rooms);
  return {
    latestMetrics: sanitizeMetrics(source.latestMetrics),
    rooms,
    appliances,
    dailyHistory: sanitizeHistory(source.dailyHistory),
    setupCompleted: typeof source.setupCompleted === 'boolean' ? source.setupCompleted : Boolean(rooms.length && appliances.length),
    settings: sanitizeSettings(source.settings),
  };
}

function ensureProfile(store, userId) {
  const normalized = normalizeProfile(store.profiles[userId]);
  store.profiles[userId] = normalized;
  return normalized;
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/signup') {
    const body = await parseBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || password.length < 6) {
      sendJson(res, 400, { message: 'Name, valid email, and a 6+ character password are required.' });
      return true;
    }

    const store = readStore();
    if (store.users.some((user) => user.email === email)) {
      sendJson(res, 409, { message: 'An account with this email already exists.' });
      return true;
    }

    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    store.users.push(user);
    store.profiles[user.id] = defaultProfile();
    writeStore(store);

    const token = signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    sendJson(res, 201, {
      token,
      user: sanitizeUser(user),
      settings: store.profiles[user.id].settings,
      setupCompleted: store.profiles[user.id].setupCompleted,
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const store = readStore();
    const user = store.users.find((entry) => entry.email === email);

    if (!user || !comparePassword(password, user.passwordHash)) {
      sendJson(res, 401, { message: 'Invalid email or password.' });
      return true;
    }

    const profile = ensureProfile(store, user.id);
    writeStore(store);
    const token = signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    sendJson(res, 200, {
      token,
      user: sanitizeUser(user),
      settings: profile.settings,
      setupCompleted: profile.setupCompleted,
    });
    return true;
  }

  if (url.pathname === '/user-data' || url.pathname === '/usage-data' || url.pathname === '/save-usage' || url.pathname === '/save-layout') {
    const authResult = getAuthResult(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status || 401, { message: authResult.message || 'Authentication required.' });
      return true;
    }

    const authUser = authResult.user;
    const store = readStore();
    const user = store.users.find((entry) => entry.id === authUser.id);
    if (!user) {
      sendJson(res, 404, { message: 'User not found.' });
      return true;
    }

    const profile = ensureProfile(store, user.id);

    if (req.method === 'GET' && url.pathname === '/user-data') {
      writeStore(store);
      sendJson(res, 200, { user: sanitizeUser(user), settings: profile.settings, setupCompleted: profile.setupCompleted });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/usage-data') {
      writeStore(store);
      sendJson(res, 200, profile);
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/save-layout') {
      const body = await parseBody(req);
      const nextProfile = normalizeProfile({
        ...profile,
        latestMetrics: body.metrics || profile.latestMetrics,
        dailyHistory: body.dailyHistory || profile.dailyHistory,
        rooms: body.rooms,
        appliances: body.appliances,
        setupCompleted: body.setupCompleted !== false,
        settings: {
          ...profile.settings,
          ...(body.settings || {}),
        },
      });
      store.profiles[user.id] = nextProfile;
      writeStore(store);
      sendJson(res, 200, { message: 'Layout saved successfully.', profile: nextProfile });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/save-usage') {
      const body = await parseBody(req);
      const nextProfile = normalizeProfile({
        latestMetrics: body.metrics,
        dailyHistory: body.dailyHistory,
        rooms: body.rooms || profile.rooms,
        appliances: body.appliances,
        setupCompleted: body.setupCompleted !== false,
        settings: body.settings || profile.settings,
      });
      store.profiles[user.id] = nextProfile;
      writeStore(store);
      sendJson(res, 200, { message: 'Usage saved successfully.', profile: nextProfile });
      return true;
    }
  }

  return false;
}

const { execFile } = require('child_process');

const OTP_RESET_TTL_MS = 10 * 60 * 1000;
const OTP_RESET_COOLDOWN_MS = 60 * 1000;
const POWERSHELL_EXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

function hashOtp(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function clearPasswordReset(user) {
  if (user && user.passwordReset) {
    delete user.passwordReset;
  }
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function allowDebugOtpPreview() {
  return process.env.RESET_DEBUG_OTP === 'true' || (!smtpConfigured() && process.env.NODE_ENV !== 'production');
}

function sendOtpByEmail({ to, name, otp }) {
  const subject = 'GridSense password reset OTP';
  const body = [
    `Hello ${name || 'there'},`,
    '',
    `Your GridSense password reset OTP is: ${otp}`,
    '',
    'This code expires in 10 minutes.',
    'If you did not request a password reset, you can ignore this email.',
    '',
    'GridSense Control',
  ].join('\r\n');

  if (!smtpConfigured()) {
    if (!allowDebugOtpPreview()) {
      return Promise.reject(new Error('OTP email is not configured on this server yet.'));
    }
    console.log(`[GridSense OTP Preview] ${to} -> ${otp}`);
    return Promise.resolve({ delivery: 'debug', debugOtp: otp });
  }

  const command = [
    '$secure = ConvertTo-SecureString $env:SMTP_PASS -AsPlainText -Force',
    '$credential = New-Object System.Management.Automation.PSCredential($env:SMTP_USER, $secure)',
    '$port = [int]$env:SMTP_PORT',
    "if ($env:SMTP_USE_SSL -eq 'true') {",
    '  Send-MailMessage -To $env:MAIL_TO -From $env:SMTP_FROM -Subject $env:MAIL_SUBJECT -Body $env:MAIL_BODY -SmtpServer $env:SMTP_HOST -Port $port -UseSsl -Credential $credential -ErrorAction Stop',
    '} else {',
    '  Send-MailMessage -To $env:MAIL_TO -From $env:SMTP_FROM -Subject $env:MAIL_SUBJECT -Body $env:MAIL_BODY -SmtpServer $env:SMTP_HOST -Port $port -Credential $credential -ErrorAction Stop',
    '}',
  ].join('; ');

  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL_EXE,
      ['-NoProfile', '-Command', command],
      {
        env: {
          ...process.env,
          MAIL_TO: to,
          MAIL_SUBJECT: subject,
          MAIL_BODY: body,
          SMTP_PORT: String(process.env.SMTP_PORT || 587),
          SMTP_USE_SSL: String(process.env.SMTP_USE_SSL || 'true').toLowerCase(),
        },
        windowsHide: true,
        timeout: 30000,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || stdout || error.message || 'Failed to send OTP email.').trim()));
          return;
        }
        resolve({ delivery: 'email' });
      }
    );
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/forgot-password') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) {
      sendJson(res, 400, { message: 'Please enter your email address.' });
      return true;
    }

    const store = readStore();
    const user = store.users.find((entry) => entry.email === email);
    if (!user) {
      sendJson(res, 200, { message: 'If an account with that email exists, an OTP has been sent.' });
      return true;
    }

    const requestedAt = Number(user.passwordReset?.requestedAt || 0);
    if (requestedAt && Date.now() - requestedAt < OTP_RESET_COOLDOWN_MS) {
      sendJson(res, 429, { message: 'Please wait about a minute before requesting another OTP.' });
      return true;
    }

    const otp = generateOtpCode();
    user.passwordReset = {
      otpHash: hashOtp(otp),
      requestedAt: Date.now(),
      expiresAt: Date.now() + OTP_RESET_TTL_MS,
    };
    writeStore(store);

    try {
      const delivery = await sendOtpByEmail({ to: user.email, name: user.name, otp });
      sendJson(res, 200, {
        message: delivery.delivery === 'debug' ? 'OTP generated in local preview mode. Use the code below to continue.' : 'OTP sent to your email address.',
        delivery: delivery.delivery,
        debugOtp: delivery.debugOtp,
      });
    } catch (error) {
      clearPasswordReset(user);
      writeStore(store);
      sendJson(res, 500, { message: error.message || 'Unable to send OTP email right now.' });
    }
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/reset-password') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const otp = String(body.otp || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!email || !otp) {
      sendJson(res, 400, { message: 'Email and OTP are required.' });
      return true;
    }
    if (newPassword.length < 6) {
      sendJson(res, 400, { message: 'A new password with at least 6 characters is required.' });
      return true;
    }

    const store = readStore();
    const user = store.users.find((entry) => entry.email === email);
    if (!user || !user.passwordReset) {
      sendJson(res, 400, { message: 'Invalid or expired OTP.' });
      return true;
    }

    const resetState = user.passwordReset;
    if (!resetState.expiresAt || Date.now() > Number(resetState.expiresAt)) {
      clearPasswordReset(user);
      writeStore(store);
      sendJson(res, 400, { message: 'OTP has expired. Please request a new one.' });
      return true;
    }

    if (hashOtp(otp) !== resetState.otpHash) {
      sendJson(res, 400, { message: 'Invalid or expired OTP.' });
      return true;
    }

    user.passwordHash = hashPassword(newPassword);
    clearPasswordReset(user);
    writeStore(store);
    sendJson(res, 200, { message: 'Password updated successfully. You can now log in with your new password.' });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/signup') {
    const body = await parseBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || password.length < 6) {
      sendJson(res, 400, { message: 'Name, valid email, and a 6+ character password are required.' });
      return true;
    }

    const store = readStore();
    if (store.users.some((user) => user.email === email)) {
      sendJson(res, 409, { message: 'An account with this email already exists.' });
      return true;
    }

    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    store.users.push(user);
    store.profiles[user.id] = defaultProfile();
    writeStore(store);

    const token = signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    sendJson(res, 201, {
      token,
      user: sanitizeUser(user),
      settings: store.profiles[user.id].settings,
      setupCompleted: store.profiles[user.id].setupCompleted,
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const store = readStore();
    const user = store.users.find((entry) => entry.email === email);

    if (!user || !comparePassword(password, user.passwordHash)) {
      sendJson(res, 401, { message: 'Invalid email or password.' });
      return true;
    }

    const profile = ensureProfile(store, user.id);
    writeStore(store);
    const token = signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    sendJson(res, 200, {
      token,
      user: sanitizeUser(user),
      settings: profile.settings,
      setupCompleted: profile.setupCompleted,
    });
    return true;
  }

  if (url.pathname === '/user-data' || url.pathname === '/usage-data' || url.pathname === '/save-usage' || url.pathname === '/save-layout') {
    const authResult = getAuthResult(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status || 401, { message: authResult.message || 'Authentication required.' });
      return true;
    }

    const authUser = authResult.user;
    const store = readStore();
    const user = store.users.find((entry) => entry.id === authUser.id);
    if (!user) {
      sendJson(res, 404, { message: 'User not found.' });
      return true;
    }

    const profile = ensureProfile(store, user.id);

    if (req.method === 'GET' && url.pathname === '/user-data') {
      writeStore(store);
      sendJson(res, 200, { user: sanitizeUser(user), settings: profile.settings, setupCompleted: profile.setupCompleted });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/usage-data') {
      writeStore(store);
      sendJson(res, 200, profile);
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/save-layout') {
      const body = await parseBody(req);
      const nextProfile = normalizeProfile({
        ...profile,
        latestMetrics: body.metrics || profile.latestMetrics,
        dailyHistory: body.dailyHistory || profile.dailyHistory,
        rooms: body.rooms,
        appliances: body.appliances,
        setupCompleted: body.setupCompleted !== false,
        settings: {
          ...profile.settings,
          ...(body.settings || {}),
        },
      });
      store.profiles[user.id] = nextProfile;
      writeStore(store);
      sendJson(res, 200, { message: 'Layout saved successfully.', profile: nextProfile });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/save-usage') {
      const body = await parseBody(req);
      const nextProfile = normalizeProfile({
        latestMetrics: body.metrics,
        dailyHistory: body.dailyHistory,
        rooms: body.rooms || profile.rooms,
        appliances: body.appliances,
        setupCompleted: body.setupCompleted !== false,
        settings: body.settings || profile.settings,
      });
      store.profiles[user.id] = nextProfile;
      writeStore(store);
      sendJson(res, 200, { message: 'Usage saved successfully.', profile: nextProfile });
      return true;
    }
  }

  return false;
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const seed = {
    users: [],
    profiles: {},
    smtpConfig: {},
  };

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
    let changed = false;
    if (!Array.isArray(parsed.users)) {
      parsed.users = [];
      changed = true;
    }
    if (!parsed.profiles || typeof parsed.profiles !== 'object' || Array.isArray(parsed.profiles)) {
      parsed.profiles = {};
      changed = true;
    }
    if (!parsed.smtpConfig || typeof parsed.smtpConfig !== 'object' || Array.isArray(parsed.smtpConfig)) {
      parsed.smtpConfig = {};
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2));
    }
  } catch (_error) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
}

function readStore() {
  ensureStore();
  const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    profiles: parsed.profiles && typeof parsed.profiles === 'object' && !Array.isArray(parsed.profiles) ? parsed.profiles : {},
    smtpConfig: parsed.smtpConfig && typeof parsed.smtpConfig === 'object' && !Array.isArray(parsed.smtpConfig) ? parsed.smtpConfig : {},
  };
}

function writeStore(store) {
  const next = {
    users: Array.isArray(store?.users) ? store.users : [],
    profiles: store?.profiles && typeof store.profiles === 'object' && !Array.isArray(store.profiles) ? store.profiles : {},
    smtpConfig: store?.smtpConfig && typeof store.smtpConfig === 'object' && !Array.isArray(store.smtpConfig) ? store.smtpConfig : {},
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
}

function normalizeSmtpFlag(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  return !['false', '0', 'no', 'off'].includes(normalized);
}

function normalizeStoredSmtpConfig(source, existing) {
  const input = source && typeof source === 'object' ? source : {};
  const prior = existing && typeof existing === 'object' ? existing : {};
  const hasPassField = Object.prototype.hasOwnProperty.call(input, 'pass');
  return {
    host: String(input.host ?? prior.host ?? '').trim(),
    port: Number(input.port ?? prior.port ?? 587) || 587,
    user: String(input.user ?? prior.user ?? '').trim(),
    pass: hasPassField ? String(input.pass || '').trim() : String(prior.pass || '').trim(),
    from: String(input.from ?? prior.from ?? '').trim(),
    useSsl: normalizeSmtpFlag(input.useSsl, prior.useSsl !== false),
  };
}

function getEnvSmtpConfig() {
  return normalizeStoredSmtpConfig({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
    useSsl: process.env.SMTP_USE_SSL,
  }, { useSsl: true });
}

function getStoredSmtpConfig(store) {
  return normalizeStoredSmtpConfig(store && store.smtpConfig ? store.smtpConfig : {}, { useSsl: true });
}

function isSmtpConfigReady(config) {
  return Boolean(config && config.host && config.user && config.from && config.pass);
}

function resolveSmtpConfig(store) {
  const envConfig = getEnvSmtpConfig();
  if (isSmtpConfigReady(envConfig)) {
    return { source: 'env', config: envConfig };
  }
  const storedConfig = getStoredSmtpConfig(store);
  if (isSmtpConfigReady(storedConfig)) {
    return { source: 'store', config: storedConfig };
  }
  return { source: 'none', config: storedConfig };
}

function clientSmtpConfig(payload) {
  const resolved = payload && payload.config ? payload : { source: 'store', config: payload || {} };
  const config = resolved.config || {};
  return {
    host: String(config.host || ''),
    port: Number(config.port) || 587,
    user: String(config.user || ''),
    from: String(config.from || ''),
    useSsl: config.useSsl !== false,
    configured: isSmtpConfigReady(config),
    hasSavedPassword: Boolean(config.pass),
    source: String(resolved.source || 'store'),
  };
}

function smtpConfigured(store) {
  return isSmtpConfigReady(resolveSmtpConfig(store).config);
}

function allowDebugOtpPreview(store) {
  return process.env.RESET_DEBUG_OTP === 'true' || (!smtpConfigured(store) && process.env.NODE_ENV !== 'production');
}

function sendMailMessage(message, store, options) {
  const payload = message && typeof message === 'object' ? message : {};
  const resolved = options && options.overrideConfig
    ? { source: 'override', config: normalizeStoredSmtpConfig(options.overrideConfig, { useSsl: true }) }
    : resolveSmtpConfig(store);

  if (!isSmtpConfigReady(resolved.config)) {
    if (options && options.allowDebugPreview) {
      const debugSuffix = options.debugValue ? ` -> ${options.debugValue}` : '';
      console.log(`[GridSense ${options.debugLabel || 'Mail Preview'}] ${payload.to || 'unknown'}${debugSuffix}`);
      return Promise.resolve({ delivery: 'debug', debugOtp: options.debugValue });
    }
    return Promise.reject(new Error('SMTP is not configured yet. Open Settings and add the sender mailbox details first.'));
  }

  const smtp = resolved.config;
  const command = [
    '$secure = ConvertTo-SecureString $env:SMTP_PASS -AsPlainText -Force',
    '$credential = New-Object System.Management.Automation.PSCredential($env:SMTP_USER, $secure)',
    '$port = [int]$env:SMTP_PORT',
    "if ($env:SMTP_USE_SSL -eq 'true') {",
    '  Send-MailMessage -To $env:MAIL_TO -From $env:SMTP_FROM -Subject $env:MAIL_SUBJECT -Body $env:MAIL_BODY -SmtpServer $env:SMTP_HOST -Port $port -UseSsl -Credential $credential -ErrorAction Stop',
    '} else {',
    '  Send-MailMessage -To $env:MAIL_TO -From $env:SMTP_FROM -Subject $env:MAIL_SUBJECT -Body $env:MAIL_BODY -SmtpServer $env:SMTP_HOST -Port $port -Credential $credential -ErrorAction Stop',
    '}',
  ].join('; ');

  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL_EXE,
      ['-NoProfile', '-Command', command],
      {
        env: {
          ...process.env,
          MAIL_TO: String(payload.to || ''),
          MAIL_SUBJECT: String(payload.subject || ''),
          MAIL_BODY: String(payload.body || ''),
          SMTP_HOST: smtp.host,
          SMTP_PORT: String(smtp.port || 587),
          SMTP_USER: smtp.user,
          SMTP_PASS: smtp.pass,
          SMTP_FROM: smtp.from,
          SMTP_USE_SSL: String(smtp.useSsl !== false).toLowerCase(),
        },
        windowsHide: true,
        timeout: 30000,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || stdout || error.message || 'Failed to send email.').trim()));
          return;
        }
        resolve({ delivery: 'email' });
      }
    );
  });
}

function sendOtpByEmail(details, store) {
  const payload = details && typeof details === 'object' ? details : {};
  const subject = 'GridSense password reset OTP';
  const body = [
    `Hello ${payload.name || 'there'},`,
    '',
    `Your GridSense password reset OTP is: ${payload.otp}`,
    '',
    'This code expires in 10 minutes.',
    'If you did not request a password reset, you can ignore this email.',
    '',
    'GridSense Control',
  ].join('\r\n');

  return sendMailMessage({ to: payload.to, subject, body }, store, {
    allowDebugPreview: allowDebugOtpPreview(store),
    debugLabel: 'OTP Preview',
    debugValue: payload.otp,
  });
}

function sendTestEmail(details, store) {
  const payload = details && typeof details === 'object' ? details : {};
  const subject = 'GridSense email delivery test';
  const body = [
    `Hello ${payload.name || 'there'},`,
    '',
    'This is a live email delivery test from your Smart Electricity Usage Tracker app.',
    'If you received this message, password reset OTP emails are now configured correctly.',
    '',
    `Sent at: ${new Date().toISOString()}`,
    '',
    'GridSense Control',
  ].join('\r\n');

  return sendMailMessage({ to: payload.to, subject, body }, store, {
    allowDebugPreview: false,
    debugLabel: 'SMTP Test',
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/forgot-password') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) {
      sendJson(res, 400, { message: 'Please enter your email address.' });
      return true;
    }

    const store = readStore();
    const user = store.users.find((entry) => entry.email === email);
    if (!user) {
      sendJson(res, 200, { message: 'If an account with that email exists, an OTP has been sent.' });
      return true;
    }

    const requestedAt = Number(user.passwordReset?.requestedAt || 0);
    if (requestedAt && Date.now() - requestedAt < OTP_RESET_COOLDOWN_MS) {
      sendJson(res, 429, { message: 'Please wait about a minute before requesting another OTP.' });
      return true;
    }

    const otp = generateOtpCode();
    user.passwordReset = {
      otpHash: hashOtp(otp),
      requestedAt: Date.now(),
      expiresAt: Date.now() + OTP_RESET_TTL_MS,
    };
    writeStore(store);

    try {
      const delivery = await sendOtpByEmail({ to: user.email, name: user.name, otp }, store);
      sendJson(res, 200, {
        message: delivery.delivery === 'debug' ? 'OTP generated in local preview mode. Use the code below to continue.' : 'OTP sent to your email address.',
        delivery: delivery.delivery,
        debugOtp: delivery.debugOtp,
      });
    } catch (error) {
      clearPasswordReset(user);
      writeStore(store);
      sendJson(res, 500, { message: error.message || 'Unable to send OTP email right now.' });
    }
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/reset-password') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const otp = String(body.otp || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!email || !otp) {
      sendJson(res, 400, { message: 'Email and OTP are required.' });
      return true;
    }
    if (newPassword.length < 6) {
      sendJson(res, 400, { message: 'A new password with at least 6 characters is required.' });
      return true;
    }

    const store = readStore();
    const user = store.users.find((entry) => entry.email === email);
    if (!user || !user.passwordReset) {
      sendJson(res, 400, { message: 'Invalid or expired OTP.' });
      return true;
    }

    const resetState = user.passwordReset;
    if (!resetState.expiresAt || Date.now() > Number(resetState.expiresAt)) {
      clearPasswordReset(user);
      writeStore(store);
      sendJson(res, 400, { message: 'OTP has expired. Please request a new one.' });
      return true;
    }

    if (hashOtp(otp) !== resetState.otpHash) {
      sendJson(res, 400, { message: 'Invalid or expired OTP.' });
      return true;
    }

    user.passwordHash = hashPassword(newPassword);
    clearPasswordReset(user);
    writeStore(store);
    sendJson(res, 200, { message: 'Password updated successfully. You can now log in with your new password.' });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/signup') {
    const body = await parseBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || password.length < 6) {
      sendJson(res, 400, { message: 'Name, valid email, and a 6+ character password are required.' });
      return true;
    }

    const store = readStore();
    if (store.users.some((user) => user.email === email)) {
      sendJson(res, 409, { message: 'An account with this email already exists.' });
      return true;
    }

    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    store.users.push(user);
    store.profiles[user.id] = defaultProfile();
    writeStore(store);

    const token = signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    sendJson(res, 201, {
      token,
      user: sanitizeUser(user),
      settings: store.profiles[user.id].settings,
      setupCompleted: store.profiles[user.id].setupCompleted,
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      sendJson(res, 400, { message: 'Email and password are required.' });
      return true;
    }

    const store = readStore();
    const user = store.users.find((entry) => entry.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      sendJson(res, 401, { message: 'Invalid email or password.' });
      return true;
    }

    const profile = ensureProfile(store, user.id);
    writeStore(store);
    const token = signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    sendJson(res, 200, {
      token,
      user: sanitizeUser(user),
      settings: profile.settings,
      setupCompleted: profile.setupCompleted,
    });
    return true;
  }

  if (url.pathname === '/user-data' || url.pathname === '/usage-data' || url.pathname === '/save-usage' || url.pathname === '/save-layout' || url.pathname === '/smtp-config' || url.pathname === '/smtp-test-email') {
    const authResult = getAuthResult(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status || 401, { message: authResult.message || 'Authentication required.' });
      return true;
    }

    const authUser = authResult.user;
    const store = readStore();
    const user = store.users.find((entry) => entry.id === authUser.id);
    if (!user) {
      sendJson(res, 404, { message: 'User not found.' });
      return true;
    }

    const profile = ensureProfile(store, user.id);

    if (req.method === 'GET' && url.pathname === '/smtp-config') {
      writeStore(store);
      sendJson(res, 200, { config: clientSmtpConfig(resolveSmtpConfig(store)) });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/smtp-config') {
      const body = await parseBody(req);
      if (body.clear === true) {
        store.smtpConfig = {};
        writeStore(store);
        sendJson(res, 200, {
          message: 'Saved SMTP settings removed. The app will use local OTP preview until you configure email delivery again.',
          config: clientSmtpConfig({ source: 'none', config: {} }),
        });
        return true;
      }

      const nextConfig = normalizeStoredSmtpConfig(body, getStoredSmtpConfig(store));
      if (!nextConfig.host || !nextConfig.user || !nextConfig.from || !nextConfig.pass) {
        sendJson(res, 400, { message: 'SMTP host, username, from email, and password are required to enable real OTP email delivery.' });
        return true;
      }

      store.smtpConfig = nextConfig;
      writeStore(store);
      sendJson(res, 200, {
        message: 'SMTP settings saved. Password reset OTPs will now use real email delivery.',
        config: clientSmtpConfig({ source: 'store', config: nextConfig }),
      });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/smtp-test-email') {
      const body = await parseBody(req);
      const email = String(body.email || user.email || '').trim().toLowerCase();
      if (!email) {
        sendJson(res, 400, { message: 'A test email address is required.' });
        return true;
      }

      try {
        await sendTestEmail({ to: email, name: user.name }, store);
        sendJson(res, 200, { message: `Test email sent to ${email}.` });
      } catch (error) {
        sendJson(res, 502, { message: error.message || 'Unable to send the test email right now.' });
      }
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/user-data') {
      writeStore(store);
      sendJson(res, 200, { user: sanitizeUser(user), settings: profile.settings, setupCompleted: profile.setupCompleted });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/usage-data') {
      writeStore(store);
      sendJson(res, 200, profile);
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/save-layout') {
      const body = await parseBody(req);
      const nextProfile = normalizeProfile({
        ...profile,
        latestMetrics: body.metrics || profile.latestMetrics,
        dailyHistory: body.dailyHistory || profile.dailyHistory,
        rooms: body.rooms,
        appliances: body.appliances,
        setupCompleted: body.setupCompleted !== false,
        settings: {
          ...profile.settings,
          ...(body.settings || {}),
        },
      });
      store.profiles[user.id] = nextProfile;
      writeStore(store);
      sendJson(res, 200, { message: 'Layout saved successfully.', profile: nextProfile });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/save-usage') {
      const body = await parseBody(req);
      const nextProfile = normalizeProfile({
        latestMetrics: body.metrics,
        dailyHistory: body.dailyHistory,
        rooms: body.rooms || profile.rooms,
        appliances: body.appliances,
        setupCompleted: body.setupCompleted !== false,
        settings: body.settings || profile.settings,
      });
      store.profiles[user.id] = nextProfile;
      writeStore(store);
      sendJson(res, 200, { message: 'Usage saved successfully.', profile: nextProfile });
      return true;
    }
  }

  return false;
}

const smtpNet = require('net');
const smtpTls = require('tls');

function openSmtpSocket(config) {
  const smtp = config && typeof config === 'object' ? config : {};
  const port = Number(smtp.port) || 587;
  const useImplicitTls = smtp.useSsl !== false && port === 465;

  return new Promise((resolve, reject) => {
    let settled = false;
    const handleError = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const socket = useImplicitTls
      ? smtpTls.connect({ host: smtp.host, port, servername: smtp.host }, () => {
          if (!settled) {
            settled = true;
            resolve(socket);
          }
        })
      : smtpNet.createConnection({ host: smtp.host, port }, () => {
          if (!settled) {
            settled = true;
            resolve(socket);
          }
        });

    socket.setEncoding('utf8');
    socket.setTimeout(30000, () => handleError(new Error('SMTP connection timed out.')));
    socket.once('error', handleError);
  });
}

function rejectSmtpPending(session, error) {
  while (session.pending.length) {
    const pending = session.pending.shift();
    pending.reject(error);
  }
}

function tryDequeueSmtpResponse(session) {
  if (!session.lines.length) {
    return null;
  }

  const firstMatch = session.lines[0].match(/^(\d{3})([ -])(.*)$/);
  if (!firstMatch) {
    const fallback = session.lines.shift();
    return { code: 0, message: fallback };
  }

  const code = firstMatch[1];
  const messageLines = [];
  for (let index = 0; index < session.lines.length; index += 1) {
    const line = session.lines[index];
    const match = line.match(/^(\d{3})([ -])(.*)$/);
    if (!match) {
      messageLines.push(line);
      continue;
    }
    messageLines.push(match[3]);
    if (match[1] === code && match[2] === ' ') {
      session.lines = session.lines.slice(index + 1);
      return { code: Number(code), message: messageLines.join('\n') };
    }
  }

  return null;
}

function createSmtpSession(socket) {
  const session = {
    socket,
    pending: [],
    lines: [],
    partial: '',
    closed: false,
  };

  session.onData = (chunk) => {
    session.partial += String(chunk || '');
    const pieces = session.partial.split(/\r?\n/);
    session.partial = pieces.pop();
    pieces.filter(Boolean).forEach((line) => session.lines.push(line));
    while (session.pending.length) {
      const response = tryDequeueSmtpResponse(session);
      if (!response) {
        break;
      }
      session.pending.shift().resolve(response);
    }
  };

  session.onError = (error) => {
    if (session.closed) {
      return;
    }
    session.closed = true;
    rejectSmtpPending(session, error instanceof Error ? error : new Error(String(error || 'SMTP connection failed.')));
  };

  session.onClose = () => {
    if (session.closed) {
      return;
    }
    session.closed = true;
    rejectSmtpPending(session, new Error('SMTP connection closed unexpectedly.'));
  };

  socket.on('data', session.onData);
  socket.on('error', session.onError);
  socket.on('close', session.onClose);
  return session;
}

function destroySmtpSession(session) {
  if (!session || !session.socket) {
    return;
  }
  session.socket.off('data', session.onData);
  session.socket.off('error', session.onError);
  session.socket.off('close', session.onClose);
  session.closed = true;
}

function readSmtpResponse(session) {
  return new Promise((resolve, reject) => {
    const immediate = tryDequeueSmtpResponse(session);
    if (immediate) {
      resolve(immediate);
      return;
    }
    session.pending.push({ resolve, reject });
  });
}

async function expectSmtp(session, allowedCodes) {
  const expected = Array.isArray(allowedCodes) ? allowedCodes : [allowedCodes];
  const response = await readSmtpResponse(session);
  if (!expected.includes(response.code)) {
    throw new Error(`SMTP ${response.code}: ${response.message}`);
  }
  return response;
}

function upgradeSmtpSocket(session, host) {
  destroySmtpSession(session);
  return new Promise((resolve, reject) => {
    const tlsSocket = smtpTls.connect({ socket: session.socket, servername: host }, () => {
      tlsSocket.setEncoding('utf8');
      tlsSocket.setTimeout(30000, () => reject(new Error('SMTP TLS negotiation timed out.')));
      resolve(tlsSocket);
    });
    tlsSocket.once('error', reject);
  });
}

function smtpEscapeData(value) {
  return String(value || '')
    .replace(/\r?\n/g, '\r\n')
    .replace(/^\./gm, '..');
}

async function sendMailMessage(message, store, options) {
  const payload = message && typeof message === 'object' ? message : {};
  const resolved = options && options.overrideConfig
    ? { source: 'override', config: normalizeStoredSmtpConfig(options.overrideConfig, { useSsl: true }) }
    : resolveSmtpConfig(store);

  if (!isSmtpConfigReady(resolved.config)) {
    if (options && options.allowDebugPreview) {
      const debugSuffix = options.debugValue ? ` -> ${options.debugValue}` : '';
      console.log(`[GridSense ${options.debugLabel || 'Mail Preview'}] ${payload.to || 'unknown'}${debugSuffix}`);
      return Promise.resolve({ delivery: 'debug', debugOtp: options.debugValue });
    }
    return Promise.reject(new Error('SMTP is not configured yet. Open Settings and add the sender mailbox details first.'));
  }

  const smtp = resolved.config;
  const port = Number(smtp.port) || 587;
  const requiresStartTls = smtp.useSsl !== false && port !== 465;
  let session = null;

  try {
    const socket = await openSmtpSocket(smtp);
    session = createSmtpSession(socket);

    await expectSmtp(session, 220);
    session.socket.write('EHLO gridsense.local\r\n');
    let ehlo = await expectSmtp(session, 250);

    if (requiresStartTls) {
      if (!/STARTTLS/i.test(ehlo.message)) {
        throw new Error('SMTP server does not advertise STARTTLS on this port.');
      }
      session.socket.write('STARTTLS\r\n');
      await expectSmtp(session, 220);
      const secureSocket = await upgradeSmtpSocket(session, smtp.host);
      session = createSmtpSession(secureSocket);
      session.socket.write('EHLO gridsense.local\r\n');
      ehlo = await expectSmtp(session, 250);
    }

    if (!/AUTH/i.test(ehlo.message)) {
      throw new Error('SMTP server does not allow authenticated login on this connection.');
    }

    session.socket.write('AUTH LOGIN\r\n');
    await expectSmtp(session, 334);
    session.socket.write(`${Buffer.from(String(smtp.user || ''), 'utf8').toString('base64')}\r\n`);
    await expectSmtp(session, 334);
    session.socket.write(`${Buffer.from(String(smtp.pass || ''), 'utf8').toString('base64')}\r\n`);
    await expectSmtp(session, 235);

    session.socket.write(`MAIL FROM:<${smtp.from}>\r\n`);
    await expectSmtp(session, 250);
    session.socket.write(`RCPT TO:<${payload.to}>\r\n`);
    await expectSmtp(session, [250, 251]);
    session.socket.write('DATA\r\n');
    await expectSmtp(session, 354);

    const dataBlock = [
      `From: ${smtp.from}`,
      `To: ${payload.to}`,
      `Subject: ${payload.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      smtpEscapeData(payload.body),
    ].join('\r\n');

    session.socket.write(`${dataBlock}\r\n.\r\n`);
    await expectSmtp(session, 250);
    session.socket.write('QUIT\r\n');
    return { delivery: 'email' };
  } catch (error) {
    throw new Error(error && error.message ? error.message : 'Failed to send email.');
  } finally {
    if (session && session.socket) {
      destroySmtpSession(session);
      session.socket.end();
      session.socket.destroySoon?.();
    }
  }
}

function verifyPassword(password, stored) {
  return comparePassword(password, stored);
}


function normalizeLayoutRoomInput(room, index) {
  const source = room && typeof room === 'object' ? room : {};
  return {
    id: String(source.id || source.roomId || `room-${index + 1}`),
    type: String(source.type || 'custom'),
    name: String(source.name || `Room ${index + 1}`),
    x: Number(source.x) || 0,
    y: Number(source.y) || 0,
    w: Number(source.w != null ? source.w : source.width) || 3,
    h: Number(source.h != null ? source.h : source.height) || 2,
    threshold: Number(source.threshold) || profileRoomThreshold(String(source.type || 'custom')),
  };
}

function normalizeLayoutDeviceInput(device, index) {
  const source = device && typeof device === 'object' ? device : {};
  const type = String(source.type || 'fan');
  const hasOn = source.on !== undefined && source.on !== null;
  const hasIsOn = source.isOn !== undefined && source.isOn !== null;
  const normalized = {
    deviceId: String(source.deviceId || source.id || `device-${index + 1}`),
    roomId: String(source.roomId || ''),
    room: String(source.room || ''),
    name: String(source.name || type),
    type,
    watts: Number(source.watts != null ? source.watts : source.power) || 0,
    dailyHours: Number(source.dailyHours) || undefined,
    on: hasOn ? Boolean(source.on) : hasIsOn ? Boolean(source.isOn) : true,
    highUsage: Boolean(source.highUsage),
  };

  const x = source.xPct != null ? Number(source.xPct) : source.x != null ? Number(source.x) : null;
  const y = source.yPct != null ? Number(source.yPct) : source.y != null ? Number(source.y) : null;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    normalized.xPct = x;
    normalized.yPct = y;
  }

  return normalized;
}

function buildLayoutResponse(userId, profile) {
  const normalized = normalizeProfile(profile);
  return {
    userId,
    rooms: normalized.rooms.map((room) => ({
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
    })),
    devices: normalized.appliances.map((device) => ({
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
    })),
    setupCompleted: normalized.setupCompleted,
    updatedAt: normalized.layoutUpdatedAt || normalized.latestMetrics?.lastSyncedAt || null,
  };
}

const previousHandleApiWithLayoutPersistence = handleApi;
handleApi = async function handleApi(req, res, url) {
  if (url.pathname === '/get-layout' || url.pathname === '/save-layout') {
    const authResult = getAuthResult(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status || 401, { message: authResult.message || 'Authentication required.' });
      return true;
    }

    const authUser = authResult.user;
    const store = readStore();
    const user = store.users.find((entry) => entry.id === authUser.id);
    if (!user) {
      sendJson(res, 404, { message: 'User not found.' });
      return true;
    }

    const profile = ensureProfile(store, user.id);

    if (req.method === 'GET' && url.pathname === '/get-layout') {
      writeStore(store);
      sendJson(res, 200, buildLayoutResponse(user.id, profile));
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/save-layout') {
      const body = await parseBody(req);
      const rooms = Array.isArray(body.rooms) ? body.rooms.map(normalizeLayoutRoomInput) : profile.rooms;
      const devicesSource = Array.isArray(body.devices) ? body.devices : Array.isArray(body.appliances) ? body.appliances : profile.appliances;
      const appliances = Array.isArray(devicesSource) ? devicesSource.map(normalizeLayoutDeviceInput) : profile.appliances;

      const nextProfile = normalizeProfile({
        ...profile,
        latestMetrics: body.metrics || profile.latestMetrics,
        dailyHistory: body.dailyHistory || profile.dailyHistory,
        rooms,
        appliances,
        setupCompleted: body.setupCompleted !== false,
        settings: {
          ...profile.settings,
          ...(body.settings || {}),
        },
      });

      nextProfile.layoutUpdatedAt = new Date().toISOString();
      store.profiles[user.id] = nextProfile;
      writeStore(store);
      sendJson(res, 200, {
        message: 'Layout saved successfully.',
        layout: buildLayoutResponse(user.id, nextProfile),
        profile: nextProfile,
      });
      return true;
    }
  }

  return previousHandleApiWithLayoutPersistence(req, res, url);
};

function normalizeOriginValue(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveConfiguredCorsOrigin() {
  const configured = normalizeOriginValue(process.env.CORS_ORIGIN || process.env.FRONTEND_URL || process.env.APP_ORIGIN || '*');
  return configured || '*';
}

applyCors = function applyCors(res) {
  const allowedOrigin = resolveConfiguredCorsOrigin();
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

function resolvePublicApiUrl(req) {
  const explicit = normalizeOriginValue(process.env.PUBLIC_API_URL || process.env.API_URL || process.env.REACT_APP_API_URL || '');
  if (explicit) {
    return explicit;
  }

  const host = req && req.headers ? String(req.headers.host || '') : '';
  if (!host) {
    return `http://localhost:${PORT}`;
  }

  const forwardedProto = req && req.headers ? String(req.headers['x-forwarded-proto'] || '') : '';
  const protocol = forwardedProto || (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

function appConfigScript(req) {
  return `window.__APP_CONFIG__ = ${JSON.stringify({
    apiBaseUrl: resolvePublicApiUrl(req),
    healthUrl: '/health',
  })};`;
}

const previousHandleApiWithRuntimeConfig = handleApi;
handleApi = async function handleApi(req, res, url) {
  const acceptHeader = String(req.headers.accept || '').toLowerCase();

  if (req.method === 'GET' && url.pathname === '/' && !acceptHeader.includes('text/html')) {
    applyCors(res);
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end('Server running');
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      message: 'Server running',
      apiBaseUrl: resolvePublicApiUrl(req),
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/app-config.js') {
    applyCors(res);
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(appConfigScript(req));
    return true;
  }

  return previousHandleApiWithRuntimeConfig(req, res, url);
};
