const { Cron } = require("croner");

function isValidTimeZone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function computeNextRunAt(
  cronExpression,
  timezone = "UTC",
  fromDate = new Date(),
) {
  const job = new Cron(cronExpression, { timezone });
  return job.nextRun(fromDate);
}

module.exports = { isValidTimeZone , computeNextRunAt};
