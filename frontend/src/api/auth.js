import { apiClient } from "./config";

/**
 * Log in a user
 * @param {Object} credentials - { email, password }
 * @returns {Promise} - Resolves to the logged-in user data
 */
export const loginUser = async (credentials) => {
  try {
    const response = await apiClient.post("/auth/login", credentials);
    return response.data;
  } catch (error) {
    console.error("Error logging in:", error);
    throw new Error(error.response?.data?.message || "Login failed.");
  }
};

/**
 * Sign up a new user
 * @param {Object} credentials - { name, email, password }
 * @returns {Promise} - Resolves to the registered user data
 */
export const signupUser = async (credentials) => {
  try {
    const response = await apiClient.post("/auth/register", credentials);
    return response.data;
  } catch (error) {
    console.error("Error signing up:", error);
    throw new Error(error.response?.data?.message || "Signup failed.");
  }
};
