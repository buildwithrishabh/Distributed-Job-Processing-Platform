const emailProcessor = require("./email.processor");
const { JOB_TYPES } = require("../config/constant");

// Map job types to processor functions
const processorRegistry = {
  [JOB_TYPES.EMAIL]: emailProcessor,
};

/**
 * Dispatch job payload to registered processor
 */
async function processJobDispatch(type, payload, bullJob) {
  const processor = processorRegistry[type];

  if (!processor) {
    throw new Error(`Unsupported job type: "${type}". No registered processor found.`);
  }

  return await processor(payload, bullJob);
}

module.exports = {
  processorRegistry,
  processJobDispatch,
};
