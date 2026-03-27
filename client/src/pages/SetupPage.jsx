import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import ApplianceIcon from "../components/ApplianceIcon";
import MetricCard from "../components/MetricCard";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  getAllowedDeviceLibrary,
  MIN_ROOM_SIZE,
  ROOM_LIBRARY,
  calculateRoomStats,
  canPlaceRoom,
  clamp,
  computeMetrics,
  createDevice,
  createInitialHistory,
  createRoom,
  deviceStyle,
  getRoomById,
  mergeSavedAppliances,
  normalizeRooms,
  roomStyle,
  serializeAppliances,
  serializeRooms,
  snapToGrid,
  syncTodayHistory,
} from "../utils/energy";

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function getStepNote(step) {
  if (step === 1) return "Select a room type, then drag across the grid to draw a clean top-view layout.";
  if (step === 2) return "Click a device to add it, then drag it inside the selected room.";
  return "Review the saved floor plan and commit the setup.";
}

function ensureUniqueRoomName(baseName, rooms, ignoreId) {
  const trimmed = String(baseName || "Room").trim() || "Room";
  const taken = rooms.filter((room) => room.id !== ignoreId).map((room) => room.name.toLowerCase());
  if (!taken.includes(trimmed.toLowerCase())) return trimmed;
  let index = 2;
  while (taken.includes(`${trimmed.toLowerCase()} ${index}`)) index += 1;
  return `${trimmed} ${index}`;
}

function pxRectToStyle(candidate) {
  return {
    left: `${(candidate.x / BOARD_WIDTH) * 100}%`,
    top: `${(candidate.y / BOARD_HEIGHT) * 100}%`,
    width: `${(candidate.width / BOARD_WIDTH) * 100}%`,
    height: `${(candidate.height / BOARD_HEIGHT) * 100}%`,
  };
}

export default function SetupPage({ session, onLogout, onSetupComplete, onSettingsChange }) {
  const navigate = useNavigate();
  const initialTheme = session?.settings?.darkMode === false ? "light" : "dark";
  const initialLimit = session?.settings?.dailyLimit || 28;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(1);
  const [theme, setTheme] = useState(initialTheme);
  const [dailyLimit, setDailyLimit] = useState(initialLimit);
  const [gridSize, setGridSize] = useState(20);
  const [roomType, setRoomType] = useState("living");
  const [customRoomName, setCustomRoomName] = useState("Study");
  const [rooms, setRooms] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [metrics, setMetrics] = useState(() => computeMetrics([], null, initialLimit));
  const [dailyHistory, setDailyHistory] = useState(() => createInitialHistory(0));

  const boardRef = useRef(null);
  const previewRef = useRef(null);
  const badgeRef = useRef(null);
  const badgeTitleRef = useRef(null);
  const badgeNoteRef = useRef(null);
  const rafRef = useRef(0);
  const interactionRef = useRef(null);
  const pendingPointRef = useRef(null);
  const roomsRef = useRef(rooms);
  const devicesRef = useRef(devices);
  const gridSizeRef = useRef(gridSize);
  const roomTypeRef = useRef(roomType);
  const customRoomNameRef = useRef(customRoomName);

  const roomStats = useMemo(() => calculateRoomStats(rooms, devices), [rooms, devices]);
  const selectedRoom = useMemo(() => getRoomById(roomStats, selectedRoomId), [roomStats, selectedRoomId]);

  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);
  useEffect(() => { roomTypeRef.current = roomType; }, [roomType]);
  useEffect(() => { customRoomNameRef.current = customRoomName; }, [customRoomName]);

  useEffect(() => {
    let ignore = false;
    async function loadLayout() {
      try {
        const data = await api.getLayout(session.token);
        if (ignore) return;
        const nextRooms = normalizeRooms(data.rooms, data.appliances || data.devices);
        const nextDevices = mergeSavedAppliances(data.appliances || data.devices, nextRooms, { preferDefaultsWhenMissing: Boolean(data.setupCompleted) });
        const nextMetrics = data.metrics?.todayUsage ? data.metrics : computeMetrics(nextDevices, null, data.settings?.dailyLimit || initialLimit);
        const nextHistory = data.dailyHistory?.length ? data.dailyHistory.slice(-14) : createInitialHistory(nextMetrics.todayUsage);
        setRooms(nextRooms);
        setDevices(nextDevices);
        setMetrics(nextMetrics);
        setDailyHistory(syncTodayHistory(nextHistory, nextMetrics.todayUsage));
        setDailyLimit(data.settings?.dailyLimit || initialLimit);
        setTheme(data.settings?.darkMode === false ? "light" : "dark");
        setSelectedRoomId(nextRooms[0]?.id || null);
      } catch (loadError) {
        if (!ignore) setError(loadError.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadLayout();
    return () => { ignore = true; };
  }, [session.token]);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme !== "dark");
    onSettingsChange({ darkMode: theme === "dark", dailyLimit });
  }, [theme, dailyLimit, onSettingsChange]);

  useEffect(() => {
    if (loading) return;
    setMetrics((previous) => {
      const nextMetrics = computeMetrics(devices, previous, dailyLimit);
      setDailyHistory((history) => syncTodayHistory(history, nextMetrics.todayUsage));
      return nextMetrics;
    });
  }, [devices, dailyLimit, loading]);

  useEffect(() => {
    if (!rooms.length) { setSelectedRoomId(null); return; }
    if (!selectedRoomId || !rooms.some((room) => room.id === selectedRoomId)) setSelectedRoomId(rooms[0].id);
  }, [rooms, selectedRoomId]);

  function clearTransient() {
    if (previewRef.current) {
      previewRef.current.style.display = "none";
      previewRef.current.classList.remove("invalid");
    }
    if (badgeRef.current) badgeRef.current.style.display = "none";
  }

  function showTransient(candidate, point, title, note, valid = true) {
    if (previewRef.current) {
      Object.assign(previewRef.current.style, pxRectToStyle(candidate), { display: "block" });
      previewRef.current.classList.toggle("invalid", !valid);
    }
    if (badgeRef.current && badgeTitleRef.current && badgeNoteRef.current) {
      badgeRef.current.style.display = "grid";
      badgeRef.current.style.left = `${(point.x / BOARD_WIDTH) * 100}%`;
      badgeRef.current.style.top = `${(point.y / BOARD_HEIGHT) * 100}%`;
      badgeTitleRef.current.textContent = title;
      badgeNoteRef.current.textContent = note;
    }
  }

  function updateRoomPreview(roomId, candidate, valid) {
    const roomEl = boardRef.current?.querySelector(`[data-room-id="${roomId}"]`);
    if (!roomEl) return;
    Object.assign(roomEl.style, pxRectToStyle(candidate));
    roomEl.classList.toggle("invalid", !valid);
  }

  function updateDevicePreview(deviceId, candidate) {
    const deviceEl = boardRef.current?.querySelector(`[data-setup-device-id="${deviceId}"]`);
    if (!deviceEl) return;
    Object.assign(deviceEl.style, deviceStyle(candidate));
  }

  function getBoardPoint(event) {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * BOARD_WIDTH, 0, BOARD_WIDTH),
      y: clamp(((event.clientY - rect.top) / rect.height) * BOARD_HEIGHT, 0, BOARD_HEIGHT),
    };
  }

  function flushInteraction() {
    rafRef.current = 0;
    const point = pendingPointRef.current;
    const interaction = interactionRef.current;
    if (!point || !interaction) return;

    if (interaction.type === "draw") {
      const size = gridSizeRef.current;
      const x = clamp(Math.min(snapToGrid(interaction.start.x, size), snapToGrid(point.x, size)), 0, BOARD_WIDTH - MIN_ROOM_SIZE);
      const y = clamp(Math.min(snapToGrid(interaction.start.y, size), snapToGrid(point.y, size)), 0, BOARD_HEIGHT - MIN_ROOM_SIZE);
      const width = clamp(Math.max(MIN_ROOM_SIZE, Math.abs(snapToGrid(point.x, size) - snapToGrid(interaction.start.x, size)) || MIN_ROOM_SIZE), MIN_ROOM_SIZE, BOARD_WIDTH - x);
      const height = clamp(Math.max(MIN_ROOM_SIZE, Math.abs(snapToGrid(point.y, size) - snapToGrid(interaction.start.y, size)) || MIN_ROOM_SIZE), MIN_ROOM_SIZE, BOARD_HEIGHT - y);
      const candidate = { x, y, width, height };
      const valid = canPlaceRoom(candidate, roomsRef.current, null);
      interaction.candidate = candidate;
      interaction.valid = valid;
      showTransient(candidate, point, `${candidate.width}px x ${candidate.height}px`, valid ? "Release to create room" : "Room overlaps another room", valid);
      return;
    }

    if (interaction.type === "move") {
      const size = gridSizeRef.current;
      const dx = snapToGrid(point.x - interaction.start.x, size);
      const dy = snapToGrid(point.y - interaction.start.y, size);
      const candidate = {
        ...interaction.origin,
        x: clamp(interaction.origin.x + dx, 0, BOARD_WIDTH - interaction.origin.width),
        y: clamp(interaction.origin.y + dy, 0, BOARD_HEIGHT - interaction.origin.height),
      };
      const valid = canPlaceRoom(candidate, roomsRef.current, interaction.roomId);
      interaction.candidate = candidate;
      interaction.valid = valid;
      updateRoomPreview(interaction.roomId, candidate, valid);
      showTransient(candidate, point, `${candidate.width}px x ${candidate.height}px`, valid ? "Drag to reposition room" : "Placement blocked", valid);
      return;
    }
    if (interaction.type === "resize") {
      const size = gridSizeRef.current;
      const right = interaction.origin.x + interaction.origin.width;
      const bottom = interaction.origin.y + interaction.origin.height;
      let x = interaction.origin.x;
      let y = interaction.origin.y;
      let width = interaction.origin.width;
      let height = interaction.origin.height;

      if (interaction.corner.includes("e")) width = clamp(snapToGrid(point.x - interaction.origin.x, size), MIN_ROOM_SIZE, BOARD_WIDTH - interaction.origin.x);
      if (interaction.corner.includes("s")) height = clamp(snapToGrid(point.y - interaction.origin.y, size), MIN_ROOM_SIZE, BOARD_HEIGHT - interaction.origin.y);
      if (interaction.corner.includes("w")) { x = clamp(snapToGrid(point.x, size), 0, right - MIN_ROOM_SIZE); width = right - x; }
      if (interaction.corner.includes("n")) { y = clamp(snapToGrid(point.y, size), 0, bottom - MIN_ROOM_SIZE); height = bottom - y; }

      const candidate = { x, y, width, height };
      const valid = canPlaceRoom(candidate, roomsRef.current, interaction.roomId);
      interaction.candidate = candidate;
      interaction.valid = valid;
      updateRoomPreview(interaction.roomId, candidate, valid);
      showTransient(candidate, point, `${candidate.width}px x ${candidate.height}px`, valid ? "Resize the room" : "Resize would overlap another room", valid);
      return;
    }

    if (interaction.type === "device") {
      const room = roomsRef.current.find((item) => item.id === interaction.roomId);
      if (!room) return;
      const candidate = {
        xPct: clamp((point.x - room.x) / room.width, 0.16, 0.84),
        yPct: clamp((point.y - room.y) / room.height, 0.18, 0.84),
      };
      interaction.candidate = candidate;
      interaction.valid = true;
      updateDevicePreview(interaction.deviceId, candidate);
      if (badgeRef.current && badgeTitleRef.current && badgeNoteRef.current) {
        badgeRef.current.style.display = "grid";
        badgeRef.current.style.left = `${(point.x / BOARD_WIDTH) * 100}%`;
        badgeRef.current.style.top = `${(point.y / BOARD_HEIGHT) * 100}%`;
        badgeTitleRef.current.textContent = interaction.name;
        badgeNoteRef.current.textContent = `Room position ${Math.round(candidate.xPct * 100)}% x ${Math.round(candidate.yPct * 100)}%`;
      }
    }
  }

  useEffect(() => {
    function handlePointerMove(event) {
      if (!interactionRef.current) return;
      pendingPointRef.current = getBoardPoint(event);
      if (!rafRef.current) rafRef.current = window.requestAnimationFrame(flushInteraction);
    }

    function handlePointerUp() {
      if (!interactionRef.current) return;
      const interaction = interactionRef.current;
      const candidate = interaction.candidate;
      const valid = interaction.valid;

      if (interaction.type === "draw" && candidate && valid) {
        const baseName = roomTypeRef.current === "custom"
          ? customRoomNameRef.current || "Custom Room"
          : ROOM_LIBRARY.find((item) => item.key === roomTypeRef.current)?.label || "Room";
        const nextRoom = createRoom({
          type: roomTypeRef.current,
          name: ensureUniqueRoomName(baseName, roomsRef.current, null),
          x: candidate.x,
          y: candidate.y,
          width: candidate.width,
          height: candidate.height,
        });
        setRooms((current) => [...current, nextRoom]);
        setSelectedRoomId(nextRoom.id);
        setMessage(`${nextRoom.name} added to the blueprint.`);
      }

      if ((interaction.type === "move" || interaction.type === "resize") && interaction.origin) {
        if (candidate && valid) setRooms((current) => current.map((room) => (room.id === interaction.roomId ? { ...room, ...candidate } : room)));
        else updateRoomPreview(interaction.roomId, interaction.origin, true);
      }

      if (interaction.type === "device" && interaction.originPlacement) {
        if (candidate) setDevices((current) => current.map((device) => (device.deviceId === interaction.deviceId ? { ...device, ...candidate } : device)));
        else updateDevicePreview(interaction.deviceId, interaction.originPlacement);
      }

      interactionRef.current = null;
      pendingPointRef.current = null;
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      clearTransient();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  function handleBoardPointerDown(event) {
    if (loading || !boardRef.current) return;
    const point = getBoardPoint(event);
    if (!point) return;

    const resizeHandle = event.target.closest("[data-room-resize]");
    const moveHandle = event.target.closest("[data-room-handle='move']");
    const roomNode = event.target.closest("[data-room-id]");
    const deviceNode = event.target.closest("[data-setup-device-id]");

    if (step === 2 && deviceNode) {
      const device = devicesRef.current.find((item) => item.deviceId === deviceNode.dataset.setupDeviceId);
      if (!device) return;
      setSelectedRoomId(device.roomId);
      interactionRef.current = { type: "device", deviceId: device.deviceId, roomId: device.roomId, name: device.name, originPlacement: { xPct: device.xPct, yPct: device.yPct }, candidate: null, valid: true };
      event.preventDefault();
      return;
    }

    if (step === 1 && resizeHandle) {
      const room = roomsRef.current.find((item) => item.id === resizeHandle.dataset.roomResize);
      if (!room) return;
      setSelectedRoomId(room.id);
      interactionRef.current = { type: "resize", roomId: room.id, corner: resizeHandle.dataset.corner, start: point, origin: { x: room.x, y: room.y, width: room.width, height: room.height }, candidate: null, valid: true };
      event.preventDefault();
      return;
    }

    if (step === 1 && moveHandle) {
      const roomId = moveHandle.closest("[data-room-id]")?.dataset.roomId;
      const room = roomsRef.current.find((item) => item.id === roomId);
      if (!room) return;
      setSelectedRoomId(roomId);
      interactionRef.current = { type: "move", roomId, start: point, origin: { x: room.x, y: room.y, width: room.width, height: room.height }, candidate: null, valid: true };
      event.preventDefault();
      return;
    }

    if (roomNode) {
      setSelectedRoomId(roomNode.dataset.roomId);
      if (step !== 1) return;
    }

    if (step !== 1 || roomNode) return;
    interactionRef.current = { type: "draw", start: point, candidate: null, valid: false };
    event.preventDefault();
  }

  function goToStep(nextStep) {
    if (nextStep === 2 && !rooms.length) return setMessage("Please add at least one room first");
    if (nextStep === 3 && !devices.length) return setMessage("Please add devices before continuing");
    setMessage("");
    setStep(nextStep);
  }

  function handleAddDevice(roomId, type) {
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return setMessage("Please select a room first");
    const allowedDevices = getAllowedDeviceLibrary(room);
    const template = allowedDevices.find((item) => item.type === type);
    if (!template) return setMessage(`${room.name} does not support that device.`);
    const count = devices.filter((device) => device.roomId === roomId && device.type === type).length;
    const nextDevice = createDevice({ roomId: room.id, room: room.name, name: count ? `${template.name} ${count + 1}` : template.name, type: template.type, watts: template.watts, dailyHours: template.dailyHours, on: true }, devices.filter((device) => device.roomId === roomId).length);
    setDevices((current) => [...current, nextDevice]);
    setSelectedRoomId(roomId);
    setMessage(`${nextDevice.name} added to ${room.name}.`);
  }

  function handleRoomDrop(event, roomId) {
    event.preventDefault();
    const type = event.dataTransfer.getData("text/plain");
    if (type) handleAddDevice(roomId, type);
  }

  function handleRenameRoom(roomId, value) {
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;
    const name = ensureUniqueRoomName(value || room.name, rooms, roomId);
    setRooms((current) => current.map((item) => (item.id === roomId ? { ...item, name } : item)));
    setDevices((current) => current.map((item) => (item.roomId === roomId ? { ...item, room: name } : item)));
  }

  function handleRemoveRoom(roomId) {
    setRooms((current) => current.filter((room) => room.id !== roomId));
    setDevices((current) => current.filter((device) => device.roomId !== roomId));
    setMessage("Room removed from the blueprint.");
  }

  function handleClearLayout() {
    setRooms([]);
    setDevices([]);
    setSelectedRoomId(null);
    setStep(1);
    setMessage("Layout cleared.");
  }

  function handleRemoveDevice(deviceId) { setDevices((current) => current.filter((device) => device.deviceId !== deviceId)); }
  function handleToggleDevice(deviceId) { setDevices((current) => current.map((device) => (device.deviceId === deviceId ? { ...device, on: !device.on } : device))); }
  function handleDeviceWatts(deviceId, value) {
    const watts = Math.max(10, Number(value) || 0);
    setDevices((current) => current.map((device) => device.deviceId === deviceId ? { ...device, watts, highUsage: watts >= 1000 } : device));
  }

  async function handleSave() {
    if (!rooms.length) { setMessage("Please add at least one room first"); setStep(1); return; }
    setSaving(true);
    setError("");
    try {
      const finalMetrics = computeMetrics(devices, metrics, dailyLimit);
      const finalHistory = syncTodayHistory(dailyHistory, finalMetrics.todayUsage);
      setMetrics(finalMetrics);
      setDailyHistory(finalHistory);
      await api.saveLayout(session.token, { rooms: serializeRooms(rooms), appliances: serializeAppliances(devices), metrics: finalMetrics, dailyHistory: finalHistory, settings: { dailyLimit, darkMode: theme === "dark" }, setupCompleted: true });
      onSetupComplete({ settings: { dailyLimit, darkMode: theme === "dark" } });
      navigate("/dashboard", { replace: true });
    } catch (saveError) {
      setError(saveError.message || "Unable to save layout.");
    } finally {
      setSaving(false);
    }
  }

  const gridStyle = { "--grid-step-x": `${(gridSize / BOARD_WIDTH) * 100}%`, "--grid-step-y": `${(gridSize / BOARD_HEIGHT) * 100}%` };
  const selectedRoomDevices = devices.filter((device) => device.roomId === selectedRoomId);
  const availableDevices = selectedRoom ? getAllowedDeviceLibrary(selectedRoom) : [];

  return (
    <div className="setup-layout">
      <div className="setup-shell">
        <header className="panel setup-topbar">
          <div>
            <span className="section-tag">First-time setup</span>
            <h2>Build your smart house map</h2>
            <p>Create rooms, place appliances, and save a blueprint-style layout before opening the dashboard.</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>
            {session?.setupCompleted ? <button type="button" className="ghost-button" onClick={() => navigate("/dashboard")}>Dashboard</button> : null}
            <button type="button" className="ghost-button" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {message ? <div className="form-alert info inline">{message}</div> : null}
        {error ? <div className="form-alert error inline">{error}</div> : null}

        <div className="setup-step-row">
          {[1, 2, 3].map((item) => {
            const locked = (item === 2 && !rooms.length) || (item === 3 && !devices.length);
            const title = item === 1 ? "Draw rooms" : item === 2 ? "Place devices" : "Review";
            const note = item === 1 ? "Create a floor-plan layout." : item === 2 ? "Add appliances into rooms." : "Save and open the dashboard.";
            return (
              <button key={item} type="button" className={`step-chip clickable ${step === item ? "active" : ""} ${item < step ? "done" : ""} ${locked ? "locked" : ""}`} disabled={locked} onClick={() => goToStep(item)}>
                <strong>{item}. {title}</strong>
                <span>{note}</span>
              </button>
            );
          })}
        </div>

        <div className="setup-body">
          <article className="panel setup-canvas-card">
            <div className="panel-head">
              <div>
                <span className="section-tag">Blueprint canvas</span>
                <h3>{step === 1 ? "Architectural room builder" : step === 2 ? "Device placement canvas" : "Review the saved map"}</h3>
                <p>{getStepNote(step)}</p>
              </div>
            </div>
            <div className="grid-preset-row">
              {[10, 20, 40].map((size) => (
                <button key={size} type="button" className={`grid-preset-button ${gridSize === size ? "active" : ""}`} onClick={() => setGridSize(size)}>{size}px grid</button>
              ))}
            </div>
            <div className="blueprint-shell">
              <div ref={boardRef} className="blueprint-board builder" style={gridStyle} onPointerDown={handleBoardPointerDown}>
                <div className="blueprint-grid-meta"><strong>{BOARD_WIDTH}px x {BOARD_HEIGHT}px</strong><span>Snap-to-grid {gridSize}px</span></div>
                {!roomStats.length ? <div className="blueprint-empty"><article className="setup-inline-card selected"><strong>Start with your first room</strong><span>Choose a room type and drag across the grid to create your floor plan.</span></article></div> : null}
                {roomStats.map((room) => (
                  <article key={room.id} className={`floor-room ${selectedRoomId === room.id ? "selected" : ""} ${room.overloaded ? "overloaded" : ""}`} data-room-id={room.id} style={roomStyle(room)} onClick={() => setSelectedRoomId(room.id)} onDragOver={step === 2 ? (event) => event.preventDefault() : undefined} onDrop={step === 2 ? (event) => handleRoomDrop(event, room.id) : undefined}>
                    <div className="floor-room-title" data-room-handle="move"><strong>{room.name}</strong><span>{step === 1 ? `${room.width}px x ${room.height}px` : `${room.activeWatts}W active`}</span></div>
                    {room.overloaded ? <span className="floor-room-warning">!</span> : null}
                    {step === 1 ? <><button type="button" className="room-resize-handle nw" data-room-resize={room.id} data-corner="nw" /><button type="button" className="room-resize-handle ne" data-room-resize={room.id} data-corner="ne" /><button type="button" className="room-resize-handle sw" data-room-resize={room.id} data-corner="sw" /><button type="button" className="room-resize-handle se" data-room-resize={room.id} data-corner="se" /></> : null}
                    <div className="floor-room-devices">
                      {room.devices.map((device) => (
                        <button key={device.deviceId} type="button" className={`map-device ${device.on ? "on" : "off"} ${device.highUsage ? "high" : ""} ${step === 2 ? "setup-draggable" : ""}`} data-setup-device-id={step === 2 ? device.deviceId : undefined} style={deviceStyle(device)} onClick={(event) => { event.stopPropagation(); setSelectedRoomId(room.id); }}>
                          <span className="map-device-icon"><ApplianceIcon type={device.type} /></span>
                          <strong>{device.name}</strong>
                          <span className="device-watts">{device.watts}W</span>
                          <span className={`device-state ${device.on ? "on" : "off"}`}>{device.on ? "ON" : "OFF"}</span>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
                <article ref={previewRef} className="floor-room-preview" style={{ display: "none" }} />
                <div ref={badgeRef} className="setup-dimension-badge" style={{ display: "none" }}><strong ref={badgeTitleRef}>0px x 0px</strong><span ref={badgeNoteRef}>Release to save</span></div>
              </div>
            </div>
          </article>

          <aside className="panel setup-sidebar">
            {step === 1 ? (
              <div className="builder-stack">
                <div className="panel-head stacked"><div><span className="section-tag">Rooms</span><h3>Create the floor plan</h3><p>Select a room type, then drag across the blueprint to draw each room.</p></div></div>
                <div className="palette-grid">{ROOM_LIBRARY.map((item) => <button key={item.key} type="button" className={`room-type-button ${roomType === item.key ? "active" : ""}`} onClick={() => setRoomType(item.key)}>{item.label}</button>)}</div>
                {roomType === "custom" ? <label className="setup-field"><span>Custom room name</span><input value={customRoomName} onChange={(event) => setCustomRoomName(event.target.value)} maxLength={24} /></label> : null}
                <div className="builder-note">{getStepNote(step)}</div>
                <div className="room-line-list">{rooms.length ? rooms.map((room) => <button key={room.id} type="button" className={`room-line-item ${selectedRoomId === room.id ? "selected" : ""}`} onClick={() => setSelectedRoomId(room.id)}><strong>{room.name}</strong><span>{room.width}px x {room.height}px</span></button>) : <article className="setup-inline-card"><strong>No rooms yet</strong><span>Your custom floor plan will appear here after you draw on the grid.</span></article>}</div>
                {selectedRoom ? <label className="setup-field"><span>Rename selected room</span><input value={selectedRoom.name} onChange={(event) => handleRenameRoom(selectedRoom.id, event.target.value)} maxLength={24} /></label> : null}
                <div className="room-line-actions">{selectedRoom ? <button type="button" className="ghost-button" onClick={() => handleRemoveRoom(selectedRoom.id)}>Delete room</button> : null}<button type="button" className="ghost-button" onClick={handleClearLayout}>Clear layout</button></div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="builder-stack">
                <div className="panel-head stacked"><div><span className="section-tag">Devices</span><h3>Place appliances inside rooms</h3><p>Click a device to add it, then drag it within the selected room.</p></div></div>
                <div className="room-pill-grid">{rooms.map((room) => <button key={room.id} type="button" className={`room-pill ${selectedRoomId === room.id ? "active" : ""}`} onClick={() => setSelectedRoomId(room.id)}>{room.name}</button>)}</div>
                <div className="device-palette">{availableDevices.length ? availableDevices.map((device) => <button key={device.type} type="button" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", device.type)} onClick={() => handleAddDevice(selectedRoomId, device.type)}><span className="map-device-icon"><ApplianceIcon type={device.type} /></span><strong>{device.name}</strong><span>{device.watts}W default</span></button>) : <article className="setup-inline-card"><strong>No device options</strong><span>Select a room to see the devices allowed there.</span></article>}</div>
                <div className="builder-note">{selectedRoom ? `Selected room: ${selectedRoom.name}. Drag existing devices to reposition them.` : "Select a room to add devices."}</div>
                <div className="setup-device-list">{selectedRoomDevices.length ? selectedRoomDevices.map((device) => <article key={device.deviceId} className="setup-device-row"><strong>{device.name}</strong><span>{device.watts}W, {device.on ? "currently ON" : "currently OFF"}</span><div className="setup-inline-grid"><label className="inline-field"><span>Watts</span><input type="number" min="10" max="5000" value={device.watts} onChange={(event) => handleDeviceWatts(device.deviceId, event.target.value)} /></label><button type="button" className="ghost-button" onClick={() => handleToggleDevice(device.deviceId)}>{device.on ? "Turn OFF" : "Turn ON"}</button></div><button type="button" className="ghost-button" onClick={() => handleRemoveDevice(device.deviceId)}>Remove device</button></article>) : <article className="setup-inline-card"><strong>No devices in this room</strong><span>Add a device from the palette to begin controlling it.</span></article>}</div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="builder-stack">
                <div className="panel-head stacked"><div><span className="section-tag">Review</span><h3>Save your smart home layout</h3><p>Check the room blueprint, device counts, and usage assumptions before saving.</p></div></div>
                <div className="setup-summary-grid"><MetricCard label="Rooms" value={rooms.length} note="Saved on the house map" /><MetricCard label="Devices" value={devices.length} note="Placed across rooms" /><MetricCard label="Devices ON" value={devices.filter((device) => device.on).length} note="Realtime starting state" /><MetricCard label="Est. bill" value={formatCurrency(metrics.billEstimate)} note="Based on current device mix" /></div>
                <div className="room-line-list">{roomStats.map((room) => <article key={room.id} className="room-line-item"><strong>{room.name}</strong><span>{room.devices.length} devices, {room.activeWatts}W active load</span></article>)}</div>
                <label className="settings-control"><span>Daily usage limit</span><input type="range" min="10" max="60" value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} /><strong>{dailyLimit} kWh</strong></label>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="panel setup-actions"><div className="setup-hint"><strong>{step === 1 ? "Draw rooms" : step === 2 ? "Place devices" : "Review and save"}</strong><span>{getStepNote(step)}</span></div><div className="setup-action-row">{step > 1 ? <button type="button" className="ghost-button" onClick={() => goToStep(step - 1)}>Back</button> : null}{step === 1 ? <button type="button" className="primary-button" disabled={!rooms.length} onClick={() => goToStep(2)}>Place devices</button> : null}{step === 2 ? <button type="button" className="primary-button" disabled={!devices.length} onClick={() => goToStep(3)}>Review dashboard</button> : null}{step === 3 ? <button type="button" className="primary-button" disabled={saving || !rooms.length} onClick={handleSave}>{saving ? "Saving..." : session?.setupCompleted ? "Update dashboard" : "Save and open dashboard"}</button> : null}</div></div>
      </div>
    </div>
  );
}
