import { apiClient } from "./config";

// Get user profile
export const getUserProfile = async () => {
  try {
    const response = await apiClient.get("/auth/profile");
    return response.data;
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};
