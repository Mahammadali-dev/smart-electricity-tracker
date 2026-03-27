import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { UsageProfile } from "../models/UsageProfile.js";

const router = express.Router();

function sanitizeAppliances(appliances = []) {
  return appliances.map((item) => ({
    deviceId: item.deviceId,
    room: item.room,
    name: item.name,
    type: item.type,
    watts: Number(item.watts) || 0,
    on: Boolean(item.on),
    highUsage: Boolean(item.highUsage),
  }));
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

router.post("/save-usage", authenticateToken, async (req, res) => {
  try {
    const payload = {
      latestMetrics: sanitizeMetrics(req.body.metrics),
      appliances: sanitizeAppliances(req.body.appliances),
      dailyHistory: sanitizeHistory(req.body.dailyHistory),
      settings: {
        dailyLimit: Number(req.body.settings?.dailyLimit) || 28,
        darkMode: Boolean(req.body.settings?.darkMode),
      },
    };

    const profile = await UsageProfile.findOneAndUpdate(
      { user: req.user.id },
      { $set: payload },
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

    if (!profile) {
      return res.json({
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
      });
    }

    return res.json(profile);
  } catch (error) {
    console.error("Usage data error", error);
    return res.status(500).json({ message: "Unable to load usage data." });
  }
});

export default router;
