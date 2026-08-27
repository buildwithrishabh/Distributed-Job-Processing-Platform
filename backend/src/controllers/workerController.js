const { getActiveWorker } = require("../utils/heartBeat");

const getWorkersStatus = async (req, res, next) => {
  try {
    const workers = await getActiveWorker();
    return res.status(200).json({
      success: true,
      count: workers.length,
      data: workers,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWorkersStatus };
