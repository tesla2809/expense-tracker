import { listExpensesByUser } from "../models/expenseStore.js";
import { isGoogleSheetsConfigured, exportExpensesToSheet, readSheetValues } from "../utils/googleSheets.js";
import { parseSheetValuesToPreview } from "../utils/importParser.js";

export const getSheetsStatus = (req, res) => {
  res.json({ configured: isGoogleSheetsConfigured() });
};

// Pushes every one of the user's expenses into a Google Sheet the user
// owns/shares with the service account. Full overwrite, not incremental —
// the Sheet always ends up mirroring exactly what's in the app. This is
// separate from the app's own database sheet (GOOGLE_SHEET_ID) — this is a
// "share/back up a copy to any Sheet you like" feature.
export const exportToSheet = async (req, res) => {
  const { sheetUrl } = req.body;
  if (!sheetUrl || !sheetUrl.trim()) {
    return res.status(400).json({ message: "Paste the Google Sheet's link or ID first" });
  }

  try {
    const expenses = (await listExpensesByUser(req.user.id)).sort((a, b) => new Date(a.date) - new Date(b.date));
    await exportExpensesToSheet(sheetUrl, expenses);
    res.json({ message: `Exported ${expenses.length} expense${expenses.length === 1 ? "" : "s"} to the Google Sheet`, count: expenses.length });
  } catch (error) {
    console.error("Error exporting to Google Sheet:", error.message);
    res.status(400).json({ message: error.message });
  }
};

// Reads a Google Sheet and returns preview rows — same shape the file-based
// import preview returns — so the frontend can reuse one review/commit UI
// regardless of whether the data came from a file or a live Sheet.
export const previewFromSheet = async (req, res) => {
  const { sheetUrl } = req.body;
  if (!sheetUrl || !sheetUrl.trim()) {
    return res.status(400).json({ message: "Paste the Google Sheet's link or ID first" });
  }

  try {
    const values = await readSheetValues(sheetUrl);
    const { rows, warnings, columnMapping } = parseSheetValuesToPreview(values);
    res.json({ rows, warnings, columnMapping, totalRows: rows.length });
  } catch (error) {
    console.error("Error importing from Google Sheet:", error.message);
    res.status(400).json({ message: error.message });
  }
};
