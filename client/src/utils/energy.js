import {
  DEVICE_LIBRARY as PROFILE_DEVICE_LIBRARY,
  ROOM_DEVICE_TYPES,
  getDeviceTemplate,
  getFloorNames,
  getPlaceConfig,
  getRoomDefinition,
  getRoomLibrary as getPlaceRoomLibrary,
  getRoomThreshold,
  getTemplateApplianceBlueprints,
  getTemplateRoomBlueprints,
  normalizePlaceType,
} from "./placeProfiles";

export const BOARD_WIDTH = 480;
export const BOARD_HEIGHT = 400;
export const MIN_ROOM_SIZE = 80;

export const FLOOR_LIBRARY = [
  { id: "floor-1", name: "Floor 1" },
  { id: "floor-2", name: "Floor 2" },
  { id: "floor-3", name: "Floor 3" },
];

export const ROOM_LIBRARY = getPlaceRoomLibrary("home");
export const DEVICE_LIBRARY = PROFILE_DEVICE_LIBRARY;

const FALLBACK_LAYOUT_SLOTS = [
  { x: 0, y: 0, width: 240, height: 120 },
  { x: 240, y: 0, width: 240, height: 120 },
  { x: 0, y: 120, width: 240, height: 140 },
  { x: 240, y: 120, width: 240, height: 140 },
  { x: 0, y: 260, width: 240, height: 140 },
  { x: 240, y: 260, width: 240, height: 140 },
];

const DEVICE_PLACEMENTS = {
  fan: [0.24, 0.34],
  ac: [0.74, 0.28],
  light: [0.5, 0.18],
  tv: [0.33, 0.72],
  fridge: [0.72, 0.72],
  "water-heater": [0.72, 0.64],
  projector: [0.5, 0.26],
  computer: [0.34, 0.62],
  "lab-equipment": [0.68, 0.66],
  motor: [0.3, 0.58],
  conveyor: [0.56, 0.56],
  cnc: [0.74, 0.42],
  compressor: [0.72, 0.74],
  pump: [0.42, 0.74],
  hvac: [0.78, 0.26],
  server: [0.72, 0.42],
  router: [0.54, 0.26],
  generator: [0.2, 0.74],
  "smart-plug": [0.24, 0.76],
};

const SIMULATION_PROFILES = {
  home: {
    standbyWatts: 36,
    idlePerDevice: 6,
    baseDaily: 5.6,
    weeklyFactor: 6.5,
    monthlyFactor: 27.1,
    nominalVoltage: 229,
    voltageDrop: 4.8,
    peakHours: [18, 22],
    tariff: 8.35,
    lowVoltageAt: 210,
    dailyCurve: [0.42, 0.58, 0.66, 0.74, 0.96, 1.08, 0.62],
  },
  school: {
    standbyWatts: 90,
    idlePerDevice: 10,
    baseDaily: 18,
    weeklyFactor: 5.4,
    monthlyFactor: 22.2,
    nominalVoltage: 228,
    voltageDrop: 5.4,
    peakHours: [10, 15],
    tariff: 9.1,
    lowVoltageAt: 208,
    dailyCurve: [0.2, 0.82, 1.04, 1.08, 0.88, 0.3, 0.12],
  },
  industry: {
    standbyWatts: 240,
    idlePerDevice: 28,
    baseDaily: 72,
    weeklyFactor: 6.8,
    monthlyFactor: 28.6,
    nominalVoltage: 226,
    voltageDrop: 6.6,
    peakHours: [12, 19],
    tariff: 11.8,
    lowVoltageAt: 205,
    dailyCurve: [0.88, 1.02, 1.08, 1.16, 1.22, 1.1, 0.92],
  },
  office: {
    standbyWatts: 78,
    idlePerDevice: 9,
    baseDaily: 15,
    weeklyFactor: 5.8,
    monthlyFactor: 23.8,
    nominalVoltage: 229,
    voltageDrop: 5.2,
    peakHours: [9, 18],
    tariff: 9.8,
    lowVoltageAt: 209,
    dailyCurve: [0.22, 0.76, 0.98, 1.06, 0.9, 0.42, 0.16],
  },
};

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

function sortFloorIds(left, right) {
  const leftNumber = Number(String(left).replace(/[^0-9]/g, "")) || 0;
  const rightNumber = Number(String(right).replace(/[^0-9]/g, "")) || 0;
  return leftNumber - rightNumber;
}

function ensureFloorId(value) {
  return String(value || "floor-1").trim().toLowerCase() || "floor-1";
}

function defaultFloorName(floorId, placeType = "home") {
  const normalizedType = normalizePlaceType(placeType);
  const match = createDefaultFloors(normalizedType).find((floor) => floor.id === ensureFloorId(floorId));
  if (match) {
    return match.name;
  }

  const number = Number(String(floorId).replace(/[^0-9]/g, "")) || 1;
  return normalizedType === "industry" ? `Section ${number}` : `Floor ${number}`;
}

function normalizeRoomTypeFromName(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name) return "custom";
  if (name.includes("bed")) return "bedroom";
  if (name.includes("bath")) return "bathroom";
  if (name.includes("kitchen")) return "kitchen";
  if (name.includes("living")) return "living";
  if (name.includes("class")) return "classroom";
  if (name.includes("lab")) return "lab";
  if (name.includes("staff")) return "staff";
  if (name.includes("production")) return "production";
  if (name.includes("control")) return "control";
  if (name.includes("storage") || name.includes("utility")) return "storage";
  if (name.includes("workspace") || name.includes("work space")) return "workspace";
  if (name.includes("meeting") || name.includes("board")) return "meeting";
  if (name.includes("server")) return "server";
  if (name.includes("office")) return "office";
  return "custom";
}

function resolveRoomType(roomOrType) {
  if (typeof roomOrType === "string") {
    return normalizeRoomTypeFromName(roomOrType);
  }

  const type = String(roomOrType?.type || "").toLowerCase();
  if (type) {
    return type;
  }

  return normalizeRoomTypeFromName(roomOrType?.name);
}

function roomThreshold(type) {
  return getRoomThreshold(resolveRoomType(type));
}

function defaultRoomName(type) {
  return getRoomDefinition(resolveRoomType(type)).label || "Custom Room";
}

export function getRoomLibrary(placeType = "home") {
  return getPlaceRoomLibrary(placeType);
}

export function createDefaultFloors(placeType = "home") {
  return getFloorNames(placeType).map((name, index) => ({
    id: `floor-${index + 1}`,
    name,
  }));
}

export function normalizeFloors(savedFloors, savedRooms = [], savedAppliances = [], placeType = "home") {
  const normalizedType = normalizePlaceType(placeType);
  const floors = Object.fromEntries(createDefaultFloors(normalizedType).map((floor) => [floor.id, floor]));

  (savedFloors || []).forEach((floor) => {
    const floorId = ensureFloorId(floor?.id);
    floors[floorId] = {
      id: floorId,
      name: String(floor?.name || floors[floorId]?.name || defaultFloorName(floorId, normalizedType)).trim() || defaultFloorName(floorId, normalizedType),
    };
  });

  [...(savedRooms || []), ...(savedAppliances || [])].forEach((item) => {
    const floorId = ensureFloorId(item?.floorId);
    if (!floors[floorId]) {
      floors[floorId] = { id: floorId, name: defaultFloorName(floorId, normalizedType) };
    }
  });

  return Object.values(floors).sort((left, right) => sortFloorIds(left.id, right.id));
}

export function serializeFloors(floors) {
  return (floors || []).map((floor) => ({
    id: ensureFloorId(floor.id),
    name: String(floor.name || defaultFloorName(floor.id)).trim() || defaultFloorName(floor.id),
  }));
}

export function getFloorById(floors, floorId) {
  return (floors || []).find((floor) => floor.id === floorId) || floors?.[0] || null;
}

export function getPreferredFloorId(floors, rooms, appliances) {
  const sortedFloors = normalizeFloors(floors, rooms, appliances);
  const populated = sortedFloors.find((floor) =>
    (rooms || []).some((room) => ensureFloorId(room.floorId) === floor.id) ||
    (appliances || []).some((device) => ensureFloorId(device.floorId) === floor.id)
  );
  return populated?.id || sortedFloors[0]?.id || "floor-1";
}

export function filterRoomsByFloor(rooms, floorId) {
  const nextFloorId = ensureFloorId(floorId);
  return (rooms || []).filter((room) => ensureFloorId(room.floorId) === nextFloorId);
}

export function filterDevicesByFloor(appliances, floorId) {
  const nextFloorId = ensureFloorId(floorId);
  return (appliances || []).filter((device) => ensureFloorId(device.floorId) === nextFloorId);
}

export function getAllowedDeviceTypes(roomOrType) {
  return ROOM_DEVICE_TYPES[resolveRoomType(roomOrType)] || ROOM_DEVICE_TYPES.custom;
}

export function getAllowedDeviceLibrary(roomOrType) {
  const allowed = new Set(getAllowedDeviceTypes(roomOrType));
  return DEVICE_LIBRARY.filter((device) => allowed.has(device.type));
}

export function isDeviceAllowedInRoom(roomOrType, deviceType) {
  return getAllowedDeviceTypes(roomOrType).includes(deviceType);
}

function uniqueRoomName(baseName, roomList, ignoreId) {
  const taken = (roomList || []).filter((room) => room.id !== ignoreId).map((room) => room.name.toLowerCase());
  const initialName = String(baseName || "Room").trim() || "Room";
  if (!taken.includes(initialName.toLowerCase())) {
    return initialName;
  }

  let index = 2;
  while (taken.includes(`${initialName.toLowerCase()} ${index}`)) {
    index += 1;
  }
  return `${initialName} ${index}`;
}

function toOneDecimal(value) {
  return Number((Number(value) || 0).toFixed(1));
}

function toTwoDecimals(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function defaultDevicePlacement(type, count) {
  const fallback = DEVICE_PLACEMENTS[type] || [0.5, 0.5];
  const xNudge = (count % 3) * 0.05;
  const yNudge = Math.floor(count / 3) * 0.06;
  return {
    xPct: clamp(fallback[0] + xNudge - 0.03, 0.16, 0.84),
    yPct: clamp(fallback[1] + yNudge - 0.03, 0.18, 0.84),
  };
}

function upgradeLegacyRoomDevice(room, item) {
  const resolvedRoomType = resolveRoomType(room);
  if (resolvedRoomType === "bathroom" && item.type === "fan") {
    return {
      ...item,
      type: "water-heater",
      name: "Water Heater",
      watts: Number(item.watts) >= 500 ? Number(item.watts) : 1800,
      dailyHours: Number(item.dailyHours) || 1.2,
      highUsage: true,
    };
  }

  return item;
}

export function createRoom(payload = {}) {
  const type = resolveRoomType(payload.type || payload.name || "custom");
  const floorId = ensureFloorId(payload.floorId);
  const legacyWidth = payload.width == null && payload.w != null ? Number(payload.w) * 40 : null;
  const legacyHeight = payload.height == null && payload.h != null ? Number(payload.h) * 40 : null;
  const width = clamp(Number(payload.width ?? legacyWidth ?? 160) || 160, MIN_ROOM_SIZE, BOARD_WIDTH);
  const height = clamp(Number(payload.height ?? legacyHeight ?? 120) || 120, MIN_ROOM_SIZE, BOARD_HEIGHT);
  const x = clamp(Number(payload.x) || 0, 0, Math.max(0, BOARD_WIDTH - width));
  const y = clamp(Number(payload.y) || 0, 0, Math.max(0, BOARD_HEIGHT - height));

  return {
    id: String(payload.id || `${floorId}-${slugify(payload.name || defaultRoomName(type))}-${Math.random().toString(36).slice(2, 8)}`),
    floorId,
    type,
    name: String(payload.name || defaultRoomName(type)).trim() || defaultRoomName(type),
    x,
    y,
    width,
    height,
    threshold: Math.max(Number(payload.threshold) || 0, roomThreshold(type)),
  };
}

export function createDefaultRooms(floorId = "floor-1", placeType = "home") {
  const normalizedFloorId = ensureFloorId(floorId);
  return getTemplateRoomBlueprints(placeType)
    .filter((item) => ensureFloorId(item.floorId) === normalizedFloorId)
    .map((item) => createRoom({ ...item, floorId: normalizedFloorId }));
}

export function createAllDefaultRooms(placeType = "home") {
  return createDefaultFloors(placeType).flatMap((floor) => createDefaultRooms(floor.id, placeType));
}

function createRoomsFromLegacyAppliances(savedAppliances, placeType = "home") {
  const names = Array.from(new Set((savedAppliances || []).map((item) => String(item.room || "").trim()).filter(Boolean)));
  const knownSlots = getTemplateRoomBlueprints(placeType);
  return names.map((name, index) => {
    const known = knownSlots.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const slot = known || FALLBACK_LAYOUT_SLOTS[index % FALLBACK_LAYOUT_SLOTS.length];
    const type = known ? known.type : normalizeRoomTypeFromName(name);
    return createRoom({
      id: `legacy-${slugify(name)}`,
      floorId: ensureFloorId(savedAppliances?.[0]?.floorId),
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

export function normalizeRooms(savedRooms, savedAppliances, placeType = "home") {
  if (Array.isArray(savedRooms) && savedRooms.length) {
    return savedRooms.map((room) => createRoom(room));
  }
  if (Array.isArray(savedAppliances) && savedAppliances.length) {
    return createRoomsFromLegacyAppliances(savedAppliances, placeType);
  }
  return [];
}

export function renameRoom(rooms, roomId, nextName) {
  const room = rooms.find((item) => item.id === roomId);
  if (!room) {
    return rooms;
  }
  const sameFloorRooms = rooms.filter((item) => item.floorId === room.floorId);
  const name = uniqueRoomName(String(nextName || room.name).trim() || room.name, sameFloorRooms, roomId);
  return rooms.map((item) => (item.id === roomId ? { ...item, name } : item));
}

export function createDevice(payload = {}, indexInRoom = 0) {
  const template = getDeviceTemplate(payload.type);
  const placement = payload.xPct != null && payload.yPct != null
    ? { xPct: Number(payload.xPct), yPct: Number(payload.yPct) }
    : defaultDevicePlacement(payload.type || template.type, indexInRoom);

  return {
    deviceId: String(payload.deviceId || `${payload.roomId || ensureFloorId(payload.floorId)}-${template.type}-${Math.random().toString(36).slice(2, 8)}`),
    floorId: ensureFloorId(payload.floorId),
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

export function createDefaultAppliances(roomList = [], placeType = "home") {
  const roomMap = Object.fromEntries(roomList.map((room) => [`${ensureFloorId(room.floorId)}::${room.name.toLowerCase()}`, room]));
  const roomCounts = {};

  return getTemplateApplianceBlueprints(placeType)
    .map((item) => {
      const key = `${ensureFloorId(item.floorId)}::${String(item.room).toLowerCase()}`;
      const room = roomMap[key];
      if (!room || !isDeviceAllowedInRoom(room, item.type)) {
        return null;
      }
      roomCounts[room.id] = roomCounts[room.id] || 0;
      const device = createDevice(
        {
          deviceId: `${ensureFloorId(item.floorId)}-${slugify(item.room)}-${slugify(item.name || getDeviceTemplate(item.type).name)}`,
          floorId: room.floorId,
          roomId: room.id,
          room: room.name,
          name: item.name || getDeviceTemplate(item.type).name,
          type: item.type,
          watts: item.watts || getDeviceTemplate(item.type).watts,
          dailyHours: item.dailyHours || getDeviceTemplate(item.type).dailyHours,
          on: item.on ?? item.type !== "generator",
          highUsage: (item.watts || getDeviceTemplate(item.type).watts) >= 1000,
        },
        roomCounts[room.id]
      );
      roomCounts[room.id] += 1;
      return device;
    })
    .filter(Boolean);
}

export function mergeSavedAppliances(savedAppliances, roomList, options = {}, placeType = "home") {
  const { preferDefaultsWhenMissing = true } = options;
  if (!Array.isArray(savedAppliances) || !savedAppliances.length) {
    return preferDefaultsWhenMissing && roomList.length ? createDefaultAppliances(roomList, placeType) : [];
  }

  const roomById = Object.fromEntries(roomList.map((room) => [room.id, room]));
  const roomByName = Object.fromEntries(roomList.map((room) => [`${ensureFloorId(room.floorId)}::${room.name.toLowerCase()}`, room]));
  const roomCounts = {};

  const normalized = savedAppliances
    .map((item) => {
      const preferredFloorId = ensureFloorId(item.floorId);
      const matchedRoom =
        roomById[item.roomId] ||
        roomByName[`${preferredFloorId}::${String(item.room || "").toLowerCase()}`] ||
        roomList.find((room) => room.floorId === preferredFloorId) ||
        roomList[0] ||
        null;

      const upgradedItem = matchedRoom ? upgradeLegacyRoomDevice(matchedRoom, item) : item;
      if (matchedRoom && !isDeviceAllowedInRoom(matchedRoom, upgradedItem.type)) {
        return null;
      }

      const room = matchedRoom || {
        id: upgradedItem.roomId,
        floorId: preferredFloorId,
        name: upgradedItem.room || "Room",
        type: resolveRoomType(upgradedItem.room || upgradedItem.type),
      };

      roomCounts[room.id] = roomCounts[room.id] || 0;
      const device = createDevice(
        {
          ...upgradedItem,
          floorId: room.floorId,
          roomId: room.id,
          room: room.name,
          name: upgradedItem.name || getDeviceTemplate(upgradedItem.type).name,
          type: upgradedItem.type,
          watts: upgradedItem.watts || getDeviceTemplate(upgradedItem.type).watts,
          dailyHours: upgradedItem.dailyHours || getDeviceTemplate(upgradedItem.type).dailyHours,
          on: upgradedItem.on !== false,
          highUsage: upgradedItem.highUsage || Number(upgradedItem.watts || getDeviceTemplate(upgradedItem.type).watts) >= 1000,
          xPct: upgradedItem.xPct,
          yPct: upgradedItem.yPct,
        },
        roomCounts[room.id]
      );
      roomCounts[room.id] += 1;
      return device;
    })
    .filter(Boolean);

  return normalized.length || !preferDefaultsWhenMissing || !roomList.length ? normalized : createDefaultAppliances(roomList, placeType);
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
      estimatedDailyKwh: toOneDecimal(devices.reduce((sum, item) => sum + (item.watts * item.dailyHours) / 1000, 0)),
      overloaded: activeWatts > Number(room.threshold || roomThreshold(room.type)),
    };
  });
}

export function calculateFloorStats(floors, rooms, appliances, placeType = "home") {
  return normalizeFloors(floors, rooms, appliances, placeType).map((floor) => {
    const floorRooms = filterRoomsByFloor(rooms, floor.id);
    const floorDevices = filterDevicesByFloor(appliances, floor.id);
    const roomStats = calculateRoomStats(floorRooms, floorDevices);
    const activeWatts = floorDevices.filter((device) => device.on).reduce((sum, device) => sum + device.watts, 0);
    const estimatedDailyKwh = floorDevices.reduce((sum, device) => sum + (device.watts * device.dailyHours) / 1000, 0);

    return {
      ...floor,
      rooms: floorRooms,
      devices: floorDevices,
      roomCount: floorRooms.length,
      deviceCount: floorDevices.length,
      activeCount: floorDevices.filter((device) => device.on).length,
      activeWatts,
      activeLoadKw: toTwoDecimals(activeWatts / 1000),
      estimatedDailyKwh: toOneDecimal(estimatedDailyKwh),
      overloadedCount: roomStats.filter((room) => room.overloaded).length,
    };
  });
}

export function getRoomById(roomStats, roomId) {
  return roomStats.find((room) => room.id === roomId) || roomStats[0] || null;
}

function getProfile(placeType = "home") {
  return SIMULATION_PROFILES[normalizePlaceType(placeType)] || SIMULATION_PROFILES.home;
}

function getCurveIndex(date) {
  const hour = date.getHours();
  if (hour < 6) return 0;
  if (hour < 9) return 1;
  if (hour < 12) return 2;
  if (hour < 15) return 3;
  if (hour < 18) return 4;
  if (hour < 22) return 5;
  return 6;
}

function getUtilizationFactor(placeType, date) {
  const hour = date.getHours();
  switch (normalizePlaceType(placeType)) {
    case "school":
      if (hour >= 8 && hour < 16) return 1.06;
      if (hour >= 6 && hour < 8) return 0.54;
      if (hour >= 16 && hour < 19) return 0.34;
      return 0.18;
    case "industry":
      if (hour >= 6 && hour < 22) return 1.14;
      return 0.76;
    case "office":
      if (hour >= 9 && hour < 18) return 0.96;
      if (hour >= 7 && hour < 9) return 0.52;
      if (hour >= 18 && hour < 21) return 0.36;
      return 0.2;
    case "home":
    default:
      if (hour >= 18 && hour < 23) return 0.96;
      if (hour >= 6 && hour < 9) return 0.58;
      if (hour >= 9 && hour < 18) return 0.46;
      return 0.28;
  }
}

function getDayProgressFactor(placeType, date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  switch (normalizePlaceType(placeType)) {
    case "school":
      if (hour < 6) return 0.08;
      if (hour < 8) return 0.18;
      if (hour < 12) return 0.46;
      if (hour < 16) return 0.72;
      if (hour < 19) return 0.82;
      return 0.9;
    case "industry":
      if (hour < 6) return 0.28;
      if (hour < 12) return 0.56;
      if (hour < 18) return 0.82;
      if (hour < 22) return 0.94;
      return 1.0;
    case "office":
      if (hour < 7) return 0.1;
      if (hour < 9) return 0.22;
      if (hour < 13) return 0.54;
      if (hour < 18) return 0.78;
      if (hour < 21) return 0.88;
      return 0.94;
    case "home":
    default:
      if (hour < 6) return 0.08;
      if (hour < 9) return 0.2;
      if (hour < 13) return 0.38;
      if (hour < 18) return 0.58;
      if (hour < 22) return 0.86;
      return 0.96;
  }
}

function detectSpike(placeType, activeAppliances, date) {
  const type = normalizePlaceType(placeType);
  const heavyActive = activeAppliances.filter((item) => item.watts >= 2200);
  if (!heavyActive.length) {
    return { unusualSpike: false, spikeWatts: 0 };
  }

  if (type === "industry") {
    const pulse = (Math.sin((date.getMinutes() * 60 + date.getSeconds()) / 14) + 1) / 2;
    if (pulse > 0.82) {
      const heavyWatts = heavyActive.reduce((sum, item) => sum + item.watts, 0);
      return {
        unusualSpike: true,
        spikeWatts: Math.round(heavyWatts * 0.18 + 900),
      };
    }
  }

  if (type === "school" && activeAppliances.some((item) => item.type === "lab-equipment") && (date.getHours() < 7 || date.getHours() >= 18)) {
    return { unusualSpike: true, spikeWatts: 480 };
  }

  return { unusualSpike: false, spikeWatts: 0 };
}

export function computeMetrics(appliances, previousMetrics, dailyLimit, placeType = "home") {
  const now = new Date();
  const type = normalizePlaceType(placeType);
  const profile = getProfile(type);
  const activeAppliances = (appliances || []).filter((item) => item.on);
  const activeBaseWatts = activeAppliances.reduce((sum, item) => sum + item.watts, 0);
  const standbyWatts = profile.standbyWatts + Math.max(0, (appliances || []).length - activeAppliances.length) * profile.idlePerDevice;
  const utilizationFactor = getUtilizationFactor(type, now);
  const { unusualSpike, spikeWatts } = detectSpike(type, activeAppliances, now);
  const activeWatts = Math.round((activeBaseWatts + standbyWatts) * utilizationFactor + spikeWatts);
  const liveLoadKw = toTwoDecimals(activeWatts / 1000);
  const modeledDaily = (appliances || []).reduce((sum, item) => sum + (item.watts * item.dailyHours) / 1000, 0);
  const targetToday = profile.baseDaily + modeledDaily * getDayProgressFactor(type, now);
  const previousToday = Number(previousMetrics?.todayUsage) || targetToday;
  const todayUsage = toTwoDecimals(Math.max(profile.baseDaily, previousMetrics ? previousToday * 0.56 + targetToday * 0.44 : targetToday));
  const weeklyUsage = toOneDecimal(todayUsage * profile.weeklyFactor);
  const monthlyUsage = toOneDecimal(todayUsage * profile.monthlyFactor);
  const [peakStart, peakEnd] = profile.peakHours;
  const peakHour = now.getHours() >= peakStart && now.getHours() < peakEnd;
  const rawVoltage = profile.nominalVoltage - liveLoadKw * profile.voltageDrop - (peakHour ? 5 : 0) - (unusualSpike ? 8 : 0) + Math.sin((now.getMinutes() / 60) * Math.PI * 2) * 1.4;
  const voltage = Math.max(193, Math.min(238, Math.round(rawVoltage)));
  const current = toOneDecimal(activeWatts / Math.max(voltage, 1));
  const billEstimate = Math.round(monthlyUsage * profile.tariff);

  return {
    liveLoadKw,
    todayUsage,
    weeklyUsage,
    monthlyUsage,
    voltage,
    current,
    billEstimate,
    lowVoltage: voltage < profile.lowVoltageAt,
    overLimit: todayUsage > dailyLimit,
    peakHour,
    unusualSpike,
    simulationMode: getPlaceConfig(type).simulationMode,
    lastSyncedAt: now.toISOString(),
    activeDevices: activeAppliances.length,
  };
}

export function createInitialHistory(todayUsage, placeType = "home") {
  const profile = getProfile(placeType);
  const history = [];
  const now = new Date();
  const baseline = Math.max(profile.baseDaily, Number(todayUsage) || profile.baseDaily);
  for (let index = 13; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - index);
    const variance = ((13 - index) % 5 - 2) * 0.06;
    const multiplier = 1 + variance;
    const totalKwh = index === 0 ? baseline : Math.max(profile.baseDaily * 0.7, baseline * (0.92 - index * 0.012) * multiplier);
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

export function buildTrendSeries(range, metrics, history, placeType = "home") {
  const profile = getProfile(placeType);
  if (range === "daily") {
    const labels = ["6a", "9a", "12p", "3p", "6p", "9p", "12a"];
    const values = profile.dailyCurve.map((multiplier) => toOneDecimal(Math.max(0.2, metrics.liveLoadKw * multiplier)));
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
  const values = labels.map((_, index) => toOneDecimal(Math.max(profile.baseDaily * 8, metrics.monthlyUsage * (0.76 + index * 0.05))));
  return { labels, values };
}

export function buildDeviceComparison(appliances, rooms, floors, placeType = "home") {
  const roomMap = Object.fromEntries((rooms || []).map((room) => [room.id, room.name]));
  const floorMap = Object.fromEntries(normalizeFloors(floors, rooms, appliances, placeType).map((floor) => [floor.id, floor.name]));
  return (appliances || [])
    .slice()
    .sort((left, right) => right.watts - left.watts)
    .slice(0, 6)
    .map((item) => ({
      label: `${floorMap[ensureFloorId(item.floorId)] || defaultFloorName(item.floorId, placeType)} ${roomMap[item.roomId] || item.room || "Room"} ${item.name}`,
      watts: item.watts,
      on: item.on,
    }));
}

export function buildAlerts(metrics, roomStats, dailyLimit, placeType = "home") {
  const alerts = [];
  const type = normalizePlaceType(placeType);

  if (metrics.overLimit) {
    alerts.push({
      tone: "danger",
      title: "Daily limit exceeded",
      detail: `${toOneDecimal(metrics.todayUsage - dailyLimit)} kWh above the configured daily budget.`,
    });
  } else if (dailyLimit - metrics.todayUsage < Math.max(2, dailyLimit * 0.08)) {
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
      detail: `${metrics.liveLoadKw} kW is active during the higher tariff window for this ${type} profile.`,
    });
  }

  if (metrics.unusualSpike) {
    alerts.push({
      tone: "danger",
      title: type === "industry" ? "Industrial load spike" : "Unusual spike detected",
      detail: type === "industry"
        ? "Heavy machinery is drawing above the normal production baseline. Check backup and safety systems."
        : "One or more high-consumption devices are pulling more power than the expected schedule.",
    });
  }

  const overloadedRooms = (roomStats || []).filter((room) => room.overloaded);
  if (overloadedRooms.length) {
    alerts.push({
      tone: "danger",
      title: "Overload warning",
      detail: `${overloadedRooms.map((room) => `${defaultFloorName(room.floorId, placeType)} ${room.name}`).join(", ")} has high appliance demand and needs attention.`,
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
  return (appliances || []).map((item) => ({
    deviceId: item.deviceId,
    floorId: ensureFloorId(item.floorId),
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
  return (rooms || []).map((item) => ({
    id: item.id,
    floorId: ensureFloorId(item.floorId),
    type: item.type,
    name: item.name,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    threshold: item.threshold,
  }));
}
