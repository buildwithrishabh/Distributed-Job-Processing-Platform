function withTimeout(asyncTaskFn, timeoutMs = 10000) {
  const controller = new AbortController();
  let timerId;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      // 1. In-flight HTTP / background task to physically abort
      controller.abort();

      const err = new Error(`Job Execution Timed Out after ${timeoutMs}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
  });

  // asyncTaskFn ko controller.signal pass karo
  const taskPromise = asyncTaskFn(controller.signal);

  // Attach silent catch to handle late abort rejections safely
  if (taskPromise && typeof taskPromise.catch === "function") {
    taskPromise.catch(() => {});
  }

  return Promise.race([taskPromise, timeoutPromise]).finally(() => {
    clearTimeout(timerId); // Memory leak prevention
  });
}

module.exports = {
  withTimeout,
};
