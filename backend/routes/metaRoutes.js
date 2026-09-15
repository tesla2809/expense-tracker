import express from "express";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_MODES, PAYMENT_STATUSES } from "../constants/categories.js";

const router = express.Router();

// Public: lets the frontend build category/payment-mode dropdowns from a single source of truth.
router.get("/categories", (req, res) => {
  res.json({
    expenseCategories: EXPENSE_CATEGORIES,
    incomeCategories: INCOME_CATEGORIES,
    paymentModes: PAYMENT_MODES,
    paymentStatuses: PAYMENT_STATUSES,
  });
});

export default router;
