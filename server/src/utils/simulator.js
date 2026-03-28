import { normalizePlaceType } from "./placeAutoConfig.js";

const PLACE_PROFILES = {
  home: {
    nominalVoltage: 229,
    voltageDrop: 6.2,
    voltageNoise: 1.8,
    lowVoltageAt: 210,
    thresholdWatts: 3200,
    spikeMultiplier: 0.9,
  },
  school: {
    nominalVoltage: 228,
    voltageDrop: 7.4,
    voltageNoise: 2.1,
    lowVoltageAt: 208,
    thresholdWatts: 6500,
    spikeMultiplier: 1,
  },
  industry: {
    nominalVoltage: 226,
    voltageDrop: 9.6,
    voltageNoise: 2.8,
    lowVoltageAt: 205,
    thresholdWatts: 12000,
    spikeMultiplier: 1.35,
  },
  office: {
    nominalVoltage: 229,
    voltageDrop: 6.8,
    voltageNoise: 1.9,
    lowVoltageAt: 209,
    thresholdWatts: 5200,
    spikeMultiplier: 0.95,
  },
};

const DEVICE_PROFILES = {
  fan: {
    nominalWatts: 78,
    minWatts: 45,
    maxWatts: 120,
    baseLoad: 0.86,
    variation: 0.16,
    microVariation: 0.05,
    noise: 0.09,
    cycleSeconds: 6,
    spikeProbability: 0.04,
    spikeBoost: 0.18,
    warningFactor: 1.18,
  },
  ac: {
    nominalWatts: 1480,
    minWatts: 820,
    maxWatts: 2200,
    baseLoad: 0.92,
    variation: 0.18,
    microVariation: 0.06,
    noise: 0.08,
    cycleSeconds: 8,
    spikeProbability: 0.12,
    spikeBoost: 0.28,
    warningFactor: 1.2,
  },
  light: {
    nominalWatts: 18,
    minWatts: 6,
    maxWatts: 42,
    baseLoad: 0.96,
    variation: 0.08,
    microVariation: 0.03,
    noise: 0.04,
    cycleSeconds: 7,
    spikeProbability: 0.01,
    spikeBoost: 0.08,
    warningFactor: 1.28,
  },
  tv: {
    nominalWatts: 120,
    minWatts: 55,
    maxWatts: 220,
    baseLoad: 0.9,
    variation: 0.15,
    microVariation: 0.05,
    noise: 0.06,
    cycleSeconds: 9,
    spikeProbability: 0.05,
    spikeBoost: 0.16,
    warningFactor: 1.22,
  },
  fridge: {
    nominalWatts: 180,
    minWatts: 95,
    maxWatts: 340,
    baseLoad: 0.82,
    variation: 0.24,
    microVariation: 0.08,
    noise: 0.07,
    cycleSeconds: 10,
    spikeProbability: 0.1,
    spikeBoost: 0.22,
    warningFactor: 1.18,
  },
  "water-heater": {
    nominalWatts: 1800,
    minWatts: 1200,
    maxWatts: 2600,
    baseLoad: 0.95,
    variation: 0.14,
    microVariation: 0.04,
    noise: 0.06,
    cycleSeconds: 6,
    spikeProbability: 0.1,
    spikeBoost: 0.22,
    warningFactor: 1.16,
  },
  projector: {
    nominalWatts: 240,
    minWatts: 150,
    maxWatts: 360,
    baseLoad: 0.9,
    variation: 0.14,
    microVariation: 0.04,
    noise: 0.05,
    cycleSeconds: 8,
    spikeProbability: 0.04,
    spikeBoost: 0.14,
    warningFactor: 1.18,
  },
  computer: {
    nominalWatts: 170,
    minWatts: 75,
    maxWatts: 320,
    baseLoad: 0.84,
    variation: 0.18,
    microVariation: 0.06,
    noise: 0.06,
    cycleSeconds: 7,
    spikeProbability: 0.06,
    spikeBoost: 0.18,
    warningFactor: 1.22,
  },
  "lab-equipment": {
    nominalWatts: 620,
    minWatts: 300,
    maxWatts: 1100,
    baseLoad: 0.88,
    variation: 0.2,
    microVariation: 0.06,
    noise: 0.07,
    cycleSeconds: 7,
    spikeProbability: 0.08,
    spikeBoost: 0.22,
    warningFactor: 1.16,
  },
  motor: {
    nominalWatts: 3200,
    minWatts: 1600,
    maxWatts: 5400,
    baseLoad: 0.9,
    variation: 0.2,
    microVariation: 0.06,
    noise: 0.08,
    cycleSeconds: 6,
    spikeProbability: 0.18,
    spikeBoost: 0.34,
    warningFactor: 1.14,
  },
  conveyor: {
    nominalWatts: 2600,
    minWatts: 1400,
    maxWatts: 4200,
    baseLoad: 0.9,
    variation: 0.16,
    microVariation: 0.05,
    noise: 0.07,
    cycleSeconds: 7,
    spikeProbability: 0.14,
    spikeBoost: 0.26,
    warningFactor: 1.15,
  },
  cnc: {
    nominalWatts: 4200,
    minWatts: 2400,
    maxWatts: 7600,
    baseLoad: 0.92,
    variation: 0.18,
    microVariation: 0.07,
    noise: 0.08,
    cycleSeconds: 8,
    spikeProbability: 0.16,
    spikeBoost: 0.3,
    warningFactor: 1.14,
  },
  compressor: {
    nominalWatts: 3400,
    minWatts: 2000,
    maxWatts: 5600,
    baseLoad: 0.9,
    variation: 0.18,
    microVariation: 0.06,
    noise: 0.08,
    cycleSeconds: 7,
    spikeProbability: 0.16,
    spikeBoost: 0.28,
    warningFactor: 1.14,
  },
  pump: {
    nominalWatts: 2100,
    minWatts: 1100,
    maxWatts: 3600,
    baseLoad: 0.9,
    variation: 0.18,
    microVariation: 0.06,
    noise: 0.07,
    cycleSeconds: 7,
    spikeProbability: 0.12,
    spikeBoost: 0.22,
    warningFactor: 1.15,
  },
  hvac: {
    nominalWatts: 2800,
    minWatts: 1600,
    maxWatts: 4600,
    baseLoad: 0.91,
    variation: 0.16,
    microVariation: 0.05,
    noise: 0.07,
    cycleSeconds: 9,
    spikeProbability: 0.14,
    spikeBoost: 0.24,
    warningFactor: 1.14,
  },
  server: {
    nominalWatts: 520,
    minWatts: 260,
    maxWatts: 920,
    baseLoad: 0.86,
    variation: 0.14,
    microVariation: 0.04,
    noise: 0.05,
    cycleSeconds: 10,
    spikeProbability: 0.06,
    spikeBoost: 0.18,
    warningFactor: 1.16,
  },
  router: {
    nominalWatts: 45,
    minWatts: 18,
    maxWatts: 90,
    baseLoad: 0.92,
    variation: 0.08,
    microVariation: 0.03,
    noise: 0.03,
    cycleSeconds: 11,
    spikeProbability: 0.02,
    spikeBoost: 0.08,
    warningFactor: 1.24,
  },
  generator: {
    nominalWatts: 4800,
    minWatts: 2200,
    maxWatts: 8000,
    baseLoad: 0.92,
    variation: 0.16,
    microVariation: 0.06,
    noise: 0.08,
    cycleSeconds: 8,
    spikeProbability: 0.18,
    spikeBoost: 0.32,
    warningFactor: 1.14,
  },
  "smart-plug": {
    nominalWatts: 32,
    minWatts: 5,
    maxWatts: 100,
    baseLoad: 0.82,
    variation: 0.16,
    microVariation: 0.05,
    noise: 0.05,
    cycleSeconds: 8,
    spikeProbability: 0.02,
    spikeBoost: 0.1,
    warningFactor: 1.32,
  },
  generic: {
    nominalWatts: 120,
    minWatts: 20,
    maxWatts: 600,
    baseLoad: 0.88,
    variation: 0.18,
    microVariation: 0.05,
    noise: 0.06,
    cycleSeconds: 8,
    spikeProbability: 0.05,
    spikeBoost: 0.18,
    warningFactor: 1.2,
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFixedNumber(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function hashSeed(value) {
  const input = String(value || "");
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededUnit(...parts) {
  const seed = hashSeed(parts.join(":"));
  const raw = Math.sin(seed) * 10000;
  return raw - Math.floor(raw);
}

function normalizeDeviceType(value) {
  const type = String(value || "generic").trim().toLowerCase();
  if (type === "refrigerator") return "fridge";
  if (type === "air-conditioner") return "ac";
  return type || "generic";
}

function getPlaceProfile(placeType = "home") {
  return PLACE_PROFILES[normalizePlaceType(placeType)] || PLACE_PROFILES.home;
}

function getDeviceProfile(deviceType) {
  return DEVICE_PROFILES[normalizeDeviceType(deviceType)] || DEVICE_PROFILES.generic;
}

function getUsageEnvelope(placeType, now) {
  const hour = new Date(now).getHours();
  switch (normalizePlaceType(placeType)) {
    case "school":
      return hour >= 8 && hour <= 16 ? 1 : 0.22;
    case "office":
      return hour >= 8 && hour <= 19 ? 1 : 0.26;
    case "industry":
      return hour >= 7 && hour <= 21 ? 1.06 : 0.84;
    case "home":
    default:
      if (hour < 6) return 0.48;
      if (hour < 9) return 0.72;
      if (hour < 17) return 0.58;
      if (hour < 23) return 1;
      return 0.54;
  }
}

function buildSimulatorPath(device, placeType) {
  const type = normalizeDeviceType(device.type);
  const params = new URLSearchParams({
    deviceId: String(device.deviceId || `${type}-sim`),
    watts: String(Math.max(0, Number(device.watts) || 0)),
    on: String(Boolean(device.on)),
    placeType: normalizePlaceType(placeType),
  });
  return `/api/simulator/${type}?${params.toString()}`;
}

export function simulateDevice(device = {}, placeType = "home", now = Date.now()) {
  const type = normalizeDeviceType(device.type || device.deviceType);
  const deviceProfile = getDeviceProfile(type);
  const placeProfile = getPlaceProfile(placeType);
  const on = device.on === true || device.on === "true" || device.on === 1 || device.on === "1";
  const seedId = String(device.deviceId || `${type}-sim`);
  const declaredWatts = Number(device.watts) || deviceProfile.nominalWatts;
  const baseWatts = clamp(
    declaredWatts,
    deviceProfile.minWatts,
    Math.max(deviceProfile.maxWatts, declaredWatts * 1.4)
  );
  const secondBucket = Math.floor(now / 1000);
  const phase = seededUnit(seedId, type, "phase") * Math.PI * 2;
  const microPhase = seededUnit(seedId, type, "micro") * Math.PI * 2;
  const slowWave = Math.sin(secondBucket / deviceProfile.cycleSeconds + phase);
  const microWave = Math.sin(secondBucket / Math.max(2, deviceProfile.cycleSeconds / 2) + microPhase);
  const jitter = (seededUnit(seedId, secondBucket, "jitter") - 0.5) * deviceProfile.noise;
  const occupancyFactor = getUsageEnvelope(placeType, now);

  let loadFactor = deviceProfile.baseLoad;
  loadFactor += slowWave * deviceProfile.variation;
  loadFactor += microWave * deviceProfile.microVariation;
  loadFactor += jitter;
  loadFactor *= occupancyFactor;

  let power = on ? baseWatts * loadFactor : 0;
  let spike = false;

  if (on) {
    const spikeChance = seededUnit(seedId, Math.floor(now / 4500), "spike");
    const spikeThreshold = 1 - deviceProfile.spikeProbability * placeProfile.spikeMultiplier;
    if (spikeChance > spikeThreshold) {
      spike = true;
      power += baseWatts * deviceProfile.spikeBoost * (0.72 + seededUnit(seedId, secondBucket, "boost"));
    }
  }

  power = on
    ? Math.round(clamp(power, Math.max(4, deviceProfile.minWatts * 0.45), Math.max(deviceProfile.maxWatts, baseWatts * 1.65)))
    : 0;

  const voltageNoise = (seededUnit(type, secondBucket, "voltage") - 0.5) * placeProfile.voltageNoise;
  const voltageDrop = (power / Math.max(placeProfile.thresholdWatts, 1)) * placeProfile.voltageDrop;
  const voltage = toFixedNumber(
    clamp(placeProfile.nominalVoltage - voltageDrop + voltageNoise, 180, placeProfile.nominalVoltage + 3),
    1
  );
  const current = on && voltage > 0 ? toFixedNumber(power / voltage, 2) : 0;
  const warningThreshold = Math.max(baseWatts * deviceProfile.warningFactor, deviceProfile.minWatts * 1.2);
  const lowVoltage = voltage < placeProfile.lowVoltageAt;
  const warning = on && (power >= warningThreshold || lowVoltage || spike);

  let warningText = "";
  if (lowVoltage) {
    warningText = "Low voltage";
  } else if (spike) {
    warningText = "Load spike";
  } else if (power >= warningThreshold) {
    warningText = "High usage";
  }

  return {
    deviceId: seedId,
    type,
    name: String(device.name || type || "Device"),
    roomId: String(device.roomId || ""),
    floorId: String(device.floorId || "floor-1"),
    active: on,
    voltage,
    current,
    power,
    warning,
    warningText,
    lowVoltage,
    spike,
    updatedAt: new Date(now).toISOString(),
    simulatorPath: buildSimulatorPath({ ...device, type, deviceId: seedId }, placeType),
  };
}

export function simulateBatch(devices = [], placeType = "home", now = Date.now()) {
  const placeProfile = getPlaceProfile(placeType);
  const snapshots = {};
  let totalPower = 0;
  let totalCurrent = 0;
  let voltageSum = 0;
  let voltageCount = 0;
  let activeDevices = 0;
  let warningCount = 0;
  let lowVoltage = false;
  let unusualSpike = false;

  (devices || []).forEach((device) => {
    const snapshot = simulateDevice(device, placeType, now);
    snapshots[snapshot.deviceId] = snapshot;

    totalPower += snapshot.power;
    totalCurrent += snapshot.current;

    if (snapshot.active) {
      activeDevices += 1;
      voltageSum += snapshot.voltage;
      voltageCount += 1;
    }

    if (snapshot.warning) {
      warningCount += 1;
    }

    lowVoltage ||= snapshot.lowVoltage;
    unusualSpike ||= snapshot.spike;
  });

  const averageVoltage = toFixedNumber(voltageCount ? voltageSum / voltageCount : placeProfile.nominalVoltage, 1);

  return {
    devices: snapshots,
    summary: {
      totalPower: Math.round(totalPower),
      liveLoadKw: toFixedNumber(totalPower / 1000, 2),
      totalCurrent: toFixedNumber(totalCurrent, 2),
      averageVoltage,
      activeDevices,
      warningCount,
      lowVoltage,
      unusualSpike,
      thresholdWatts: placeProfile.thresholdWatts,
      updatedAt: new Date(now).toISOString(),
    },
  };
}
