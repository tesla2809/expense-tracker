import { apiClient } from "./config";

const BASE_URL = "/imports";

/**
 * Upload a spreadsheet (.csv, .xls or .xlsx) and get back a preview of the
 * rows it detected. Nothing is saved to the database at this step.
 *
 * @param {File} file
 * @param {"expense"|"income"} defaultType - what to label a row as when the
 *   sheet itself doesn't indicate income vs expense for that row
 */
export const previewImportSheet = async (file, defaultType = "expense") => {
  try {
    const formData = new FormData();
    formData.append("sheet", file);
    formData.append("defaultType", defaultType);
    // Do NOT set a Content-Type header manually here — the browser needs to
    // generate its own multipart boundary for a FormData body, and setting
    // "multipart/form-data" ourselves (without that boundary) breaks upload
    // parsing on the server. Axios sets the correct header automatically
    // when it sees a FormData instance, same as the expense/income uploads.
    const response = await apiClient.post(`${BASE_URL}/preview`, formData);
    return response.data;
  } catch (error) {
    console.error("Error previewing import:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message ||
        "Couldn't read that file. Please check it's a valid .csv, .xls or .xlsx file."
    );
  }
};

/**
 * Save the (possibly edited) preview rows as real Expense/Income entries.
 * A row with `include: false` is skipped, matching what the user unchecked
 * in the preview table.
 *
 * @param {Array<object>} rows
 */
export const commitImportRows = async (rows) => {
  try {
    const response = await apiClient.post(`${BASE_URL}/commit`, { rows });
    return response.data;
  } catch (error) {
    console.error("Error committing import:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to save the imported rows.");
  }
};
