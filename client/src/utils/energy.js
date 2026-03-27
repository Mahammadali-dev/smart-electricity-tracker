const roomDefinitions = [
  { name: "Living Room", threshold: 2200 },
  { name: "Bedroom", threshold: 1800 },
  { name: "Kitchen", threshold: 1700 },
  { name: "Bathroom", threshold: 1000 },
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

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function toOneDecimal(value) {
  return Number(value.toFixed(1));
}

function toTwoDecimals(value) {
  return Number(value.toFixed(2));
}

export function createDefaultAppliances() {
  return applianceBlueprints.map((item) => ({
    ...item,
    deviceId: `${slugify(item.room)}-${slugify(item.name)}`,
    highUsage: item.watts >= 1000,
  }));
}

export function calculateRoomStats(appliances) {
  return roomDefinitions.map((room) => {
    const devices = appliances.filter((item) => item.room === room.name);
    const activeWatts = devices.filter((item) => item.on).reduce((sum, item) => sum + item.watts, 0);
    return {
      ...room,
      devices,
      activeWatts,
      activeLoadKw: toTwoDecimals(activeWatts / 1000),
      activeCount: devices.filter((item) => item.on).length,
      overloaded: activeWatts > room.threshold,
    };
  });
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
  const rawVoltage = 229 - liveLoadKw * 5 - (peakHour ? 8 : 0) + Math.sin(now.getMinutes() / 60 * Math.PI * 2) * 1.6;
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
    const values = labels.map((_, index) => toOneDecimal(Math.max(0.4, metrics.liveLoadKw * (0.55 + index * 0.16) + (index % 2 === 0 ? 0.2 : 0.4))));
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

export function buildDeviceComparison(appliances) {
  return appliances
    .slice()
    .sort((left, right) => right.watts - left.watts)
    .slice(0, 6)
    .map((item) => ({
      label: `${item.room} ${item.name}`,
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

export function getRoomByName(roomStats, roomName) {
  return roomStats.find((room) => room.name === roomName) || roomStats[0];
}

export function serializeAppliances(appliances) {
  return appliances.map((item) => ({
    deviceId: item.deviceId,
    room: item.room,
    name: item.name,
    type: item.type,
    watts: item.watts,
    on: item.on,
    highUsage: item.highUsage,
  }));
}

export { roomDefinitions };
