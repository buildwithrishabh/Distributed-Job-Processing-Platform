function withTimeout(asyncFnPromise, timeoutMs = 10000) {
  let timerId;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Job Execution Timed Out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([asyncFnPromise, timeoutPromise]).finally(() => {
    clearTimeout(timerId); // Prevent Node.js timer memory leak
  });
}

module.exports = {
  withTimeout,
};