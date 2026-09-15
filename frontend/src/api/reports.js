import { apiClient } from "./config";

const BASE_URL = "/reports";

// Last N months of income/expense/profit, for the dashboard trend chart.
export const fetchMonthlyTrend = async (months = 6) => {
  try {
    const response = await apiClient.get(`${BASE_URL}/monthly-trend`, { params: { months } });
    return response.data;
  } catch (error) {
    console.error("Error fetching monthly trend:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch the monthly trend.");
  }
};

// Every transaction still marked "Pending", sorted by due date.
export const fetchPendingPayments = async () => {
  try {
    const response = await apiClient.get(`${BASE_URL}/pending-payments`);
    return response.data;
  } catch (error) {
    console.error("Error fetching pending payments:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch pending payments.");
  }
};
