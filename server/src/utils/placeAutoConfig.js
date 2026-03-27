const PLACE_TYPE_SET = new Set(["home", "school", "industry", "office"]);

const DEVICE_CATALOG = {
  light: { name: "Light", watts: 90, dailyHours: 8.5, on: true },
  fan: { name: "Fan", watts: 75, dailyHours: 9, on: true },
  tv: { name: "TV", watts: 180, dailyHours: 4.8, on: true },
  ac: { name: "AC", watts: 1450, dailyHours: 5.2, on: false },
  fridge: { name: "Refrigerator", watts: 220, dailyHours: 18.5, on: true },
  "water-heater": { name: "Water Heater", watts: 1800, dailyHours: 1.4, on: false },
  projector: { name: "Projector", watts: 240, dailyHours: 6.8, on: true },
  computer: { name: "Computer", watts: 180, dailyHours: 8.2, on: true },
  "lab-equipment": { name: "Lab Equipment", watts: 2400, dailyHours: 4.4, on: false },
  motor: { name: "Motor", watts: 5400, dailyHours: 16, on: true },
  conveyor: { name: "Conveyor Belt", watts: 3200, dailyHours: 15, on: true },
  cnc: { name: "CNC Machine", watts: 7800, dailyHours: 11.5, on: false },
  compressor: { name: "Compressor", watts: 4600, dailyHours: 12.8, on: true },
  pump: { name: "Pump", watts: 3800, dailyHours: 13.2, on: true },
  hvac: { name: "HVAC", watts: 3600, dailyHours: 15.5, on: true },
  server: { name: "Server", watts: 900, dailyHours: 24, on: true },
  router: { name: "Router", watts: 120, dailyHours: 24, on: true },
  generator: { name: "Backup Generator", watts: 6400, dailyHours: 1.2, on: false },
  "smart-plug": { name: "Smart Plug", watts: 35, dailyHours: 10.5, on: false },
};

const ROOM_THRESHOLDS = {
  living: 2400,
  bedroom: 1800,
  kitchen: 2000,
  bathroom: 2500,
  classroom: 3200,
  lab: 7200,
  staff: 2600,
  office: 3000,
  production: 18000,
  control: 9000,
  storage: 6000,
  workspace: 4200,
  meeting: 2600,
  server: 5400,
  custom: 2400,
};

const PLACE_CONFIG = {
  home: {
    label: "Home",
    gridSize: 10,
    dailyLimit: 28,
    simulationMode: "Residential AI balance",
    floors: [
      { id: "floor-1", name: "Floor 1" },
      { id: "floor-2", name: "Floor 2" },
    ],
    rooms: [
      { floorId: "floor-1", type: "living", name: "Living Room", x: 0, y: 0, width: 280, height: 170 },
      { floorId: "floor-1", type: "kitchen", name: "Kitchen", x: 0, y: 170, width: 230, height: 230 },
      { floorId: "floor-1", type: "bathroom", name: "Bathroom", x: 230, y: 170, width: 250, height: 230 },
      { floorId: "floor-2", type: "bedroom", name: "Bedroom", x: 60, y: 40, width: 360, height: 240 },
    ],
    appliances: [
      { floorId: "floor-1", room: "Living Room", type: "light" },
      { floorId: "floor-1", room: "Living Room", type: "fan" },
      { floorId: "floor-1", room: "Living Room", type: "tv" },
      { floorId: "floor-1", room: "Living Room", type: "ac" },
      { floorId: "floor-1", room: "Kitchen", type: "light" },
      { floorId: "floor-1", room: "Kitchen", type: "fan" },
      { floorId: "floor-1", room: "Kitchen", type: "fridge" },
      { floorId: "floor-1", room: "Bathroom", type: "light" },
      { floorId: "floor-1", room: "Bathroom", type: "water-heater" },
      { floorId: "floor-2", room: "Bedroom", type: "light" },
      { floorId: "floor-2", room: "Bedroom", type: "fan" },
      { floorId: "floor-2", room: "Bedroom", type: "ac" },
    ],
  },
  school: {
    label: "School",
    gridSize: 20,
    dailyLimit: 125,
    simulationMode: "Daytime campus schedule",
    floors: [
      { id: "floor-1", name: "Floor 1" },
      { id: "floor-2", name: "Floor 2" },
      { id: "floor-3", name: "Floor 3" },
    ],
    rooms: [
      { floorId: "floor-1", type: "classroom", name: "Classroom A", x: 0, y: 0, width: 240, height: 180 },
      { floorId: "floor-1", type: "classroom", name: "Classroom B", x: 240, y: 0, width: 240, height: 180 },
      { floorId: "floor-2", type: "lab", name: "Science Lab", x: 0, y: 0, width: 280, height: 210 },
      { floorId: "floor-2", type: "lab", name: "Computer Lab", x: 280, y: 0, width: 200, height: 210 },
      { floorId: "floor-3", type: "staff", name: "Staff Room", x: 0, y: 110, width: 220, height: 210 },
      { floorId: "floor-3", type: "office", name: "School Office", x: 220, y: 110, width: 260, height: 210 },
    ],
    appliances: [
      { floorId: "floor-1", room: "Classroom A", type: "light" },
      { floorId: "floor-1", room: "Classroom A", type: "fan" },
      { floorId: "floor-1", room: "Classroom A", type: "projector" },
      { floorId: "floor-1", room: "Classroom B", type: "light" },
      { floorId: "floor-1", room: "Classroom B", type: "fan" },
      { floorId: "floor-1", room: "Classroom B", type: "projector" },
      { floorId: "floor-2", room: "Science Lab", type: "light" },
      { floorId: "floor-2", room: "Science Lab", type: "fan" },
      { floorId: "floor-2", room: "Science Lab", type: "lab-equipment" },
      { floorId: "floor-2", room: "Computer Lab", type: "light" },
      { floorId: "floor-2", room: "Computer Lab", type: "computer" },
      { floorId: "floor-2", room: "Computer Lab", type: "computer", name: "Computer 2" },
      { floorId: "floor-3", room: "Staff Room", type: "light" },
      { floorId: "floor-3", room: "Staff Room", type: "fan" },
      { floorId: "floor-3", room: "Staff Room", type: "computer" },
      { floorId: "floor-3", room: "School Office", type: "light" },
      { floorId: "floor-3", room: "School Office", type: "computer" },
      { floorId: "floor-3", room: "School Office", type: "router" },
    ],
  },
  industry: {
    label: "Industry",
    gridSize: 40,
    dailyLimit: 420,
    simulationMode: "Heavy industrial load with live spikes",
    floors: [
      { id: "floor-1", name: "Section 1" },
      { id: "floor-2", name: "Section 2" },
      { id: "floor-3", name: "Section 3" },
    ],
    rooms: [
      { floorId: "floor-1", type: "production", name: "Production Area", x: 0, y: 0, width: 320, height: 250 },
      { floorId: "floor-1", type: "storage", name: "Storage", x: 320, y: 0, width: 160, height: 250 },
      { floorId: "floor-2", type: "control", name: "Control Room", x: 40, y: 70, width: 200, height: 200 },
      { floorId: "floor-2", type: "office", name: "Plant Office", x: 240, y: 70, width: 200, height: 200 },
      { floorId: "floor-3", type: "storage", name: "Utility Bay", x: 80, y: 90, width: 320, height: 180 },
    ],
    appliances: [
      { floorId: "floor-1", room: "Production Area", type: "motor" },
      { floorId: "floor-1", room: "Production Area", type: "conveyor" },
      { floorId: "floor-1", room: "Production Area", type: "cnc" },
      { floorId: "floor-1", room: "Production Area", type: "hvac" },
      { floorId: "floor-1", room: "Storage", type: "pump" },
      { floorId: "floor-2", room: "Control Room", type: "computer" },
      { floorId: "floor-2", room: "Control Room", type: "server" },
      { floorId: "floor-2", room: "Control Room", type: "router" },
      { floorId: "floor-2", room: "Plant Office", type: "computer" },
      { floorId: "floor-2", room: "Plant Office", type: "light" },
      { floorId: "floor-3", room: "Utility Bay", type: "compressor" },
      { floorId: "floor-3", room: "Utility Bay", type: "pump" },
      { floorId: "floor-3", room: "Utility Bay", type: "generator" },
    ],
  },
  office: {
    label: "Office",
    gridSize: 20,
    dailyLimit: 96,
    simulationMode: "Business hours productivity profile",
    floors: [
      { id: "floor-1", name: "Floor 1" },
      { id: "floor-2", name: "Floor 2" },
    ],
    rooms: [
      { floorId: "floor-1", type: "workspace", name: "Workspaces", x: 0, y: 0, width: 300, height: 230 },
      { floorId: "floor-1", type: "meeting", name: "Meeting Room", x: 300, y: 0, width: 180, height: 230 },
      { floorId: "floor-2", type: "meeting", name: "Board Room", x: 0, y: 110, width: 240, height: 190 },
      { floorId: "floor-2", type: "server", name: "Server Room", x: 240, y: 110, width: 240, height: 190 },
    ],
    appliances: [
      { floorId: "floor-1", room: "Workspaces", type: "computer" },
      { floorId: "floor-1", room: "Workspaces", type: "computer", name: "Computer 2" },
      { floorId: "floor-1", room: "Workspaces", type: "light" },
      { floorId: "floor-1", room: "Workspaces", type: "ac" },
      { floorId: "floor-1", room: "Meeting Room", type: "light" },
      { floorId: "floor-1", room: "Meeting Room", type: "router" },
      { floorId: "floor-2", room: "Board Room", type: "light" },
      { floorId: "floor-2", room: "Board Room", type: "ac" },
      { floorId: "floor-2", room: "Server Room", type: "server" },
      { floorId: "floor-2", room: "Server Room", type: "server", name: "Server Rack 2" },
      { floorId: "floor-2", room: "Server Room", type: "router" },
      { floorId: "floor-2", room: "Server Room", type: "hvac" },
    ],
  },
};

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

export function normalizePlaceType(value) {
  const next = String(value || "home").trim().toLowerCase();
  return PLACE_TYPE_SET.has(next) ? next : "home";
}

export function getPlaceMeta(placeType) {
  return PLACE_CONFIG[normalizePlaceType(placeType)] || PLACE_CONFIG.home;
}

export function defaultSettingsForPlace(placeType) {
  const meta = getPlaceMeta(placeType);
  return {
    dailyLimit: meta.dailyLimit,
    darkMode: true,
    placeType: normalizePlaceType(placeType),
    gridSize: meta.gridSize,
    simulationMode: meta.simulationMode,
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createRooms(placeType) {
  return getPlaceMeta(placeType).rooms.map((room) => ({
    id: `${room.floorId}-${slugify(room.name)}`,
    floorId: room.floorId,
    type: room.type,
    name: room.name,
    x: room.x,
    y: room.y,
    width: room.width,
    height: room.height,
    threshold: ROOM_THRESHOLDS[room.type] || ROOM_THRESHOLDS.custom,
  }));
}

function defaultPlacement(index) {
  const placements = [
    [0.24, 0.26],
    [0.62, 0.28],
    [0.38, 0.62],
    [0.72, 0.66],
    [0.5, 0.18],
  ];
  const [xPct, yPct] = placements[index % placements.length];
  return { xPct, yPct };
}

function createAppliances(placeType, rooms) {
  const roomMap = Object.fromEntries(rooms.map((room) => [`${room.floorId}::${room.name}`, room]));
  const counts = {};
  return getPlaceMeta(placeType).appliances.map((item) => {
    const room = roomMap[`${item.floorId}::${item.room}`];
    const template = DEVICE_CATALOG[item.type] || DEVICE_CATALOG.light;
    counts[room.id] = counts[room.id] || 0;
    const placement = defaultPlacement(counts[room.id]);
    counts[room.id] += 1;
    return {
      deviceId: `${room.floorId}-${slugify(room.name)}-${slugify(item.name || template.name)}-${counts[room.id]}`,
      floorId: room.floorId,
      roomId: room.id,
      room: room.name,
      name: item.name || template.name,
      type: item.type,
      watts: item.watts || template.watts,
      dailyHours: item.dailyHours || template.dailyHours,
      on: item.on ?? template.on,
      highUsage: Number(item.watts || template.watts) >= 1000,
      xPct: placement.xPct,
      yPct: placement.yPct,
    };
  });
}

function buildMetrics(placeType, appliances, settings) {
  const meta = getPlaceMeta(placeType);
  const modeledLoad = appliances.reduce((sum, item) => sum + (item.watts * item.dailyHours) / 1000, 0);
  const activeWatts = appliances.filter((item) => item.on).reduce((sum, item) => sum + item.watts, 0);
  const liveLoadKw = round((activeWatts + (placeType === "industry" ? 640 : 120)) / 1000, 2);
  const baselineMultiplier = { home: 0.58, school: 0.72, industry: 0.88, office: 0.68 }[placeType] || 0.6;
  const todayUsage = round(Math.max(6.5, modeledLoad * baselineMultiplier), 2);
  const weeklyUsage = round(todayUsage * 6.6);
  const monthlyUsage = round(todayUsage * 27.1);
  const voltageDrop = placeType === "industry" ? liveLoadKw * 3.8 : liveLoadKw * 2.1;
  const voltage = Math.max(193, Math.min(238, Math.round(231 - voltageDrop)));
  const current = round((activeWatts + 40) / Math.max(voltage, 1));
  const unusualSpike = placeType === "industry" ? liveLoadKw > 18 : placeType === "school" ? liveLoadKw > 6.5 : liveLoadKw > 4.8;
  return {
    liveLoadKw,
    todayUsage,
    weeklyUsage,
    monthlyUsage,
    voltage,
    current,
    billEstimate: Math.round(monthlyUsage * (placeType === "industry" ? 9.4 : 8.35)),
    lowVoltage: voltage < 210,
    overLimit: todayUsage > settings.dailyLimit,
    peakHour: placeType === "home" ? true : placeType === "industry" || placeType === "office" || placeType === "school",
    unusualSpike,
    lastSyncedAt: new Date().toISOString(),
    activeDevices: appliances.filter((item) => item.on).length,
    simulationMode: meta.simulationMode,
  };
}

function buildHistory(todayUsage) {
  const history = [];
  const now = new Date();
  for (let index = 13; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - index);
    history.push({
      date: day.toISOString().slice(0, 10),
      totalKwh: round(Math.max(4.8, todayUsage - index * 0.48 + ((13 - index) % 3) * 0.6)),
    });
  }
  return history;
}

export function generateAutoProfile(placeType) {
  const normalizedPlaceType = normalizePlaceType(placeType);
  const meta = getPlaceMeta(normalizedPlaceType);
  const settings = defaultSettingsForPlace(normalizedPlaceType);
  const rooms = createRooms(normalizedPlaceType);
  const appliances = createAppliances(normalizedPlaceType, rooms);
  const latestMetrics = buildMetrics(normalizedPlaceType, appliances, settings);

  return {
    setupCompleted: true,
    floors: meta.floors.map((floor) => ({ ...floor })),
    rooms,
    appliances,
    latestMetrics,
    dailyHistory: buildHistory(latestMetrics.todayUsage),
    settings,
  };
}
