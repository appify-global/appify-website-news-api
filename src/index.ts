import express from "express";
import compression from "compression";
import cors from "cors";
import cron from "node-cron";
import { newsRouter } from "./routes/news";
import { adminRouter } from "./routes/admin";
import { generateArticles } from "./cron/generateArticles";
import { prisma } from "./lib/prisma";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.disable("x-powered-by");
app.use(compression());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://www.appify.global",
    "https://appify.global",
    "http://localhost:3000",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
app.use(express.json());

// API Key authentication for write endpoints
app.use("/api/news", (req, res, next) => {
  if (req.method === "GET") return next();

  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Routes
app.use("/api/news", newsRouter);
app.use("/api/admin", adminRouter);

// Health check with database connection test
app.get("/health", async (_req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      database: "connected"
    });
  } catch (error: any) {
    console.error("Health check failed - database error:", error);
    res.status(503).json({ 
      status: "error", 
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error?.message || "Database connection failed"
    });
  }
});

// Cron job: generate articles every hour
// More frequent checks ensure we catch new articles faster and maintain fresh content
if (process.env.ENABLE_CRON === "true") {
  cron.schedule("0 * * * *", async () => {
    console.log("[CRON] Starting article generation...");
    try {
      await generateArticles();
      console.log("[CRON] Article generation complete.");
    } catch (error) {
      console.error("[CRON] Article generation failed:", error);
    }
  });
  console.log("[CRON] Scheduled article generation every hour.");
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
