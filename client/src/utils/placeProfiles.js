export const PLACE_TYPE_OPTIONS = [
  {
    value: "home",
    label: "Home",
    tagline: "Residential automation",
    description: "Instantly builds a smart living space with balanced daily usage and comfort devices.",
    gridSize: 10,
    dailyLimit: 28,
    simulationMode: "Residential AI balance",
  },
  {
    value: "school",
    label: "School",
    tagline: "Daytime campus automation",
    description: "Prepares classrooms, labs, and admin zones with timed daytime load behavior.",
    gridSize: 20,
    dailyLimit: 125,
    simulationMode: "Daytime campus schedule",
  },
  {
    value: "industry",
    label: "Industry",
    tagline: "Heavy-duty industrial monitoring",
    description: "Generates production sections with high-load devices and realistic live spikes.",
    gridSize: 40,
    dailyLimit: 420,
    simulationMode: "Heavy industrial load with live spikes",
  },
  {
    value: "office",
    label: "Office",
    tagline: "Workday productivity profile",
    description: "Sets up workspaces, meeting rooms, and server zones with business-hours demand.",
    gridSize: 20,
    dailyLimit: 96,
    simulationMode: "Business hours productivity profile",
  },
];

const ROOM_DEFINITIONS = {
  living: { key: "living", label: "Living Room", threshold: 2400 },
  bedroom: { key: "bedroom", label: "Bedroom", threshold: 1800 },
  kitchen: { key: "kitchen", label: "Kitchen", threshold: 2200 },
  bathroom: { key: "bathroom", label: "Bathroom", threshold: 2600 },
  classroom: { key: "classroom", label: "Classroom", threshold: 3200 },
  lab: { key: "lab", label: "Lab", threshold: 7200 },
  staff: { key: "staff", label: "Staff Room", threshold: 2800 },
  office: { key: "office", label: "Office", threshold: 3200 },
  production: { key: "production", label: "Production Area", threshold: 18000 },
  control: { key: "control", label: "Control Room", threshold: 9000 },
  storage: { key: "storage", label: "Storage", threshold: 6400 },
  workspace: { key: "workspace", label: "Workspace", threshold: 4400 },
  meeting: { key: "meeting", label: "Meeting Room", threshold: 2800 },
  server: { key: "server", label: "Server Room", threshold: 5400 },
  custom: { key: "custom", label: "Custom Room", threshold: 2400 },
};

const DEVICE_DEFINITIONS = {
  fan: { type: "fan", name: "Fan", watts: 75, dailyHours: 8.8 },
  ac: { type: "ac", name: "AC", watts: 1450, dailyHours: 5.2 },
  light: { type: "light", name: "Light", watts: 90, dailyHours: 8.5 },
  tv: { type: "tv", name: "TV", watts: 180, dailyHours: 4.8 },
  fridge: { type: "fridge", name: "Refrigerator", watts: 220, dailyHours: 18.5 },
  "water-heater": { type: "water-heater", name: "Water Heater", watts: 1800, dailyHours: 1.4 },
  projector: { type: "projector", name: "Projector", watts: 240, dailyHours: 6.8 },
  computer: { type: "computer", name: "Computer", watts: 180, dailyHours: 8.2 },
  "lab-equipment": { type: "lab-equipment", name: "Lab Equipment", watts: 2400, dailyHours: 4.4 },
  motor: { type: "motor", name: "Motor", watts: 5400, dailyHours: 16 },
  conveyor: { type: "conveyor", name: "Conveyor Belt", watts: 3200, dailyHours: 15 },
  cnc: { type: "cnc", name: "CNC Machine", watts: 7800, dailyHours: 11.5 },
  compressor: { type: "compressor", name: "Compressor", watts: 4600, dailyHours: 12.8 },
  pump: { type: "pump", name: "Pump", watts: 3800, dailyHours: 13.2 },
  hvac: { type: "hvac", name: "HVAC", watts: 3600, dailyHours: 15.5 },
  server: { type: "server", name: "Server", watts: 900, dailyHours: 24 },
  router: { type: "router", name: "Router", watts: 120, dailyHours: 24 },
  generator: { type: "generator", name: "Backup Generator", watts: 6400, dailyHours: 1.2 },
  "smart-plug": { type: "smart-plug", name: "Smart Plug", watts: 35, dailyHours: 10.5 },
};

export const ROOM_DEVICE_TYPES = {
  living: ["light", "fan", "tv", "ac", "fridge", "smart-plug"],
  bedroom: ["light", "fan", "ac", "smart-plug"],
  kitchen: ["light", "fan", "fridge", "smart-plug"],
  bathroom: ["light", "water-heater"],
  classroom: ["light", "fan", "projector", "computer"],
  lab: ["light", "fan", "computer", "lab-equipment"],
  staff: ["light", "fan", "computer", "ac"],
  office: ["light", "computer", "router", "ac"],
  production: ["motor", "conveyor", "cnc", "compressor", "pump", "hvac", "generator"],
  control: ["computer", "server", "router", "hvac"],
  storage: ["pump", "compressor", "generator", "light"],
  workspace: ["computer", "light", "ac", "router", "smart-plug"],
  meeting: ["light", "ac", "projector", "router"],
  server: ["server", "router", "hvac", "generator"],
  custom: Object.keys(DEVICE_DEFINITIONS),
};

const PLACE_TEMPLATE = {
  home: {
    floorNames: ["Floor 1", "Floor 2"],
    roomBlueprints: [
      { floorId: "floor-1", type: "living", name: "Living Room", x: 0, y: 0, width: 280, height: 170 },
      { floorId: "floor-1", type: "kitchen", name: "Kitchen", x: 0, y: 170, width: 230, height: 230 },
      { floorId: "floor-1", type: "bathroom", name: "Bathroom", x: 230, y: 170, width: 250, height: 230 },
      { floorId: "floor-2", type: "bedroom", name: "Bedroom", x: 60, y: 40, width: 360, height: 240 },
    ],
    applianceBlueprints: [
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
    aiSuggestions: [
      { id: "smart-plug", title: "Add smart plugs?", detail: "Cut standby waste in entertainment and bedroom zones.", deviceType: "smart-plug", roomKeywords: ["living", "bedroom"] },
      { id: "water-heater", title: "Automate water heating?", detail: "Shift heavy bathroom loads away from expensive peak hours.", deviceType: "water-heater", roomKeywords: ["bathroom"] },
    ],
  },
  school: {
    floorNames: ["Floor 1", "Floor 2", "Floor 3"],
    roomBlueprints: [
      { floorId: "floor-1", type: "classroom", name: "Classroom A", x: 0, y: 0, width: 240, height: 180 },
      { floorId: "floor-1", type: "classroom", name: "Classroom B", x: 240, y: 0, width: 240, height: 180 },
      { floorId: "floor-2", type: "lab", name: "Science Lab", x: 0, y: 0, width: 280, height: 210 },
      { floorId: "floor-2", type: "lab", name: "Computer Lab", x: 280, y: 0, width: 200, height: 210 },
      { floorId: "floor-3", type: "staff", name: "Staff Room", x: 0, y: 110, width: 220, height: 210 },
      { floorId: "floor-3", type: "office", name: "School Office", x: 220, y: 110, width: 260, height: 210 },
    ],
    applianceBlueprints: [
      { floorId: "floor-1", room: "Classroom A", type: "light" },
      { floorId: "floor-1", room: "Classroom A", type: "fan" },
      { floorId: "floor-1", room: "Classroom A", type: "projector" },
      { floorId: "floor-1", room: "Classroom B", type: "light" },
      { floorId: "floor-1", room: "Classroom B", type: "fan" },
      { floorId: "floor-1", room: "Classroom B", type: "projector" },
      { floorId: "floor-2", room: "Science Lab", type: "light" },
      { floorId: "floor-2", room: "Science Lab", type: "lab-equipment" },
      { floorId: "floor-2", room: "Computer Lab", type: "computer" },
      { floorId: "floor-2", room: "Computer Lab", type: "computer", name: "Computer 2" },
      { floorId: "floor-3", room: "Staff Room", type: "computer" },
      { floorId: "floor-3", room: "School Office", type: "router" },
    ],
    aiSuggestions: [
      { id: "lab-equipment", title: "Add lab equipment?", detail: "Track heavy practical sessions separately from classroom loads.", deviceType: "lab-equipment", roomKeywords: ["lab"] },
      { id: "projector", title: "Add more projectors?", detail: "Model shared learning spaces with realistic presentation loads.", deviceType: "projector", roomKeywords: ["classroom", "meeting"] },
    ],
  },
  industry: {
    floorNames: ["Section 1", "Section 2", "Section 3"],
    roomBlueprints: [
      { floorId: "floor-1", type: "production", name: "Production Area", x: 0, y: 0, width: 320, height: 250 },
      { floorId: "floor-1", type: "storage", name: "Storage", x: 320, y: 0, width: 160, height: 250 },
      { floorId: "floor-2", type: "control", name: "Control Room", x: 40, y: 70, width: 200, height: 200 },
      { floorId: "floor-2", type: "office", name: "Plant Office", x: 240, y: 70, width: 200, height: 200 },
      { floorId: "floor-3", type: "storage", name: "Utility Bay", x: 80, y: 90, width: 320, height: 180 },
    ],
    applianceBlueprints: [
      { floorId: "floor-1", room: "Production Area", type: "motor" },
      { floorId: "floor-1", room: "Production Area", type: "conveyor" },
      { floorId: "floor-1", room: "Production Area", type: "cnc" },
      { floorId: "floor-1", room: "Production Area", type: "hvac" },
      { floorId: "floor-2", room: "Control Room", type: "server" },
      { floorId: "floor-2", room: "Control Room", type: "computer" },
      { floorId: "floor-3", room: "Utility Bay", type: "compressor" },
      { floorId: "floor-3", room: "Utility Bay", type: "pump" },
    ],
    aiSuggestions: [
      { id: "generator", title: "Add backup generator?", detail: "Keep critical sections operational during sudden load spikes or grid loss.", deviceType: "generator", roomKeywords: ["storage", "server", "control"] },
      { id: "compressor", title: "Add redundant compressors?", detail: "Simulate demand balancing during high-production shifts.", deviceType: "compressor", roomKeywords: ["production", "utility"] },
    ],
  },
  office: {
    floorNames: ["Floor 1", "Floor 2"],
    roomBlueprints: [
      { floorId: "floor-1", type: "workspace", name: "Workspaces", x: 0, y: 0, width: 300, height: 230 },
      { floorId: "floor-1", type: "meeting", name: "Meeting Room", x: 300, y: 0, width: 180, height: 230 },
      { floorId: "floor-2", type: "meeting", name: "Board Room", x: 0, y: 110, width: 240, height: 190 },
      { floorId: "floor-2", type: "server", name: "Server Room", x: 240, y: 110, width: 240, height: 190 },
    ],
    applianceBlueprints: [
      { floorId: "floor-1", room: "Workspaces", type: "computer" },
      { floorId: "floor-1", room: "Workspaces", type: "computer", name: "Computer 2" },
      { floorId: "floor-1", room: "Workspaces", type: "light" },
      { floorId: "floor-1", room: "Workspaces", type: "ac" },
      { floorId: "floor-1", room: "Meeting Room", type: "projector" },
      { floorId: "floor-2", room: "Board Room", type: "router" },
      { floorId: "floor-2", room: "Server Room", type: "server" },
      { floorId: "floor-2", room: "Server Room", type: "router" },
      { floorId: "floor-2", room: "Server Room", type: "hvac" },
    ],
    aiSuggestions: [
      { id: "router", title: "Add redundant routers?", detail: "Keep meeting spaces and network racks resilient during busy work hours.", deviceType: "router", roomKeywords: ["server", "meeting", "workspace"] },
      { id: "smart-plug", title: "Add workstation smart plugs?", detail: "Automatically trim standby draw after business hours.", deviceType: "smart-plug", roomKeywords: ["workspace", "office"] },
    ],
  },
};

export const ROOM_LIBRARY = Object.values(ROOM_DEFINITIONS);
export const DEVICE_LIBRARY = Object.values(DEVICE_DEFINITIONS);

export function normalizePlaceType(value) {
  const normalized = String(value || "home").trim().toLowerCase();
  return PLACE_TYPE_OPTIONS.some((item) => item.value === normalized) ? normalized : "home";
}

export function getPlaceConfig(placeType = "home") {
  const type = normalizePlaceType(placeType);
  const base = PLACE_TYPE_OPTIONS.find((item) => item.value === type) || PLACE_TYPE_OPTIONS[0];
  return {
    ...base,
    ...PLACE_TEMPLATE[type],
  };
}

export function getPlaceLabel(placeType = "home") {
  return getPlaceConfig(placeType).label;
}

export function getRoomLibrary(placeType = "home") {
  const config = getPlaceConfig(placeType);
  const seen = new Set();
  const rooms = [];
  (config.roomBlueprints || []).forEach((room) => {
    const definition = ROOM_DEFINITIONS[room.type];
    if (definition && !seen.has(definition.key)) {
      seen.add(definition.key);
      rooms.push(definition);
    }
  });
  rooms.push(ROOM_DEFINITIONS.custom);
  return rooms;
}

export function getAiSuggestions(placeType = "home") {
  return getPlaceConfig(placeType).aiSuggestions || [];
}

export function getTemplateRoomBlueprints(placeType = "home") {
  return getPlaceConfig(placeType).roomBlueprints || [];
}

export function getTemplateApplianceBlueprints(placeType = "home") {
  return getPlaceConfig(placeType).applianceBlueprints || [];
}

export function getRoomThreshold(type) {
  return ROOM_DEFINITIONS[type]?.threshold || ROOM_DEFINITIONS.custom.threshold;
}

export function getRoomDefinition(type) {
  return ROOM_DEFINITIONS[type] || ROOM_DEFINITIONS.custom;
}

export function getDeviceTemplate(type) {
  return DEVICE_DEFINITIONS[type] || DEVICE_DEFINITIONS.light;
}

export function getDefaultGridSize(placeType = "home") {
  return getPlaceConfig(placeType).gridSize;
}

export function getDefaultDailyLimit(placeType = "home") {
  return getPlaceConfig(placeType).dailyLimit;
}

export function getFloorNames(placeType = "home") {
  return getPlaceConfig(placeType).floorNames || ["Floor 1"];
}
