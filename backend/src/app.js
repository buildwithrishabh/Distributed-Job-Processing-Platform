const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const httpLogger = require("./middleware/httpLogger");
const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const dlqRoutes = require("./routes/dlqRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Trust reverse proxy (essential for Render, AWS, Cloudflare to get real client IP for rate limiting and cookies)
app.set("trust proxy", 1);

// Security & Utility Middlewares
app.use(helmet());

const clientUrls = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((u) => u.trim().replace(/\/$/, ""));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, "");
      if (clientUrls.includes(cleanOrigin) || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true, // Allow HTTP cookies across domains
  })
);


app.use(httpLogger);
app.use(express.json());
app.use(cookieParser());

// HTTP Request Metrics Middleware
const {
  register,
  httpRequestDuration,
  httpRequestTotal,
  updateDynamicGauges,
} = require("./utils/metrics");

app.use((req, res, next) => {
  if (req.path === "/metrics") return next();

  const start = process.hrtime();
  res.on("finish", () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;
    const route = req.baseUrl + (req.route?.path || req.path);

    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );
    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
  });
  next();
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api", dlqRoutes);
app.use("/api", jobRoutes);
app.use("/api", monitoringRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Prometheus Scrape Endpoint
app.get("/metrics", async (req, res) => {
  try {
    await updateDynamicGauges();
    res.setHeader("Content-Type", register.contentType);
    res.send(await register.metrics());
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;