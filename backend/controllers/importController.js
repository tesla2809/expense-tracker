import { parseSheetToPreview } from "../utils/importParser.js";

// Upload a sheet, get back a preview (nothing is saved yet — committing
// happens via POST /api/expenses/bulk once the user has reviewed/edited
// the rows in the UI).
export const previewImport = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please choose a .csv, .xls or .xlsx file to upload" });
  }

  try {
    const { rows, warnings, columnMapping } = parseSheetToPreview(req.file.buffer, req.file.originalname);
    res.json({ rows, warnings, columnMapping, totalRows: rows.length });
  } catch (error) {
    console.error("Error parsing import sheet:", error);
    res.status(400).json({ message: "Couldn't read that file. Make sure it's a valid .csv, .xls or .xlsx file." });
  }
};
