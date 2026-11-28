const scheduleService = require("../services/scheduleService");

const createSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.createScheduleService({
      ...req.body,
      userId: req.user._id,
    });

    return res.status(201).json({ message: "Schedule created", schedule });
  } catch (error) {
    next(error);
  }
};

const getScheduleById = async (req, res, next) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await scheduleService.getScheduleByIdService(
      scheduleId,
      req.user._id,
    );

    if (!schedule) {
      return res.status(404).json({
        message: "Schedule not found",
      });
    }

    return res.status(200).json({
      message: "Schedule fetched successfully",
      schedule,
    });
  } catch (error) {
    next(error);
  }
};

const getSchedules = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const result = await scheduleService.getSchedulesService({
      userId: req.user._id,
      page,
      limit,
      status,
    });

    return res.status(200).json({
      message: "Schedules fetched successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getScheduleExecutions = async (req, res, next) => {
  try {
    const { scheduleId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await scheduleService.getScheduleExecutionsService({
      scheduleId,
      userId: req.user._id,
      page,
      limit,
    });

    if (!result) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    return res.status(200).json({
      message: "Schedule executions fetched successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const updateSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.updateScheduleService(
      req.params.scheduleId,
      req.user._id,
      req.body,
    );

    if (!schedule)
      return res.status(404).json({ message: "Schedule not found" });

    return res.status(200).json({ message: "Schedule updated", schedule });
  } catch (error) {
    next(error);
  }
};

const pauseSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.pauseScheduleService(
      req.params.scheduleId,
      req.user._id,
    );

    if (!schedule)
      return res.status(404).json({ message: "Schedule not found" });
    return res.status(200).json({ message: "Schedule paused", schedule });
  } catch (error) {
    next(error);
  }
};

const resumeSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.resumeScheduleService(
      req.params.scheduleId,
      req.user._id,
    );
    if (!schedule)
      return res.status(404).json({ message: "Schedule not found" });
    return res.status(200).json({ message: "Schedule resumed", schedule });
  } catch (error) {
    next(error);
  }
};

const cancelSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.cancelScheduleService(
      req.params.scheduleId,
      req.user._id,
    );
    if (!schedule)
      return res.status(404).json({ message: "Schedule not found" });
    return res.status(200).json({ message: "Schedule cancelled", schedule });
  } catch (error) {
    next(error);
  }
};

const deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.deleteScheduleService(
      req.params.scheduleId,
      req.user._id,
    );
    if (!schedule)
      return res.status(404).json({ message: "Schedule not found" });
    return res.status(200).json({ message: "Schedule deleted", schedule });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  getScheduleExecutions,
  updateSchedule,
  pauseSchedule,
  resumeSchedule,
  cancelSchedule,
  deleteSchedule,
};
