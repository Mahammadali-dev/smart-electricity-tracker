import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDatabase } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import usageRoutes from "./routes/usageRoutes.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const DEFAULT_CLIENT_ORIGIN = "http://localhost:5173";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../client/dist");
const clientEntryPath = path.join(clientDistPath, "index.html");
const hasClientBuild = fs.existsSync(clientEntryPath);

function parseAllowedOrigins() {
  const rawOrigins = process.env.CORS_ORIGIN || process.env.CLIENT_URL || DEFAULT_CLIENT_ORIGIN;
  return rawOrigins
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.status(200).send("Server running");
});

app.get("/health", (_req, res) => {
  res.status(200).send("Server running");
});

app.use(authRoutes);
app.use(usageRoutes);

if (hasClientBuild) {
  app.use(express.static(clientDistPath));
}

app.get("*", (req, res, next) => {
  if (
    req.path === "/" ||
    req.path.startsWith("/signup") ||
    req.path.startsWith("/login") ||
    req.path.startsWith("/user-data") ||
    req.path.startsWith("/save-usage") ||
    req.path.startsWith("/save-layout") ||
    req.path.startsWith("/get-layout") ||
    req.path.startsWith("/usage-data") ||
    req.path.startsWith("/health")
  ) {
    return next();
  }

  if (hasClientBuild) {
    return res.sendFile(clientEntryPath);
  }

  return res.status(200).json({
    message: "API is running. Build the client app to serve the frontend from Express.",
  });
});

app.use((error, _req, res, next) => {
  if (!error) {
    next();
    return;
  }

  if (error.message && error.message.startsWith("CORS blocked")) {
    res.status(403).json({ message: error.message });
    return;
  }

  console.error("Server error", error);
  res.status(500).json({ message: "Internal server error." });
});

connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect database", error);
    process.exit(1);
  });
