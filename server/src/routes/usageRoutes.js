import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { UsageProfile } from "../models/UsageProfile.js";

const router = express.Router();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeRooms(rooms = []) {
  return rooms
    .map((item) => {
      const width = Number(item.width ?? item.w) || 0;
      const height = Number(item.height ?? item.h) || 0;
      return {
        id: String(item.id || ""),
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

function sanitizeMetrics(metrics = {}) {
  return {
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
    lastSyncedAt: metrics.lastSyncedAt || new Date(),
  };
}

function sanitizeSettings(settings = {}) {
  return {
    dailyLimit: Number(settings.dailyLimit) || 28,
    darkMode: settings.darkMode !== false,
  };
}

function defaultPayload() {
  return {
    setupCompleted: false,
    rooms: [],
    latestMetrics: {
      liveLoadKw: 0,
      todayUsage: 0,
      weeklyUsage: 0,
      monthlyUsage: 0,
      voltage: 0,
      current: 0,
      billEstimate: 0,
      lowVoltage: false,
      overLimit: false,
      peakHour: false,
      lastSyncedAt: new Date(),
    },
    appliances: [],
    dailyHistory: [],
    settings: {
      dailyLimit: 28,
      darkMode: true,
    },
  };
}

router.post("/save-usage", authenticateToken, async (req, res) => {
  try {
    const profile = await UsageProfile.findOneAndUpdate(
      { user: req.user.id },
      {
        $set: {
          latestMetrics: sanitizeMetrics(req.body.metrics),
          appliances: sanitizeAppliances(req.body.appliances),
          rooms: sanitizeRooms(req.body.rooms),
          dailyHistory: sanitizeHistory(req.body.dailyHistory),
          settings: sanitizeSettings(req.body.settings),
          setupCompleted: Boolean(req.body.setupCompleted) || sanitizeRooms(req.body.rooms).length > 0,
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
    return res.json(profile || defaultPayload());
  } catch (error) {
    console.error("Usage data error", error);
    return res.status(500).json({ message: "Unable to load usage data." });
  }
});

router.post("/save-layout", authenticateToken, async (req, res) => {
  try {
    const rooms = sanitizeRooms(req.body.rooms);
    const appliances = sanitizeAppliances(req.body.appliances || req.body.devices);

    const profile = await UsageProfile.findOneAndUpdate(
      { user: req.user.id },
      {
        $set: {
          rooms,
          appliances,
          latestMetrics: sanitizeMetrics(req.body.metrics),
          dailyHistory: sanitizeHistory(req.body.dailyHistory),
          settings: sanitizeSettings(req.body.settings),
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
    const profile = await UsageProfile.findOne({ user: req.user.id });
    return res.json({
      rooms: profile?.rooms || [],
      devices: profile?.appliances || [],
      appliances: profile?.appliances || [],
      setupCompleted: Boolean(profile?.setupCompleted),
      settings: profile?.settings || { dailyLimit: 28, darkMode: true },
      metrics: profile?.latestMetrics || defaultPayload().latestMetrics,
      dailyHistory: profile?.dailyHistory || [],
    });
  } catch (error) {
    console.error("Get layout error", error);
    return res.status(500).json({ message: "Unable to load layout." });
  }
});

export default router;