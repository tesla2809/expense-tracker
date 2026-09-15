import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import cron from "node-cron";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import incomeRoutes from "./routes/incomeRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import metaRoutes from "./routes/metaRoutes.js";
import importRoutes from "./routes/importRoutes.js";
import partyRoutes from "./routes/partyRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import recurringRoutes from "./routes/recurringRoutes.js";
import wageRoutes from "./routes/wageRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import cronRoutes from "./routes/cronRoutes.js";
import { UPLOADS_DIR } from "./middleware/uploadMiddleware.js";
import { runDailyTasks } from "./utils/dailyTasks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// Middleware
app.use(express.json()); // ✅ Ensure JSON parsing middleware is before routes
app.use(helmet({ crossOriginResourcePolicy: false })); // allow serving /uploads to the frontend origin

// Extra origins can be added via CORS_ORIGINS (comma-separated) in .env —
// useful once this is deployed somewhere other than localhost.
const extraAllowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Vite (and most dev servers) pick a different port automatically when the
// usual one is busy (5173 -> 5174 -> 5175 ...), so hard-coding one port
// breaks CORS the moment that happens. Instead, always allow any localhost/
// 127.0.0.1 origin regardless of port during local development.
const isLocalhostOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      // requests with no Origin header (curl, server-to-server, Postman) are always allowed
      if (!origin || isLocalhostOrigin(origin) || extraAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  })
);

// Serve uploaded bill/invoice files
app.use("/uploads", express.static(UPLOADS_DIR));

// API Routes
app.use("/api/auth", userRoutes);
app.use("/api/incomes", incomeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/imports", importRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/recurring", recurringRoutes);
app.use("/api/wages", wageRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/cron", cronRoutes);

// Root route — also reports whether MongoDB is actually connected, so a
// single visit to this URL in a browser tells you if the backend AND the
// database are both healthy (open http://localhost:3000 directly to check).
app.get("/", (req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  res.status(200).json({
    message: "Kushal Timbers Expense Tracker API is running...",
    database: dbStates[mongoose.connection.readyState] || "unknown",
  });
});

// Multer/file-upload errors land here instead of crashing the process
app.use((err, req, res, next) => {
  if (err) {
    console.error("Unhandled error:", err.message);
    return res.status(400).json({ message: err.message || "Something went wrong" });
  }
  next();
});

// Runs recurring transactions + payment reminder emails once a day. This
// only fires while the process is actually awake — on Render's free tier the
// service sleeps after 15 minutes idle, so this alone isn't reliable. For a
// guarantee, also ping POST /api/cron/run-daily (with an `x-cron-secret`
// header matching CRON_SECRET) from a free external scheduler like
// cron-job.org once a day — see backend/.env.example.
cron.schedule("0 3 * * *", () => {
  console.log("⏰ Running scheduled daily tasks (recurring transactions + payment reminders)...");
  runDailyTasks()
    .then((summary) => console.log("✅ Daily tasks complete:", summary))
    .catch((error) => console.error("❌ Daily tasks failed:", error.message));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
