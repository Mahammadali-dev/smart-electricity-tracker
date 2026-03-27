export const BOARD_WIDTH = 480;
export const BOARD_HEIGHT = 400;
export const MIN_ROOM_SIZE = 80;

export const ROOM_LIBRARY = [
  { key: "living", label: "Living Room", threshold: 2200 },
  { key: "bedroom", label: "Bedroom", threshold: 1800 },
  { key: "kitchen", label: "Kitchen", threshold: 1700 },
  { key: "bathroom", label: "Bathroom", threshold: 1000 },
  { key: "custom", label: "Custom Room", threshold: 1600 },
];

export const DEVICE_LIBRARY = [
  { type: "fan", name: "Fan", watts: 75, dailyHours: 8.2 },
  { type: "ac", name: "AC", watts: 1450, dailyHours: 4.5 },
  { type: "light", name: "Light", watts: 90, dailyHours: 6.5 },
  { type: "tv", name: "TV", watts: 180, dailyHours: 5.2 },
  { type: "fridge", name: "Refrigerator", watts: 220, dailyHours: 18.5 },
];

const DEFAULT_ROOM_LAYOUT = [
  { type: "living", name: "Living Room", x: 0, y: 0, width: 280, height: 160 },
  { type: "bedroom", name: "Bedroom", x: 280, y: 0, width: 200, height: 160 },
  { type: "kitchen", name: "Kitchen", x: 0, y: 160, width: 240, height: 240 },
  { type: "bathroom", name: "Bathroom", x: 240, y: 160, width: 240, height: 240 },
];

const FALLBACK_LAYOUT_SLOTS = [
  { x: 0, y: 0, width: 240, height: 120 },
  { x: 240, y: 0, width: 240, height: 120 },
  { x: 0, y: 120, width: 240, height: 140 },
  { x: 240, y: 120, width: 240, height: 140 },
  { x: 0, y: 260, width: 240, height: 140 },
  { x: 240, y: 260, width: 240, height: 140 },
];

const applianceBlueprints = [
  { room: "Living Room", name: "Fan", type: "fan", watts: 75, dailyHours: 8.2, on: true },
  { room: "Living Room", name: "AC", type: "ac", watts: 1450, dailyHours: 4.5, on: true },
  { room: "Living Room", name: "Light", type: "light", watts: 90, dailyHours: 6.5, on: true },
  { room: "Living Room", name: "TV", type: "tv", watts: 180, dailyHours: 5.2, on: true },
  { room: "Living Room", name: "Refrigerator", type: "fridge", watts: 220, dailyHours: 18.5, on: true },
  { room: "Bedroom", name: "Fan", type: "fan", watts: 60, dailyHours: 9.0, on: true },
  { room: "Bedroom", name: "AC", type: "ac", watts: 1300, dailyHours: 3.6, on: false },
  { room: "Bedroom", name: "Light", type: "light", watts: 60, dailyHours: 5.0, on: true },
  { room: "Bedroom", name: "TV", type: "tv", watts: 120, dailyHours: 2.4, on: false },
  { room: "Bedroom", name: "Refrigerator", type: "fridge", watts: 160, dailyHours: 10.0, on: false },
  { room: "Kitchen", name: "Fan", type: "fan", watts: 55, dailyHours: 6.2, on: true },
  { room: "Kitchen", name: "AC", type: "ac", watts: 900, dailyHours: 1.5, on: false },
  { room: "Kitchen", name: "Light", type: "light", watts: 80, dailyHours: 7.0, on: true },
  { room: "Kitchen", name: "TV", type: "tv", watts: 95, dailyHours: 1.0, on: false },
  { room: "Kitchen", name: "Refrigerator", type: "fridge", watts: 260, dailyHours: 22.0, on: true },
  { room: "Bathroom", name: "Fan", type: "fan", watts: 35, dailyHours: 3.5, on: false },
  { room: "Bathroom", name: "AC", type: "ac", watts: 650, dailyHours: 1.2, on: false },
  { room: "Bathroom", name: "Light", type: "light", watts: 50, dailyHours: 3.3, on: true },
  { room: "Bathroom", name: "TV", type: "tv", watts: 70, dailyHours: 0.7, on: false },
  { room: "Bathroom", name: "Refrigerator", type: "fridge", watts: 120, dailyHours: 5.5, on: false },
];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function roomThreshold(type) {
  return ROOM_LIBRARY.find((room) => room.key === type)?.threshold || 1600;
}

function defaultRoomName(type) {
  return ROOM_LIBRARY.find((room) => room.key === type)?.label || "Custom Room";
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

function toOneDecimal(value) {
  return Number(value.toFixed(1));
}

function toTwoDecimals(value) {
  return Number(value.toFixed(2));
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

export function createRoom(payload = {}) {
  const type = payload.type || "custom";
  const legacyWidth = payload.width == null && payload.w != null ? Number(payload.w) * 40 : null;
  const legacyHeight = payload.height == null && payload.h != null ? Number(payload.h) * 40 : null;
  const width = clamp(Number(payload.width ?? legacyWidth ?? 160) || 160, MIN_ROOM_SIZE, BOARD_WIDTH);
  const height = clamp(Number(payload.height ?? legacyHeight ?? 120) || 120, MIN_ROOM_SIZE, BOARD_HEIGHT);
  const x = clamp(Number(payload.x) || 0, 0, Math.max(0, BOARD_WIDTH - width));
  const y = clamp(Number(payload.y) || 0, 0, Math.max(0, BOARD_HEIGHT - height));

  return {
    id: String(payload.id || `${slugify(payload.name || defaultRoomName(type))}-${Math.random().toString(36).slice(2, 8)}`),
    type,
    name: String(payload.name || defaultRoomName(type)).trim() || defaultRoomName(type),
    x,
    y,
    width,
    height,
    threshold: Number(payload.threshold) || roomThreshold(type),
  };
}

export function createDefaultRooms() {
  return DEFAULT_ROOM_LAYOUT.map((item) => createRoom(item));
}

function createRoomsFromLegacyAppliances(savedAppliances) {
  const names = Array.from(new Set((savedAppliances || []).map((item) => String(item.room || "").trim()).filter(Boolean)));
  return names.map((name, index) => {
    const known = DEFAULT_ROOM_LAYOUT.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const slot = known || FALLBACK_LAYOUT_SLOTS[index % FALLBACK_LAYOUT_SLOTS.length];
    const type = known ? known.type : "custom";
    return createRoom({
      id: `legacy-${slugify(name)}`,
      type,
      name,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      threshold: roomThreshold(type),
    });
  });
}

export function normalizeRooms(savedRooms, savedAppliances) {
  if (Array.isArray(savedRooms) && savedRooms.length) {
    return savedRooms.map((room) => createRoom(room));
  }
  if (Array.isArray(savedAppliances) && savedAppliances.length) {
    return createRoomsFromLegacyAppliances(savedAppliances);
  }
  return [];
}

export function renameRoom(rooms, roomId, nextName) {
  const room = rooms.find((item) => item.id === roomId);
  if (!room) {
    return rooms;
  }
  const trimmed = String(nextName || "").trim();
  const name = uniqueRoomName(trimmed || room.name, rooms, roomId);
  return rooms.map((item) => (item.id === roomId ? { ...item, name } : item));
}

export function createDevice(payload = {}, indexInRoom = 0) {
  const template = DEVICE_LIBRARY.find((item) => item.type === payload.type) || DEVICE_LIBRARY[0];
  const placement = payload.xPct != null && payload.yPct != null
    ? { xPct: Number(payload.xPct), yPct: Number(payload.yPct) }
    : defaultDevicePlacement(payload.type || template.type, indexInRoom);

  return {
    deviceId: String(payload.deviceId || `${payload.roomId || "room"}-${template.type}-${Math.random().toString(36).slice(2, 8)}`),
    roomId: String(payload.roomId || ""),
    room: String(payload.room || ""),
    name: String(payload.name || template.name),
    type: payload.type || template.type,
    watts: Number(payload.watts) || template.watts,
    dailyHours: Number(payload.dailyHours) || template.dailyHours,
    on: payload.on !== false,
    highUsage: Number(payload.watts ?? template.watts) >= 1000 || Boolean(payload.highUsage),
    xPct: clamp(Number(placement.xPct), 0.16, 0.84),
    yPct: clamp(Number(placement.yPct), 0.18, 0.84),
  };
}

export function createDefaultAppliances(roomList = createDefaultRooms()) {
  const roomMap = Object.fromEntries(roomList.map((room) => [room.name, room]));
  const roomCounts = {};

  return applianceBlueprints
    .map((item) => {
      const room = roomMap[item.room];
      if (!room) {
        return null;
      }
      roomCounts[room.id] = roomCounts[room.id] || 0;
      const device = createDevice(
        {
          deviceId: `${slugify(item.room)}-${slugify(item.name)}`,
          roomId: room.id,
          room: room.name,
          name: item.name,
          type: item.type,
          watts: item.watts,
          dailyHours: item.dailyHours,
          on: item.on,
          highUsage: item.watts >= 1000,
        },
        roomCounts[room.id]
      );
      roomCounts[room.id] += 1;
      return device;
    })
    .filter(Boolean);
}

export function mergeSavedAppliances(savedAppliances, roomList, options = {}) {
  const { preferDefaultsWhenMissing = true } = options;
  if (!Array.isArray(savedAppliances) || !savedAppliances.length) {
    return preferDefaultsWhenMissing && roomList.length ? createDefaultAppliances(roomList) : [];
  }

  const roomById = Object.fromEntries(roomList.map((room) => [room.id, room]));
  const roomByName = Object.fromEntries(roomList.map((room) => [room.name.toLowerCase(), room]));
  const roomCounts = {};

  return savedAppliances.map((item) => {
    const matchedRoom = roomById[item.roomId] || roomByName[String(item.room || "").toLowerCase()] || roomList[0] || null;
    if (matchedRoom) {
      roomCounts[matchedRoom.id] = roomCounts[matchedRoom.id] || 0;
    }
    const device = createDevice(
      {
        deviceId: item.deviceId,
        roomId: matchedRoom ? matchedRoom.id : String(item.roomId || ""),
        room: matchedRoom ? matchedRoom.name : String(item.room || ""),
        name: item.name,
        type: item.type,
        watts: item.watts,
        dailyHours: item.dailyHours,
        on: item.on,
        highUsage: item.highUsage,
        xPct: item.xPct,
        yPct: item.yPct,
      },
      matchedRoom ? roomCounts[matchedRoom.id] : 0
    );
    if (matchedRoom) {
      roomCounts[matchedRoom.id] += 1;
    }
    return device;
  });
}

export function calculateRoomStats(rooms, appliances) {
  return (rooms || []).map((room) => {
    const devices = (appliances || []).filter((item) => item.roomId === room.id);
    const activeWatts = devices.filter((item) => item.on).reduce((sum, item) => sum + item.watts, 0);
    return {
      ...room,
      devices,
      activeWatts,
      activeLoadKw: toTwoDecimals(activeWatts / 1000),
      activeCount: devices.filter((item) => item.on).length,
      overloaded: activeWatts > Number(room.threshold || roomThreshold(room.type)),
    };
  });
}

export function getRoomById(roomStats, roomId) {
  return roomStats.find((room) => room.id === roomId) || roomStats[0] || null;
}

export function computeMetrics(appliances, previousMetrics, dailyLimit) {
  const now = new Date();
  const activeAppliances = appliances.filter((item) => item.on);
  const baseModeledLoad = appliances.reduce((sum, item) => sum + (item.watts * item.dailyHours) / 1000, 0);
  const activeWatts = activeAppliances.reduce((sum, item) => sum + item.watts, 0) + 42;
  const liveLoadKw = toTwoDecimals(activeWatts / 1000);
  const hour = now.getHours();
  const peakHour = hour >= 18 && hour < 22;
  const baselineToday = 6.4 + baseModeledLoad * 0.44;
  const previousToday = previousMetrics?.todayUsage || baselineToday;
  const drift = liveLoadKw * 0.001 + (peakHour ? 0.0003 : 0.00012);
  const todayUsage = toTwoDecimals(Math.max(baselineToday, previousToday + drift));
  const weeklyUsage = toOneDecimal(todayUsage * 6.7);
  const monthlyUsage = toOneDecimal(todayUsage * 27.3);
  const rawVoltage = 229 - liveLoadKw * 5 - (peakHour ? 8 : 0) + Math.sin((now.getMinutes() / 60) * Math.PI * 2) * 1.6;
  const voltage = Math.max(193, Math.min(238, Math.round(rawVoltage)));
  const current = toOneDecimal(activeWatts / Math.max(voltage, 1));
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
    activeDevices: activeAppliances.length,
  };
}

export function createInitialHistory(todayUsage) {
  const history = [];
  const now = new Date();
  for (let index = 13; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - index);
    const variance = ((13 - index) % 4) * 0.6;
    const totalKwh = index === 0 ? todayUsage : Math.max(8.4, todayUsage - (index * 0.55 + variance));
    history.push({
      date: day.toISOString().slice(0, 10),
      totalKwh: toOneDecimal(totalKwh),
    });
  }
  return history;
}

export function syncTodayHistory(history, todayUsage) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const nextHistory = history.length ? [...history] : createInitialHistory(todayUsage);
  const todayIndex = nextHistory.findIndex((item) => item.date === todayKey);

  if (todayIndex >= 0) {
    nextHistory[todayIndex] = {
      ...nextHistory[todayIndex],
      totalKwh: toOneDecimal(todayUsage),
    };
  } else {
    nextHistory.push({ date: todayKey, totalKwh: toOneDecimal(todayUsage) });
  }

  return nextHistory.slice(-14);
}

export function buildTrendSeries(range, metrics, history) {
  if (range === "daily") {
    const labels = ["6a", "9a", "12p", "3p", "6p", "9p", "12a"];
    const values = labels.map((_, index) =>
      toOneDecimal(Math.max(0.4, metrics.liveLoadKw * (0.55 + index * 0.16) + (index % 2 === 0 ? 0.2 : 0.4)))
    );
    return { labels, values };
  }

  if (range === "weekly") {
    const recentDays = history.slice(-7);
    return {
      labels: recentDays.map((item) => new Date(item.date).toLocaleDateString(undefined, { weekday: "short" })),
      values: recentDays.map((item) => toOneDecimal(item.totalKwh)),
    };
  }

  const labels = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const values = labels.map((_, index) => toOneDecimal(Math.max(280, metrics.monthlyUsage - (5 - index) * 18 + index * 4)));
  return { labels, values };
}

export function buildDeviceComparison(appliances, rooms) {
  const roomMap = Object.fromEntries((rooms || []).map((room) => [room.id, room.name]));
  return appliances
    .slice()
    .sort((left, right) => right.watts - left.watts)
    .slice(0, 6)
    .map((item) => ({
      label: `${roomMap[item.roomId] || item.room || "Room"} ${item.name}`,
      watts: item.watts,
      on: item.on,
    }));
}

export function buildAlerts(metrics, roomStats, dailyLimit) {
  const alerts = [];

  if (metrics.overLimit) {
    alerts.push({
      tone: "danger",
      title: "Daily limit exceeded",
      detail: `${toOneDecimal(metrics.todayUsage - dailyLimit)} kWh above the configured daily budget.`,
    });
  } else if (dailyLimit - metrics.todayUsage < 2) {
    alerts.push({
      tone: "warning",
      title: "Approaching daily limit",
      detail: `${toOneDecimal(dailyLimit - metrics.todayUsage)} kWh remaining before the limit is crossed.`,
    });
  }

  if (metrics.lowVoltage) {
    alerts.push({
      tone: "warning",
      title: "Low voltage detected",
      detail: `Incoming voltage dropped to ${metrics.voltage} V. Sensitive devices are being monitored.`,
    });
  }

  if (metrics.peakHour) {
    alerts.push({
      tone: "info",
      title: "Peak hour usage",
      detail: `${metrics.liveLoadKw} kW is active during the higher tariff window.`,
    });
  }

  const overloadedRooms = roomStats.filter((room) => room.overloaded);
  if (overloadedRooms.length) {
    alerts.push({
      tone: "danger",
      title: "Overload warning",
      detail: `${overloadedRooms.map((room) => room.name).join(", ")} has high appliance demand and needs attention.`,
    });
  }

  return alerts;
}

export function rectanglesOverlap(left, right) {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

export function canPlaceRoom(candidate, rooms, ignoreId) {
  if (
    candidate.x < 0 ||
    candidate.y < 0 ||
    candidate.x + candidate.width > BOARD_WIDTH ||
    candidate.y + candidate.height > BOARD_HEIGHT ||
    candidate.width < MIN_ROOM_SIZE ||
    candidate.height < MIN_ROOM_SIZE
  ) {
    return false;
  }

  return !(rooms || []).some((room) => room.id !== ignoreId && rectanglesOverlap(room, candidate));
}

export function roomStyle(room) {
  return {
    left: `${(room.x / BOARD_WIDTH) * 100}%`,
    top: `${(room.y / BOARD_HEIGHT) * 100}%`,
    width: `${(room.width / BOARD_WIDTH) * 100}%`,
    height: `${(room.height / BOARD_HEIGHT) * 100}%`,
  };
}

export function deviceStyle(device) {
  return {
    left: `${device.xPct * 100}%`,
    top: `${device.yPct * 100}%`,
  };
}

export function serializeAppliances(appliances) {
  return appliances.map((item) => ({
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
  }));
}

export function serializeRooms(rooms) {
  return rooms.map((item) => ({
    id: item.id,
    type: item.type,
    name: item.name,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    threshold: item.threshold,
  }));
}