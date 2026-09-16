import express from "express";
import {
  addExpense,
  getExpenses,
  getExpenseSummary,
  getMonthlyTrend,
  updateExpense,
  deleteExpense,
  bulkAddExpenses,
} from "../controllers/expenseController.js";
import protect from "../middleware/authMiddleware.js";
import { uploadBill } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getExpenses);
router.get("/summary", getExpenseSummary);
router.get("/monthly-trend", getMonthlyTrend);
router.post("/", uploadBill, addExpense);
router.post("/bulk", bulkAddExpenses);
router.put("/:id", uploadBill, updateExpense);
router.delete("/:id", deleteExpense);

export default router;
