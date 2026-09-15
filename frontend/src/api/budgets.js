import { apiClient } from "./config";

const BASE_URL = "/budgets";

export const fetchBudgets = async () => {
  try {
    const response = await apiClient.get(BASE_URL);
    return response.data;
  } catch (error) {
    console.error("Error fetching budgets:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to fetch budgets.");
  }
};

export const setBudget = async (category, monthlyLimit) => {
  try {
    const response = await apiClient.post(BASE_URL, { category, monthlyLimit });
    return response.data;
  } catch (error) {
    console.error("Error setting budget:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to set budget.");
  }
};

export const deleteBudget = async (id) => {
  try {
    const response = await apiClient.delete(`${BASE_URL}/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting budget:", error.response?.data || error);
    throw new Error(error.response?.data?.message || "Failed to delete budget.");
  }
};
