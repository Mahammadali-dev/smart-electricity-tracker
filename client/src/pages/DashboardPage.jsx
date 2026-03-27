import { useEffect, useState } from "react";
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
  calculateRoomStats,
  computeMetrics,
  createDefaultAppliances,
  createDefaultRooms,
  createInitialHistory,
  deviceStyle,
  getRoomById,
  mergeSavedAppliances,
  normalizeRooms,
  roomStyle,
  serializeAppliances,
  serializeRooms,
  syncTodayHistory,
} from "../utils/energy";

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
  { name: "Primary Admin", role: "Admin", access: "All rooms and billing" },
  { name: "Family Member", role: "Member", access: "Living Room and Bedroom" },
  { name: "Caretaker", role: "Restricted", access: "Lighting and alerts only" },
];

function formatNumber(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
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
            <p>Top-view room summary with live appliance demand.</p>
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
  const initialLimit = session?.settings?.dailyLimit || 28;
  const initialTheme = session?.settings?.darkMode === false ? "light" : "dark";
  const initialRooms = createDefaultRooms();
  const initialAppliances = createDefaultAppliances(initialRooms);
  const initialMetrics = computeMetrics(initialAppliances, null, initialLimit);

  const [activeTab, setActiveTab] = useState("home");
  const [rooms, setRooms] = useState(initialRooms);
  const [appliances, setAppliances] = useState(initialAppliances);
  const [dailyLimit, setDailyLimit] = useState(initialLimit);
  const [theme, setTheme] = useState(initialTheme);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [dailyHistory, setDailyHistory] = useState(createInitialHistory(initialMetrics.todayUsage));
  const [notificationPrefs, setNotificationPrefs] = useState(notificationDefaults);
  const [selectedRoomId, setSelectedRoomId] = useState(initialRooms[0]?.id || null);
  const [roomModal, setRoomModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Syncing");

  useEffect(() => {
    let ignore = false;

    async function loadUsage() {
      try {
        const data = await api.getUsageData(session.token);
        if (ignore) {
          return;
        }

        const nextRooms = normalizeRooms(data.rooms, data.appliances);
        const seededRooms = nextRooms.length ? nextRooms : createDefaultRooms();
        const seededAppliances = mergeSavedAppliances(data.appliances, seededRooms, {
          preferDefaultsWhenMissing: true,
        });
        const nextLimit = data.settings?.dailyLimit || initialLimit;
        const nextTheme = data.settings?.darkMode === false ? "light" : initialTheme;
        const seededMetrics = data.latestMetrics?.todayUsage
          ? {
              ...data.latestMetrics,
              activeDevices: seededAppliances.filter((item) => item.on).length,
            }
          : computeMetrics(seededAppliances, null, nextLimit);
        const seededHistory = data.dailyHistory?.length ? data.dailyHistory.slice(-14) : createInitialHistory(seededMetrics.todayUsage);

        setRooms(seededRooms);
        setAppliances(seededAppliances);
        setDailyLimit(nextLimit);
        setTheme(nextTheme);
        setMetrics(seededMetrics);
        setDailyHistory(syncTodayHistory(seededHistory, seededMetrics.todayUsage));
        setSelectedRoomId((current) => current || seededRooms[0]?.id || null);
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
  }, [session.token]);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme !== "dark");
    onSettingsChange({ darkMode: theme === "dark", dailyLimit });
  }, [theme, dailyLimit, onSettingsChange]);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setMetrics((previous) => {
        const nextMetrics = computeMetrics(appliances, previous, dailyLimit);
        setDailyHistory((history) => syncTodayHistory(history, nextMetrics.todayUsage));
        return nextMetrics;
      });
    }, 4000);

    return () => clearInterval(intervalId);
  }, [appliances, dailyLimit, loading]);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const saveTimer = setTimeout(async () => {
      try {
        setSaveStatus("Syncing");
        await api.saveUsage(session.token, {
          rooms: serializeRooms(rooms),
          metrics,
          appliances: serializeAppliances(appliances),
          dailyHistory,
          settings: {
            dailyLimit,
            darkMode: theme === "dark",
          },
          setupCompleted: true,
        });
        setSaveStatus("Live");
      } catch (_error) {
        setSaveStatus("Offline");
      }
    }, 900);

    return () => clearTimeout(saveTimer);
  }, [rooms, appliances, dailyLimit, theme, dailyHistory, metrics, loading, session.token]);

  const roomStats = calculateRoomStats(rooms, appliances);
  const selectedRoomData = getRoomById(roomStats, selectedRoomId);
  const alerts = buildAlerts(metrics, roomStats, dailyLimit).filter((alert) => notificationPrefs.usageLimit || alert.tone !== "danger");
  const dailyTrend = buildTrendSeries("daily", metrics, dailyHistory);
  const weeklyTrend = buildTrendSeries("weekly", metrics, dailyHistory);
  const monthlyTrend = buildTrendSeries("monthly", metrics, dailyHistory);
  const deviceComparison = buildDeviceComparison(appliances, rooms);
  const remainingUsage = Math.max(0, dailyLimit - metrics.todayUsage);

  function toggleAppliance(deviceId) {
    setAppliances((current) => {
      const nextAppliances = current.map((item) => (item.deviceId === deviceId ? { ...item, on: !item.on } : item));
      setMetrics((previous) => {
        const nextMetrics = computeMetrics(nextAppliances, previous, dailyLimit);
        setDailyHistory((history) => syncTodayHistory(history, nextMetrics.todayUsage));
        return nextMetrics;
      });
      return nextAppliances;
    });
  }

  function openRoom(roomId) {
    setSelectedRoomId(roomId);
    setRoomModal(getRoomById(roomStats, roomId));
  }

  function togglePreference(key) {
    setNotificationPrefs((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function renderFloorMap() {
    if (!roomStats.length) {
      return (
        <div className="blueprint-empty">
          <article className="setup-inline-card selected">
            <strong>No custom house map yet</strong>
            <span>Open the setup wizard to build your first floor plan.</span>
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
            <h3>Saved floor plan</h3>
            <p>Tap any room to inspect total usage. Tap any appliance to switch it ON or OFF.</p>
          </div>
          <div className="blueprint-actions">
            <span className={`status-pill ${roomStats.some((room) => room.overloaded) ? "danger" : "ok"}`}>
              {roomStats.some((room) => room.overloaded) ? "Warning active" : "Normal load"}
            </span>
            <button type="button" className="ghost-button" onClick={() => navigate("/setup")}>Edit layout</button>
          </div>
        </div>

        <div className="summary-grid room-summary-grid">
          <MetricCard label="Selected room" value={selectedRoomData?.name || "No room"} note={selectedRoomData ? `${selectedRoomData.activeWatts}W active` : "No custom room saved"} />
          <MetricCard label="Devices ON" value={selectedRoomData?.activeCount || 0} note={selectedRoomData?.overloaded ? "Above threshold" : "Within safe load"} tone={selectedRoomData?.overloaded ? "danger" : "default"} />
        </div>

        <div className="blueprint-shell dashboard-floor-shell">
          <div className="blueprint-board readonly">{renderFloorMap()}</div>
        </div>
      </article>
    );
  }

  function renderHomeTab() {
    return (
      <div className="tab-stack">
        <section className="hero-grid">
          <article className="panel hero-panel">
            <div className="hero-copy">
              <span className="section-tag">Realtime dashboard</span>
              <h2>{formatNumber(metrics.liveLoadKw, 2)} kW live load</h2>
              <p>Voltage, current, daily usage, and room demand are refreshed in real time from simulated IoT meter data.</p>
            </div>
            <div className="hero-badge">
              <strong>{metrics.activeDevices}</strong>
              <span>devices active</span>
            </div>
          </article>

          <article className="panel limit-panel">
            <span className="section-tag">Smart daily usage</span>
            <h3>{formatNumber(remainingUsage, 1)} kWh left</h3>
            <p>
              {metrics.overLimit
                ? `${formatNumber(metrics.todayUsage - dailyLimit, 1)} kWh above the set limit.`
                : `${formatNumber((metrics.todayUsage / dailyLimit) * 100, 0)}% of the limit already used.`}
            </p>
            <div className="limit-bar">
              <span style={{ width: `${Math.min(100, (metrics.todayUsage / dailyLimit) * 100)}%` }} />
            </div>
          </article>
        </section>

        <section className="metric-grid-large">
          <MetricCard label="Voltage" value={`${metrics.voltage} V`} note="Live line reading" />
          <MetricCard label="Current" value={`${formatNumber(metrics.current, 1)} A`} note="Main supply" />
          <MetricCard label="Today" value={`${formatNumber(metrics.todayUsage, 1)} kWh`} note="Tracked today" />
          <MetricCard label="This week" value={`${formatNumber(metrics.weeklyUsage, 1)} kWh`} note="Rolling 7-day total" />
          <MetricCard label="This month" value={`${formatNumber(metrics.monthlyUsage, 1)} kWh`} note={formatCurrency(metrics.billEstimate)} />
          <MetricCard label="Sync" value={saveStatus} note="Backend save status" tone={saveStatus === "Offline" ? "danger" : "default"} />
        </section>

        {renderRoomMapPanel()}

        <section className="content-grid two-up">
          <ChartPanel title="Hourly load" subtitle="Real-time demand pattern across the day." data={dailyTrend} accent="teal" />
          <article className="panel alerts-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Alerts</span>
                <h3>System notifications</h3>
                <p>Overuse, low voltage, peak hour, and overload signals.</p>
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
                <p>Room-wise power status with total watt draw and active appliance count.</p>
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
                <h3>Device automation notes</h3>
                <p>Backend updates are triggered when an appliance state changes from the UI.</p>
              </div>
            </div>

            <div className="tips-list">
              <article>
                <strong>Green toggle</strong>
                <p>Represents appliances that are currently ON and consuming power.</p>
              </article>
              <article>
                <strong>Orange warning</strong>
                <p>Represents room or device states that need attention due to high load.</p>
              </article>
              <article>
                <strong>High usage highlight</strong>
                <p>Large loads like AC units are visually emphasized to make power-heavy devices easy to spot.</p>
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
          <ChartPanel title="Daily graph" subtitle="Short-interval electricity demand." data={dailyTrend} accent="teal" />
          <ChartPanel title="Weekly graph" subtitle="Last 7 days of tracked usage." data={weeklyTrend} accent="lime" />
          <ChartPanel title="Monthly graph" subtitle="Projected monthly consumption profile." data={monthlyTrend} accent="amber" />
        </section>

        <section className="content-grid two-up">
          <article className="panel bill-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Bill estimate</span>
                <h3>{formatCurrency(metrics.billEstimate)}</h3>
                <p>Projected bill based on the current monthly usage pattern.</p>
              </div>
            </div>

            <div className="bill-insights">
              <MetricCard label="Month usage" value={`${formatNumber(metrics.monthlyUsage, 1)} kWh`} note="Simulated projection" />
              <MetricCard label="Peak hour" value={metrics.peakHour ? "Active" : "Idle"} note="6 PM to 10 PM window" />
            </div>
          </article>

          <article className="panel comparison-panel">
            <div className="panel-head">
              <div>
                <span className="section-tag">Appliance comparison</span>
                <h3>Highest watt devices</h3>
                <p>Use this ranking to find which devices contribute most to overall consumption.</p>
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
              <input type="range" min="10" max="60" value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} />
              <strong>{dailyLimit} kWh</strong>
            </label>

            <button type="button" className="toggle-setting" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <div>
                <strong>{theme === "dark" ? "Dark mode enabled" : "Light mode enabled"}</strong>
                <span>Toggle the app appearance across mobile and desktop layouts.</span>
              </div>
              <span className={`theme-switch ${theme === "dark" ? "active" : ""}`}>Toggle</span>
            </button>

            <button type="button" className="toggle-setting" onClick={() => navigate("/setup")}>
              <div>
                <strong>Edit house map</strong>
                <span>{rooms.length} rooms and {appliances.length} devices saved in your custom layout.</span>
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
                <span key={item} className="data-chip">
                  {item}
                </span>
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
    <div className={`dashboard-shell ${theme === "dark" ? "dark-surface" : "light-surface"}`}>
      <Navigation activeTab={activeTab} onChange={setActiveTab} onLogout={onLogout} userName={session.user.name} />

      <main className="dashboard-main">
        <header className="topbar panel">
          <div>
            <span className="section-tag">Authenticated workspace</span>
            <h2>Smart Electricity Usage Tracker</h2>
            <p>Monitor power usage, control appliances, and analyze demand across rooms in real time.</p>
          </div>

          <div className="topbar-actions">
            <div className="status-card">
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

        {!loading && activeTab === "home" ? renderHomeTab() : null}
        {!loading && activeTab === "devices" ? renderDevicesTab() : null}
        {!loading && activeTab === "analytics" ? renderAnalyticsTab() : null}
        {!loading && activeTab === "settings" ? renderSettingsTab() : null}
      </main>

      <RoomModal room={roomModal} onClose={() => setRoomModal(null)} />
    </div>
  );
}