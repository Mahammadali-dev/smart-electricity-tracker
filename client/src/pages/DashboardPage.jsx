import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import Navigation from "../components/Navigation";
import MetricCard from "../components/MetricCard";
import ChartPanel from "../components/ChartPanel";
import ApplianceIcon from "../components/ApplianceIcon";
import {
  buildAlerts,
  buildDeviceComparison,
  buildTrendSeries,
  calculateFloorStats,
  calculateRoomStats,
  computeMetrics,
  createAllDefaultRooms,
  createDefaultAppliances,
  createDefaultFloors,
  createDevice,
  createInitialHistory,
  deviceStyle,
  filterDevicesByFloor,
  filterRoomsByFloor,
  getAllowedDeviceLibrary,
  getFloorById,
  getPreferredFloorId,
  getRoomById,
  mergeSavedAppliances,
  normalizeFloors,
  normalizeRooms,
  roomStyle,
  serializeAppliances,
  serializeFloors,
  serializeRooms,
  syncTodayHistory,
} from "../utils/energy";
import { getAiSuggestions, getPlaceConfig, normalizePlaceType } from "../utils/placeProfiles";

const notificationDefaults = {
  usageLimit: true,
  lowVoltage: true,
  peakHour: true,
  overload: true,
};

const iotObjects = [
  "Electricity meter",
  "Current sensor",
  "Voltage sensor",
  "Breadboard",
  "Jumper wires",
  "Microcontroller",
  "IoT gateway",
];

const userAccess = [
  { name: "Primary Admin", role: "Admin", access: "All floors and billing" },
  { name: "Family Member", role: "Member", access: "Living spaces and bedrooms" },
  { name: "Caretaker", role: "Restricted", access: "Lighting and alerts only" },
];

const METRIC_TWEEN_FIELDS = ["liveLoadKw", "todayUsage", "weeklyUsage", "monthlyUsage", "voltage", "current", "billEstimate", "activeDevices"];

function blendMetricsSnapshot(fromMetrics, toMetrics, progress, dailyLimit) {
  const next = { ...toMetrics };

  for (const key of METRIC_TWEEN_FIELDS) {
    const start = Number(fromMetrics?.[key] ?? toMetrics?.[key] ?? 0);
    const end = Number(toMetrics?.[key] ?? start);
    const blended = start + (end - start) * progress;

    if (key === "voltage" || key === "billEstimate" || key === "activeDevices") {
      next[key] = Math.round(blended);
    } else {
      next[key] = Number(blended.toFixed(3));
    }
  }

  next.lowVoltage = next.voltage < 210;
  next.overLimit = next.todayUsage > dailyLimit;
  return next;
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
}

function formatInteger(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function getLiveWarningThreshold(placeType) {
  switch (normalizePlaceType(placeType)) {
    case "industry":
      return 12000;
    case "school":
      return 6500;
    case "office":
      return 5200;
    case "home":
    default:
      return 3200;
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function RoomModal({ room, onClose }) {
  if (!room) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="panel-head">
          <div>
            <span className="section-tag">Room usage</span>
            <h3>{room.name}</h3>
            <p>{room.floorName} live summary with current appliance demand.</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="room-modal-grid">
          <MetricCard label="Live load" value={`${formatNumber(room.activeLoadKw, 2)} kW`} note={`${room.activeWatts} W active`} />
          <MetricCard label="Devices ON" value={room.activeCount} note="Currently running in this room" />
        </div>

        <div className="room-device-list">
          {room.devices.map((device) => (
            <div key={device.deviceId} className={`room-device-item ${device.on ? "on" : "off"}`}>
              <span>{device.name}</span>
              <strong>{device.watts}W</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage({ session, onLogout, onSettingsChange }) {
  const navigate = useNavigate();
  const shellRef = useRef(null);
  const placeType = normalizePlaceType(session?.user?.placeType || session?.settings?.placeType);
  const placeConfig = getPlaceConfig(placeType);
  const aiSuggestions = getAiSuggestions(placeType);
  const initialLimit = session?.settings?.dailyLimit || placeConfig.dailyLimit;
  const initialTheme = session?.settings?.darkMode === false ? "light" : "dark";
  const initialGridSize = session?.settings?.gridSize || placeConfig.gridSize;
  const initialSimulationMode = session?.settings?.simulationMode || placeConfig.simulationMode;
  const initialFloors = createDefaultFloors(placeType);
  const initialRooms = createAllDefaultRooms(placeType);
  const initialAppliances = createDefaultAppliances(initialRooms, placeType);
  const initialMetrics = computeMetrics(initialAppliances, null, initialLimit, placeType);

  const [activeTab, setActiveTab] = useState("home");
  const [floors, setFloors] = useState(initialFloors);
  const [activeFloorId, setActiveFloorId] = useState(initialFloors[0]?.id || "floor-1");
  const [rooms, setRooms] = useState(initialRooms);
  const [appliances, setAppliances] = useState(initialAppliances);
  const [dailyLimit, setDailyLimit] = useState(initialLimit);
  const [theme, setTheme] = useState(initialTheme);
  const [gridSize, setGridSize] = useState(initialGridSize);
  const [simulationMode, setSimulationMode] = useState(initialSimulationMode);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [displayMetrics, setDisplayMetrics] = useState(initialMetrics);
  const displayMetricsRef = useRef(initialMetrics);
  const [dailyHistory, setDailyHistory] = useState(createInitialHistory(initialMetrics.todayUsage, placeType));
  const [notificationPrefs, setNotificationPrefs] = useState(notificationDefaults);
  const [selectedRoomId, setSelectedRoomId] = useState(initialRooms[0]?.id || null);
  const [roomModal, setRoomModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Syncing");

  const roomLookup = useMemo(() => Object.fromEntries(rooms.map((room) => [room.id, room])), [rooms]);
  const activeRooms = useMemo(() => filterRoomsByFloor(rooms, activeFloorId), [rooms, activeFloorId]);
  const activeAppliances = useMemo(() => filterDevicesByFloor(appliances, activeFloorId), [appliances, activeFloorId]);
  const roomStats = useMemo(() => calculateRoomStats(activeRooms, activeAppliances), [activeRooms, activeAppliances]);
  const allRoomStats = useMemo(() => calculateRoomStats(rooms, appliances), [rooms, appliances]);
  const floorStats = useMemo(() => calculateFloorStats(floors, rooms, appliances, placeType), [floors, rooms, appliances, placeType]);
  const activeFloor = useMemo(() => getFloorById(floors, activeFloorId) || floorStats[0] || null, [floors, activeFloorId, floorStats]);
  const activeFloorData = useMemo(() => floorStats.find((floor) => floor.id === activeFloorId) || floorStats[0] || null, [floorStats, activeFloorId]);
  const selectedRoomData = useMemo(() => getRoomById(roomStats, selectedRoomId), [roomStats, selectedRoomId]);
  const alerts = useMemo(() => buildAlerts(metrics, allRoomStats, dailyLimit, placeType).filter((alert) => notificationPrefs.usageLimit || alert.tone !== "danger"), [metrics, allRoomStats, dailyLimit, placeType, notificationPrefs.usageLimit]);
  const dailyTrend = useMemo(() => buildTrendSeries("daily", metrics, dailyHistory, placeType), [metrics, dailyHistory, placeType]);
  const weeklyTrend = useMemo(() => buildTrendSeries("weekly", metrics, dailyHistory, placeType), [metrics, dailyHistory, placeType]);
  const monthlyTrend = useMemo(() => buildTrendSeries("monthly", metrics, dailyHistory, placeType), [metrics, dailyHistory, placeType]);
  const deviceComparison = useMemo(() => buildDeviceComparison(appliances, rooms, floors, placeType), [appliances, rooms, floors, placeType]);
  const viewMetrics = displayMetrics;
  const remainingUsage = Math.max(0, dailyLimit - viewMetrics.todayUsage);
  const livePowerWatts = Math.round(viewMetrics.liveLoadKw * 1000);
  const liveWarningThreshold = useMemo(() => getLiveWarningThreshold(placeType), [placeType]);
  const highUsageActiveCount = useMemo(() => activeAppliances.filter((device) => device.on && device.highUsage).length, [activeAppliances]);
  const activeDeviceFeed = useMemo(() => activeAppliances.slice().sort((left, right) => (Number(right.on) - Number(left.on)) || right.watts - left.watts).slice(0, 8), [activeAppliances]);
  const maxFloorWatts = useMemo(() => Math.max(...floorStats.map((floor) => floor.activeWatts), 1), [floorStats]);
  const warningActive = viewMetrics.lowVoltage || viewMetrics.unusualSpike || livePowerWatts > liveWarningThreshold;
  const floorLoadRatio = Math.min(100, Math.round((livePowerWatts / liveWarningThreshold) * 100));
  useEffect(() => {
    const host = shellRef.current;
    if (!host || typeof window === "undefined") {
      return undefined;
    }

    const target = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.24 };
    const current = { ...target };
    let frameId = 0;

    const render = () => {
      const deltaX = target.x - current.x;
      const deltaY = target.y - current.y;
      const distance = Math.hypot(deltaX, deltaY);
      const easing = Math.min(0.26, 0.12 + distance / 1800);
      current.x += deltaX * easing;
      current.y += deltaY * easing;
      host.style.setProperty("--cursor-x", `${current.x}px`);
      host.style.setProperty("--cursor-y", `${current.y}px`);
      frameId = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event) => {
      target.x = event.clientX;
      target.y = event.clientY;
    };

    const handlePointerLeave = () => {
      target.x = window.innerWidth * 0.68;
      target.y = window.innerHeight * 0.22;
    };

    render();
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerMove, { passive: true });
    window.addEventListener("blur", handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerMove);
      window.removeEventListener("blur", handlePointerLeave);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      displayMetricsRef.current = metrics;
      setDisplayMetrics(metrics);
      return undefined;
    }

    const fromMetrics = displayMetricsRef.current;
    const toMetrics = metrics;
    const start = window.performance.now();
    const duration = 540;
    let frameId = 0;

    const animate = (time) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextMetrics = blendMetricsSnapshot(fromMetrics, toMetrics, eased, dailyLimit);
      displayMetricsRef.current = nextMetrics;
      setDisplayMetrics(nextMetrics);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      } else {
        displayMetricsRef.current = toMetrics;
        setDisplayMetrics(toMetrics);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [metrics, dailyLimit]);

  useEffect(() => {
    let ignore = false;

    async function loadUsage() {
      try {
        const data = await api.getUsageData(session.token);
        if (ignore) return;

        const nextRooms = normalizeRooms(data.rooms, data.appliances, placeType);
        const seededRooms = nextRooms.length ? nextRooms : createAllDefaultRooms(placeType);
        const seededAppliances = mergeSavedAppliances(data.appliances, seededRooms, {
          preferDefaultsWhenMissing: true,
        }, placeType);
        const nextFloors = normalizeFloors(data.floors, seededRooms, seededAppliances, placeType);
        const nextFloorId = getPreferredFloorId(nextFloors, seededRooms, seededAppliances);
        const nextLimit = data.settings?.dailyLimit || initialLimit;
        const nextTheme = data.settings?.darkMode === false ? "light" : initialTheme;
        const nextGridSize = data.settings?.gridSize || initialGridSize;
        const nextSimulationMode = data.settings?.simulationMode || placeConfig.simulationMode;
        const seededMetrics = data.latestMetrics?.todayUsage
          ? {
              ...data.latestMetrics,
              activeDevices: seededAppliances.filter((item) => item.on).length,
              simulationMode: data.latestMetrics?.simulationMode || nextSimulationMode,
            }
          : computeMetrics(seededAppliances, null, nextLimit, placeType);
        const seededHistory = data.dailyHistory?.length ? data.dailyHistory.slice(-14) : createInitialHistory(seededMetrics.todayUsage, placeType);

        setFloors(nextFloors);
        setRooms(seededRooms);
        setAppliances(seededAppliances);
        setDailyLimit(nextLimit);
        setTheme(nextTheme);
        setGridSize(nextGridSize);
        setSimulationMode(nextSimulationMode);
        setMetrics(seededMetrics);
        setDailyHistory(syncTodayHistory(seededHistory, seededMetrics.todayUsage));
        setActiveFloorId(nextFloorId);
        setSelectedRoomId(seededRooms.find((room) => room.floorId === nextFloorId)?.id || null);
        setSaveStatus("Live");
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message);
          setSaveStatus("Offline");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadUsage();
    return () => {
      ignore = true;
    };
  }, [session.token, initialLimit, initialTheme, initialGridSize, placeConfig.simulationMode, placeType]);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme !== "dark");
    onSettingsChange({ darkMode: theme === "dark", dailyLimit, placeType, gridSize, simulationMode });
  }, [theme, dailyLimit, placeType, gridSize, simulationMode, onSettingsChange]);

  useEffect(() => {
    if (!activeRooms.length) {
      setSelectedRoomId(null);
      setRoomModal(null);
      return;
    }
    if (!selectedRoomId || !activeRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(activeRooms[0].id);
      setRoomModal(null);
    }
  }, [activeRooms, selectedRoomId]);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setMetrics((previous) => {
        const nextMetrics = computeMetrics(appliances, previous, dailyLimit, placeType);
        setDailyHistory((history) => syncTodayHistory(history, nextMetrics.todayUsage));
        return nextMetrics;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [appliances, dailyLimit, loading, placeType]);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const saveTimer = setTimeout(async () => {
      try {
        setSaveStatus("Syncing");
        await api.saveUsage(session.token, {
          floors: serializeFloors(floors),
          rooms: serializeRooms(rooms),
          metrics,
          appliances: serializeAppliances(appliances),
          dailyHistory,
          settings: {
            dailyLimit,
            darkMode: theme === "dark",
            placeType,
            gridSize,
            simulationMode,
          },
          setupCompleted: true,
        });
        setSaveStatus("Live");
      } catch (_error) {
        setSaveStatus("Offline");
      }
    }, 900);

    return () => clearTimeout(saveTimer);
  }, [floors, rooms, appliances, dailyLimit, theme, gridSize, simulationMode, dailyHistory, metrics, loading, session.token, placeType]);

  function toggleAppliance(deviceId) {
    setAppliances((current) => {
      const nextAppliances = current.map((item) => (item.deviceId === deviceId ? { ...item, on: !item.on } : item));
      setMetrics((previous) => {
        const nextMetrics = computeMetrics(nextAppliances, previous, dailyLimit, placeType);
        setDailyHistory((history) => syncTodayHistory(history, nextMetrics.todayUsage));
        return nextMetrics;
      });
      return nextAppliances;
    });
  }

  function openRoom(roomId) {
    setSelectedRoomId(roomId);
    const room = getRoomById(roomStats, roomId);
    if (room) {
      setRoomModal({
        ...room,
        floorName: activeFloor?.name || "Selected floor",
      });
    }
  }

  function togglePreference(key) {
    setNotificationPrefs((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function handleFloorChange(floorId) {
    setActiveFloorId(floorId);
    setSelectedRoomId(null);
    setRoomModal(null);
  }


  function applySuggestion(suggestion) {
    const orderedRooms = [
      ...activeRooms,
      ...rooms.filter((room) => !activeRooms.some((activeRoom) => activeRoom.id === room.id)),
    ];
    const room = orderedRooms.find((candidate) =>
      (suggestion.roomKeywords || []).some((keyword) =>
        String(candidate.type || "").toLowerCase().includes(keyword) ||
        String(candidate.name || "").toLowerCase().includes(keyword)
      )
    ) || orderedRooms[0];

    if (!room) {
      return;
    }

    const template = getAllowedDeviceLibrary(room).find((device) => device.type === suggestion.deviceType);
    if (!template) {
      return;
    }

    const roomDeviceCount = appliances.filter((device) => device.roomId === room.id).length;
    const sameTypeCount = appliances.filter((device) => device.roomId === room.id && device.type === template.type).length;
    const nextDevice = createDevice(
      {
        floorId: room.floorId,
        roomId: room.id,
        room: room.name,
        name: sameTypeCount ? `${template.name} ${sameTypeCount + 1}` : template.name,
        type: template.type,
        watts: template.watts,
        dailyHours: template.dailyHours,
        on: template.type !== "generator",
      },
      roomDeviceCount
    );

    setAppliances((current) => [...current, nextDevice]);
    setActiveFloorId(room.floorId);
    setSelectedRoomId(room.id);
    setActiveTab("devices");
  }

  function renderFloorSelectorPanel() {
    return (
      <section className="panel floor-band-panel cinematic-floor-band">
        <div className="panel-head">
          <div>
            <span className="section-tag">Floor selector</span>
            <h3>{activeFloor?.name || "Floor 1"}</h3>
            <p>Switch between {placeConfig.label.toLowerCase()} floors to inspect room load, devices, and AI-managed consumption on each level.</p>
          </div>
          <div className="status-card status-card-glow">
            <strong>{activeFloorData?.roomCount || 0}</strong>
            <span>rooms</span>
          </div>
        </div>
        <div className="floor-selector-row">
          {floorStats.map((floor) => (
            <button
              key={floor.id}
              type="button"
              className={`floor-tab-chip ${activeFloorId === floor.id ? "active" : ""}`}
              onClick={() => handleFloorChange(floor.id)}
            >
              <strong>{floor.name}</strong>
              <span>{floor.roomCount} rooms | {floor.deviceCount} devices</span>
              <small>{floor.activeWatts}W live | {floor.estimatedDailyKwh.toFixed(1)} kWh/day</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function renderFloorMap() {
    if (!roomStats.length) {
      return (
        <div className="blueprint-empty">
          <article className="setup-inline-card selected">
            <strong>No rooms saved on {activeFloor?.name || "this floor"}</strong>
            <span>Open the setup wizard to draw rooms and place appliances on this level.</span>
            <button type="button" className="ghost-button" onClick={() => navigate("/setup")}>Open setup wizard</button>
          </article>
        </div>
      );
    }

    return roomStats.map((room) => (
      <article
        key={room.id}
        className={`floor-room ${selectedRoomId === room.id ? "selected" : ""} ${room.overloaded ? "overloaded" : ""}`}
        style={roomStyle(room)}
        role="button"
        tabIndex={0}
        onClick={() => openRoom(room.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            openRoom(room.id);
          }
        }}
      >
        <div className="floor-room-title">
          <strong>{room.name}</strong>
          <span>{room.activeWatts}W active</span>
        </div>
        {room.overloaded ? <span className="floor-room-warning">!</span> : null}
        <div className="floor-room-devices">
          {room.devices.map((device) => (
            <button
              key={device.deviceId}
              type="button"
              className={`map-device ${device.on ? "on" : "off"} ${device.highUsage ? "high" : ""}`}
              style={deviceStyle(device)}
              onClick={(event) => {
                event.stopPropagation();
                toggleAppliance(device.deviceId);
              }}
            >
              <span className="map-device-aura" aria-hidden="true" />
              {device.on ? (
                <span className="device-energy-flow" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
              <span className="map-device-icon">
                <ApplianceIcon type={device.type} />
              </span>
              <strong>{device.name}</strong>
              <span className="device-watts">{device.watts}W</span>
              <span className={`device-state ${device.on ? "on" : "off"}`}>{device.on ? "ON" : "OFF"}</span>
            </button>
          ))}
        </div>
      </article>
    ));
  }

  function renderRoomMapPanel() {
    return (
      <article className="panel room-map-panel dashboard-blueprint-card">
        <div className="panel-head">
          <div>
            <span className="section-tag">2D house map</span>
            <h3>{activeFloor?.name || "Floor"} layout</h3>
            <p>Tap a room for totals. Tap any appliance inside it to switch the device ON or OFF in real time.</p>
          </div>
          <div className="blueprint-actions">
            <span className={`status-pill ${activeFloorData?.overloadedCount ? "danger" : "ok"}`}>
              {activeFloorData?.overloadedCount ? `${activeFloorData.overloadedCount} warning${activeFloorData.overloadedCount > 1 ? "s" : ""}` : "Normal load"}
            </span>
            <button type="button" className="ghost-button" onClick={() => navigate("/setup")}>Edit layout</button>
          </div>
        </div>

        <div className="summary-grid room-summary-grid">
          <MetricCard label="Selected floor" value={activeFloor?.name || "Floor 1"} note={`${activeFloorData?.roomCount || 0} rooms | ${activeFloorData?.deviceCount || 0} devices`} />
          <MetricCard label="Floor load" value={`${formatNumber(activeFloorData?.activeLoadKw || 0, 2)} kW`} note={`${activeFloorData?.activeWatts || 0}W active`} />
          <MetricCard label="Selected room" value={selectedRoomData?.name || "No room"} note={selectedRoomData ? `${selectedRoomData.activeWatts}W active` : "No room saved on this floor"} />
          <MetricCard label="Devices ON" value={selectedRoomData?.activeCount || 0} note={selectedRoomData?.overloaded ? "Above threshold" : "Within safe load"} tone={selectedRoomData?.overloaded ? "danger" : "default"} />
        </div>

        <div className="blueprint-shell dashboard-floor-shell cinematic-blueprint-shell">
          <div className="blueprint-board readonly">{renderFloorMap()}</div>
        </div>
      </article>
    );
  }

  function renderLiveEnergyPanel() {
    return (
      <aside className="panel live-energy-panel cinematic-panel-stack">
        <div className="panel-head">
          <div>
            <span className="section-tag">Live energy</span>
            <h3>{formatInteger(livePowerWatts)} W total draw</h3>
            <p>Device demand, peak-hour pressure, and overload conditions refresh every second.</p>
          </div>
          <span className={`status-pill ${warningActive ? "danger" : "ok"}`}>{warningActive ? "Attention" : "Stable flow"}</span>
        </div>

        <div className="energy-orb-section">
          <div className={`energy-core ${warningActive ? "warning" : ""}`}>
            <span className="energy-core-ring energy-core-ring-one" />
            <span className="energy-core-ring energy-core-ring-two" />
            <span className="energy-core-ring energy-core-ring-three" />
            <strong>{formatNumber(viewMetrics.liveLoadKw, 2)}</strong>
            <small>kW live</small>
          </div>
          <div className="energy-orb-copy">
            <strong>{viewMetrics.activeDevices} active devices</strong>
            <span>{activeFloor?.name || "Current floor"} is carrying {formatInteger(activeFloorData?.activeWatts || 0)}W right now.</span>
          </div>
        </div>

        <div className="energy-stat-grid">
          <article className="energy-stat-card">
            <span>Peak hour</span>
            <strong>{viewMetrics.peakHour ? "Active" : "Idle"}</strong>
            <small>Usage window reacts in real time</small>
          </article>
          <article className="energy-stat-card">
            <span>Heavy devices</span>
            <strong>{highUsageActiveCount}</strong>
            <small>Amber-highlighted high consumption loads</small>
          </article>
          <article className="energy-stat-card">
            <span>Voltage</span>
            <strong>{viewMetrics.voltage}V</strong>
            <small>{viewMetrics.lowVoltage ? "Low voltage watch" : "Line stable"}</small>
          </article>
          <article className="energy-stat-card">
            <span>Threshold</span>
            <strong>{floorLoadRatio}%</strong>
            <small>{formatInteger(liveWarningThreshold)}W warning level</small>
          </article>
        </div>

        <div className={`energy-alert-strip ${warningActive ? "warning" : "ok"}`}>
          <strong>{warningActive ? "High usage warning" : "System operating normally"}</strong>
          <span>
            {viewMetrics.unusualSpike
              ? "Unusual power spike detected."
              : viewMetrics.lowVoltage
                ? `Voltage dipped to ${viewMetrics.voltage}V.`
                : livePowerWatts > liveWarningThreshold
                  ? `Live power crossed ${formatInteger(liveWarningThreshold)}W.`
                  : "Power draw remains inside the recommended operating envelope."}
          </span>
        </div>

        <div className="energy-panel-section">
          <div className="section-head-inline">
            <strong>Active devices</strong>
            <span>{activeDeviceFeed.length} visible</span>
          </div>
          <div className="energy-device-stream">
            {activeDeviceFeed.map((device) => (
              <article key={device.deviceId} className={`energy-device-row ${device.on ? "on" : "off"} ${device.highUsage ? "high" : ""}`}>
                <div className="energy-device-leading">
                  <span className="icon-pill compact">
                    <ApplianceIcon type={device.type} />
                  </span>
                  <div>
                    <strong>{device.name}</strong>
                    <span>{roomLookup[device.roomId]?.name || device.room || "Unassigned room"}</span>
                  </div>
                </div>
                <div className="energy-device-meta">
                  <strong>{device.watts}W</strong>
                  <span>{device.on ? "Live" : "Idle"}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="energy-panel-section">
          <div className="section-head-inline">
            <strong>Floor load balance</strong>
            <span>Multi-floor view</span>
          </div>
          <div className="floor-load-list">
            {floorStats.map((floor) => (
              <article key={floor.id} className={`floor-load-row ${floor.id === activeFloorId ? "active" : ""}`}>
                <div className="floor-load-copy">
                  <strong>{floor.name}</strong>
                  <span>{floor.activeCount} devices ON</span>
                </div>
                <div className="floor-load-meter">
                  <span style={{ width: `${Math.max(10, (floor.activeWatts / maxFloorWatts) * 100)}%` }} />
                </div>
                <small>{formatInteger(floor.activeWatts)}W</small>
              </article>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  function renderHomeTab() {
    return (
      <div className="tab-stack cinematic-home">
        <section className="hero-grid cinematic-hero-grid">
          <article className="panel hero-panel cinematic-hero-panel">
            <div className="hero-copy">
              <span className="section-tag">{placeConfig.label} AI simulation</span>
              <h2>{formatNumber(viewMetrics.liveLoadKw, 2)} kW live load</h2>
              <p>{placeConfig.simulationMode}. Voltage, current, floor demand, and device activity are refreshed continuously from the intelligent simulation engine.</p>
            </div>
            <div className="hero-badge cinematic-hero-badge">
              <strong>{viewMetrics.activeDevices}</strong>
              <span>devices active</span>
              <small>{viewMetrics.peakHour ? "Peak-hour modulation" : "Normal demand window"}</small>
            </div>
          </article>

          <article className="panel limit-panel cinematic-limit-panel">
            <span className="section-tag">Smart daily usage</span>
            <h3>{formatNumber(remainingUsage, 1)} kWh left</h3>
            <p>
              {viewMetrics.overLimit
                ? `${formatNumber(viewMetrics.todayUsage - dailyLimit, 1)} kWh above the set limit.`
                : `${formatNumber((viewMetrics.todayUsage / dailyLimit) * 100, 0)}% of the limit already used.`}
            </p>
            <div className="limit-bar cinematic-limit-bar">
              <span style={{ width: `${Math.min(100, (viewMetrics.todayUsage / dailyLimit) * 100)}%` }} />
            </div>
          </article>
        </section>

        <section className="command-layout">
          <div className="command-primary">{renderRoomMapPanel()}</div>
          <div className="command-side">{renderLiveEnergyPanel()}</div>
        </section>

        <section className="floor-usage-grid cinematic-floor-metrics">
          {floorStats.map((floor) => (
            <MetricCard
              key={floor.id}
              label={floor.name}
              value={`${formatNumber(floor.estimatedDailyKwh, 1)} kWh`}
              note={`${floor.roomCount} rooms | ${floor.activeWatts}W active`}
              tone={floor.id === activeFloorId ? "success" : floor.overloadedCount ? "danger" : "default"}
            />
          ))}
        </section>

        <section className="content-grid two-up cinematic-lower-grid">
          <ChartPanel title="Real-time demand wave" subtitle={`Live load behavior across ${activeFloor?.name || "the selected floor"}.`} data={dailyTrend} accent="amber" />
          <article className="panel alerts-panel cinematic-alerts-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Alerts</span>
                <h3>System notifications</h3>
                <p>Overuse, low voltage, peak hour, and overload signals across the full multi-floor system.</p>
              </div>
            </div>

            <div className="alerts-list">
              {alerts.length ? (
                alerts.map((alert) => (
                  <article key={alert.title} className={`alert-card ${alert.tone}`}>
                    <strong>{alert.title}</strong>
                    <p>{alert.detail}</p>
                  </article>
                ))
              ) : (
                <article className="alert-card ok">
                  <strong>All systems normal</strong>
                  <p>No critical power alerts are active right now.</p>
                </article>
              )}
            </div>
          </article>
        </section>

        <section className="content-grid two-up cinematic-lower-grid">
          <article className="panel ai-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">AI suggestions</span>
                <h3>Recommended next devices</h3>
                <p>Quick additions tailored to the {placeConfig.label.toLowerCase()} profile and current floor plan.</p>
              </div>
            </div>

            <div className="suggestion-list">
              {aiSuggestions.map((suggestion) => (
                <article key={suggestion.id} className="suggestion-card">
                  <strong>{suggestion.title}</strong>
                  <p>{suggestion.detail}</p>
                  <button type="button" className="ghost-button" onClick={() => applySuggestion(suggestion)}>Apply</button>
                </article>
              ))}
            </div>
          </article>

          <article className="panel ai-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Simulation mode</span>
                <h3>{simulationMode}</h3>
                <p>The intelligent engine adjusts live demand, peak-hour emphasis, and unusual-spike behavior for this place type automatically.</p>
              </div>
            </div>

            <div className="tips-list">
              <article>
                <strong>Place profile</strong>
                <p>{placeConfig.description}</p>
              </article>
              <article>
                <strong>Automatic grid size</strong>
                <p>{gridSize}px blueprint spacing keeps this {placeConfig.label.toLowerCase()} floor plan realistic and easy to scan.</p>
              </article>
              <article>
                <strong>Persistent layout</strong>
                <p>Every room, floor, and device change is synced to MongoDB so the same map loads after refresh.</p>
              </article>
            </div>
          </article>
        </section>
      </div>
    );
  }

  function renderDevicesTab() {
    return (
      <div className="tab-stack">
        <section className="content-grid two-up">
          <article className="panel selected-room-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Selected room</span>
                <h3>{selectedRoomData?.name || "No room selected"}</h3>
                <p>Room-wise power status for {activeFloor?.name || "the active floor"} with total watt draw and active appliance count.</p>
              </div>
            </div>

            <div className="room-summary-grid">
              <MetricCard label="Live room load" value={`${formatNumber(selectedRoomData?.activeLoadKw || 0, 2)} kW`} note={`${selectedRoomData?.activeWatts || 0}W in use`} />
              <MetricCard label="Devices on" value={selectedRoomData?.activeCount || 0} note="Running right now" />
              <MetricCard
                label="Status"
                value={selectedRoomData?.overloaded ? "Warning" : "Healthy"}
                note={selectedRoomData?.overloaded ? "Above room threshold" : "Within safe range"}
                tone={selectedRoomData?.overloaded ? "danger" : "default"}
              />
            </div>

            <div className="device-detail-list">
              {(selectedRoomData?.devices || []).map((device) => (
                <div key={device.deviceId} className={`device-detail-item ${device.on ? "on" : "off"}`}>
                  <div className="device-leading">
                    <span className="icon-pill compact">
                      <ApplianceIcon type={device.type} />
                    </span>
                    <div>
                      <strong>{device.name}</strong>
                      <span>{device.watts}W appliance rating</span>
                    </div>
                  </div>
                  <button type="button" className={`toggle-inline ${device.on ? "on" : "off"}`} onClick={() => toggleAppliance(device.deviceId)}>
                    {device.on ? "Turn OFF" : "Turn ON"}
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="panel control-tips-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Remote control</span>
                <h3>Floor-aware device automation</h3>
                <p>State changes are saved with floor metadata so each level of the building keeps its own device map.</p>
              </div>
            </div>

            <div className="tips-list">
              <article>
                <strong>Floor-specific toggles</strong>
                <p>Only the devices on the selected floor are shown in the room map, which keeps multi-floor control realistic and uncluttered.</p>
              </article>
              <article>
                <strong>Orange warning</strong>
                <p>Represents room or device states that need attention due to high load.</p>
              </article>
              <article>
                <strong>High usage highlight</strong>
                <p>Large loads like AC units and water heaters stay visually emphasized so power-heavy devices are easy to spot.</p>
              </article>
            </div>
          </article>
        </section>

        {renderRoomMapPanel()}
      </div>
    );
  }

  function renderAnalyticsTab() {
    return (
      <div className="tab-stack">
        <section className="content-grid analytics-grid">
          <ChartPanel title="Daily graph" subtitle="Short-interval electricity demand." data={dailyTrend} accent="amber" />
          <ChartPanel title="Weekly graph" subtitle="Last 7 days of tracked usage." data={weeklyTrend} accent="smoke" />
          <ChartPanel title="Monthly graph" subtitle="Projected monthly consumption profile." data={monthlyTrend} accent="amber" />
        </section>

        <section className="content-grid two-up">
          <article className="panel bill-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Bill estimate</span>
                <h3>{formatCurrency(viewMetrics.billEstimate)}</h3>
                <p>Projected bill based on the current monthly usage pattern.</p>
              </div>
            </div>

            <div className="bill-insights">
              <MetricCard label="Month usage" value={`${formatNumber(viewMetrics.monthlyUsage, 1)} kWh`} note="Simulated projection" />
              <MetricCard label="Peak hour" value={viewMetrics.peakHour ? "Active" : "Idle"} note="6 PM to 10 PM window" />
            </div>
          </article>

          <article className="panel comparison-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Appliance comparison</span>
                <h3>Highest watt devices</h3>
                <p>Use this ranking to find which devices and floors contribute most to overall consumption.</p>
              </div>
            </div>

            <div className="comparison-list">
              {deviceComparison.map((device) => (
                <div key={device.label} className="comparison-row">
                  <div>
                    <strong>{device.label}</strong>
                    <span>{device.on ? "Currently ON" : "Currently OFF"}</span>
                  </div>
                  <span className="comparison-watts">{device.watts}W</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="floor-usage-grid">
          {floorStats.map((floor) => (
            <MetricCard
              key={floor.id}
              label={`${floor.name} live load`}
              value={`${formatNumber(floor.activeLoadKw, 2)} kW`}
              note={`${floor.activeCount} devices ON | ${floor.overloadedCount} warnings`}
              tone={floor.overloadedCount ? "danger" : floor.id === activeFloorId ? "success" : "default"}
            />
          ))}
        </section>
      </div>
    );
  }

  function renderSettingsTab() {
    return (
      <div className="tab-stack">
        <section className="content-grid two-up">
          <article className="panel settings-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Preferences</span>
                <h3>Smart limits and theme</h3>
                <p>Set the daily limit, switch dark mode, and maintain backend-synced preferences.</p>
              </div>
            </div>

            <label className="settings-control">
              <span>Daily usage limit</span>
              <input type="range" min="10" max={placeType === "industry" ? 800 : placeType === "school" ? 250 : placeType === "office" ? 180 : 60} value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} />
              <strong>{dailyLimit} kWh</strong>
            </label>

            <button type="button" className="toggle-setting" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <div>
                <strong>{theme === "dark" ? "Dark mode enabled" : "Light mode enabled"}</strong>
                <span>Matte black and solar amber styling stays consistent across mobile and desktop layouts.</span>
              </div>
              <span className={`theme-switch ${theme === "dark" ? "active" : ""}`}>Toggle</span>
            </button>

            <button type="button" className="toggle-setting" onClick={() => navigate("/setup")}>
              <div>
                <strong>Edit house map</strong>
                <span>{floors.length} floors, {rooms.length} rooms, and {appliances.length} devices saved in your {placeConfig.label.toLowerCase()} layout.</span>
              </div>
              <span className="theme-switch active">Open</span>
            </button>
          </article>

          <article className="panel notification-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Notifications</span>
                <h3>Alert preferences</h3>
                <p>Control which safety and billing signals are highlighted in the dashboard.</p>
              </div>
            </div>

            <div className="settings-list">
              {Object.entries(notificationPrefs).map(([key, value]) => (
                <button key={key} type="button" className="toggle-setting" onClick={() => togglePreference(key)}>
                  <div>
                    <strong>{key.replace(/([A-Z])/g, " $1")}</strong>
                    <span>{value ? "Enabled" : "Disabled"}</span>
                  </div>
                  <span className={`theme-switch ${value ? "active" : ""}`}>{value ? "On" : "Off"}</span>
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="content-grid two-up">
          <article className="panel setup-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">IoT setup</span>
                <h3>Connected objects</h3>
                <p>The UI includes the hardware objects commonly used to collect and transmit electricity data.</p>
              </div>
            </div>

            <div className="chip-list">
              {iotObjects.map((item) => (
                <span key={item} className="data-chip">{item}</span>
              ))}
            </div>
          </article>

          <article className="panel access-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">User access</span>
                <h3>{session.user.name}</h3>
                <p>{session.user.email}</p>
              </div>
            </div>

            <div className="access-list">
              {userAccess.map((member) => (
                <article key={member.name} className="access-card">
                  <strong>{member.name}</strong>
                  <span>{member.role}</span>
                  <small>{member.access}</small>
                </article>
              ))}
            </div>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div ref={shellRef} className={`dashboard-shell ${theme === "dark" ? "dark-surface" : "light-surface"}`}>
      <div className="cursor-glow" aria-hidden="true" />
      <Navigation activeTab={activeTab} onChange={setActiveTab} onLogout={onLogout} userName={session.user.name} />

      <main className="dashboard-main">
        <header className="topbar panel cinematic-topbar">
          <div>
            <span className="section-tag">{placeConfig.label} AI workspace</span>
            <h2>Smart Electricity Management</h2>
            <p>Monitor power usage, control appliances, and analyze demand across rooms, floors, and intelligent device clusters in real time.</p>
          </div>

          <div className="topbar-actions">
            <div className="status-card status-card-glow">
              <strong>{saveStatus}</strong>
              <span>Data sync</span>
            </div>
            <button type="button" className="ghost-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </header>

        {error ? <div className="form-alert error inline">{error}</div> : null}
        {loading ? <div className="panel loading-panel">Loading usage profile...</div> : null}
        {!loading ? renderFloorSelectorPanel() : null}
        {!loading && activeTab === "home" ? renderHomeTab() : null}
        {!loading && activeTab === "devices" ? renderDevicesTab() : null}
        {!loading && activeTab === "analytics" ? renderAnalyticsTab() : null}
        {!loading && activeTab === "settings" ? renderSettingsTab() : null}
      </main>

      <RoomModal room={roomModal} onClose={() => setRoomModal(null)} />
    </div>
  );
}
