import path from "path";
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config/env";
import apiRouter from "./routes";
import { notFoundHandler } from "./middlewares/notFound.middleware";
import { errorHandler } from "./middlewares/error.middleware";

const app: Application = express();

// Security & Core Middlewares
app.use(helmet({ contentSecurityPolicy: false }));

// Strict CORS allowlist
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const allowed = config.corsOrigins;
      if (allowed.includes('*') || allowed.includes(origin)) {
        return callback(null, true);
      }

      // Allow localhost variants in development
      if (config.isDevelopment && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Chính sách CORS không cho phép truy cập từ nguồn gốc này'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Agent-Token', 'X-Organization-Id'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP Request Logger
if (config.isDevelopment) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Root Route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Main Backend API",
    healthCheck: `${config.apiPrefix}/health`,
  });
});

// API Routes
app.use(config.apiPrefix, apiRouter);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
export default app;
