require("dotenv").config();
const { z } = require("zod");

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  MONGO_URI: z
    .string()
    .min(1)
    .default("mongodb://localhost:27017/job_platform"),

  REDIS_HOST: z.string().default("localhost"),

  REDIS_PORT: z.coerce.number().default(6379),

  REDIS_PASSWORD: z.string().optional().default(""),

  CLIENT_URL: z.string().optional().default("http://localhost:5173"),

  JWT_SECRET: z
    .string()
    .min(10, "JWT_SECRET must be at least 10 characters")
    .default("super_secret_jwt_key_change_in_production"),

  ACCESS_TOKEN_SECRET: z
    .string()
    .default("super_secret_access_token_key"),

  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),

  REFRESH_TOKEN_SECRET: z
    .string()
    .default("super_secret_refresh_token_key"),

  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),

  MAX_QUEUE_CAPACITY: z.coerce.number().positive().default(1000),

  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(10),

  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().positive().default(60),

  BREVO_API_KEY: z.string().optional().default(""),

  BREVO_SENDER_EMAIL: z.string().optional().default("noreply@example.com"),

  BREVO_SENDER_NAME: z.string().optional().default("Distributed Job Platform"),
});

const env = envSchema.parse(process.env);

module.exports = env;