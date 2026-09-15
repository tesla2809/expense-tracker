import express from "express";
import {
  addExpense,
  getExpenses,
  getExpenseSummary,
  updateExpense,
  deleteExpense,
} from "../controllers/expenseController.js";
import protect from "../middleware/authMiddleware.js";
import { uploadBill } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getExpenses);
router.get("/summary", getExpenseSummary);
router.post("/", uploadBill, addExpense);
router.put("/:id", uploadBill, updateExpense);
router.delete("/:id", deleteExpense);

export default router;
