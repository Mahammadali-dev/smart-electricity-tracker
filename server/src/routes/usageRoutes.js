import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { UsageProfile } from "../models/UsageProfile.js";
import { createBlankProfile, defaultSettingsForPlace, normalizePlaceType } from "../utils/placeAutoConfig.js";
import { simulateBatch, simulateDevice } from "../utils/simulator.js";

const router = express.Router();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function ensureFloorId(value) {
  return String(value || "floor-1").trim().toLowerCase() || "floor-1";
}

function createFallbackFloor(placeType = "home") {
  return createBlankProfile(placeType).floors[0] || { id: "floor-1", name: "Floor 1" };
}

function sanitizeFloors(floors = [], placeType = "home") {
  const fallback = Object.fromEntries([createFallbackFloor(placeType)].map((floor) => [floor.id, { ...floor }]));
  floors.forEach((floor) => {
    const floorId = ensureFloorId(floor?.id);
    fallback[floorId] = {
      id: floorId,
      name: String(floor?.name || fallback[floorId]?.name || `Floor ${floorId.replace(/[^0-9]/g, "") || 1}`).trim() || fallback[floorId]?.name || "Floor 1",
    };
  });

  return Object.values(fallback).sort((left, right) => {
    const leftNumber = Number(left.id.replace(/[^0-9]/g, "")) || 0;
    const rightNumber = Number(right.id.replace(/[^0-9]/g, "")) || 0;
    return leftNumber - rightNumber;
  });
}

function sanitizeRooms(rooms = []) {
  return rooms
    .map((item) => {
      const width = Number(item.width ?? item.w) || 0;
      const height = Number(item.height ?? item.h) || 0;
      return {
        id: String(item.id || ""),
        floorId: ensureFloorId(item.floorId),
        type: String(item.type || "custom"),
        name: String(item.name || "Room").trim() || "Room",
        x: Math.max(0, Number(item.x) || 0),
        y: Math.max(0, Number(item.y) || 0),
        width: Math.max(80, width),
        height: Math.max(80, height),
        threshold: Math.max(200, Number(item.threshold) || 1600),
      };
    })
    .filter((item) => item.id && item.width > 0 && item.height > 0);
}

function sanitizeAppliances(appliances = []) {
  return appliances
    .map((item) => ({
      deviceId: String(item.deviceId || ""),
      floorId: ensureFloorId(item.floorId),
      roomId: String(item.roomId || ""),
      room: String(item.room || ""),
      name: String(item.name || "Device").trim() || "Device",
      type: String(item.type || "device"),
      watts: Number(item.watts) || 0,
      dailyHours: Number(item.dailyHours) || 0,
      on: Boolean(item.on),
      highUsage: Boolean(item.highUsage),
      xPct: clamp(Number(item.xPct) || 0.5, 0.12, 0.88),
      yPct: clamp(Number(item.yPct) || 0.5, 0.12, 0.88),
    }))
    .filter((item) => item.deviceId);
}

function sanitizeHistory(history = []) {
  return history
    .map((item) => ({
      date: item.date,
      totalKwh: Number(item.totalKwh) || 0,
    }))
    .filter((item) => item.date)
    .slice(-31);
}

function sanitizeMetrics(metrics = {}, placeType = "home") {
  const base = createBlankProfile(placeType).latestMetrics;
  return {
    ...base,
    liveLoadKw: Number(metrics.liveLoadKw) || 0,
    todayUsage: Number(metrics.todayUsage) || 0,
    weeklyUsage: Number(metrics.weeklyUsage) || 0,
    monthlyUsage: Number(metrics.monthlyUsage) || 0,
    voltage: Number(metrics.voltage) || 0,
    current: Number(metrics.current) || 0,
    billEstimate: Number(metrics.billEstimate) || 0,
    lowVoltage: Boolean(metrics.lowVoltage),
    overLimit: Boolean(metrics.overLimit),
    peakHour: Boolean(metrics.peakHour),
    unusualSpike: Boolean(metrics.unusualSpike),
    simulationMode: String(metrics.simulationMode || base.simulationMode),
    lastSyncedAt: metrics.lastSyncedAt || new Date(),
    activeDevices: Number(metrics.activeDevices) || 0,
  };
}

function sanitizeSettings(settings = {}, fallbackPlaceType = "home") {
  const placeType = normalizePlaceType(settings.placeType || fallbackPlaceType);
  const fallback = defaultSettingsForPlace(placeType);
  return {
    dailyLimit: Number(settings.dailyLimit) || fallback.dailyLimit,
    darkMode: settings.darkMode !== false,
    placeType,
    gridSize: [10, 20, 40].includes(Number(settings.gridSize)) ? Number(settings.gridSize) : fallback.gridSize,
    simulationMode: String(settings.simulationMode || fallback.simulationMode),
  };
}

function defaultPayload(placeType = "home") {
  return createBlankProfile(placeType);
}

function parseBooleanQuery(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return value === true || value === "true" || value === 1 || value === "1";
}

router.post(["/simulator/batch", "/api/simulator/batch"], authenticateToken, async (req, res) => {
  try {
    const devices = sanitizeAppliances(req.body.devices || req.body.appliances || []);
    const placeType = normalizePlaceType(req.body.placeType || req.user.placeType);
    return res.json(simulateBatch(devices, placeType));
  } catch (error) {
    console.error("Simulator batch error", error);
    return res.status(500).json({ message: "Unable to stream simulator data." });
  }
});

router.get(["/simulator/:deviceType", "/api/simulator/:deviceType"], authenticateToken, async (req, res) => {
  try {
    const placeType = normalizePlaceType(req.query.placeType || req.user.placeType);
    const snapshot = simulateDevice(
      {
        deviceId: req.query.deviceId || `${req.params.deviceType}-sim`,
        type: req.params.deviceType,
        name: req.query.name || req.params.deviceType,
        roomId: req.query.roomId || "",
        floorId: req.query.floorId || "floor-1",
        watts: Number(req.query.watts) || 0,
        on: parseBooleanQuery(req.query.on, true),
      },
      placeType
    );

    return res.json({
      device: snapshot,
      summary: {
        totalPower: snapshot.power,
        liveLoadKw: Number((snapshot.power / 1000).toFixed(2)),
        totalCurrent: snapshot.current,
        averageVoltage: snapshot.voltage,
        activeDevices: snapshot.active ? 1 : 0,
        warningCount: snapshot.warning ? 1 : 0,
        lowVoltage: snapshot.lowVoltage,
        unusualSpike: snapshot.spike,
        thresholdWatts: simulateBatch([], placeType).summary.thresholdWatts,
        updatedAt: snapshot.updatedAt,
      },
    });
  } catch (error) {
    console.error("Simulator device error", error);
    return res.status(500).json({ message: "Unable to stream device simulator data." });
  }
});

router.post("/save-usage", authenticateToken, async (req, res) => {
  try {
    const settings = sanitizeSettings(req.body.settings, req.user.placeType);
    const rooms = sanitizeRooms(req.body.rooms);
    const appliances = sanitizeAppliances(req.body.appliances);

    const profile = await UsageProfile.findOneAndUpdate(
      { user: req.user.id },
      {
        $set: {
          floors: sanitizeFloors(req.body.floors, settings.placeType),
          latestMetrics: sanitizeMetrics(req.body.metrics, settings.placeType),
          appliances,
          rooms,
          dailyHistory: sanitizeHistory(req.body.dailyHistory),
          settings,
          setupCompleted: Boolean(req.body.setupCompleted) || rooms.length > 0,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json({ message: "Usage saved successfully.", profile });
  } catch (error) {
    console.error("Save usage error", error);
    return res.status(500).json({ message: "Unable to save usage data." });
  }
});

router.get("/usage-data", authenticateToken, async (req, res) => {
  try {
    const profile = await UsageProfile.findOne({ user: req.user.id });
    return res.json(profile || defaultPayload(req.user.placeType));
  } catch (error) {
    console.error("Usage data error", error);
    return res.status(500).json({ message: "Unable to load usage data." });
  }
});

router.post("/save-layout", authenticateToken, async (req, res) => {
  try {
    const settings = sanitizeSettings(req.body.settings, req.user.placeType);
    const rooms = sanitizeRooms(req.body.rooms);
    const appliances = sanitizeAppliances(req.body.appliances || req.body.devices);

    const profile = await UsageProfile.findOneAndUpdate(
      { user: req.user.id },
      {
        $set: {
          floors: sanitizeFloors(req.body.floors, settings.placeType),
          rooms,
          appliances,
          latestMetrics: sanitizeMetrics(req.body.metrics, settings.placeType),
          dailyHistory: sanitizeHistory(req.body.dailyHistory),
          settings,
          setupCompleted: rooms.length > 0,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json({
      message: "Layout saved successfully.",
      layout: {
        floors: profile.floors,
        rooms: profile.rooms,
        devices: profile.appliances,
        appliances: profile.appliances,
        setupCompleted: profile.setupCompleted,
      },
      profile,
    });
  } catch (error) {
    console.error("Save layout error", error);
    return res.status(500).json({ message: "Unable to save layout." });
  }
});

router.get("/get-layout", authenticateToken, async (req, res) => {
  try {
    const fallback = defaultPayload(req.user.placeType);
    const profile = await UsageProfile.findOne({ user: req.user.id });
    return res.json({
      floors: profile?.floors || fallback.floors,
      rooms: profile?.rooms || [],
      devices: profile?.appliances || [],
      appliances: profile?.appliances || [],
      setupCompleted: Boolean(profile?.setupCompleted),
      settings: profile?.settings || fallback.settings,
      metrics: profile?.latestMetrics || fallback.latestMetrics,
      dailyHistory: profile?.dailyHistory || [],
    });
  } catch (error) {
    console.error("Get layout error", error);
    return res.status(500).json({ message: "Unable to load layout." });
  }
});

export default router;

