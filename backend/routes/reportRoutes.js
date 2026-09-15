import express from "express";
import { getMonthlyTrend, getPendingPayments } from "../controllers/reportController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/monthly-trend", getMonthlyTrend);
router.get("/pending-payments", getPendingPayments);

export default router;
