const mongoose = require("mongoose");

const {
  JOB_TYPES,
  SCHEDULE_STATUS,
  SCHEDULE_TYPES,
  MISFIRE_POLICY,
} = require("../config/constant");

const scheduleSchema = new mongoose.Schema(
  {
    scheduleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    jobType: {
      type: String,
      required: true,
      enum: Object.values(JOB_TYPES),
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },

    scheduleType: {
      type: String,
      required: true,
      enum: Object.values(SCHEDULE_TYPES),
    },
    runAt: { type: Date, default: null }, // for once
    cronExpression: { type: String, default: null },
    timezone: { type: String, default: "UTC" },

    status: {
      type: String,
      enum: Object.values(SCHEDULE_STATUS),
      default: SCHEDULE_STATUS.ACTIVE,
    },
    nextRunAt: { type: Date, default: null },
    lastRunAt: { type: Date, default: null },
    lastJobId: { type: String, default: null },
    runCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },

    misfirePolicy: {
      type: String,
      enum: Object.values(MISFIRE_POLICY),
      default: MISFIRE_POLICY.SKIP,
    },
  },
  { timestamps: true },
);

scheduleSchema.index({ status: 1, nextRunAt: 1 });
scheduleSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Schedule", scheduleSchema);
