const mongoose = require("mongoose");

const scheduleExecutionSchema = new mongoose.Schema(
  {
    scheduleId: { type: String, required: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jobId: { type: String, default: null, index: true },
    scheduledFor: { type: Date, required: true },
    triggeredAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["TRIGGERED", "COMPLETED", "FAILED", "SKIPPED"],
      default: "TRIGGERED",
    },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

scheduleExecutionSchema.index({ scheduleId: 1, triggeredAt: -1 });

module.exports = mongoose.model("ScheduleExecution", scheduleExecutionSchema);
