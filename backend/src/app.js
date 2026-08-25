const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const dlqRoutes = require("./routes/dlqRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Security & Utility Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173", // Configure your client origin
    credentials: true, // Allow HTTP cookies across domains
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api", jobRoutes);
app.use("/api", dlqRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;