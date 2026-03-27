import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    id: String,
    type: String,
    name: String,
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    threshold: Number,
  },
  { _id: false }
);

const applianceSchema = new mongoose.Schema(
  {
    deviceId: String,
    roomId: String,
    room: String,
    name: String,
    type: String,
    watts: Number,
    dailyHours: Number,
    on: Boolean,
    highUsage: Boolean,
    xPct: Number,
    yPct: Number,
  },
  { _id: false }
);

const historyEntrySchema = new mongoose.Schema(
  {
    date: String,
    totalKwh: Number,
  },
  { _id: false }
);

const metricsSchema = new mongoose.Schema(
  {
    liveLoadKw: { type: Number, default: 0 },
    todayUsage: { type: Number, default: 0 },
    weeklyUsage: { type: Number, default: 0 },
    monthlyUsage: { type: Number, default: 0 },
    voltage: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
    billEstimate: { type: Number, default: 0 },
    lowVoltage: { type: Boolean, default: false },
    overLimit: { type: Boolean, default: false },
    peakHour: { type: Boolean, default: false },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    dailyLimit: { type: Number, default: 28 },
    darkMode: { type: Boolean, default: true },
  },
  { _id: false }
);

const usageProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    setupCompleted: {
      type: Boolean,
      default: false,
    },
    rooms: {
      type: [roomSchema],
      default: [],
    },
    latestMetrics: {
      type: metricsSchema,
      default: () => ({}),
    },
    appliances: {
      type: [applianceSchema],
      default: [],
    },
    dailyHistory: {
      type: [historyEntrySchema],
      default: [],
    },
    settings: {
      type: settingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

export const UsageProfile = mongoose.model("UsageProfile", usageProfileSchema);