import mongoose from "mongoose";

const floorSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    id: String,
    floorId: String,
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
    floorId: String,
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
    floors: {
      type: [floorSchema],
      default: [
        { id: "floor-1", name: "Floor 1" },
        { id: "floor-2", name: "Floor 2" },
        { id: "floor-3", name: "Floor 3" },
      ],
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