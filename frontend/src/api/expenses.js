import { apiClient } from "./config";

const BASE_URL = "/expenses";

// Builds multipart form data so an optional bill/invoice file can ride along
// with the rest of the fields in one request.
const toFormData = (expenseData) => {
  const formData = new FormData();
  Object.entries(expenseData).forEach(([key, value]) => {
    if (key === "bill" && value) {
      formData.append("bill", value);
    } else if (value !== undefined && value !== null && key !== "bill") {
      formData.append(key, value);
    }
  });
  return formData;
};

/**
 * Fetch all expenses for the logged-in user
 */
export const fetchExpenses = async () => {
  try {
    const response = await apiClient.get(BASE_URL);
    return response.data;
  } catch (error) {
    console.error("Error fetching expenses:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to fetch expenses.");
  }
};

/**
 * Category-wise expense totals
 */
export const fetchExpenseSummary = async () => {
  try {
    const response = await apiClient.get(`${BASE_URL}/summary`);
    return response.data;
  } catch (error) {
    console.error("Error fetching expense summary:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to fetch expense summary.");
  }
};

/**
 * Add a new expense. Pass a File under `bill` to attach an invoice/receipt.
 */
export const addExpense = async (expenseData) => {
  try {
    const response = await apiClient.post(BASE_URL, toFormData(expenseData));
    return response.data;
  } catch (error) {
    console.error("Error adding expense:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to add expense.");
  }
};

/**
 * Update an existing expense
 */
export const updateExpense = async (expenseId, expenseData) => {
  try {
    const response = await apiClient.put(`${BASE_URL}/${expenseId}`, toFormData(expenseData));
    return response.data;
  } catch (error) {
    console.error("Error updating expense:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to update expense.");
  }
};

/**
 * Delete an expense by ID
 */
export const deleteExpense = async (expenseId) => {
  try {
    const response = await apiClient.delete(`${BASE_URL}/${expenseId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting expense:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to delete expense.");
  }
};

/**
 * Last N months of expense totals, for the dashboard trend chart
 */
export const fetchMonthlyTrend = async (months = 6) => {
  try {
    const response = await apiClient.get(`${BASE_URL}/monthly-trend`, { params: { months } });
    return response.data;
  } catch (error) {
    console.error("Error fetching monthly trend:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to fetch the monthly trend.");
  }
};

/**
 * Save a batch of reviewed rows (from a file/Google Sheet import preview) as
 * real expense entries in one call. A row with `include: false` is skipped.
 */
export const bulkAddExpenses = async (rows) => {
  try {
    const response = await apiClient.post(`${BASE_URL}/bulk`, { rows });
    return response.data;
  } catch (error) {
    console.error("Error bulk-adding expenses:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to save the imported rows.");
  }
};
