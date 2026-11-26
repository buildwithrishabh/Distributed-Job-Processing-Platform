/**
 * Global Constants & Configuration Enums
 */
const JOB_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  DEAD: "DEAD",
  RETRYING: "RETRYING",
};

const JOB_TYPES = {
  EMAIL: "email",
};

const SCHEDULE_STATUS = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

const SCHEDULE_TYPES = {
  ONCE: "ONCE",
  RECURRING: "RECURRING",
};

const MISFIRE_POLICY = {
  SKIP: "SKIP", // Purane missed runs chhod do, agla future run set karo
  RUN_ONCE: "RUN_ONCE", // Missed hai toh abhi 1 baar chala do, phir future run set karo
};

module.exports = {
  JOB_STATUS,
  JOB_TYPES,
  SCHEDULE_STATUS,
  SCHEDULE_TYPES,
  MISFIRE_POLICY
};
