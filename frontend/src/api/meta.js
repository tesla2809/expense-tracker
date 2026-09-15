import { apiClient } from "./config";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_PAYMENT_MODES,
} from "../constants/categories";

// Fetches the canonical category/payment-mode lists from the backend.
// Falls back to the local defaults if the server can't be reached, so the
// forms still work offline / while the backend is starting up.
export const fetchCategories = async () => {
  try {
    const response = await apiClient.get("/meta/categories");
    return response.data;
  } catch (error) {
    console.error("Falling back to default categories:", error);
    return {
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
      incomeCategories: DEFAULT_INCOME_CATEGORIES,
      paymentModes: DEFAULT_PAYMENT_MODES,
    };
  }
};
