import express from "express";
import cors from "cors";
import cron from "node-cron";
import { newsRouter } from "./routes/news";
import { generateArticles } from "./cron/generateArticles";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
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

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Cron job: generate articles every 6 hours
if (process.env.ENABLE_CRON === "true") {
  cron.schedule("0 */6 * * *", async () => {
    console.log("[CRON] Starting article generation...");
    try {
      await generateArticles();
      console.log("[CRON] Article generation complete.");
    } catch (error) {
      console.error("[CRON] Article generation failed:", error);
    }
  });
  console.log("[CRON] Scheduled article generation every 6 hours.");
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
