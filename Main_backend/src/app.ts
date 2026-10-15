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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP Request Logger
if (config.isDevelopment) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Static files (Dashboard UI)
app.use("/dashboard", express.static(path.join(__dirname, "../public")));

// Root Route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Main Backend API",
    dashboard: "/dashboard",
    healthCheck: `${config.apiPrefix}/health`,
  });
});

// API Routes
app.use(config.apiPrefix, apiRouter);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
