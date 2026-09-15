import Expense from "../models/Expense.js";
import Income from "../models/Income.js";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_MODES } from "../constants/categories.js";
import { parseSheetToPreview } from "../utils/importParser.js";

// Step 1: upload a sheet, get back a preview (nothing is saved yet).
export const previewImport = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please choose a .csv, .xls or .xlsx file to upload" });
  }

  const defaultType = req.body.defaultType === "income" ? "income" : "expense";

  try {
    const { rows, warnings, columnMapping } = parseSheetToPreview(req.file.buffer, req.file.originalname, defaultType);
    res.json({ rows, warnings, columnMapping, totalRows: rows.length });
  } catch (error) {
    console.error("Error parsing import sheet:", error);
    res.status(400).json({ message: "Couldn't read that file. Make sure it's a valid .csv, .xls or .xlsx file." });
  }
};

// Step 2: the user has reviewed/edited the preview rows in the UI — save the
// ones they kept checked as real Expense/Income documents.
export const commitImport = async (req, res) => {
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "No rows to import" });
  }

  const expenseDocs = [];
  const incomeDocs = [];
  const skipped = [];

  rows.forEach((row, i) => {
    if (row.include === false) return;

    const amount = Number(row.amount);
    if (!row.amount || isNaN(amount) || amount <= 0) {
      skipped.push({ row: i + 1, reason: "Missing or invalid amount" });
      return;
    }

    const isIncome = row.entryType === "income";
    const categoryList = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const category = categoryList.includes(row.category) ? row.category : "Other";
    const customCategory = category === "Other" ? (row.customCategory || row.category || "Imported") : undefined;
    const paymentMode = PAYMENT_MODES.includes(row.paymentMode) ? row.paymentMode : "Cash";
    const date = row.date && !isNaN(new Date(row.date).getTime()) ? new Date(row.date) : new Date();

    const base = {
      user: req.user.id,
      amount,
      category,
      customCategory,
      party: row.party || undefined,
      paymentMode,
      date,
      notes: "Imported from spreadsheet",
    };

    if (isIncome) {
      incomeDocs.push({ ...base, source: row.source || row.title || "Imported income" });
    } else {
      expenseDocs.push({ ...base, title: row.title || row.source || "Imported expense" });
    }
  });

  try {
    const [savedExpenses, savedIncomes] = await Promise.all([
      expenseDocs.length ? Expense.insertMany(expenseDocs, { ordered: false }) : Promise.resolve([]),
      incomeDocs.length ? Income.insertMany(incomeDocs, { ordered: false }) : Promise.resolve([]),
    ]);

    res.status(201).json({
      expensesImported: savedExpenses.length,
      incomesImported: savedIncomes.length,
      skipped,
    });
  } catch (error) {
    console.error("Error committing import:", error);
    res.status(500).json({ message: "Some rows failed to save", error: error.message });
  }
};
