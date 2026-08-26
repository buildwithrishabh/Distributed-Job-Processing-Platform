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

module.exports = {
  JOB_STATUS,
  JOB_TYPES,
};