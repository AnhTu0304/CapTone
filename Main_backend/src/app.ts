import path from "path";
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config/env";
import apiRouter from "./routes";
import { notFoundHandler } from "./middlewares/notFound.middleware";
import { errorHandler } from "./middlewares/error.middleware";
import { ApiError } from "./utils/apiError";
import { redactSensitiveString } from "./utils/logSanitizer";
import { otelHttpMiddleware } from "./telemetry/metrics";

const app: Application = express();

// Trust exact proxy hop count (e.g. Edge Nginx) so req.ip reflects real client IP without allowing arbitrary X-Forwarded-For spoofing
app.set('trust proxy', config.trustProxyHops);

// Security & Core Middlewares (explicit CSP instead of disabled)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// Strict CORS allowlist (forbids wildcard '*' when credentials: true)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowed = config.corsOrigins.filter((o) => o !== '*');
      if (allowed.includes(origin)) {
        return callback(null, true);
      }

      // Allow localhost variants in development
      if (config.isDevelopment && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new ApiError(403, 'Chính sách CORS không cho phép truy cập từ nguồn gốc này'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Agent-Token', 'X-Organization-Id', 'X-CSRF-Token'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(otelHttpMiddleware);

// HTTP Request Logger (masks ?token=, ?secret=, etc. in URL paths)
morgan.token('sanitized-url', (req: express.Request) =>
  redactSensitiveString(req.originalUrl || req.url || '')
);
if (config.isDevelopment) {
  app.use(morgan(':method :sanitized-url :status :response-time ms'));
} else {
  app.use(
    morgan(':remote-addr - [:date[clf]] ":method :sanitized-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"')
  );
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
if (config.apiPrefix !== "/api") {
  app.use("/api", apiRouter);
}

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
export default app;
