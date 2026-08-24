const mongoose = require("mongoose");
const { JOB_STATUS, JOB_TYPES } = require("../config/constant");

const jobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(JOB_TYPES),
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.PENDING,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    priority: {
      type: Number,
      default: 0, // Higher numbers = higher priority in BullMQ
    },
    error: {
      message: { type: String },
      stack: { type: String },
      failedAt: { type: Date },
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null/undefined values while ensuring non-null keys are unique
      index: true,
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  },
);

// Compound Index for monitoring queries
jobSchema.index({ status: 1, createdAt: -1 });

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;
