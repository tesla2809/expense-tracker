import { apiClient } from "./config";

const BASE_URL = "/sheets";

// Whether the server has Google Sheets sync configured at all (a service
// account key set) — lets the UI show a helpful message instead of a
// confusing error when it isn't.
export const fetchSheetsStatus = async () => {
  try {
    const response = await apiClient.get(`${BASE_URL}/status`);
    return response.data;
  } catch (error) {
    return { configured: false };
  }
};

// Pushes every expense to the given Google Sheet (full overwrite).
export const exportToGoogleSheet = async (sheetUrl) => {
  try {
    const response = await apiClient.post(`${BASE_URL}/export`, { sheetUrl });
    return response.data;
  } catch (error) {
    console.error("Error exporting to Google Sheet:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to export to Google Sheet.");
  }
};

// Reads a Google Sheet and returns a preview of the rows it detected —
// same shape as the file-upload import preview. Nothing is saved yet.
export const previewFromGoogleSheet = async (sheetUrl) => {
  try {
    const response = await apiClient.post(`${BASE_URL}/import-preview`, { sheetUrl });
    return response.data;
  } catch (error) {
    console.error("Error importing from Google Sheet:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to import from Google Sheet.");
  }
};
